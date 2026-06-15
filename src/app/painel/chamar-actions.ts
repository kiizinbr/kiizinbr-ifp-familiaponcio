"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { canAccessUnidade, getUserUnits, podeChamar } from "@/lib/rbac";
import { unidadeFromSlug } from "@/lib/unidades";
import { logEvent } from "@/lib/audit";
import { criarChamada } from "@/lib/painel/chamada";
import { destinoFixoValido, nomeChamado as derivarNomeChamado } from "@/lib/painel/core";
import { db } from "@/lib/db";

/**
 * Chama um paciente no painel da TV. Disparada por <form action> nas telas de fila
 * (minha-fila, recepcao, triagem) com hidden inputs. Re-chamavel (nova linha por clique).
 */
export async function chamarAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session) throw new Error("Sem sessao");

  const unidade = String(formData.get("unidade") ?? "");
  if (!unidadeFromSlug(unidade)) throw new Error("Unidade invalida");
  // Roles cross-unit (social/super_admin) podem chamar em qualquer painel
  // (ex.: triagem social chama no painel do Centro Medico). Demais ficam na sua unidade.
  // presidencia passa o gate de unidade (read-only global) mas NAO chama: podeChamar a exclui.
  const acessoUnidade = getUserUnits(session) === "all" || canAccessUnidade(session, unidade);
  if (!acessoUnidade) throw new Error("Sem permissao");
  if (!podeChamar(session)) throw new Error("Sem permissao");

  const destino = String(formData.get("destino") ?? "").trim();
  if (!destino) throw new Error("Dados invalidos");

  const cidadaoId = formData.get("cidadaoId") ? String(formData.get("cidadaoId")) : null;
  const consultaId = formData.get("consultaId") ? String(formData.get("consultaId")) : null;

  // Nome anunciado: se ha cidadaoId, deriva no servidor (nomeSocial || nomeCompleto) e
  // IGNORA o hidden — fecha spoof de nome na TV publica. Sem cidadaoId, usa o hidden
  // (fallback p/ eventual chamada manual; destino segue blindado pela allowlist abaixo).
  let nome = String(formData.get("nomeChamado") ?? "").trim();
  if (cidadaoId) {
    const cidadao = await db.cidadao.findUnique({
      where: { id: cidadaoId },
      select: { nomeSocial: true, nomeCompleto: true },
    });
    if (!cidadao) throw new Error("Cidadao invalido");
    nome = derivarNomeChamado(cidadao);
  }
  if (!nome) throw new Error("Dados invalidos");

  // Allowlist server-side do destino: fixos (Recepcao/Triagem) ou profissional ativo
  // (nomeExibicao nao e @unique -> findFirst basta p/ checar existencia).
  let destinoOk = destinoFixoValido(destino);
  if (!destinoOk) {
    const prof = await db.profissional.findFirst({
      where: { ativo: true, nomeExibicao: destino },
      select: { id: true },
    });
    destinoOk = Boolean(prof);
  }
  if (!destinoOk) throw new Error("Destino invalido");

  const chamada = await criarChamada({
    unidade,
    nomeChamado: nome,
    destino,
    chamadoPor: session.user.id,
    cidadaoId,
    consultaId,
  });

  await logEvent({
    userId: session.user.id,
    action: "paciente_chamado",
    entityType: "chamada",
    entityId: chamada.id,
    rootEntityType: cidadaoId ? "cidadao" : undefined,
    rootEntityId: cidadaoId ?? undefined,
    meta: { unidade, destino },
  });

  // a TV pega via polling; revalida as telas de origem pra refletir feedback
  revalidatePath("/medico/minha-fila");
  revalidatePath("/medico/recepcao");
  revalidatePath("/social");
}
