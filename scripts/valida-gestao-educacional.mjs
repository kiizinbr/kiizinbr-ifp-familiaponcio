/**
 * E2E ao vivo da GESTÃO da vertical Educacional (telas novas da gestora).
 * Uso: SENHA_DEV=... node scripts/valida-gestao-educacional.mjs
 * Cobre: publicar comunicado (geral/turma inexistente), RBAC de publicação,
 * leitura no portal da família, cadastro/revogação de autorizado e
 * concessão/revogação de autorização de imagem por escopo.
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
  const j = await r.json();
  return j.accessToken ?? j.access_token ?? j.token;
}

async function req(token, method, path, body) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
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
  console.log(`${ok ? "✓" : "✗ FALHOU"} ${nome}: ${obtido} (espera ${esperado})`);
}

const gestora = await login("gestora@ifp.local");
const educadora = await login("educadora@ifp.local");
const familia = await login("familia@ifp.local");

console.log("--- COMUNICADOS (gestora) ---");
const marca = `[regressão ${new Date().toISOString().slice(0, 16)}]`;
const novo = await req(gestora, "POST", "/educacional/comunicados", {
  titulo: `Aviso geral ${marca}`,
  corpo: "Comunicado criado pelo script de regressão da gestão.",
  critico: false,
});
caso("gestora -> publica comunicado geral", 201, novo.status);

const turmaErrada = await req(gestora, "POST", "/educacional/comunicados", {
  titulo: `Aviso turma fantasma ${marca}`,
  corpo: "Não deve existir.",
  turmaId: "turma-inexistente",
});
caso("gestora -> turma inexistente", 404, turmaErrada.status);

const negadoEducadora = await req(educadora, "POST", "/educacional/comunicados", {
  titulo: "Educadora não publica",
  corpo: "RBAC deve barrar.",
});
caso("educadora -> publicar (RBAC)", 403, negadoEducadora.status);

const lista = await req(gestora, "GET", "/educacional/comunicados");
caso("gestora -> lista da unidade", 200, lista.status);
const achou = lista.json?.items?.some((c) => c.id === novo.json?.id);
caso("lista contém o publicado", true, Boolean(achou));
const comLeituras = lista.json?.items?.every(
  (c) => typeof c._count?.leituras === "number",
);
caso("todos os itens trazem nº de leituras", true, Boolean(comLeituras));

const listaFamilia = await req(familia, "GET", "/familia/educacional/comunicados");
caso("família -> vê comunicados", 200, listaFamilia.status);
const familiaVe = listaFamilia.json?.items?.some((c) => c.id === novo.json?.id);
caso("família vê o recém-publicado", true, Boolean(familiaVe));

console.log("--- AUTORIZADOS (gestora) ---");
const turmas = await req(gestora, "GET", "/educacional/turmas");
const turma = turmas.json?.items?.[0];
const detalhe = await req(gestora, "GET", `/educacional/turmas/${turma.id}`);
const membroId = detalhe.json?.matriculas?.[0]?.membroId;
if (!membroId) throw new Error("Criança do seed não encontrada — rode o seed");

const autorizado = await req(gestora, "POST", `/educacional/criancas/${membroId}/autorizados`, {
  nome: `Tia Regressão ${marca}`,
  documento: "DOC-REGRESSAO-1",
  parentesco: "tia",
});
caso("gestora -> cadastra autorizado", 201, autorizado.status);

const negadoCriar = await req(educadora, "POST", `/educacional/criancas/${membroId}/autorizados`, {
  nome: "Educadora não cadastra",
  documento: "DOC-X",
  parentesco: "tio",
});
caso("educadora -> cadastrar (RBAC)", 403, negadoCriar.status);

const revogacao = await req(
  gestora,
  "PATCH",
  `/educacional/criancas/autorizados/${autorizado.json?.id}/revogar`,
);
caso("gestora -> revoga autorizado", 200, revogacao.status);
caso("revogação preenche revogadoEm", true, Boolean(revogacao.json?.revogadoEm));

const perfil = await req(gestora, "GET", `/educacional/criancas/${membroId}`);
const aindaListado = perfil.json?.autorizados?.some(
  (a) => a.id === autorizado.json?.id && a.revogadoEm,
);
caso("registro preservado (nunca delete)", true, Boolean(aindaListado));

console.log("--- AUTORIZAÇÃO DE IMAGEM (gestora) ---");
const concede = await req(
  gestora,
  "PATCH",
  `/educacional/criancas/${membroId}/autorizacoes-imagem/REDES_IFP`,
  { concedido: true },
);
caso("gestora -> concede REDES_IFP", 200, concede.status);

const perfilImg = await req(gestora, "GET", `/educacional/criancas/${membroId}`);
const redes = perfilImg.json?.autorizacoesImagem?.find((a) => a.escopo === "REDES_IFP");
caso("perfil reflete concessão", true, Boolean(redes?.concedido && !redes?.revogadoEm));

const revoga = await req(
  gestora,
  "PATCH",
  `/educacional/criancas/${membroId}/autorizacoes-imagem/REDES_IFP`,
  { concedido: false },
);
caso("gestora -> revoga REDES_IFP (volta ao default)", 200, revoga.status);

const negadoFamilia = await req(
  familia,
  "PATCH",
  `/educacional/criancas/${membroId}/autorizacoes-imagem/IMPRENSA`,
  { concedido: true },
);
caso("família -> imagem (RBAC)", 403, negadoFamilia.status);

const total = resultados.length;
const ok = resultados.filter(Boolean).length;
console.log(`\n${ok}/${total}`);
if (ok !== total) process.exit(1);
console.log(">>> GESTÃO EDUCACIONAL VALIDADA <<<");
