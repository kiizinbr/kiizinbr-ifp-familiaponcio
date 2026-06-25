/**
 * E2E da VERIFICAÇÃO PÚBLICA por código (entrada manual — A5).
 *
 * Cobre o endpoint que a nova tela de "digitar o código" consome
 * (GET /medico/documentos/verificar/:codigo, SEM login):
 *   - código válido → 200 com { valido: true } e dados anti-fraude;
 *   - não vaza dado clínico sigiloso (sem CID, sem conteúdo da receita);
 *   - código inválido → 404 amigável com { valido: false } e mensagem.
 *
 * Uso: SENHA_DEV=... node scripts/valida-verificacao-publica.mjs
 * Pré: seed rodado (João da Silva é paciente do Centro Médico) + API no ar.
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
  console.log(
    `${ok ? "✓" : "✗ FALHOU"} ${nome}: ${JSON.stringify(obtido)} (espera ${JSON.stringify(esperado)})`,
  );
}

const medico = await login("medico@ifp.local");
const emHoras = (h) => new Date(Date.now() + h * 3600_000).toISOString();

// --- prepara um documento real (emite atestado num atendimento) ---
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
  motivo: "QA verificação pública",
});
if (ag.status !== 201) {
  console.error("falha ao criar agendamento", ag.status, ag.json);
  process.exit(2);
}
const ini = await req(medico, "POST", `/medico/agendamentos/${ag.json.id}/iniciar`);
const atId = ini.json?.id;
const atest = await req(medico, "POST", `/medico/atendimentos/${atId}/documentos`, {
  tipo: "ATESTADO",
  conteudo: "Atesto, para os devidos fins, que o paciente necessita de afastamento.",
  cid10: "J11",
  diasAfastamento: 2,
});
if (atest.status !== 201) {
  console.error("falha ao emitir atestado", atest.status, atest.json);
  process.exit(2);
}
const codigo = atest.json?.codigoVerificacao;
caso("documento emitido tem código", true, !!codigo);

console.log("--- CÓDIGO VÁLIDO (entrada manual, sem login) ---");
const ok = await req(null, "GET", `/medico/documentos/verificar/${encodeURIComponent(codigo)}`);
caso("código válido → 200", 200, ok.status);
caso("achado: valido = true", true, ok.json?.valido);
caso("traz o tipo do documento", "ATESTADO", ok.json?.tipo);
caso("traz o paciente", true, !!ok.json?.paciente);
caso("traz o profissional", true, !!ok.json?.profissional);
caso("documento vigente (não revogado)", false, ok.json?.revogado);
// Não pode vazar dado clínico sigiloso na rota pública.
caso("não vaza CID", true, !("cid10" in (ok.json ?? {})));
caso("não vaza conteúdo", true, !("conteudo" in (ok.json ?? {})));

console.log("--- CÓDIGO INVÁLIDO (not-found amigável, sem vazar dado) ---");
const inval = await req(
  null,
  "GET",
  `/medico/documentos/verificar/${encodeURIComponent("CODIGO-QUE-NAO-EXISTE-123")}`,
);
caso("código inválido → 404", 404, inval.status);
caso("404 com valido = false", false, inval.json?.valido);
caso("404 traz mensagem amigável", true, typeof inval.json?.mensagem === "string");
caso("404 não traz paciente (não vaza dado)", true, !("paciente" in (inval.json ?? {})));

console.log("--- CÓDIGO VAZIO/ESPAÇO (não casa, 404) ---");
const espaco = await req(null, "GET", `/medico/documentos/verificar/${encodeURIComponent("   ")}`);
caso("código só com espaço → 404", 404, espaco.status);

const total = resultados.length;
const okN = resultados.filter(Boolean).length;
console.log(`\n${okN}/${total}`);
if (okN !== total) process.exit(1);
console.log(">>> VERIFICAÇÃO PÚBLICA (entrada manual de código) VALIDADO <<<");
