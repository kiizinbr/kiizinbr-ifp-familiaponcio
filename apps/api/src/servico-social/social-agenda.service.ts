import { BadRequestException, Injectable } from "@nestjs/common";
import { AcaoAuditoria, StatusAgendamento, TipoUnidade } from "@ifp/database";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/current-user.decorator";

// O dia "de negócio" é o dia civil em São Paulo, independente do TZ do servidor
// (molde idêntico ao da agenda do Centro Médico). Sem fuso fixo, um agendamento
// das 23h "vazaria" para o dia seguinte conforme o relógio do container.
const TZ_NEGOCIO = "America/Sao_Paulo";
const OFFSET_SP = "-03:00";

/** Item já normalizado de qualquer unidade para a lista cronológica do dia. */
export interface ItemAgenda {
  id: string;
  tipo: "AGENDAMENTO" | "AULA" | "TREINO" | "EVENTO";
  inicioEm: string;
  titulo: string;
  detalhe: string | null;
  profissional: string | null;
  // Status só faz sentido para o agendamento médico; nas demais fica null.
  status: StatusAgendamento | null;
}

/** Bloco de uma unidade no dia: rótulo + contagem + itens cronológicos. */
export interface ColunaUnidade {
  tipo: TipoUnidade;
  nome: string;
  slug: string;
  total: number;
  itens: ItemAgenda[];
}

/**
 * Agenda transversal do Serviço Social: agrega, em um único dia, o que as 4
 * unidades JÁ têm marcado — agendamentos médicos, aulas da capacitação, treinos
 * do esportivo e eventos do educacional. NÃO cria agenda nova: só lê e cruza o
 * que existe. Toda leitura entra na trilha LGPD (vê nomes de profissionais e
 * conteúdo do dia). É READ-only e cross-unidade, como a Sala de Comando.
 */
@Injectable()
export class SocialAgendaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Janela [00:00, 24:00) do dia civil em São Paulo. */
  private janelaDoDia(data?: string) {
    const dia =
      data ??
      // en-CA formata como YYYY-MM-DD; o timeZone resolve "que dia é hoje" em SP.
      new Intl.DateTimeFormat("en-CA", { timeZone: TZ_NEGOCIO }).format(new Date());
    const inicio = new Date(`${dia}T00:00:00${OFFSET_SP}`);
    if (Number.isNaN(inicio.getTime())) {
      throw new BadRequestException("Data inválida — use o formato AAAA-MM-DD.");
    }
    const fim = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);
    return { inicio, fim, dia };
  }

  async doDia(user: AuthenticatedUser, data?: string) {
    const { inicio, fim, dia } = this.janelaDoDia(data);

    // As 4 unidades ativas (ordenadas por tipo para a UI ficar estável).
    const unidades = await this.prisma.unidade.findMany({
      where: { ativo: true },
      orderBy: { tipo: "asc" },
      select: { id: true, tipo: true, nome: true, slug: true },
    });
    const porTipo = new Map(unidades.map((u) => [u.tipo, u]));

    const colunas: ColunaUnidade[] = [];

    // --- Médico: agendamentos do dia (status real do atendimento) ---
    const medico = porTipo.get(TipoUnidade.MEDICO);
    if (medico) {
      const ags = await this.prisma.agendamento.findMany({
        where: { unidadeId: medico.id, inicioEm: { gte: inicio, lt: fim } },
        orderBy: { inicioEm: "asc" },
        select: {
          id: true,
          inicioEm: true,
          status: true,
          motivo: true,
          profissional: { select: { user: { select: { nome: true } } } },
        },
      });
      // Lê na ordem cronológica que veio do banco (linha do tempo do dia, não fila).
      colunas.push(
        this.montarColuna(
          medico,
          ags.map((a) => ({
            id: a.id,
            tipo: "AGENDAMENTO" as const,
            inicioEm: a.inicioEm.toISOString(),
            titulo: a.motivo ?? "Consulta",
            detalhe: null,
            profissional: a.profissional.user.nome,
            status: a.status,
          })),
        ),
      );
    }

    // --- Capacitação: aulas do dia (chamada) ---
    const capacitacao = porTipo.get(TipoUnidade.CAPACITACAO);
    if (capacitacao) {
      const aulas = await this.prisma.aula.findMany({
        where: { unidadeId: capacitacao.id, data: { gte: inicio, lt: fim } },
        orderBy: { data: "asc" },
        select: {
          id: true,
          data: true,
          conteudo: true,
          turma: { select: { codigo: true } },
          instrutor: { select: { user: { select: { nome: true } } } },
        },
      });
      colunas.push(
        this.montarColuna(
          capacitacao,
          aulas.map((a) => ({
            id: a.id,
            tipo: "AULA" as const,
            inicioEm: a.data.toISOString(),
            titulo: a.turma.codigo,
            detalhe: a.conteudo,
            profissional: a.instrutor.user.nome,
            status: null,
          })),
        ),
      );
    }

    // --- Esportivo: treinos do dia (chamada) ---
    const esportivo = porTipo.get(TipoUnidade.ESPORTIVO);
    if (esportivo) {
      const treinos = await this.prisma.treinoEsportivo.findMany({
        where: { unidadeId: esportivo.id, data: { gte: inicio, lt: fim } },
        orderBy: { data: "asc" },
        select: {
          id: true,
          data: true,
          conteudo: true,
          turma: { select: { codigo: true } },
          instrutor: { select: { user: { select: { nome: true } } } },
        },
      });
      colunas.push(
        this.montarColuna(
          esportivo,
          treinos.map((t) => ({
            id: t.id,
            tipo: "TREINO" as const,
            inicioEm: t.data.toISOString(),
            titulo: t.turma.codigo,
            detalhe: t.conteudo,
            profissional: t.instrutor.user.nome,
            status: null,
          })),
        ),
      );
    }

    // --- Educacional: eventos da unidade no dia ---
    const educacional = porTipo.get(TipoUnidade.EDUCACIONAL);
    if (educacional) {
      const eventos = await this.prisma.eventoUnidade.findMany({
        where: { unidadeId: educacional.id, inicioEm: { gte: inicio, lt: fim } },
        orderBy: { inicioEm: "asc" },
        select: { id: true, inicioEm: true, titulo: true, descricao: true, local: true },
      });
      colunas.push(
        this.montarColuna(
          educacional,
          eventos.map((e) => ({
            id: e.id,
            tipo: "EVENTO" as const,
            inicioEm: e.inicioEm.toISOString(),
            titulo: e.titulo,
            detalhe: e.local ?? e.descricao,
            profissional: null,
            status: null,
          })),
        ),
      );
    }

    const totalDoDia = colunas.reduce((acc, c) => acc + c.total, 0);
    const unidadesComAtividade = colunas.filter((c) => c.total > 0).length;

    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "SocialAgenda",
      entidadeId: dia,
      metadados: { contexto: "agenda-transversal", dia, totalDoDia },
    });

    return {
      data: dia,
      pulso: {
        totalDoDia,
        unidadesComAtividade,
        // Por tipo de atividade (ajuda o Serviço Social a ler o "pulso" do dia).
        agendamentos: this.somaPorTipo(colunas, "AGENDAMENTO"),
        aulas: this.somaPorTipo(colunas, "AULA"),
        treinos: this.somaPorTipo(colunas, "TREINO"),
        eventos: this.somaPorTipo(colunas, "EVENTO"),
      },
      unidades: colunas,
    };
  }

  private montarColuna(
    unidade: { tipo: TipoUnidade; nome: string; slug: string },
    itens: ItemAgenda[],
  ): ColunaUnidade {
    return { tipo: unidade.tipo, nome: unidade.nome, slug: unidade.slug, total: itens.length, itens };
  }

  private somaPorTipo(colunas: ColunaUnidade[], tipo: ItemAgenda["tipo"]): number {
    return colunas.reduce(
      (acc, c) => acc + c.itens.filter((i) => i.tipo === tipo).length,
      0,
    );
  }
}

export type AgendaTransversal = Awaited<ReturnType<SocialAgendaService["doDia"]>>;
