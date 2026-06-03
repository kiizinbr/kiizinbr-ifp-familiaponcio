"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import type { StatusMatricula } from "@prisma/client";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/audit";
import {
  podeCriarTurma,
  podeGerenciarCurso,
  podeGerenciarInstrutor,
  podeMatricular,
  podeTransicionarMatricula as rbacPodeTransicionarMatricula,
} from "@/lib/capacitacao/rbac";
import {
  ListaEsperaVaziaError,
  matricular,
  MatriculaDuplicadaError,
  promoverDaListaEspera,
  transicionarMatricula,
  TurmaLotadaError,
} from "@/lib/capacitacao/matricula";

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
  const para = s(formData, "para") as StatusMatricula;
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
  } catch {
    redirect(`/capacitacao/turmas/${turmaId}?erro=transicao` as Route);
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
