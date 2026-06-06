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
 * Query do polling: a mais recente = `atual`, as proximas = `recentes` (lista de
 * "ultimos chamados", sem repetir a atual). `limite` = total buscado (atual + recentes).
 */
export async function listarChamadas(
  unidade: string,
  limite = 5,
): Promise<{ atual: ChamadaResumo | null; recentes: ChamadaResumo[] }> {
  const linhas = await db.chamada.findMany({
    where: { unidade },
    orderBy: { criadoEm: "desc" },
    take: limite,
    select: { id: true, nomeChamado: true, destino: true, criadoEm: true },
  });
  const [atual, ...recentes] = linhas;
  return { atual: atual ?? null, recentes };
}
