"use server";

import { redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { podeMarcarConsulta } from "@/lib/medico/rbac";
import { db } from "@/lib/db";

/** Mínimo de caracteres antes de disparar a busca — evita LIKE '%%' caro/ruidoso. */
const MIN_CHARS = 2;

/** Resultado enxuto da busca: só os campos já exibidos no card da recepção. */
export interface PacienteEncontrado {
  id: string;
  nomeCompleto: string;
  cpf: string | null;
  telefonePrincipal: string | null;
}

/**
 * #16 — Busca incremental de paciente da recepção (read-only). A QUERY e o RBAC
 * são IDÊNTICOS ao que o page.tsx já fazia inline; só muda o ponto de invocação
 * (de RSC para Server Action exposta), pra alimentar a digitação ao vivo.
 *
 * Como a action é uma superfície nova exposta ao cliente, os 3 guards de RBAC do
 * topo do recepcao/page.tsx são RE-APLICADOS aqui (defesa real, igual ao
 * buscarCid10Action) ANTES de qualquer leitura — sem permissão, retorna [] e não
 * vaza nada. Falha aqui NUNCA derruba a tela: o botão "Buscar" segue como reserva.
 */
export async function buscarPacientesAction(q: string): Promise<PacienteEncontrado[]> {
  const session = await auth();
  if (!session) redirect("/medico/login" as Route);
  if (!canAccessUnidade(session, "medico")) return [];
  if (!podeMarcarConsulta(session)) return [];

  const termo = q.trim();
  if (termo.length < MIN_CHARS) return [];

  // Mesma query da recepção (recepcao/page.tsx): deletedAt:null + OR
  // nome(insensitive)/telefone/cpf-por-dígitos, take:6, orderBy nomeCompleto asc.
  // cpf só entra quando há dígitos (senão `contains: ""` vira LIKE '%%').
  const digits = termo.replace(/\D/g, "");
  const matches = await db.cidadao.findMany({
    where: {
      deletedAt: null,
      OR: [
        { nomeCompleto: { contains: termo, mode: "insensitive" } },
        { telefonePrincipal: { contains: termo } },
        ...(digits ? [{ cpf: { contains: digits } }] : []),
      ],
    },
    select: { id: true, nomeCompleto: true, cpf: true, telefonePrincipal: true },
    take: 6,
    orderBy: { nomeCompleto: "asc" },
  });

  return matches;
}
