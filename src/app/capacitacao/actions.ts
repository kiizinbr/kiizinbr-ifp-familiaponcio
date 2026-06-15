"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { canAccessUnidade } from "@/lib/rbac";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/audit";
import { matriculasDaTurma } from "@/lib/capacitacao/presenca-scope";
import { buildCidadaoSearchFilter } from "@/lib/cidadao";
import {
  podeCriarTurma,
  podeEmitirCertificado,
  podeGerenciarCurso,
  podeGerenciarInstrutor,
  podeMatricular,
  podeRegistrarPresencaNaTurma,
  podeTransicionarMatricula as rbacPodeTransicionarMatricula,
} from "@/lib/capacitacao/rbac";
import {
  ListaEsperaVaziaError,
  matricular,
  MatriculaDuplicadaError,
  promoverDaListaEspera,
  STATUS_OCUPA_VAGA,
  TransicaoMatriculaInvalidaError,
  transicionarMatricula,
  TurmaLotadaError,
} from "@/lib/capacitacao/matricula";
import { podeTransicionarTurma } from "@/lib/capacitacao/turma";
import { avaliarElegibilidade } from "@/lib/capacitacao/certificado";
import { randomBytes } from "node:crypto";

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
  // Inclui o instrutor da turma: o ramo `profissional` do RBAC exige o userId do
  // dono da turma (sem ele a capability do instrutor fica morta). instrutor é
  // opcional no schema → `?.userId ?? undefined`.
  const m = await db.matricula.findUniqueOrThrow({
    where: { id: matriculaId },
    include: { turma: { select: { instrutor: { select: { userId: true } } } } },
  });
  if (
    !rbacPodeTransicionarMatricula(session, m.status, para, m.turma.instrutor?.userId ?? undefined)
  )
    throw new Error("Sem permissão");
  // Detecta liberação de vaga ANTES da transição (F2/F3): saiu de ocupa-vaga.
  const vagaLiberada = STATUS_OCUPA_VAGA.has(m.status) && !STATUS_OCUPA_VAGA.has(para);
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
  // NUDGE (não auto-promoção): se a vaga foi liberada e há fila, sinaliza pra UI
  // destacar "Promover próximo da fila" (caminho transacional manual, FIFO+lock).
  let flag = "";
  if (vagaLiberada) {
    const naEspera = await db.matricula.count({ where: { turmaId, status: "lista_espera" } });
    if (naEspera > 0) flag = `?vaga_liberada=${naEspera}`;
  }
  redirect(`/capacitacao/turmas/${turmaId}${flag}` as Route);
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

  // B4 — concluir a turma NÃO bloqueia, mas avisa se há matrículas penduradas
  // em 'cursando' (sem certificado). Conta antes do update; a transição segue livre.
  const cursandoPendentes =
    para === "concluida" ? await db.matricula.count({ where: { turmaId, status: "cursando" } }) : 0;

  await db.turma.update({ where: { id: turmaId }, data: { status: para } });
  await logEvent({
    userId: session!.user.id,
    action: para === "cancelada" ? "turma_cancelada" : "turma_atualizada",
    entityType: "turma",
    entityId: turmaId,
    meta: { de: turma.status, para },
  });
  const flag =
    para === "concluida" && cursandoPendentes > 0 ? `?turma_concluida=${cursandoPendentes}` : "";
  redirect(`/capacitacao/turmas/${turmaId}${flag}` as Route);
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

  const turmaId = s(formData, "turmaId");
  const turmaScope = await db.turma.findUnique({
    where: { id: turmaId },
    select: { instrutor: { select: { userId: true } } },
  });
  if (!podeRegistrarPresencaNaTurma(session, turmaScope?.instrutor?.userId ?? null)) {
    throw new Error("Sem permissão");
  }
  const dataStr = s(formData, "data");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
    redirect(`/capacitacao/turmas/${turmaId}?erro=presenca` as Route);
  }
  const data = new Date(dataStr);
  const roster = s(formData, "roster")
    .split(",")
    .filter((id) => id.length > 0);
  // IDOR guard: só matrículas que pertencem a ESTA turma (roster vem do cliente).
  const validas = await matriculasDaTurma(turmaId, roster);

  await db.$transaction(
    validas.map((matriculaId) =>
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
    meta: { data: dataStr, alunos: validas.length },
  });
  redirect(`/capacitacao/turmas/${turmaId}?presenca=ok` as Route);
}

/**
 * Emite o certificado de conclusão de uma matrícula (F1.A.3). Idempotente: se já
 * existe, vai pra verificação. Trava por elegibilidade (concluído + frequência >=80%).
 * Guarda snapshots (nome/curso/carga) e um código público p/ verificação.
 */
export async function emitirCertificadoAction(formData: FormData) {
  const session = await auth();
  if (!canAccessUnidade(session, "capacitacao")) throw new Error("Sem permissão");
  if (!podeEmitirCertificado(session)) throw new Error("Sem permissão");

  const matriculaId = s(formData, "matriculaId");
  const turmaId = s(formData, "turmaId");
  const voltar = `/capacitacao/turmas/${turmaId}`;

  const m = await db.matricula.findUnique({
    where: { id: matriculaId },
    include: {
      presencas: { select: { presente: true } },
      certificado: { select: { codigo: true } },
      cidadao: { select: { nomeCompleto: true, nomeSocial: true } },
      turma: { include: { curso: { select: { nome: true, cargaHorariaTotal: true } } } },
    },
  });
  if (!m) redirect(`${voltar}?erro=cert` as Route);
  if (m.certificado) redirect(`/verificar/${m.certificado.codigo}` as Route);

  const elig = avaliarElegibilidade(m.status, m.presencas);
  if (!elig.elegivel) redirect(`${voltar}?erro=cert_inelegivel` as Route);

  const nomeAluno = m.cidadao.nomeSocial?.trim() ? m.cidadao.nomeSocial : m.cidadao.nomeCompleto;
  const codigo = `IFP-${randomBytes(8).toString("hex").toUpperCase()}`;

  const cert = await db.certificado.create({
    data: {
      matriculaId: m.id,
      codigo,
      nomeAluno,
      nomeCurso: m.turma.curso.nome,
      cargaHoraria: m.turma.curso.cargaHorariaTotal,
      percentualFrequencia: elig.percentual,
      emitidoPor: session!.user.id,
    },
  });

  await logEvent({
    userId: session!.user.id,
    action: "certificado_emitido",
    entityType: "certificado",
    entityId: cert.id,
    rootEntityType: "cidadao",
    rootEntityId: m.cidadaoId,
    meta: { codigo, turmaId: m.turmaId, percentual: elig.percentual },
  });

  revalidatePath(voltar);
  redirect(`${voltar}?cert=${codigo}` as Route);
}

/**
 * Vincula o cadastro de Instrutor a um login existente (F1.A.2). O super_admin cria
 * a conta no /admin/users (papel profissional·capacitação); aqui o gestor liga essa
 * conta ao Instrutor, destravando "Minhas turmas" + marcação de presença pelo professor.
 */
export async function vincularLoginInstrutorAction(formData: FormData) {
  const session = await auth();
  if (!canAccessUnidade(session, "capacitacao")) throw new Error("Sem permissão");
  if (!podeGerenciarInstrutor(session)) throw new Error("Sem permissão");

  const instrutorId = s(formData, "instrutorId");
  const email = s(formData, "email").toLowerCase();
  const back = "/capacitacao/instrutores";

  const user = await db.user.findUnique({
    where: { email },
    include: { userRoles: { include: { role: true } } },
  });
  if (!user) redirect(`${back}?erro=user_nao_encontrado` as Route);

  const temPapel = user.userRoles.some(
    (ur) => ur.role.name === "profissional" && ur.unitScope === "capacitacao",
  );
  if (!temPapel) redirect(`${back}?erro=user_sem_papel` as Route);

  const jaLigado = await db.instrutor.findUnique({ where: { userId: user.id } });
  if (jaLigado && jaLigado.id !== instrutorId) {
    redirect(`${back}?erro=user_ja_vinculado` as Route);
  }

  await db.instrutor.update({ where: { id: instrutorId }, data: { userId: user.id } });
  await logEvent({
    userId: session!.user.id,
    action: "instrutor_atualizado",
    entityType: "instrutor",
    entityId: instrutorId,
    meta: { vinculoLogin: email },
  });
  revalidatePath(back);
  redirect(`${back}?vinculo=ok` as Route);
}

/** Edita nome/bio do instrutor (gestão). */
export async function editarInstrutorAction(formData: FormData) {
  const session = await auth();
  if (!canAccessUnidade(session, "capacitacao")) throw new Error("Sem permissão");
  if (!podeGerenciarInstrutor(session)) throw new Error("Sem permissão");
  const instrutorId = s(formData, "instrutorId");
  const nomeExibicao = s(formData, "nomeExibicao");
  if (!nomeExibicao) redirect("/capacitacao/instrutores?erro=nome" as Route);
  await db.instrutor.update({
    where: { id: instrutorId },
    data: { nomeExibicao, bio: sOpt(formData, "bio") },
  });
  await logEvent({
    userId: session!.user.id,
    action: "instrutor_atualizado",
    entityType: "instrutor",
    entityId: instrutorId,
    meta: { nome: nomeExibicao },
  });
  revalidatePath("/capacitacao/instrutores");
  redirect("/capacitacao/instrutores?vinculo=editado" as Route);
}

/** Desativa/reativa o instrutor (soft-delete por flag). */
export async function toggleInstrutorAtivoAction(formData: FormData) {
  const session = await auth();
  if (!canAccessUnidade(session, "capacitacao")) throw new Error("Sem permissão");
  if (!podeGerenciarInstrutor(session)) throw new Error("Sem permissão");
  const instrutorId = s(formData, "instrutorId");
  const inst = await db.instrutor.findUnique({ where: { id: instrutorId } });
  if (!inst) redirect("/capacitacao/instrutores" as Route);
  await db.instrutor.update({ where: { id: instrutorId }, data: { ativo: !inst.ativo } });
  await logEvent({
    userId: session!.user.id,
    action: "instrutor_atualizado",
    entityType: "instrutor",
    entityId: instrutorId,
    meta: { ativo: !inst.ativo },
  });
  revalidatePath("/capacitacao/instrutores");
  redirect("/capacitacao/instrutores" as Route);
}
