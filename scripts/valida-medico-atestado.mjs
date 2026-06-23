/**
 * E2E dos DOCUMENTOS MÉDICOS (atestado/receita/declaração) com QR + verificação
 * PÚBLICA, revogação, RBAC e selo do atendimento.
 * Uso: SENHA_DEV=... SENHA_ADMIN=... node scripts/valida-medico-atestado.mjs
 * Pré: seed rodado (João da Silva é paciente do Centro Médico).
 */
const API = process.env.API_URL_TESTE ?? "http://127.0.0.1:3333/api/v1";
const SENHA = process.env.SENHA_DEV;
if (!SENHA) {
  console.error("Defina SENHA_DEV");
  process.exit(2);
}

async function login(email) {
  const r = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, senha: SENHA }),
  });
  if (!r.ok) throw new Error(`login ${email}: ${r.status}`);
  return (await r.json()).accessToken;
}

async function req(token, method, path, body) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await r.json();
  } catch {
    /* sem corpo */
  }
  return { status: r.status, json };
}

const resultados = [];
function caso(nome, esperado, obtido) {
  const ok = esperado === obtido;
  resultados.push(ok);
  console.log(`${ok ? "✓" : "✗ FALHOU"} ${nome}: ${JSON.stringify(obtido)} (espera ${JSON.stringify(esperado)})`);
}

const medico = await login("medico@ifp.local");
const familia = await login("familia@ifp.local");
const emHoras = (h) => new Date(Date.now() + h * 3600_000).toISOString();

// Acha o João da Silva e abre um atendimento.
let fichaId = null;
for (const termo of ["joao", "joão", "silva"]) {
  const r = await req(medico, "GET", `/medico/fichas?q=${encodeURIComponent(termo)}`);
  const itens = r.json?.items ?? [];
  const item =
    itens.find((f) => /jo[aã]o/i.test(f.nomeCompleto ?? f.nome ?? "")) ??
    (termo.startsWith("jo") ? itens[0] : null);
  if (item) {
    fichaId = item.id;
    break;
  }
}
if (!fichaId) {
  console.error("João não encontrado — rode o seed.");
  process.exit(2);
}

const ag = await req(medico, "POST", "/medico/agendamentos", {
  fichaId,
  inicioEm: emHoras(1),
  motivo: "QA documentos",
});
if (ag.status !== 201) {
  console.error("falha ao criar agendamento", ag.status, ag.json);
  process.exit(2);
}
const ini = await req(medico, "POST", `/medico/agendamentos/${ag.json.id}/iniciar`);
const atId = ini.json?.id;
caso("inicia atendimento (tem id)", true, !!atId);

console.log("--- EMISSÃO DE ATESTADO ---");
const atest = await req(medico, "POST", `/medico/atendimentos/${atId}/documentos`, {
  tipo: "ATESTADO",
  conteudo: "Atesto, para os devidos fins, que o paciente necessita de afastamento.",
  cid10: "J11",
  diasAfastamento: 3,
});
caso("atestado emitido → 201", 201, atest.status);
caso("tem codigoVerificacao", true, !!atest.json?.codigoVerificacao);
caso("guarda dias de afastamento", 3, atest.json?.diasAfastamento);
const codigo = atest.json?.codigoVerificacao;
const docId = atest.json?.id;

console.log("--- EMISSÃO DE RECEITA E DECLARAÇÃO ---");
const rec = await req(medico, "POST", `/medico/atendimentos/${atId}/documentos`, {
  tipo: "RECEITA",
  conteudo: "Amoxicilina 500mg — 1 comprimido de 8/8h por 7 dias.",
});
caso("receita emitida → 201", 201, rec.status);
const decl = await req(medico, "POST", `/medico/atendimentos/${atId}/documentos`, {
  tipo: "DECLARACAO",
  conteudo: "Declaro que o paciente compareceu à consulta nesta data.",
});
caso("declaração emitida → 201", 201, decl.status);

console.log("--- VALIDAÇÃO DE ENTRADA ---");
const ruim = await req(medico, "POST", `/medico/atendimentos/${atId}/documentos`, {
  tipo: "ATESTADO",
  conteudo: "x", // < MinLength(3)
});
caso("conteúdo curto → 400", 400, ruim.status);
const tipoRuim = await req(medico, "POST", `/medico/atendimentos/${atId}/documentos`, {
  tipo: "BOLETO",
  conteudo: "conteudo qualquer valido",
});
caso("tipo inválido → 400", 400, tipoRuim.status);

console.log("--- LISTAGEM ---");
const lista = await req(medico, "GET", `/medico/atendimentos/${atId}/documentos`);
caso("lista documentos → 200", 200, lista.status);
caso("listou os 3 documentos", true, (lista.json?.items?.length ?? 0) >= 3);

console.log("--- VERIFICAÇÃO PÚBLICA (sem login) ---");
const pub = await req(null, "GET", `/medico/documentos/verificar/${codigo}`);
caso("verificação pública → 200", 200, pub.status);
caso("documento válido", true, pub.json?.valido);
caso("tipo na verificação", "ATESTADO", pub.json?.tipo);
caso("não vaza CID (sigiloso)", true, !("cid10" in (pub.json ?? {})));
caso("não vaza conteúdo (sigiloso)", true, !("conteudo" in (pub.json ?? {})));
caso("documento vigente (não revogado)", false, pub.json?.revogado);

console.log("--- PDF PÚBLICO ---");
const pdf = await fetch(`${API}/medico/documentos/verificar/${codigo}/pdf`);
caso("PDF público → 200", 200, pdf.status);
caso(
  "content-type pdf",
  true,
  (pdf.headers.get("content-type") ?? "").includes("application/pdf"),
);

console.log("--- CÓDIGO INVÁLIDO ---");
const inval = await req(null, "GET", `/medico/documentos/verificar/codigo-que-nao-existe`);
caso("código inválido → 404", 404, inval.status);
caso("404 com valido:false", false, inval.json?.valido);

console.log("--- REVOGAÇÃO ---");
const revVazio = await req(medico, "PATCH", `/medico/documentos/${docId}/revogar`, {
  motivo: "abc", // < MinLength(5)
});
caso("motivo curto → 400", 400, revVazio.status);
const rev = await req(medico, "PATCH", `/medico/documentos/${docId}/revogar`, {
  motivo: "Erro de digitação na data; emitido outro corrigido.",
});
caso("revoga documento → 200", 200, rev.status);
caso("marca revogadoEm", true, !!rev.json?.revogadoEm);
const rev2 = await req(medico, "PATCH", `/medico/documentos/${docId}/revogar`, {
  motivo: "tentativa duplicada de revogação",
});
caso("revogar de novo → 409", 409, rev2.status);
const pubRev = await req(null, "GET", `/medico/documentos/verificar/${codigo}`);
caso("verificação reflete revogado", true, pubRev.json?.revogado);

console.log("--- RBAC ---");
const famEmite = await req(familia, "POST", `/medico/atendimentos/${atId}/documentos`, {
  tipo: "ATESTADO",
  conteudo: "tentativa indevida de emitir atestado",
});
caso("família não emite → 403", 403, famEmite.status);
const famRevoga = await req(familia, "PATCH", `/medico/documentos/${rec.json?.id}/revogar`, {
  motivo: "tentativa indevida de revogar",
});
caso("família não revoga → 403", 403, famRevoga.status);

console.log("--- NOT FOUND ---");
const nf = await req(medico, "POST", `/medico/atendimentos/atendimento-inexistente/documentos`, {
  tipo: "ATESTADO",
  conteudo: "conteudo qualquer valido para teste",
});
caso("atendimento inexistente → 404", 404, nf.status);

console.log("--- ATENDIMENTO SELADO (imutável) ---");
await req(medico, "PATCH", `/medico/atendimentos/${atId}`, {
  subjetivo: "Sintomas gripais",
  plano: "Repouso e sintomáticos",
});
const sel = await req(medico, "POST", `/medico/atendimentos/${atId}/encerrar`);
caso("sela atendimento", 200, sel.status);
const posSelo = await req(medico, "POST", `/medico/atendimentos/${atId}/documentos`, {
  tipo: "DECLARACAO",
  conteudo: "tentativa de emitir documento em atendimento selado",
});
caso("emitir em atendimento selado → 409", 409, posSelo.status);

const total = resultados.length;
const ok = resultados.filter(Boolean).length;
console.log(`\n${ok}/${total}`);
if (ok !== total) process.exit(1);
console.log(">>> DOCUMENTOS MÉDICOS (atestado/receita/declaração) VALIDADO <<<");
