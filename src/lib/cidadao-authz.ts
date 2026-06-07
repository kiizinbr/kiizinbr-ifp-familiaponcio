import type { Session } from "next-auth";
import { db } from "@/lib/db";
import { can, type RbacAction } from "@/lib/rbac";
import type { UnitScope } from "@/lib/rbac-types";

/**
 * Guards de autorização de OBJETO para cidadão (fecha IDOR multi-tenant).
 *
 * Server Actions recebem `cidadaoId` do FormData (cliente). O gate de papel
 * (ex: podeGerirConsentimento) NÃO confere a unidade do objeto — então é
 * preciso carregar o cidadão e validar o acesso à unidade dele aqui.
 */

export class CidadaoNaoEncontradoError extends Error {
  constructor(message = "Cidadão não encontrado") {
    super(message);
    this.name = "CidadaoNaoEncontradoError";
  }
}

export class SemAcessoCidadaoError extends Error {
  constructor(message = "Sem permissão para esta unidade") {
    super(message);
    this.name = "SemAcessoCidadaoError";
  }
}

/**
 * Carrega o cidadão e exige que a sessão possa `action` (view/edit/delete) a
 * ficha na unidade dele. Lança se o cidadão não existe ou se a unidade não é
 * acessível. Retorna o cidadão (id + unitIdOrigem) quando autorizado.
 */
export async function assertAcessoCidadao(
  session: Session | null,
  cidadaoId: string,
  action: RbacAction,
): Promise<{ id: string; unitIdOrigem: string }> {
  const cidadao = await db.cidadao.findUnique({
    where: { id: cidadaoId },
    select: { id: true, unitIdOrigem: true },
  });
  if (!cidadao) throw new CidadaoNaoEncontradoError();
  if (!can(session, action, "ficha_cidada", { unitScope: cidadao.unitIdOrigem as UnitScope })) {
    throw new SemAcessoCidadaoError();
  }
  return cidadao;
}
