/**
 * Regressão de Fichas Cidadãs + dos P1 da auditoria de pré-lançamento (2026-06-22):
 *  #1 replaceMembros reconcilia por identidade natural (não apaga/recria): membro
 *     com histórico não pode ser removido (409) e quem permanece mantém o id (vínculo).
 *  #2 GET /fichas-cidadas grava audit READ do ator (PII em massa).
 *  #3 GET /educacional/criancas/:id/autorizados grava audit READ (dossiê do menor).
 *  #4 vigenteAte do autorizado é gravado como FIM do dia em America/Sao_Paulo.
 *
 * Rodar SEMPRE após `pnpm db:seed`.
 * Uso: SENHA_DEV=<senha não-admin> SENHA_ADMIN=<senha admin> node scripts/valida-fichas-cidadas.mjs
 */
const API = process.env.API_URL_TESTE ?? "http://127.0.0.1:3333/api/v1";
const SENHA = process.env.SENHA_DEV;
const SENHA_ADMIN = process.env.SENHA_ADMIN;

async function login(email, senha) {
  const r = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, senha }),
  });
  if (!r.ok) throw new Error(`login ${email}: ${r.status}`);
  return (await r.json()).accessToken;
}
async function req(token, method, path, body) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await r.json(); } catch {}
  return { status: r.status, json };
}
const res = [];
const caso = (n, esp, obt) => { const ok = esp === obt; res.push(ok); console.log(`${ok ? "✓" : "✗ FALHOU"} ${n}: ${JSON.stringify(obt)} (espera ${JSON.stringify(esp)})`); };

const admin = await login("admin@ifp.local", SENHA_ADMIN);
const educadora = await login("educadora@ifp.local", SENHA);
const gestora = await login("gestora@ifp.local", SENHA);
const familia = await login("familia@ifp.local", SENHA);

// descobre Ana
const minhas = await req(familia, "GET", "/familia/educacional/criancas");
const ana = minhas.json.items[0].crianca.id;

// ── #2 findAll com audit ─────────────────────────────────────────────
const lista = await req(admin, "GET", "/fichas-cidadas");
caso("#2 admin lista fichas (200)", 200, lista.status);
const ficha = lista.json.items.find((f) => /sandra/i.test(f.nomeCompleto));

// monta membros atuais como DTO válido
const det = await req(admin, "GET", `/fichas-cidadas/${ficha.id}`);
const toDto = (m) => ({
  nomeCompleto: m.nomeCompleto,
  ...(m.cpf ? { cpf: m.cpf } : {}),
  dataNascimento: m.dataNascimento,
  parentesco: m.parentesco,
  ...(m.ocupacao ? { ocupacao: m.ocupacao } : {}),
  ...(m.escolaridade ? { escolaridade: m.escolaridade } : {}),
  ...(m.rendaMensal != null ? { rendaMensal: Number(m.rendaMensal) } : {}),
  ...(m.observacoes ? { observacoes: m.observacoes } : {}),
});
const membros = det.json.membros.map(toDto);
const anaAntes = det.json.membros.find((m) => /ana/i.test(m.nomeCompleto))?.id;
console.log("  membros atuais:", det.json.membros.map((m) => m.nomeCompleto).join(", "), "| Ana id:", anaAntes);

// ── #1a remover membro COM histórico → 409 ───────────────────────────
const semAna = membros.filter((m) => !/ana/i.test(m.nomeCompleto));
const rem = await req(admin, "PUT", `/fichas-cidadas/${ficha.id}/membros`, { membros: semAna });
caso("#1a remover membro com histórico → 409", 409, rem.status);

// ── #1b reconciliar (mantém Ana) + criar novo → 200, Ana preserva id ─
const comNovo = [...membros, { nomeCompleto: "Tio Verify Teste", cpf: "98765432100", dataNascimento: "1990-01-01", parentesco: "OUTRO" }];
const recon = await req(admin, "PUT", `/fichas-cidadas/${ficha.id}/membros`, { membros: comNovo });
caso("#1b reconciliar + criar novo → 200", 200, recon.status);
const anaDepois = recon.json?.membros?.find((m) => /ana silva/i.test(m.nomeCompleto))?.id;
caso("#1b Ana preserva o MESMO id (vínculo intacto)", anaAntes, anaDepois);
caso("#1b membro novo criado", true, recon.json?.membros?.some((m) => /tio verify teste/i.test(m.nomeCompleto)));

// ── #3 listarAutorizados (audit) ─────────────────────────────────────
const aut = await req(educadora, "GET", `/educacional/criancas/${ana}/autorizados`);
caso("#3 educadora lista autorizados (200)", 200, aut.status);

// ── #4 vigenteAte = fim do dia em SP ─────────────────────────────────
const na = await req(gestora, "POST", `/educacional/criancas/${ana}/autorizados`, {
  nome: "Verify Vigencia", documento: "123456789", parentesco: "tio", vigenteAte: "2026-06-22",
});
caso("#4 cria autorizado c/ vigenteAte (201)", 201, na.status);
// fim do dia SP de 2026-06-22 = 23:59:59.999-03:00 = 2026-06-23T02:59:59.999Z
caso("#4 vigenteAte gravado como fim do dia SP", "2026-06-23T02:59:59.999Z", na.json?.vigenteAte);

// ── motivo obrigatório ao revogar elegibilidade (P2 rodada 2) ─────────
const semMotivo = await req(admin, "PUT", `/fichas-cidadas/${ficha.id}/elegibilidade/educacional`, {
  status: "REPROVADO",
});
caso("reprovar elegibilidade SEM motivo → 400", 400, semMotivo.status);
const comMotivo = await req(admin, "PUT", `/fichas-cidadas/${ficha.id}/elegibilidade/educacional`, {
  status: "REPROVADO",
  motivo: "Renda acima do critério (QA).",
});
caso("reprovar COM motivo → 200", 200, comMotivo.status);
caso("motivo fica gravado", true, /renda acima/i.test(comMotivo.json?.motivo ?? ""));

console.log("");
console.log(`${res.filter(Boolean).length}/${res.length}`);
console.log("ANA_ID=" + ana);
process.exit(res.every(Boolean) ? 0 : 1);
