"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/audit";
import { buildCidadaoSearchFilter } from "@/lib/cidadao";
import {
  podeCriarTurma,
  podeGerenciarCurso,
  podeGerenciarInstrutor,
  podeMatricular,
  podeRegistrarPresenca,
  podeTransicionarMatricula as rbacPodeTransicionarMatricula,
} from "@/lib/capacitacao/rbac";
import {
  ListaEsperaVaziaError,
  matricular,
  MatriculaDuplicadaError,
  promoverDaListaEspera,
  TransicaoMatriculaInvalidaError,
  transicionarMatricula,
  TurmaLotadaError,
} from "@/lib/capacitacao/matricula";
import { podeTransicionarTurma } from "@/lib/capacitacao/turma";

function s(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}
function sOpt(formData: FormData, key: string): string | null {
  return s(formData, key) || null;
}
function num(formData: FormData, key: string, def: number): number {
  const v = Number(s(formData, key));
  return Number.isFinite(v) && v > 0 ? v : def;
}

/** Valida a transição vinda do form (antes era um cast cego `as StatusMatricula`). */
const statusMatriculaSchema = z.enum([
  "lista_espera",
  "inscrito",
  "confirmado",
  "cursando",
  "concluido",
  "reprovado",
  "desistente",
  "cancelado",
]);

const statusTurmaSchema = z.enum([
  "planejada",
  "inscricoes_abertas",
  "em_andamento",
  "concluida",
  "cancelada",
]);

export async function criarCursoAction(formData: FormData) {
  const session = await auth();
  if (!canAccessUnidade(session, "capacitacao")) throw new Error("Sem permissão");
  if (!podeGerenciarCurso(session)) throw new Error("Sem permissão");
  const curso = await db.curso.create({
    data: {
      nome: s(formData, "nome"),
      descricao: sOpt(formData, "descricao"),
      area: s(formData, "area"),
      cargaHorariaTotal: num(formData, "cargaHorariaTotal", 20),
      modalidade: s(formData, "modalidade") || "presencial",
      capacidadePadrao: num(formData, "capacidadePadrao", 20),
      createdById: session!.user.id,
    },
  });
  await logEvent({
    userId: session!.user.id,
    action: "curso_criado",
    entityType: "curso",
    entityId: curso.id,
    meta: { nome: curso.nome },
  });
  redirect("/capacitacao/cursos" as Route);
}

export async function criarTurmaAction(formData: FormData) {
  const session = await auth();
  if (!canAccessUnidade(session, "capacitacao")) throw new Error("Sem permissão");
  if (!podeCriarTurma(session)) throw new Error("Sem permissão");
  const cursoId = s(formData, "cursoId");
  const curso = await db.curso.findUniqueOrThrow({ where: { id: cursoId } });
  const turma = await db.turma.create({
    data: {
      cursoId,
      codigo: s(formData, "codigo"),
      dataInicio: new Date(s(formData, "dataInicio")),
      dataFim: new Date(s(formData, "dataFim")),
      local: sOpt(formData, "local"),
      capacidade: num(formData, "capacidade", curso.capacidadePadrao),
      instrutorId: sOpt(formData, "instrutorId"),
    },
  });
  await logEvent({
    userId: session!.user.id,
    action: "turma_criada",
    entityType: "turma",
    entityId: turma.id,
    meta: { codigo: turma.codigo },
  });
  redirect(`/capacitacao/turmas/${turma.id}` as Route);
}

export async function matricularAction(formData: FormData) {
  const session = await auth();
  if (!canAccessUnidade(session, "capacitacao")) throw new Error("Sem permissão");
  if (!podeMatricular(session)) throw new Error("Sem permissão");
  const turmaId = s(formData, "turmaId");
  const cidadaoId = s(formData, "cidadaoId");
  try {
    const m = await matricular({ turmaId, cidadaoId, createdBy: session!.user.id });
    await logEvent({
      userId: session!.user.id,
      action: "matricula_criada",
      entityType: "matricula",
      entityId: m.id,
      rootEntityType: "cidadao",
      rootEntityId: cidadaoId,
      meta: { turmaId, status: m.status },
    });
  } catch (e) {
    if (e instanceof MatriculaDuplicadaError) {
      redirect(`/capacitacao/turmas/${turmaId}?erro=duplicada` as Route);
    }
    throw e;
  }
  redirect(`/capacitacao/turmas/${turmaId}` as Route);
}

export async function transicionarMatriculaAction(formData: FormData) {
  const session = await auth();
  if (!canAccessUnidade(session, "capacitacao")) throw new Error("Sem permissão");
  const matriculaId = s(formData, "matriculaId");
  const turmaId = s(formData, "turmaId");
  const paraParsed = statusMatriculaSchema.safeParse(s(formData, "para"));
  if (!paraParsed.success) {
    redirect(`/capacitacao/turmas/${turmaId}?erro=transicao` as Route);
  }
  const para = paraParsed.data;
  const motivoSaida = sOpt(formData, "motivoSaida") ?? undefined;
  const m = await db.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
  if (!rbacPodeTransicionarMatricula(session, m.status, para)) throw new Error("Sem permissão");
  try {
    await transicionarMatricula(matriculaId, para, motivoSaida);
    await logEvent({
      userId: session!.user.id,
      action: "matricula_transicionada",
      entityType: "matricula",
      entityId: matriculaId,
      meta: { de: m.status, para },
    });
  } catch (e) {
    // Erro de domínio esperado → feedback na tela; o resto propaga (não silencia).
    if (e instanceof TransicaoMatriculaInvalidaError) {
      redirect(`/capacitacao/turmas/${turmaId}?erro=transicao` as Route);
    }
    throw e;
  }
  redirect(`/capacitacao/turmas/${turmaId}` as Route);
}

export async function promoverListaEsperaAction(formData: FormData) {
  const session = await auth();
  if (!canAccessUnidade(session, "capacitacao")) throw new Error("Sem permissão");
  if (!podeCriarTurma(session)) throw new Error("Sem permissão");
  const turmaId = s(formData, "turmaId");
  try {
    const m = await promoverDaListaEspera(turmaId);
    await logEvent({
      userId: session!.user.id,
      action: "lista_espera_promovida",
      entityType: "matricula",
      entityId: m.id,
      meta: { turmaId },
    });
  } catch (e) {
    if (e instanceof ListaEsperaVaziaError || e instanceof TurmaLotadaError) {
      redirect(`/capacitacao/turmas/${turmaId}?erro=promocao` as Route);
    }
    throw e;
  }
  redirect(`/capacitacao/turmas/${turmaId}` as Route);
}

export async function criarInstrutorAction(formData: FormData) {
  const session = await auth();
  if (!canAccessUnidade(session, "capacitacao")) throw new Error("Sem permissão");
  if (!podeGerenciarInstrutor(session)) throw new Error("Sem permissão");
  const inst = await db.instrutor.create({
    data: { nomeExibicao: s(formData, "nomeExibicao"), bio: sOpt(formData, "bio") },
  });
  await logEvent({
    userId: session!.user.id,
    action: "instrutor_criado",
    entityType: "instrutor",
    entityId: inst.id,
    meta: { nome: inst.nomeExibicao },
  });
  redirect("/capacitacao/instrutores" as Route);
}

export async function toggleCursoAtivoAction(formData: FormData) {
  const session = await auth();
  if (!canAccessUnidade(session, "capacitacao")) throw new Error("Sem permissão");
  if (!podeGerenciarCurso(session)) throw new Error("Sem permissão");
  const cursoId = s(formData, "cursoId");
  const curso = await db.curso.findUnique({ where: { id: cursoId } });
  if (!curso) redirect("/capacitacao/cursos" as Route);
  const ativo = !curso.ativo;
  await db.curso.update({ where: { id: cursoId }, data: { ativo } });
  await logEvent({
    userId: session!.user.id,
    action: ativo ? "curso_reativado" : "curso_desativado",
    entityType: "curso",
    entityId: cursoId,
    meta: { nome: curso.nome, ativo },
  });
  revalidatePath(`/capacitacao/cursos/${cursoId}`);
  revalidatePath("/capacitacao/cursos");
  redirect(`/capacitacao/cursos/${cursoId}` as Route);
}

/** Transição de status da turma (planejada→inscrições→em_andamento→concluída; +cancelada). */
export async function transicionarTurmaAction(formData: FormData) {
  const session = await auth();
  if (!canAccessUnidade(session, "capacitacao")) throw new Error("Sem permissão");
  if (!podeCriarTurma(session)) throw new Error("Sem permissão");

  const turmaId = s(formData, "turmaId");
  const paraParsed = statusTurmaSchema.safeParse(s(formData, "para"));
  if (!paraParsed.success) {
    redirect(`/capacitacao/turmas/${turmaId}?erro=status` as Route);
  }
  const para = paraParsed.data;

  const turma = await db.turma.findUniqueOrThrow({ where: { id: turmaId } });
  if (!podeTransicionarTurma(turma.status, para)) {
    redirect(`/capacitacao/turmas/${turmaId}?erro=status` as Route);
  }

  await db.turma.update({ where: { id: turmaId }, data: { status: para } });
  await logEvent({
    userId: session!.user.id,
    action: para === "cancelada" ? "turma_cancelada" : "turma_atualizada",
    entityType: "turma",
    entityId: turmaId,
    meta: { de: turma.status, para },
  });
  redirect(`/capacitacao/turmas/${turmaId}` as Route);
}

/**
 * Busca incremental de candidatos para matrícula (server-side). Substitui o <select>
 * de 300 — com 1064+ alunas, o select estático não serve. Reusa buildCidadaoSearchFilter
 * (índices trigram), exclui anonimizados e quem já está na turma. Máx. 20 resultados.
 */
export async function buscarCandidatosAction(
  turmaId: string,
  query: string,
): Promise<{ id: string; nome: string }[]> {
  const session = await auth();
  if (!canAccessUnidade(session, "capacitacao") || !podeMatricular(session)) return [];
  const q = query.trim();
  if (q.length < 2) return [];

  const matriculas = await db.matricula.findMany({
    where: { turmaId, status: { not: "cancelado" } },
    select: { cidadaoId: true },
  });
  const jaNaTurma = matriculas.map((m) => m.cidadaoId);

  const cidadaos = await db.cidadao.findMany({
    where: {
      deletedAt: null,
      anonimizadoEm: null,
      ...(jaNaTurma.length > 0 ? { id: { notIn: jaNaTurma } } : {}),
      ...buildCidadaoSearchFilter(q),
    },
    orderBy: { nomeCompleto: "asc" },
    take: 20,
    select: { id: true, nomeCompleto: true, nomeSocial: true },
  });
  return cidadaos.map((c) => ({
    id: c.id,
    nome: c.nomeSocial?.trim() ? c.nomeSocial : c.nomeCompleto,
  }));
}

/** Registra a presença do dia para a turma (upsert por matrícula+data; idempotente). */
export async function registrarPresencasAction(formData: FormData) {
  const session = await auth();
  if (!canAccessUnidade(session, "capacitacao")) throw new Error("Sem permissão");
  if (!podeRegistrarPresenca(session)) throw new Error("Sem permissão");

  const turmaId = s(formData, "turmaId");
  const dataStr = s(formData, "data");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
    redirect(`/capacitacao/turmas/${turmaId}?erro=presenca` as Route);
  }
  const data = new Date(dataStr);
  const roster = s(formData, "roster")
    .split(",")
    .filter((id) => id.length > 0);

  await db.$transaction(
    roster.map((matriculaId) =>
      db.presenca.upsert({
        where: { matriculaId_data: { matriculaId, data } },
        create: {
          matriculaId,
          data,
          presente: formData.has(`p_${matriculaId}`),
          registradoPor: session!.user.id,
        },
        update: { presente: formData.has(`p_${matriculaId}`) },
      }),
    ),
  );

  await logEvent({
    userId: session!.user.id,
    action: "presenca_registrada",
    entityType: "turma",
    entityId: turmaId,
    meta: { data: dataStr, alunos: roster.length },
  });
  redirect(`/capacitacao/turmas/${turmaId}?presenca=ok` as Route);
}
