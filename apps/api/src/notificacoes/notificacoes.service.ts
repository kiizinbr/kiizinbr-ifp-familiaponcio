import { Injectable } from "@nestjs/common";
import {
  Perfil,
  StatusAgendamento,
  StatusDiario,
  StatusEncaminhamento,
  StatusEvento,
  StatusSinalizacao,
  StatusTriagem,
  TipoUnidade,
} from "@ifp/database";

import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/current-user.decorator";

/** Quantos avisos a lista devolve, no máximo (mais recentes primeiro). */
const LIMITE_ITENS = 20;
/** Janela do "agenda próxima" do profissional: agendamentos das próximas 24h. */
const JANELA_AGENDA_MS = 24 * 60 * 60 * 1000;
/**
 * Janela de "novidade" para eventos de storage (C4): documento na ficha e foto
 * no diário não têm recibo de leitura, então "novo" = recente (últimos 14 dias).
 * É a noção coerente com a agregação read-only: nada de coluna/estado novo, só
 * conta o que chegou na janela. Vencido o prazo, deixa de pesar no sino.
 */
const JANELA_STORAGE_MS = 14 * 24 * 60 * 60 * 1000;

/** Um aviso já no shape do payload (sem PII além do necessário pra navegar). */
export interface ItemNotificacao {
  id: string;
  tipo: string;
  titulo: string;
  descricao?: string;
  href: string;
  em?: string; // ISO
}

export interface RespostaNotificacoes {
  /** Total de pendências reais (pode ser > itens.length, que é só a janela exibida). */
  total: number;
  itens: ItemNotificacao[];
}

/**
 * Central de Avisos — AGREGA sinais reais já existentes no banco, por perfil do
 * usuário logado. É 100% read-only (nenhum model/coluna novo): cada aviso vem de
 * uma query real, respeitando RBAC + tenant (família por User.fichaCidadaId,
 * profissional pela própria unidade), sem vazar dado de outra unidade/família.
 *
 * Semântica de `total`: é o número de PENDÊNCIAS reais (somatório dos counts),
 * enquanto `itens` é só a janela das mais recentes (LIMITE_ITENS). Assim o
 * contador do sino é fiel mesmo quando há mais avisos do que a lista mostra.
 */
@Injectable()
export class NotificacoesService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(user: AuthenticatedUser): Promise<RespostaNotificacoes> {
    const perfis = new Set(user.perfis);
    const blocos: Array<{ total: number; itens: ItemNotificacao[] }> = [];

    // Serviço Social / admin (cross-unidade): fila de triagem, ponte e encaminhamentos.
    if (perfis.has(Perfil.SUPER_ADMIN) || perfis.has(Perfil.SERVICO_SOCIAL)) {
      blocos.push(await this.avisosServicoSocial());
    }

    // Família: comunicados/mensagens não lidos + eventos com RSVP pendente.
    if (perfis.has(Perfil.RESPONSAVEL_FAMILIAR)) {
      blocos.push(await this.avisosFamilia(user));
    }

    // Profissional: a própria agenda das próximas 24h (parede de unidade).
    if (perfis.has(Perfil.PROFISSIONAL)) {
      blocos.push(await this.avisosProfissional(user));
    }

    const total = blocos.reduce((s, b) => s + b.total, 0);
    const itens = blocos
      .flatMap((b) => b.itens)
      // Mais recentes primeiro; itens sem data ficam no fim.
      .sort((a, b) => (b.em ?? "").localeCompare(a.em ?? ""))
      .slice(0, LIMITE_ITENS);

    return { total, itens };
  }

  // ───────────────────────── Serviço Social ─────────────────────────

  /**
   * Avisos do Serviço Social. `total` = nº de pendências (triagens PENDENTE +
   * sinalizações ponte PENDENTE + encaminhamentos PENDENTE); `itens` traz uma
   * amostra recente de cada fonte para a lista do sino.
   */
  private async avisosServicoSocial() {
    const [
      triagensPend,
      sinalizacoesPend,
      encaminhamentosPend,
      triagens,
      sinalizacoes,
      encaminhamentos,
    ] = await this.prisma.$transaction([
      this.prisma.triagem.count({ where: { status: StatusTriagem.PENDENTE } }),
      this.prisma.sinalizacaoPonte.count({ where: { status: StatusSinalizacao.PENDENTE } }),
      this.prisma.encaminhamento.count({ where: { status: StatusEncaminhamento.PENDENTE } }),
      this.prisma.triagem.findMany({
        where: { status: StatusTriagem.PENDENTE },
        orderBy: { criadoEm: "desc" },
        take: LIMITE_ITENS,
        select: {
          id: true,
          prioridade: true,
          criadoEm: true,
          ficha: { select: { protocolo: true, nomeCompleto: true } },
        },
      }),
      this.prisma.sinalizacaoPonte.findMany({
        where: { status: StatusSinalizacao.PENDENTE },
        orderBy: { criadoEm: "desc" },
        take: LIMITE_ITENS,
        select: {
          id: true,
          tipo: true,
          prioridade: true,
          criadoEm: true,
          unidadeOrigem: { select: { nome: true } },
          ficha: { select: { nomeCompleto: true } },
        },
      }),
      this.prisma.encaminhamento.findMany({
        where: { status: StatusEncaminhamento.PENDENTE },
        orderBy: { criadoEm: "desc" },
        take: LIMITE_ITENS,
        select: {
          id: true,
          prioridade: true,
          criadoEm: true,
          unidadeDestino: { select: { nome: true } },
          ficha: { select: { nomeCompleto: true } },
        },
      }),
    ]);

    const itens: ItemNotificacao[] = [
      ...triagens.map((t) => ({
        id: `triagem:${t.id}`,
        tipo: "TRIAGEM",
        titulo: `Triagem na fila — ${t.ficha.nomeCompleto}`,
        descricao: `Protocolo ${t.ficha.protocolo} · prioridade ${t.prioridade}`,
        href: `/servico-social/triagem`,
        em: t.criadoEm.toISOString(),
      })),
      ...sinalizacoes.map((s) => ({
        id: `sinalizacao:${s.id}`,
        tipo: "SINALIZACAO_PONTE",
        titulo: `Sinalização da ${s.unidadeOrigem.nome}`,
        descricao: `${s.ficha.nomeCompleto} · ${s.tipo.toLowerCase()} (${s.prioridade.toLowerCase()})`,
        href: `/servico-social/ponte`,
        em: s.criadoEm.toISOString(),
      })),
      ...encaminhamentos.map((e) => ({
        id: `encaminhamento:${e.id}`,
        tipo: "ENCAMINHAMENTO",
        titulo: `Encaminhamento aguardando aceite — ${e.unidadeDestino.nome}`,
        descricao: `${e.ficha.nomeCompleto} · prioridade ${e.prioridade}`,
        href: `/servico-social/encaminhamentos`,
        em: e.criadoEm.toISOString(),
      })),
    ];

    return { total: triagensPend + sinalizacoesPend + encaminhamentosPend, itens };
  }

  // ───────────────────────────── Família ─────────────────────────────

  /**
   * Avisos do portal da família. Ownership por `User.fichaCidadaId` — nunca
   * aceita fichaId do client. `total` = comunicados não lidos + mensagens da
   * equipe não lidas + crianças com RSVP pendente em eventos futuros.
   */
  private async avisosFamilia(user: AuthenticatedUser) {
    const registro = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { fichaCidadaId: true },
    });
    // Sem vínculo de ficha, a família simplesmente não tem avisos (não é erro).
    if (!registro?.fichaCidadaId) return { total: 0, itens: [] as ItemNotificacao[] };
    const fichaId = registro.fichaCidadaId;

    // Escopo: unidades/turmas/crianças onde a família tem matrícula infantil ativa.
    const matriculas = await this.prisma.matriculaInfantil.findMany({
      where: { fichaId, ativa: true },
      select: { unidadeId: true, turmaId: true, membroId: true },
    });
    if (matriculas.length === 0) return { total: 0, itens: [] as ItemNotificacao[] };

    const unidadeIds = [...new Set(matriculas.map((m) => m.unidadeId))];
    const turmaIds = [...new Set(matriculas.map((m) => m.turmaId))];
    const membroIds = [...new Set(matriculas.map((m) => m.membroId))];

    const { dataDb: inicioHoje } = janelaInicioHojeSP();
    // Corte de "novidade" dos eventos de storage (C4): só conta o que chegou na
    // janela recente (sem recibo de leitura, é a noção de "novo" possível aqui).
    const corteStorage = new Date(Date.now() - JANELA_STORAGE_MS);

    const [comunicados, conversas, eventos, documentos, fotosDiario] =
      await this.prisma.$transaction([
      // Comunicados das unidades/turmas da família, ainda SEM leitura registrada.
      this.prisma.comunicado.findMany({
        where: {
          unidadeId: { in: unidadeIds },
          OR: [{ turmaId: null }, { turmaId: { in: turmaIds } }],
          leituras: { none: { fichaId } },
        },
        orderBy: { criadoEm: "desc" },
        take: LIMITE_ITENS,
        select: { id: true, titulo: true, critico: true, criadoEm: true },
      }),
      // Conversas com mensagens da EQUIPE ainda não lidas (recibo por mensagem).
      this.prisma.conversaFamilia.findMany({
        where: { fichaId, mensagens: { some: { ladoEquipe: true, lidaEm: null } } },
        orderBy: { atualizadoEm: "desc" },
        take: LIMITE_ITENS,
        select: {
          id: true,
          atualizadoEm: true,
          crianca: { select: { nomeCompleto: true } },
          _count: { select: { mensagens: { where: { ladoEquipe: true, lidaEm: null } } } },
        },
      }),
      // Eventos futuros que pedem RSVP nas unidades da família.
      this.prisma.eventoUnidade.findMany({
        where: {
          unidadeId: { in: unidadeIds },
          status: StatusEvento.AGENDADO,
          pedeConfirmacao: true,
          inicioEm: { gte: inicioHoje },
          OR: [{ turmaId: null }, { turmaId: { in: turmaIds } }],
        },
        orderBy: { inicioEm: "asc" },
        take: LIMITE_ITENS,
        select: {
          id: true,
          titulo: true,
          inicioEm: true,
          confirmacoes: { where: { fichaId }, select: { membroId: true } },
        },
      }),
      // Storage (C4): documentos recentes na PRÓPRIA ficha da família. Escopo por
      // `fichaId` (ownership por User.fichaCidadaId) — nunca aceita ficha do client.
      this.prisma.documento.findMany({
        where: { fichaId, enviadoEm: { gte: corteStorage } },
        orderBy: { enviadoEm: "desc" },
        take: LIMITE_ITENS,
        select: { id: true, nomeArquivo: true, enviadoEm: true },
      }),
      // Storage (C4): fotos novas no diário FECHADO (selo) das crianças da família.
      // O filtro por `membroId in membroIds` (só os filhos desta ficha) é a parede
      // de tenant: foto de criança de OUTRA família nunca entra. Diário ABERTO não
      // conta (mesma regra de visibilidade da galeria — só após o selo).
      this.prisma.fotoDiario.findMany({
        where: {
          criadoEm: { gte: corteStorage },
          diario: { membroId: { in: membroIds }, status: StatusDiario.FECHADO },
        },
        orderBy: { criadoEm: "desc" },
        take: LIMITE_ITENS,
        select: {
          id: true,
          criadoEm: true,
          diario: { select: { crianca: { select: { nomeCompleto: true } } } },
        },
      }),
    ]);

    // Eventos só viram aviso se ALGUMA criança da família ainda não respondeu.
    const eventosPendentes = eventos
      .map((ev) => ({
        ev,
        pendentes: membroIds.filter(
          (mid) => !ev.confirmacoes.some((c) => c.membroId === mid),
        ).length,
      }))
      .filter((x) => x.pendentes > 0);

    const itens: ItemNotificacao[] = [
      ...comunicados.map((c) => ({
        id: `comunicado:${c.id}`,
        tipo: "COMUNICADO",
        titulo: c.critico ? `Comunicado importante: ${c.titulo}` : `Comunicado: ${c.titulo}`,
        href: `/familia/comunicados`,
        em: c.criadoEm.toISOString(),
      })),
      ...conversas.map((c) => ({
        id: `conversa:${c.id}`,
        tipo: "MENSAGEM",
        titulo: `Mensagem nova — ${c.crianca.nomeCompleto}`,
        descricao: `${c._count.mensagens} mensagem(ns) não lida(s)`,
        href: `/familia/mensagens`,
        em: c.atualizadoEm.toISOString(),
      })),
      ...eventosPendentes.map(({ ev, pendentes }) => ({
        id: `evento:${ev.id}`,
        tipo: "EVENTO",
        titulo: `Confirmar presença: ${ev.titulo}`,
        descricao: `${pendentes} criança(s) sem resposta`,
        href: `/familia/agenda`,
        em: ev.inicioEm.toISOString(),
      })),
      // Novo documento na ficha (C4) → aviso no portal "O que a gente recebeu".
      ...documentos.map((d) => ({
        id: `documento:${d.id}`,
        tipo: "DOCUMENTO",
        titulo: `Novo documento: ${d.nomeArquivo}`,
        href: `/familia/recebido`,
        em: d.enviadoEm.toISOString(),
      })),
      // Nova foto no diário selado (C4) → aviso que leva à galeria do diário.
      ...fotosDiario.map((f) => ({
        id: `foto-diario:${f.id}`,
        tipo: "FOTO_DIARIO",
        titulo: `Nova foto no diário — ${f.diario.crianca.nomeCompleto}`,
        href: `/familia/diario`,
        em: f.criadoEm.toISOString(),
      })),
    ];

    const total =
      comunicados.length +
      conversas.length +
      eventosPendentes.length +
      documentos.length +
      fotosDiario.length;
    return { total, itens };
  }

  // ─────────────────────────── Profissional ──────────────────────────

  /**
   * Avisos do profissional: a própria agenda das próximas 24h. A unidade é
   * resolvida pelo cadastro de Profissional (parede de tenant) — só conta/lista
   * agendamentos da unidade dele. Profissional sem cadastro ativo não tem aviso.
   */
  private async avisosProfissional(user: AuthenticatedUser) {
    const profissional = await this.prisma.profissional.findUnique({
      where: { userId: user.id },
      select: { id: true, ativo: true, unidade: { select: { tipo: true } } },
    });
    // Agenda só faz sentido para o Centro Médico (modelo Agendamento é dele).
    if (
      !profissional?.ativo ||
      profissional.unidade.tipo !== TipoUnidade.MEDICO
    ) {
      return { total: 0, itens: [] as ItemNotificacao[] };
    }

    const agora = new Date();
    const limite = new Date(agora.getTime() + JANELA_AGENDA_MS);
    const whereAgenda = {
      profissionalId: profissional.id,
      inicioEm: { gte: agora, lte: limite },
      status: { in: [StatusAgendamento.AGENDADO, StatusAgendamento.CONFIRMADO] },
    };

    const [total, agendamentos] = await this.prisma.$transaction([
      this.prisma.agendamento.count({ where: whereAgenda }),
      this.prisma.agendamento.findMany({
        where: whereAgenda,
        orderBy: { inicioEm: "asc" },
        take: LIMITE_ITENS,
        select: {
          id: true,
          inicioEm: true,
          ficha: { select: { nomeCompleto: true } },
        },
      }),
    ]);

    const itens: ItemNotificacao[] = agendamentos.map((a) => ({
      id: `agendamento:${a.id}`,
      tipo: "AGENDAMENTO",
      titulo: `Consulta — ${a.ficha.nomeCompleto}`,
      href: `/medico/agenda`,
      em: a.inicioEm.toISOString(),
    }));

    return { total, itens };
  }
}

/**
 * Início do dia civil em São Paulo, como Date (igual ao molde do portal da
 * família): a janela de eventos é "de hoje em diante", sem trazer o passado.
 */
function janelaInicioHojeSP(): { dataDb: Date } {
  const dia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    new Date(),
  );
  return { dataDb: new Date(`${dia}T00:00:00.000Z`) };
}
