"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/audit";
import { canAccessUnidade, hasAnyRole } from "@/lib/rbac";
import { assertAcessoCidadao } from "@/lib/cidadao-authz";
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

/**
 * Resultado serializável do core. Erros de DOMÍNIO/feedback viram `{ ok:false }`
 * (o caller decide: redirect no manual, retorno no autosave); abusos de RBAC/IDOR
 * continuam LANÇANDO dentro do core — o island nunca contorna o gate de papel.
 */
export type RascunhoCoreResult =
  | { ok: true; salvoEm: Date }
  | { ok: false; erro: "diagnosticos" | "cid_indisponivel" | "nota_assinada" };

/**
 * Miolo COMPARTILHADO de salvar rascunho. Faz toda a escrita (findUniqueOrThrow,
 * IDOR assertAcessoCidadao, gate podeEditarNota, parse vitais, canonicalização
 * CID-10, salvarRascunho + logEvent + revalidatePath) e RETORNA o resultado em vez
 * de redirect — assim serve tanto o botão manual (que re-mapeia para redirect)
 * quanto o autosave (que devolve o valor pro island; este passa `silencioso` para
 * pular logEvent/revalidatePath). Recebe a `session` JÁ resolvida pelo caller (que
 * também já validou canAccessUnidade). Não é Server Action: é função interna do
 * módulo "use server", não exportável como endpoint.
 *
 * Contrato preservado byte-a-byte vs. o fluxo antigo: mesma ordem de guards, mesma
 * escrita, mesmo audit, mesmo revalidatePath. A ÚNICA diferença é que os 3 antigos
 * `redirect(?erro=...)` (diagnosticos, cid_indisponivel, NotaAssinadaError) viram
 * `return { ok:false }`. Gates de abuso (assertAcessoCidadao, podeEditarNota)
 * seguem LANÇANDO.
 *
 * `silencioso` (LGPD): SÓ o autosave o liga. Pula o `logEvent('prontuario_criado')`
 * e o `revalidatePath` — sem inundar a trilha de auditoria com dezenas de entradas
 * por consulta (1 a cada ~2s) e sem disparar o re-render do RSC que re-loga
 * `medical_data_accessed`. A ESCRITA (CAS where status='rascunho') e os GUARDS
 * (assertAcessoCidadao, podeEditarNota) continuam rodando — só a auditoria/revalidate
 * é suprimida. O caminho manual e a assinatura mantêm audit + revalidate intactos.
 */
async function salvarRascunhoCore(
  formData: FormData,
  session: Session,
  { silencioso = false }: { silencioso?: boolean } = {},
): Promise<RascunhoCoreResult> {
  const consultaId = String(formData.get("consultaId"));
  const consulta = await db.consulta.findUniqueOrThrow({
    where: { id: consultaId },
    include: { profissional: true, notaEvolucao: true },
  });
  // A1 IDOR guard (espelha os irmãos em consultas/[id]): consultaId vem do
  // cliente e o gate de papel (podeEditarNota) não confere a unidade do OBJETO.
  // Exige acesso à unidade do cidadão antes de qualquer escrita no prontuário —
  // não trava o fluxo legítimo (profissional/gestor na própria unidade, social,
  // super_admin passam por can(edit, ficha_cidada)). LANÇA — autosave não contorna.
  await assertAcessoCidadao(session, consulta.cidadaoId, "edit");

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
      return { ok: false, erro: "diagnosticos" };
    }
    const normalizados = normalizarDiagnosticos(valido.data);
    // Anti-tampering híbrido + anti-forja: descrição canônica quando o código
    // existe na tabela Cid10; código regex-válido inexistente numa tabela
    // CONSULTADA com sucesso é rebaixado a texto livre (não finge CID oficial).
    const codigos = normalizados.flatMap((d) => (d.codigoCid ? [d.codigoCid] : []));
    let oficiais = new Map<string, string>();
    // B12 — `tabelaConsultada` permanece SEMPRE true neste fluxo: "0 linhas com
    // sucesso" (tabela vazia de verdade) já rebaixa o forjado a texto livre via
    // canonicalizarDescricoes (anti-forja correta, não bloqueia). O ERRO DE QUERY
    // (catch) ≠ tabela vazia: não dá pra refutar o código → NÃO aceitar possível
    // forja; aborta com feedback em vez de afrouxar para `false` (que mantinha o
    // código enviado intocado). Mantemos a variável p/ não tocar a assinatura
    // read-only de canonicalizarDescricoes.
    const tabelaConsultada = true;
    if (codigos.length > 0) {
      try {
        const linhas = await db.cid10.findMany({
          where: { codigo: { in: codigos } },
          select: { codigo: true, descricao: true },
        });
        oficiais = new Map(linhas.map((c) => [c.codigo, c.descricao]));
      } catch {
        return { ok: false, erro: "cid_indisponivel" };
      }
    }
    diagnosticos = canonicalizarDescricoes(normalizados, oficiais, tabelaConsultada);
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
    // LGPD: o autosave (silencioso) NÃO emite auditoria — a escrita acima já
    // rodou (CAS + guards). Só o caminho manual/assinatura registra na trilha.
    if (!silencioso) {
      await logEvent({
        userId: session.user.id,
        action: "prontuario_criado",
        entityType: "nota_evolucao",
        entityId: nota.id,
        rootEntityType: "cidadao",
        rootEntityId: consulta.cidadaoId,
        meta: { consultaId },
      });
    }
  } catch (e) {
    if (e instanceof NotaAssinadaError) {
      return { ok: false, erro: "nota_assinada" };
    }
    throw e;
  }
  // LGPD: o autosave não revalida — o island já atualiza o indicador "salvo às
  // HH:MM" client-side; revalidar re-renderiza o RSC e re-loga medical_data_accessed.
  if (!silencioso) {
    revalidatePath(`/medico/consultas/${consultaId}` as Route);
  }
  return { ok: true, salvoEm: new Date() };
}

/**
 * Salva (upsert) a evolução em rascunho enquanto a consulta está em atendimento.
 * Wrapper FINO sobre `salvarRascunhoCore`: resolve a sessão/RBAC, chama o core e
 * re-aplica os redirects (sucesso ?salvo=HHMM&voltar=, erros ?erro=) — paridade
 * 1:1 com o fluxo antigo. Botão "Salvar rascunho" inalterado, zero regressão.
 */
export async function salvarRascunhoAction(formData: FormData) {
  const session = await auth();
  if (!session) redirect("/medico/login" as Route);
  if (!canAccessUnidade(session, "medico")) throw new Error("Sem permissão");

  const consultaId = String(formData.get("consultaId"));
  const resultado = await salvarRascunhoCore(formData, session);

  if (!resultado.ok) {
    // Re-mapeia os 3 erros de domínio do core de volta ao mesmo redirect de antes.
    redirect(`/medico/consultas/${consultaId}?erro=${resultado.erro}` as Route);
  }

  // QW1 ack: redireciona para a MESMA consulta (em_atendimento) com ?salvo=HHMM
  // pra tela renderizar "Rascunho salvo às HH:MM" — mesmo idioma de sucesso já em
  // uso (reagendar ?reagendada=ok, documento ?doc=ok). Cai de volta no modo edição
  // com o textarea repovoado pelo RSC (defaultValue do banco) — o médico continua
  // digitando. Sem PII na URL (só a hora). Contrato/RBAC/IDOR/salvarRascunho intactos.
  const agora = resultado.salvoEm;
  const hhmm = `${String(agora.getHours()).padStart(2, "0")}${String(agora.getMinutes()).padStart(2, "0")}`;
  // Preserva ?voltar= (origem do QW2) se ele estava na URL e veio no form, pra não
  // perder o breadcrumb ao salvar — anti open-redirect espelhado da checkin-action.
  const voltarRaw = String(formData.get("voltar") || "");
  const voltarOk = /^\/(?![/\\])/.test(voltarRaw);
  const voltarParam = voltarOk ? `&voltar=${encodeURIComponent(voltarRaw)}` : "";
  redirect(`/medico/consultas/${consultaId}?salvo=${hhmm}${voltarParam}` as Route);
}

/**
 * Resultado serializável que o autosave devolve ao island (Date → ISO para cruzar
 * a fronteira Server Action → client sem perder informação). `salvoEm` alimenta o
 * indicador "Rascunho salvo às HH:MM"; `erro` mantém as alterações não salvas sem
 * redirect (ex.: nota assinada em outra aba).
 */
export type AutosaveResult =
  | { ok: true; salvoEm: string }
  | { ok: false; erro: "diagnosticos" | "cid_indisponivel" | "nota_assinada" };

/**
 * Autosave do rascunho — Server Action chamada DIRETO do client (island), o padrão
 * do repo: auth/RBAC continuam server-side, sem inventar Route Handler. Reusa o
 * MESMO `salvarRascunhoCore` (mesma escrita/audit/IDOR), mas RETORNA um resultado
 * serializável SEM redirect e SEM navegação — o island atualiza o indicador e zera
 * o estado sujo. Gates de RBAC/IDOR seguem LANÇANDO no core (a action não os
 * engole): só os erros de domínio/feedback do core são serializados.
 */
export async function autosalvarRascunhoAction(formData: FormData): Promise<AutosaveResult> {
  const session = await auth();
  if (!session) throw new Error("Sem permissão");
  if (!canAccessUnidade(session, "medico")) throw new Error("Sem permissão");

  // LGPD: silencioso — persiste o rascunho (CAS + guards) mas pula audit/revalidate.
  const resultado = await salvarRascunhoCore(formData, session, { silencioso: true });
  if (!resultado.ok) return { ok: false, erro: resultado.erro };
  return { ok: true, salvoEm: resultado.salvoEm.toISOString() };
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
  // A1 IDOR guard: acesso à unidade do cidadão antes de assinar (ato imutável).
  await assertAcessoCidadao(session, consulta.cidadaoId, "edit");
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
  // A1 IDOR guard: acesso à unidade do cidadão antes do addendo (append-only).
  await assertAcessoCidadao(session, consulta.cidadaoId, "edit");
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
