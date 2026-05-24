"use server";

import { redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { cidadaoCreateSchema, type CidadaoCreateInput } from "@/lib/cidadao-schema";
import { hasAnyRole } from "@/lib/rbac";
import { logEvent } from "@/lib/audit";

export type CreateCidadaoResult =
  | { ok: true; id: string }
  | { ok: false; errors: Record<string, string[]>; message?: string };

/**
 * Server Action de criação de Ficha Cidadã.
 * - Valida payload com zod
 * - Checa RBAC (recepcao/profissional/gestor_unidade/gestor_geral/super_admin podem criar)
 * - Verifica CPF duplicado
 * - Cria Cidadao + endereços em uma transaction
 * - Loga evento de auditoria
 */
export async function createCidadaoAction(input: CidadaoCreateInput): Promise<CreateCidadaoResult> {
  const session = await auth();
  if (!session) return { ok: false, errors: {}, message: "Sessão expirada" };

  const allowed = hasAnyRole(
    session,
    "super_admin",
    "gestor_geral",
    "gestor_unidade",
    "profissional",
    "recepcao",
  );
  if (!allowed) {
    return { ok: false, errors: {}, message: "Sem permissão para criar Ficha" };
  }

  const parsed = cidadaoCreateSchema.safeParse(input);
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      errors[key] = errors[key] ?? [];
      errors[key].push(issue.message);
    }
    return { ok: false, errors };
  }

  const data = parsed.data;

  // CPF duplicado
  const existing = await db.cidadao.findUnique({ where: { cpf: data.cpf } });
  if (existing) {
    return {
      ok: false,
      errors: { cpf: ["CPF já cadastrado em outra Ficha."] },
      message: `CPF já está em uso por "${existing.nomeCompleto}".`,
    };
  }

  const cidadao = await db.cidadao.create({
    data: {
      nomeCompleto: data.nomeCompleto,
      cpf: data.cpf,
      dataNascimento: new Date(data.dataNascimento),
      telefonePrincipal: data.telefonePrincipal,
      nomeSocial: data.nomeSocial,
      rg: data.rg,
      documentoAlternativo: data.documentoAlternativo,
      genero: data.genero,
      corRaca: data.corRaca,
      estadoCivil: data.estadoCivil,
      nacionalidade: data.nacionalidade,
      naturalidade: data.naturalidade,
      nomeMae: data.nomeMae,
      nomePai: data.nomePai,
      escolaAtual: data.escolaAtual,
      telefoneSecundario: data.telefoneSecundario,
      email: data.email,
      whatsappConsente: data.whatsappConsente,
      rendaFamiliar: data.rendaFamiliar,
      pessoasNaCasa: data.pessoasNaCasa,
      beneficioSocial: data.beneficioSocial,
      escolaridade: data.escolaridade,
      trabalha: data.trabalha,
      trabalhoDescricao: data.trabalhoDescricao,
      tipoSanguineo: data.tipoSanguineo,
      alergias: data.alergias,
      medicamentosEmUso: data.medicamentosEmUso,
      condicoesCronicas: data.condicoesCronicas,
      unitIdOrigem: data.unitIdOrigem,
      createdById: session.user.id,
      familiaId: data.familiaId,
      ...(data.enderecos.length > 0 && {
        enderecos: { create: data.enderecos },
      }),
    },
  });

  await logEvent({
    userId: session.user.id,
    action: "ficha_created",
    entityType: "cidadao",
    entityId: cidadao.id,
    rootEntityType: "cidadao",
    rootEntityId: cidadao.id,
    meta: { nomeCompleto: cidadao.nomeCompleto, unitIdOrigem: cidadao.unitIdOrigem },
  });

  return { ok: true, id: cidadao.id };
}

/** Helper Server Action — chama action acima e redireciona pra detalhe se sucesso. */
export async function createCidadaoAndRedirect(input: CidadaoCreateInput) {
  const result = await createCidadaoAction(input);
  if (result.ok) {
    redirect(`/app/cidadaos/${result.id}` as Route);
  }
  return result;
}
