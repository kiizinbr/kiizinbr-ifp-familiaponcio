import { db } from "@/lib/db";

export interface CriarChamadaInput {
  unidade: string;
  nomeChamado: string;
  destino: string;
  chamadoPor: string;
  cidadaoId?: string | null;
  consultaId?: string | null;
}

export interface ChamadaResumo {
  id: string;
  nomeChamado: string;
  destino: string;
  criadoEm: Date;
}

/** Grava o evento de chamada (event log; re-chamar = nova linha). */
export async function criarChamada(input: CriarChamadaInput): Promise<ChamadaResumo> {
  return db.chamada.create({
    data: {
      unidade: input.unidade,
      nomeChamado: input.nomeChamado,
      destino: input.destino,
      chamadoPor: input.chamadoPor,
      cidadaoId: input.cidadaoId ?? null,
      consultaId: input.consultaId ?? null,
    },
    select: { id: true, nomeChamado: true, destino: true, criadoEm: true },
  });
}

/**
 * Janela de retencao na exibicao: a TV nao mostra/fala nomes de chamadas antigas.
 * 24h cobre com folga um dia de atendimento (nao esconde chamada legitima ativa).
 * Indice @@index([unidade, criadoEm]) torna o filtro eficiente.
 */
export const JANELA_CHAMADA_MS = 1000 * 60 * 60 * 24;

/**
 * Query do polling: a mais recente = `atual`, as proximas = `recentes` (lista de
 * "ultimos chamados", sem repetir a atual). `limite` = total buscado (atual + recentes).
 * So considera chamadas dentro da janela de retencao (defesa de exibicao LGPD).
 */
export async function listarChamadas(
  unidade: string,
  limite = 5,
): Promise<{ atual: ChamadaResumo | null; recentes: ChamadaResumo[] }> {
  const desde = new Date(Date.now() - JANELA_CHAMADA_MS);
  const linhas = await db.chamada.findMany({
    where: { unidade, criadoEm: { gte: desde } },
    orderBy: { criadoEm: "desc" },
    take: limite,
    select: { id: true, nomeChamado: true, destino: true, criadoEm: true },
  });
  const [atual, ...recentes] = linhas;
  return { atual: atual ?? null, recentes };
}

/**
 * Purga (hard delete) das chamadas anteriores a `antesDe` — event log sem valor
 * historico de PII (a auditoria vive no AuditLog). Preparada para retencao real no
 * banco; o wiring de cron fica para janela supervisionada. Retorna a contagem removida.
 */
export async function purgarChamadasAntigas(antesDe: Date): Promise<number> {
  const { count } = await db.chamada.deleteMany({
    where: { criadoEm: { lt: antesDe } },
  });
  return count;
}
