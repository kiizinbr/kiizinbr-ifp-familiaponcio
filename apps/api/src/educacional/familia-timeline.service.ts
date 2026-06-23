import { ForbiddenException, Injectable } from "@nestjs/common";
import { AcaoAuditoria, SentidoCheck, StatusDiario } from "@ifp/database";

import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/current-user.decorator";

/**
 * Portal da família — LINHA DO TEMPO da criança.
 *
 * Jornada narrativa de UMA criança da própria família, cruzando, num só fio
 * cronológico, os eventos que JÁ existem nas verticais (matrículas de creche/
 * capacitação/esporte, presenças e check-in/out, diários fechados, certificados,
 * graduações e atendimentos selados). PURA AGREGAÇÃO de leitura — sem model novo.
 *
 * Ownership SEMPRE por `User.fichaCidadaId` (mesmo molde do FamiliaService):
 * nenhum endpoint aceita fichaId/membroId arbitrário do client sem antes
 * conferir que a criança é da própria família (IDOR → 403). Rotina/saúde de
 * menor é dado sensível: a leitura entra na trilha LGPD (audit READ).
 */

/** Categoria de evento — guia o ícone/cor na UI da timeline. */
export type TipoEventoTimeline =
  | "MATRICULA_CRECHE"
  | "MATRICULA_CAPACITACAO"
  | "MATRICULA_ESPORTE"
  | "DIARIO"
  | "ENTRADA"
  | "SAIDA"
  | "CERTIFICADO"
  | "GRADUACAO"
  | "ATENDIMENTO";

export interface EventoTimeline {
  id: string;
  tipo: TipoEventoTimeline;
  /** Instante do evento (ISO) — base da ordenação cronológica. */
  data: Date;
  titulo: string;
  descricao?: string | null;
  unidade?: string | null;
  /** Código público (certificado/graduação) para verificação/PDF, quando houver. */
  codigoVerificacao?: string | null;
}

@Injectable()
export class FamiliaTimelineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** O login do responsável → a ficha da família. Sem vínculo, 403. */
  private async resolverFichaId(user: AuthenticatedUser): Promise<string> {
    const registro = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { fichaCidadaId: true },
    });
    if (!registro?.fichaCidadaId) {
      throw new ForbiddenException(
        "Seu usuário não está vinculado a uma ficha de família — procure a secretaria.",
      );
    }
    return registro.fichaCidadaId;
  }

  /**
   * A criança é da família do usuário logado? Senão, 403 (IDOR). NÃO exige
   * matrícula ativa: a timeline é histórica e cobre crianças já desligadas.
   */
  private async assertCriancaDaFamilia(fichaId: string, membroId: string) {
    const crianca = await this.prisma.membroFamiliar.findFirst({
      where: { id: membroId, fichaId },
      select: { id: true, nomeCompleto: true, dataNascimento: true },
    });
    if (!crianca) {
      throw new ForbiddenException("Esta criança não pertence à sua família.");
    }
    return crianca;
  }

  /**
   * Monta a linha do tempo da criança: agrega os eventos das verticais e
   * devolve um array único ordenado do mais ANTIGO ao mais RECENTE. Cada
   * fonte é filtrada por `membroId` (a própria criança) — nunca cross-família.
   */
  async timeline(user: AuthenticatedUser, membroId: string) {
    const fichaId = await this.resolverFichaId(user);
    const crianca = await this.assertCriancaDaFamilia(fichaId, membroId);

    const [
      matriculasInfantis,
      matriculasCapacitacao,
      matriculasEsportivas,
      diarios,
      checks,
      certificados,
      graduacoes,
      atendimentos,
    ] = await Promise.all([
      // Matrícula na creche / educação infantil
      this.prisma.matriculaInfantil.findMany({
        where: { membroId, fichaId },
        select: {
          id: true,
          criadoEm: true,
          turma: { select: { nome: true } },
          unidade: { select: { nome: true } },
        },
      }),
      // Matrícula em cursos de capacitação (dependente)
      this.prisma.matricula.findMany({
        where: { membroId, fichaId },
        select: {
          id: true,
          criadoEm: true,
          turma: { select: { codigo: true, curso: { select: { nome: true } } } },
          unidade: { select: { nome: true } },
        },
      }),
      // Matrícula em modalidades esportivas (dependente)
      this.prisma.matriculaEsportiva.findMany({
        where: { membroId, fichaId },
        select: {
          id: true,
          criadoEm: true,
          turma: { select: { codigo: true, modalidade: { select: { nome: true } } } },
          unidade: { select: { nome: true } },
        },
      }),
      // Diários FECHADOS da creche (rotina de menor = dado sensível)
      this.prisma.diarioDia.findMany({
        where: { membroId, status: StatusDiario.FECHADO },
        select: {
          id: true,
          data: true,
          fechadoEm: true,
          unidade: { select: { nome: true } },
        },
      }),
      // Entradas e saídas da creche (segurança física)
      this.prisma.checkInOut.findMany({
        where: { membroId },
        select: {
          id: true,
          sentido: true,
          ocorridoEm: true,
          unidade: { select: { nome: true } },
          autorizado: { select: { nome: true, parentesco: true } },
        },
      }),
      // Certificados de capacitação (via matrícula da própria criança)
      this.prisma.certificado.findMany({
        where: { matricula: { membroId, fichaId } },
        select: {
          id: true,
          codigoVerificacao: true,
          emitidoEm: true,
          unidade: { select: { nome: true } },
          matricula: {
            select: { turma: { select: { curso: { select: { nome: true } } } } },
          },
        },
      }),
      // Graduações esportivas (via matrícula esportiva da própria criança)
      this.prisma.graduacao.findMany({
        where: { matricula: { membroId, fichaId } },
        select: {
          id: true,
          codigoVerificacao: true,
          nivel: true,
          concedidaEm: true,
          unidade: { select: { nome: true } },
          matricula: {
            select: { turma: { select: { modalidade: { select: { nome: true } } } } },
          },
        },
      }),
      // Atendimentos de saúde SELADOS (não expõe conteúdo clínico, só o marco)
      this.prisma.atendimento.findMany({
        where: { membroId, fichaId, encerradoEm: { not: null } },
        select: {
          id: true,
          encerradoEm: true,
          unidade: { select: { nome: true } },
        },
      }),
    ]);

    const eventos: EventoTimeline[] = [];

    for (const m of matriculasInfantis) {
      eventos.push({
        id: `mat-inf-${m.id}`,
        tipo: "MATRICULA_CRECHE",
        data: m.criadoEm,
        titulo: `Matriculada na creche — turma ${m.turma.nome}`,
        unidade: m.unidade.nome,
      });
    }
    for (const m of matriculasCapacitacao) {
      eventos.push({
        id: `mat-cap-${m.id}`,
        tipo: "MATRICULA_CAPACITACAO",
        data: m.criadoEm,
        titulo: `Matriculada no curso ${m.turma.curso.nome}`,
        descricao: `Turma ${m.turma.codigo}`,
        unidade: m.unidade.nome,
      });
    }
    for (const m of matriculasEsportivas) {
      eventos.push({
        id: `mat-esp-${m.id}`,
        tipo: "MATRICULA_ESPORTE",
        data: m.criadoEm,
        titulo: `Matriculada em ${m.turma.modalidade.nome}`,
        descricao: `Turma ${m.turma.codigo}`,
        unidade: m.unidade.nome,
      });
    }
    for (const d of diarios) {
      eventos.push({
        id: `diario-${d.id}`,
        // Selo do dia: usa fechadoEm como instante (cai no dia em que foi fechado).
        tipo: "DIARIO",
        data: d.fechadoEm ?? d.data,
        titulo: "Diário do dia disponível",
        descricao: "A creche fechou o diário desta criança.",
        unidade: d.unidade.nome,
      });
    }
    for (const c of checks) {
      const entrada = c.sentido === SentidoCheck.ENTRADA;
      const quem = c.autorizado
        ? `${c.autorizado.nome}${c.autorizado.parentesco ? ` (${c.autorizado.parentesco})` : ""}`
        : null;
      eventos.push({
        id: `check-${c.id}`,
        tipo: entrada ? "ENTRADA" : "SAIDA",
        data: c.ocorridoEm,
        titulo: entrada ? "Entrada na creche" : "Saída da creche",
        descricao: quem ? (entrada ? `Entregue por ${quem}` : `Retirada por ${quem}`) : null,
        unidade: c.unidade.nome,
      });
    }
    for (const c of certificados) {
      eventos.push({
        id: `cert-${c.id}`,
        tipo: "CERTIFICADO",
        data: c.emitidoEm,
        titulo: `Certificado: ${c.matricula.turma.curso.nome}`,
        unidade: c.unidade.nome,
        codigoVerificacao: c.codigoVerificacao,
      });
    }
    for (const g of graduacoes) {
      eventos.push({
        id: `grad-${g.id}`,
        tipo: "GRADUACAO",
        data: g.concedidaEm,
        titulo: `Graduação: ${g.nivel} em ${g.matricula.turma.modalidade.nome}`,
        unidade: g.unidade.nome,
        codigoVerificacao: g.codigoVerificacao,
      });
    }
    for (const a of atendimentos) {
      eventos.push({
        id: `atend-${a.id}`,
        tipo: "ATENDIMENTO",
        // encerradoEm é o selo; o where garante que não é null.
        data: a.encerradoEm as Date,
        titulo: "Atendimento de saúde realizado",
        descricao: "Consulta concluída no Centro Médico.",
        unidade: a.unidade.nome,
      });
    }

    // Ordem cronológica do mais ANTIGO ao mais RECENTE (a jornada lida de cima
    // pra baixo na UI). Desempate estável por id pra não "pular" a cada request.
    eventos.sort((a, b) => {
      const diff = a.data.getTime() - b.data.getTime();
      return diff !== 0 ? diff : a.id.localeCompare(b.id);
    });

    // Leitura agregada de dado sensível de menor — entra na trilha LGPD.
    this.audit.registrar({
      userId: user.id,
      acao: AcaoAuditoria.READ,
      entidade: "MembroFamiliar",
      entidadeId: membroId,
      metadados: { contexto: "familia.timeline", eventos: eventos.length },
    });

    return {
      crianca,
      total: eventos.length,
      eventos,
    };
  }
}
