"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { canAccessUnidade, podeChamar } from "@/lib/rbac";
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
  if (!canAccessUnidade(session, unidade)) throw new Error("Sem permissao");
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
}
