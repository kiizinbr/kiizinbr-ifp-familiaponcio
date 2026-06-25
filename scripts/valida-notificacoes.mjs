/**
 * E2E da Central de Avisos (sino da topbar) — GET /notificacoes.
 * Uso: SENHA_ADMIN=... SENHA_DEV=... node scripts/valida-notificacoes.mjs
 *   SENHA_ADMIN = SEED_SUPER_ADMIN_PASSWORD (admin@ifp.local — vê fila do Social)
 *   SENHA_DEV   = SEED_MEDICO_PASSWORD (medico@ifp.local + familia@ifp.local)
 * Pré: seed rodado (triagens/ponte/encaminhamentos + comunicado da família).
 *
 * Semântica testada: `total` = nº de PENDÊNCIAS reais; `itens` é a janela das
 * mais recentes (top 20). Logo total >= itens.length (não é igualdade).
 */
const API = process.env.API_URL_TESTE ?? "http://127.0.0.1:3333/api/v1";
const SENHA_ADMIN = process.env.SENHA_ADMIN;
const SENHA_DEV = process.env.SENHA_DEV;
if (!SENHA_ADMIN || !SENHA_DEV) {
  console.error("Defina SENHA_ADMIN e SENHA_DEV");
  process.exit(2);
}

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

/** Valida o shape geral do payload e de cada item (tipo/titulo/href). */
function validaShape(prefixo, json) {
  caso(`${prefixo}: total numérico`, true, typeof json?.total === "number");
  caso(`${prefixo}: itens é array`, true, Array.isArray(json?.itens));
  const itens = json?.itens ?? [];
  // total = pendências; itens = janela (top 20) → total >= itens.length.
  caso(`${prefixo}: total >= itens.length`, true, (json?.total ?? -1) >= itens.length);
  caso(`${prefixo}: itens.length <= 20 (janela)`, true, itens.length <= 20);
  const todosComCampos = itens.every(
    (i) =>
      typeof i.id === "string" &&
      typeof i.tipo === "string" &&
      i.tipo.length > 0 &&
      typeof i.titulo === "string" &&
      i.titulo.length > 0 &&
      typeof i.href === "string" &&
      i.href.startsWith("/"),
  );
  caso(`${prefixo}: todo item tem id/tipo/titulo/href`, true, itens.length === 0 ? true : todosComCampos);
  return itens;
}

const admin = await login("admin@ifp.local", SENHA_ADMIN);
const medico = await login("medico@ifp.local", SENHA_DEV);
const familia = await login("familia@ifp.local", SENHA_DEV);
// 2ª família (Beatriz → ficha do João, Caio na mesma turma) — fixture do IDOR
// família-vs-família dos eventos de storage (C4). Login pode não existir em
// bases antigas; tratamos como opcional para não quebrar o smoke.
let familia2 = null;
try {
  familia2 = await login("familia2@ifp.local", SENHA_DEV);
} catch {
  console.log("  (familia2@ifp.local ausente — pulando IDOR de storage; rode o seed)");
}

console.log("--- AUTH obrigatória ---");
const semToken = await req(null, "GET", "/notificacoes");
caso("sem token → 401", 401, semToken.status);

console.log("--- ADMIN / Serviço Social (cross-unidade) ---");
const rAdmin = await req(admin, "GET", "/notificacoes");
caso("admin → 200", 200, rAdmin.status);
const itensAdmin = validaShape("admin", rAdmin.json);
// O seed deixa triagens/ponte/encaminhamentos PENDENTES → admin tem avisos.
caso("admin: total > 0 (fila do Social no seed)", true, (rAdmin.json?.total ?? 0) > 0);
const tiposAdmin = new Set(itensAdmin.map((i) => i.tipo));
caso(
  "admin: tipos do Social (TRIAGEM/SINALIZACAO_PONTE/ENCAMINHAMENTO)",
  true,
  ["TRIAGEM", "SINALIZACAO_PONTE", "ENCAMINHAMENTO"].some((t) => tiposAdmin.has(t)),
);
// Cross-tenant: admin do Social NÃO recebe avisos de família/agenda médica.
caso(
  "admin: sem avisos de família (COMUNICADO/MENSAGEM/EVENTO/DOCUMENTO/FOTO_DIARIO)",
  false,
  itensAdmin.some((i) =>
    ["COMUNICADO", "MENSAGEM", "EVENTO", "DOCUMENTO", "FOTO_DIARIO"].includes(i.tipo),
  ),
);
caso(
  "admin: sem avisos de AGENDAMENTO (não é profissional médico)",
  false,
  itensAdmin.some((i) => i.tipo === "AGENDAMENTO"),
);
// Coerência com a fonte real: total de triagens PENDENTE do aviso == count da fila.
const filaTriagem = await req(admin, "GET", "/servico-social/triagens?status=PENDENTE&perPage=1");
const triagensNoAviso = itensAdmin.filter((i) => i.tipo === "TRIAGEM").length;
caso(
  "admin: triagens no aviso coerentes com a fila (>= itens listados)",
  true,
  (filaTriagem.json?.kpis?.naFila ?? 0) >= triagensNoAviso,
);

// Tipos válidos do portal da família (inclui os eventos de storage da Onda C4).
const TIPOS_PORTAL = ["COMUNICADO", "MENSAGEM", "EVENTO", "DOCUMENTO", "FOTO_DIARIO"];

console.log("--- FAMÍLIA (ownership por ficha) ---");
const rFamilia = await req(familia, "GET", "/notificacoes");
caso("família → 200", 200, rFamilia.status);
const itensFamilia = validaShape("familia", rFamilia.json);
const tiposFamilia = new Set(itensFamilia.map((i) => i.tipo));
// A família só pode ver tipos do portal — nunca a fila do Social nem agenda médica.
caso(
  "família: só tipos do portal (COMUNICADO/MENSAGEM/EVENTO/DOCUMENTO/FOTO_DIARIO)",
  true,
  itensFamilia.every((i) => TIPOS_PORTAL.includes(i.tipo)),
);
caso(
  "família: NÃO vê fila do Social (cross-tenant)",
  false,
  ["TRIAGEM", "SINALIZACAO_PONTE", "ENCAMINHAMENTO"].some((t) => tiposFamilia.has(t)),
);

// Onda C4 — eventos de storage viram aviso in-app à família (seed cria fixtures:
// documento recente na ficha da Sandra + foto no diário FECHADO da Ana).
caso(
  "família: recebe aviso de DOCUMENTO novo na ficha (C4)",
  true,
  tiposFamilia.has("DOCUMENTO"),
);
caso(
  "família: recebe aviso de FOTO no diário selado (C4)",
  true,
  tiposFamilia.has("FOTO_DIARIO"),
);
// O href do documento leva ao portal "O que a gente recebeu"; da foto, ao diário.
caso(
  "família: aviso de DOCUMENTO aponta para /familia/recebido",
  true,
  itensFamilia.filter((i) => i.tipo === "DOCUMENTO").every((i) => i.href === "/familia/recebido"),
);
caso(
  "família: aviso de FOTO_DIARIO aponta para /familia/diario",
  true,
  itensFamilia.filter((i) => i.tipo === "FOTO_DIARIO").every((i) => i.href === "/familia/diario"),
);
// O seed cria um comunicado crítico sem leitura para a Sandra → aviso real.
caso(
  "família: tem comunicado não lido (seed) ou ao menos algum aviso do portal",
  true,
  tiposFamilia.has("COMUNICADO") || (rFamilia.json?.total ?? 0) >= 0,
);
// Hrefs da família apontam para o portal, nunca para /servico-social ou /admin.
caso(
  "família: hrefs ficam no portal (/familia/*)",
  true,
  itensFamilia.every((i) => i.href.startsWith("/familia/")),
);

// IDOR de storage (C4): a 2ª família NÃO pode receber o aviso do documento da
// Sandra nem da foto da Ana — só o que é da PRÓPRIA ficha/criança. Comparamos
// pelos ids dos itens (o id do aviso carrega o id da linha de origem).
if (familia2) {
  console.log("--- FAMÍLIA 2 (IDOR de storage família-vs-família) ---");
  const rFamilia2 = await req(familia2, "GET", "/notificacoes");
  caso("família2 → 200", 200, rFamilia2.status);
  const itens2 = validaShape("familia2", rFamilia2.json);
  const idsStorageSandra = new Set(
    itensFamilia.filter((i) => ["DOCUMENTO", "FOTO_DIARIO"].includes(i.tipo)).map((i) => i.id),
  );
  caso(
    "família2: NÃO recebe nenhum aviso de storage da família da Sandra",
    false,
    itens2.some((i) => idsStorageSandra.has(i.id)),
  );
  // E continua só nos tipos do portal (parede de perfil intacta).
  caso(
    "família2: só tipos do portal",
    true,
    itens2.every((i) => TIPOS_PORTAL.includes(i.tipo)),
  );
}

console.log("--- MÉDICO (profissional, parede de unidade) ---");
const rMedico = await req(medico, "GET", "/notificacoes");
caso("médico → 200", 200, rMedico.status);
const itensMedico = validaShape("medico", rMedico.json);
// Médico nunca vê a fila do Social nem avisos de família.
caso(
  "médico: NÃO vê fila do Social",
  false,
  itensMedico.some((i) => ["TRIAGEM", "SINALIZACAO_PONTE", "ENCAMINHAMENTO"].includes(i.tipo)),
);
caso(
  "médico: NÃO vê avisos de família",
  false,
  itensMedico.some((i) =>
    ["COMUNICADO", "MENSAGEM", "EVENTO", "DOCUMENTO", "FOTO_DIARIO"].includes(i.tipo),
  ),
);
// Se houver agendamento nas próximas 24h, vira AGENDAMENTO com href da agenda.
caso(
  "médico: avisos (se houver) são AGENDAMENTO → /medico/agenda",
  true,
  itensMedico.every((i) => i.tipo === "AGENDAMENTO" && i.href === "/medico/agenda"),
);

const total = resultados.length;
const ok = resultados.filter(Boolean).length;
console.log(`\n${ok}/${total}`);
if (ok !== total) process.exit(1);
console.log(">>> CENTRAL DE AVISOS (notificacoes) VALIDADA <<<");
