"use server";

import { redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canAccessUnidade } from "@/lib/rbac";
import { buildCid10Filter, type Cid10Item } from "@/lib/medico/cid10";

/**
 * Busca incremental na tabela de referência Cid10 (read-only) para o combobox
 * de diagnóstico do prontuário. Arquivo separado de prontuario-actions.ts para
 * manter o diff das actions de escrita mínimo; o guard de sessão/RBAC espelha
 * exatamente o de salvarRascunhoAction. Falha aqui NUNCA bloqueia o
 * atendimento — o combobox cai no caminho de texto livre.
 */
export async function buscarCid10Action(q: string): Promise<Cid10Item[]> {
  const session = await auth();
  if (!session) redirect("/medico/login" as Route);
  if (!canAccessUnidade(session, "medico")) throw new Error("Sem permissão");

  const termo = q.trim();
  if (termo.length < 2) return [];

  return db.cid10.findMany({
    where: buildCid10Filter(termo),
    select: { codigo: true, descricao: true },
    orderBy: { codigo: "asc" },
    take: 12,
  });
}
