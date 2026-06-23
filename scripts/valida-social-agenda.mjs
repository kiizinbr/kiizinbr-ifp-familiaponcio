/**
 * E2E ao vivo da Agenda Transversal do Serviço Social (B4): visão por DIA
 * cruzando as 4 unidades (médico/capacitação/esportivo/educacional). É um
 * endpoint de AGREGAÇÃO read-only — NÃO cria agenda nova, só lê e cruza o que
 * já existe. Cobre: shape agregado por unidade, "pulso do dia", janela por
 * ?data=, fatos conhecidos do seed (3 agendamentos médicos HOJE; evento
 * "reunião geral" do educacional AMANHÃ), e RBAC (perfil errado → 403; sem
 * token → 401).
 *
 * Fixtures do seed:
 *   - 3 agendamentos médicos de HOJE (09:00, 10:30, 14:00) na unidade médico
 *   - evento "seed-evento-reuniao-geral" AMANHÃ (educacional, sem RSVP)
 *
 * Uso: SENHA_DEV=... SENHA_ADMIN=... node scripts/valida-social-agenda.mjs
 */
const API = process.env.API_URL_TESTE ?? "http://127.0.0.1:3333/api/v1";
const SENHA = process.env.SENHA_DEV;
const SENHA_ADMIN = process.env.SENHA_ADMIN ?? SENHA;
if (!SENHA) {
  console.error("Defina SENHA_DEV");
  process.exit(2);
}

async function login(email, senha = SENHA) {
  const r = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, senha }),
  });
  if (!r.ok) throw new Error(`login ${email}: ${r.status}`);
  const j = await r.json();
  return j.accessToken ?? j.access_token ?? j.token;
}

async function req(token, method, path) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const r = await fetch(`${API}${path}`, { method, headers });
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
function ok(nome, cond) {
  resultados.push(Boolean(cond));
  console.log(`${cond ? "✓" : "✗ FALHOU"} ${nome}`);
}

/** Dia civil em São Paulo no formato YYYY-MM-DD, com offset de dias. */
function diaSP(offset = 0) {
  const base = new Date(Date.now() + offset * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(base);
}

const social = await login("admin@ifp.local", SENHA_ADMIN); // admin tem SUPER_ADMIN
const medico = await login("medico@ifp.local");
const familia = await login("familia@ifp.local");

console.log("--- SHAPE AGREGADO (hoje, sem ?data=) ---");
const hoje = await req(social, "GET", "/servico-social/social-agenda");
caso("serviço social -> agenda (200)", 200, hoje.status);
const ag = hoje.json;
ok("resposta tem data/pulso/unidades", Boolean(ag?.data && ag?.pulso && Array.isArray(ag?.unidades)));
ok("data é o dia civil de hoje em SP", ag?.data === diaSP(0));
caso("agrega as 4 unidades", 4, ag?.unidades?.length);
const tipos = (ag?.unidades ?? []).map((u) => u.tipo).sort();
ok(
  "unidades cobrem médico/capacitação/esportivo/educacional",
  ["CAPACITACAO", "EDUCACIONAL", "ESPORTIVO", "MEDICO"].every((t) => tipos.includes(t)),
);
ok(
  "cada coluna tem total == itens.length",
  (ag?.unidades ?? []).every((u) => u.total === u.itens.length),
);
ok(
  "pulso.totalDoDia == soma dos totais das unidades",
  ag?.pulso?.totalDoDia === (ag?.unidades ?? []).reduce((a, u) => a + u.total, 0),
);

console.log("--- FATO DO SEED: 3 agendamentos médicos HOJE ---");
const colMedico = (ag?.unidades ?? []).find((u) => u.tipo === "MEDICO");
ok("coluna médico tem >= 3 agendamentos hoje", (colMedico?.total ?? 0) >= 3);
ok(
  "itens do médico são do tipo AGENDAMENTO com status",
  (colMedico?.itens ?? []).every((i) => i.tipo === "AGENDAMENTO" && typeof i.status === "string"),
);
ok(
  "pulso.agendamentos >= 3 (cruza só a contagem do dia)",
  (ag?.pulso?.agendamentos ?? 0) >= 3,
);
ok(
  "itens do médico estão dentro do dia consultado",
  (colMedico?.itens ?? []).every((i) => i.inicioEm.startsWith(ag.data)),
);

console.log("--- JANELA POR ?data= : AMANHÃ traz o evento do educacional ---");
const amanha = diaSP(1);
const r2 = await req(social, "GET", `/servico-social/social-agenda?data=${amanha}`);
caso("agenda de amanhã (200)", 200, r2.status);
ok("data respeita o ?data=", r2.json?.data === amanha);
const colEdu = (r2.json?.unidades ?? []).find((u) => u.tipo === "EDUCACIONAL");
ok(
  "educacional traz o evento 'reunião geral' de amanhã",
  (colEdu?.itens ?? []).some((i) => i.id === "seed-evento-reuniao-geral" && i.tipo === "EVENTO"),
);
ok("pulso.eventos >= 1 amanhã", (r2.json?.pulso?.eventos ?? 0) >= 1);
// O agendamento médico de HOJE não vaza para a janela de AMANHÃ.
const colMedAmanha = (r2.json?.unidades ?? []).find((u) => u.tipo === "MEDICO");
ok(
  "agendamento de hoje NÃO aparece na janela de amanhã",
  (colMedAmanha?.itens ?? []).every((i) => i.inicioEm.startsWith(amanha)),
);

console.log("--- DATA INVÁLIDA → 400 ---");
const ruim = await req(social, "GET", "/servico-social/social-agenda?data=31-12-2026");
caso("data fora do formato AAAA-MM-DD → 400", 400, ruim.status);

console.log("--- RBAC (perfil errado → 403; sem token → 401) ---");
caso("médico -> agenda transversal (RBAC)", 403, (await req(medico, "GET", "/servico-social/social-agenda")).status);
caso("família -> agenda transversal (RBAC)", 403, (await req(familia, "GET", "/servico-social/social-agenda")).status);
caso("sem token -> agenda transversal (401)", 401, (await req(null, "GET", "/servico-social/social-agenda")).status);

const total = resultados.length;
const okc = resultados.filter(Boolean).length;
console.log(`\n${okc}/${total}`);
if (okc !== total) process.exit(1);
console.log(">>> AGENDA TRANSVERSAL DO SERVIÇO SOCIAL (B4) VALIDADA <<<");
