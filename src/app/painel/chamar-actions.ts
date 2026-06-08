"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { canAccessUnidade, getUserUnits, podeChamar } from "@/lib/rbac";
import { unidadeFromSlug } from "@/lib/unidades";
import { logEvent } from "@/lib/audit";
import { criarChamada } from "@/lib/painel/chamada";

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

  const nomeChamado = String(formData.get("nomeChamado") ?? "").trim();
  const destino = String(formData.get("destino") ?? "").trim();
  if (!nomeChamado || !destino) throw new Error("Dados invalidos");

  const cidadaoId = formData.get("cidadaoId") ? String(formData.get("cidadaoId")) : null;
  const consultaId = formData.get("consultaId") ? String(formData.get("consultaId")) : null;

  const chamada = await criarChamada({
    unidade,
    nomeChamado,
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
