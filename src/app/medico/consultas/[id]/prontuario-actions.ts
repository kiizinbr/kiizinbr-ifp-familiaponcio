"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/audit";
import { canAccessUnidade, hasAnyRole } from "@/lib/rbac";
import { podeAssinarNota, podeEditarNota } from "@/lib/medico/rbac";
import {
  adicionarAddendo,
  assinarNota,
  NotaAssinadaError,
  NotaNaoAssinadaError,
  salvarRascunho,
  TransicaoNotaInvalidaError,
  type DiagnosticoInput,
  type SinaisVitaisInput,
} from "@/lib/medico/prontuario";
import {
  canonicalizarDescricoes,
  DiagnosticosSchema,
  normalizarDiagnosticos,
} from "@/lib/medico/cid10";

function num(formData: FormData, key: string): number | null {
  const v = String(formData.get(key) ?? "").trim();
  if (!v) return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Salva (upsert) a evolução em rascunho enquanto a consulta está em atendimento. */
export async function salvarRascunhoAction(formData: FormData) {
  const session = await auth();
  if (!session) redirect("/medico/login" as Route);
  if (!canAccessUnidade(session, "medico")) throw new Error("Sem permissão");

  const consultaId = String(formData.get("consultaId"));
  const consulta = await db.consulta.findUniqueOrThrow({
    where: { id: consultaId },
    include: { profissional: true, notaEvolucao: true },
  });

  const statusNota = consulta.notaEvolucao?.status ?? "rascunho";
  if (!podeEditarNota(session, consulta.profissional.userId, statusNota)) {
    throw new Error("Sem permissão para editar esta nota");
  }

  const vitais: SinaisVitaisInput = {
    paSistolica: num(formData, "paSistolica"),
    paDiastolica: num(formData, "paDiastolica"),
    fcBpm: num(formData, "fcBpm"),
    frIrpm: num(formData, "frIrpm"),
    tempC: num(formData, "tempC"),
    pesoKg: num(formData, "pesoKg"),
    alturaCm: num(formData, "alturaCm"),
    spo2: num(formData, "spo2"),
  };
  const texto = String(formData.get("texto") ?? "").trim() || null;

  // CID-10 estruturado: o combobox envia o hidden `diagnosticosJson` (SEMPRE
  // presente — [] limpa a lista em salvarRascunho). Form antigo sem o hidden
  // (rascunho aberto durante o deploy) cai no caminho legado cidCodigo/cidDescricao.
  const raw = formData.get("diagnosticosJson");
  let diagnosticos: DiagnosticoInput[] | undefined;
  if (raw != null) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(String(raw));
    } catch {
      parsed = undefined; // JSON inválido → reprovado pelo schema abaixo
    }
    const valido = DiagnosticosSchema.safeParse(parsed);
    if (!valido.success) {
      redirect(`/medico/consultas/${consultaId}?erro=diagnosticos` as Route);
    }
    const normalizados = normalizarDiagnosticos(valido.data);
    // Anti-tampering híbrido: descrição canônica quando o código existe na
    // tabela Cid10; fora dela (ou tabela indisponível) mantém a enviada —
    // nunca bloqueia o atendimento.
    const codigos = normalizados.flatMap((d) => (d.codigoCid ? [d.codigoCid] : []));
    let oficiais = new Map<string, string>();
    if (codigos.length > 0) {
      try {
        const linhas = await db.cid10.findMany({
          where: { codigo: { in: codigos } },
          select: { codigo: true, descricao: true },
        });
        oficiais = new Map(linhas.map((c) => [c.codigo, c.descricao]));
      } catch {
        oficiais = new Map();
      }
    }
    diagnosticos = canonicalizarDescricoes(normalizados, oficiais);
  } else {
    const cidDescricao = String(formData.get("cidDescricao") ?? "").trim();
    const cidCodigo = String(formData.get("cidCodigo") ?? "").trim() || null;
    diagnosticos = cidDescricao
      ? [{ codigoCid: cidCodigo, descricao: cidDescricao, principal: true }]
      : undefined;
  }

  try {
    const nota = await salvarRascunho({
      consultaId,
      cidadaoId: consulta.cidadaoId,
      profissionalId: consulta.profissionalId,
      texto,
      vitais,
      diagnosticos,
    });
    await logEvent({
      userId: session.user.id,
      action: "prontuario_criado",
      entityType: "nota_evolucao",
      entityId: nota.id,
      rootEntityType: "cidadao",
      rootEntityId: consulta.cidadaoId,
      meta: { consultaId },
    });
  } catch (e) {
    if (e instanceof NotaAssinadaError) {
      redirect(`/medico/consultas/${consultaId}?erro=nota_assinada` as Route);
    }
    throw e;
  }
  revalidatePath(`/medico/consultas/${consultaId}` as Route);
}

/** Assina a nota (imutável) e conclui a consulta — ato pessoal do profissional dono. */
export async function assinarNotaAction(formData: FormData) {
  const session = await auth();
  if (!session) redirect("/medico/login" as Route);
  if (!canAccessUnidade(session, "medico")) throw new Error("Sem permissão");

  const consultaId = String(formData.get("consultaId"));
  const notaId = String(formData.get("notaId"));
  const consulta = await db.consulta.findUniqueOrThrow({
    where: { id: consultaId },
    include: { profissional: true },
  });
  if (!podeAssinarNota(session, consulta.profissional.userId)) {
    throw new Error("Sem permissão para assinar esta nota");
  }

  try {
    await assinarNota(notaId, session.user.id, consultaId);
    await logEvent({
      userId: session.user.id,
      action: "prontuario_assinado",
      entityType: "nota_evolucao",
      entityId: notaId,
      rootEntityType: "cidadao",
      rootEntityId: consulta.cidadaoId,
      meta: { consultaId },
    });
  } catch (e) {
    // Erro de domínio esperado (nota já assinada / transição inválida) → feedback
    // na tela; qualquer outro erro propaga em vez de virar um "erro=assinatura" mudo.
    if (e instanceof TransicaoNotaInvalidaError) {
      redirect(`/medico/consultas/${consultaId}?erro=assinatura` as Route);
    }
    throw e;
  }
  revalidatePath(`/medico/consultas/${consultaId}` as Route);
}

/** Adiciona um addendo append-only a uma nota já assinada. */
export async function adicionarAddendoAction(formData: FormData) {
  const session = await auth();
  if (!session) redirect("/medico/login" as Route);
  if (!canAccessUnidade(session, "medico")) throw new Error("Sem permissão");
  if (!hasAnyRole(session, "profissional")) {
    throw new Error("Apenas profissionais adicionam addendo");
  }

  const consultaId = String(formData.get("consultaId"));
  const notaId = String(formData.get("notaId"));
  const texto = String(formData.get("texto") ?? "").trim();
  if (!texto) redirect(`/medico/consultas/${consultaId}` as Route);

  const consulta = await db.consulta.findUniqueOrThrow({
    where: { id: consultaId },
    include: { profissional: true },
  });
  // Ownership: addendo é ato do profissional DONO da consulta — não de qualquer profissional@medico.
  if (!podeAssinarNota(session, consulta.profissional.userId)) {
    throw new Error("Sem permissão para addendar esta nota");
  }

  try {
    await adicionarAddendo(notaId, session.user.id, texto, consultaId);
    await logEvent({
      userId: session.user.id,
      action: "prontuario_addendo",
      entityType: "nota_evolucao",
      entityId: notaId,
      rootEntityType: "cidadao",
      rootEntityId: consulta.cidadaoId,
      meta: { consultaId },
    });
  } catch (e) {
    if (e instanceof NotaNaoAssinadaError) {
      redirect(`/medico/consultas/${consultaId}?erro=nao_assinada` as Route);
    }
    throw e;
  }
  revalidatePath(`/medico/consultas/${consultaId}` as Route);
}
