"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
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

  let destino = String(formData.get("destino") ?? "").trim();
  if (!destino) throw new Error("Dados invalidos");

  // cidadaoId e obrigatorio: o nome anunciado na TV publica e SEMPRE derivado dele no
  // servidor (nomeSocial || nomeCompleto), nunca do hidden — fecha o spoof de nome.
  // Todas as telas de fila (recepcao, minha-fila, agenda-dia, social) ja enviam cidadaoId.
  const cidadaoId = formData.get("cidadaoId") ? String(formData.get("cidadaoId")) : null;
  if (!cidadaoId) throw new Error("Dados invalidos");
  const consultaId = formData.get("consultaId") ? String(formData.get("consultaId")) : null;

  // `voltar`: retorno opcional com ack para o operador (board/recepcao/minha-fila).
  // B11 anti open-redirect (mesmo guard do checkin-action): so path interno —
  // comeca com `/` e NAO com `//` nem `/\`. Ausente/externo => sem redirect
  // (preserva o comportamento atual de revalidate-only do social).
  const voltarRaw = String(formData.get("voltar") || "");
  const voltar = /^\/(?![/\\])/.test(voltarRaw) ? voltarRaw : null;

  const cidadao = await db.cidadao.findUnique({
    where: { id: cidadaoId },
    select: { nomeSocial: true, nomeCompleto: true },
  });
  if (!cidadao) throw new Error("Cidadao invalido");
  const nome = derivarNomeChamado(cidadao);
  if (!nome) throw new Error("Dados invalidos");

  // Se ha consultaId (link de auditoria), valida que existe E pertence a este cidadao
  // — assim o link gravado na Chamada nao e forjavel, e o nome do profissional fica
  // disponivel pra derivar o destino abaixo.
  const consulta = consultaId
    ? await db.consulta.findUnique({
        where: { id: consultaId },
        select: { cidadaoId: true, profissional: { select: { nomeExibicao: true } } },
      })
    : null;
  if (consultaId && (!consulta || consulta.cidadaoId !== cidadaoId)) {
    throw new Error("Dados invalidos");
  }

  // Allowlist server-side do destino. Fixos (Recepcao/Triagem) passam direto.
  if (!destinoFixoValido(destino)) {
    // Destino profissional: deriva do servidor a partir da consulta validada acima.
    // Usa o profissional REAL da consulta (nao um nome casado por texto) — imune a
    // spoof e a homonimo — e NAO exige ativo:true, entao chamar paciente de
    // profissional desativado/em reativacao com consulta ainda na fila continua
    // funcionando (regressao evitada).
    if (!consulta) throw new Error("Destino invalido");
    destino = consulta.profissional.nomeExibicao;
  }

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
    rootEntityType: "cidadao",
    rootEntityId: cidadaoId,
    meta: { unidade, destino },
  });

  // a TV pega via polling; revalida as telas de origem pra refletir feedback
  revalidatePath("/medico/minha-fila");
  revalidatePath("/medico/recepcao");
  revalidatePath("/medico/agenda-dia");
  revalidatePath("/social");

  // Ack de retorno: so quando um `voltar` interno valido veio no form (board,
  // recepcao, minha-fila). Passa apenas o PRIMEIRO nome + hora (LGPD: searchParams
  // ficam no historico do navegador, entao nada de nome completo). O destino
  // re-renderiza e ve a Chamada recem-criada -> Chamar vira Rechamar.
  if (voltar) {
    const primeiroNome = nome.split(/\s+/)[0] ?? nome;
    const hora = chamada.criadoEm.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const sep = voltar.includes("?") ? "&" : "?";
    const params = new URLSearchParams({ chamado: primeiroNome, chamadoHora: hora });
    redirect(`${voltar}${sep}${params.toString()}` as Route);
  }
}
