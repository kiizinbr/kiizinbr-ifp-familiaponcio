/**
 * E2E ao vivo da mensagem 1:1 família↔instituto (1 conversa por criança).
 * Uso: SENHA_DEV=... node scripts/valida-mensagens.mjs
 * Cobre: get-or-create idempotente (equipe e família), envio dos dois lados,
 * contadores de não lidas, recibo de leitura (lidaEm) nas duas direções,
 * RBAC/tenant/ownership cruzados e validação de corpo/membroId.
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
const familia = await login("familia@ifp.local");
const instrutor = await login("instrutor@ifp.local");
const medico = await login("medico@ifp.local");

// Criança do seed (Ana) — mesmo caminho do valida-gestao-educacional
const turmas = await req(gestora, "GET", "/educacional/turmas");
const turma = turmas.json?.items?.[0];
const detalhe = await req(gestora, "GET", `/educacional/turmas/${turma?.id}`);
const membroId = detalhe.json?.matriculas?.[0]?.membroId;
if (!membroId) throw new Error("Criança do seed não encontrada — rode o seed");

console.log("--- GET-OR-CREATE (equipe) ---");
const abre1 = await req(gestora, "POST", "/educacional/conversas", { membroId });
caso("gestora -> abre conversa da Ana", 201, abre1.status);
const conversaId = abre1.json?.id;

const abre2 = await req(gestora, "POST", "/educacional/conversas", { membroId });
caso("2º POST idempotente (mesmo id)", true, Boolean(conversaId) && abre2.json?.id === conversaId);

const abreFam = await req(familia, "POST", "/familia/educacional/conversas", { membroId });
caso("família -> mesmo get-or-create (mesmo id)", true, abreFam.json?.id === conversaId);

console.log("--- EQUIPE ENVIA / FAMÍLIA LÊ (recibo) ---");
const marca = `[regressão ${new Date().toISOString().slice(0, 16)}]`;
const msgEquipe = await req(gestora, "POST", `/educacional/conversas/${conversaId}/mensagens`, {
  corpo: `Olá, Sandra! A Ana almoçou super bem hoje. ${marca}`,
});
caso("gestora -> envia mensagem", 201, msgEquipe.status);
caso("mensagem sai com ladoEquipe=true", true, msgEquipe.json?.ladoEquipe === true);
caso("mensagem nasce sem recibo (lidaEm=null)", true, msgEquipe.json?.lidaEm === null);

const listaFam = await req(familia, "GET", "/familia/educacional/conversas");
caso("família -> lista conversas", 200, listaFam.status);
const itemFam = listaFam.json?.items?.find((c) => c.id === conversaId);
caso("família vê naoLidas=1", 1, itemFam?.naoLidas);
caso("última mensagem é a da equipe", true, itemFam?.ultimaMensagem?.ladoEquipe === true);

const threadFam = await req(familia, "GET", `/familia/educacional/conversas/${conversaId}`);
caso("família -> abre thread", 200, threadFam.status);
const msgNaThread = threadFam.json?.mensagens?.find((m) => m.id === msgEquipe.json?.id);
caso("recibo: msg da equipe ganhou lidaEm", true, Boolean(msgNaThread?.lidaEm));

const listaFam2 = await req(familia, "GET", "/familia/educacional/conversas");
const itemFam2 = listaFam2.json?.items?.find((c) => c.id === conversaId);
caso("após ler, naoLidas volta a 0", 0, itemFam2?.naoLidas);

console.log("--- FAMÍLIA RESPONDE / EQUIPE LÊ (recibo) ---");
const msgFamilia = await req(familia, "POST", `/familia/educacional/conversas/${conversaId}/mensagens`, {
  corpo: `Que ótimo! Obrigada pelo carinho com ela. ${marca}`,
});
caso("família -> responde", 201, msgFamilia.status);
caso("resposta sai com ladoEquipe=false", true, msgFamilia.json?.ladoEquipe === false);

const listaEq = await req(gestora, "GET", "/educacional/conversas");
caso("gestora -> lista conversas da unidade", 200, listaEq.status);
const itemEq = listaEq.json?.items?.find((c) => c.id === conversaId);
caso("equipe vê naoLidas=1", 1, itemEq?.naoLidas);

const threadEq = await req(gestora, "GET", `/educacional/conversas/${conversaId}`);
caso("gestora -> abre thread", 200, threadEq.status);
const respostaNaThread = threadEq.json?.mensagens?.find((m) => m.id === msgFamilia.json?.id);
caso("recibo: msg da família ganhou lidaEm", true, Boolean(respostaNaThread?.lidaEm));
const ordemAsc =
  threadEq.json?.mensagens?.length >= 2 &&
  threadEq.json.mensagens.every(
    (m, i, arr) => i === 0 || new Date(arr[i - 1].criadoEm) <= new Date(m.criadoEm),
  );
caso("thread em ordem cronológica (asc)", true, Boolean(ordemAsc));

const listaEq2 = await req(gestora, "GET", "/educacional/conversas");
const itemEq2 = listaEq2.json?.items?.find((c) => c.id === conversaId);
caso("após ler, naoLidas da equipe volta a 0", 0, itemEq2?.naoLidas);

console.log("--- RBAC / TENANT / OWNERSHIP ---");
const famConsole = await req(familia, "GET", "/educacional/conversas");
caso("família -> console da equipe (RBAC)", 403, famConsole.status);

const instrutorEdu = await req(instrutor, "GET", "/educacional/conversas");
caso("instrutor (outra unidade) -> /educacional/conversas", 403, instrutorEdu.status);

const medicoFam = await req(medico, "GET", "/familia/educacional/conversas");
caso("médico (sem ficha) -> portal da família", 403, medicoFam.status);

const famForaFicha = await req(familia, "POST", "/familia/educacional/conversas", {
  membroId: "seed-membro-fora-unidade",
});
caso("família -> criança de OUTRA família (não vaza existência)", 404, famForaFicha.status);

console.log("--- VALIDAÇÕES DE ENTRADA ---");
const corpoVazio = await req(gestora, "POST", `/educacional/conversas/${conversaId}/mensagens`, {
  corpo: "   ",
});
caso("corpo vazio (só espaços)", 400, corpoVazio.status);

const corpoLongo = await req(gestora, "POST", `/educacional/conversas/${conversaId}/mensagens`, {
  corpo: "x".repeat(2001),
});
caso("corpo > 2000 caracteres", 400, corpoLongo.status);

const membroFantasma = await req(gestora, "POST", "/educacional/conversas", {
  membroId: "membro-que-nao-existe",
});
caso("membroId inexistente", 404, membroFantasma.status);

const membroForaUnidade = await req(gestora, "POST", "/educacional/conversas", {
  membroId: "seed-membro-fora-unidade",
});
caso("criança de outra unidade (não vaza existência)", 404, membroForaUnidade.status);

const conversaFantasma = await req(gestora, "GET", "/educacional/conversas/conversa-inexistente");
caso("thread de conversa inexistente", 404, conversaFantasma.status);

const total = resultados.length;
const ok = resultados.filter(Boolean).length;
console.log(`\n${ok}/${total}`);
if (ok !== total) process.exit(1);
console.log(">>> MENSAGENS FAMÍLIA↔INSTITUTO VALIDADAS <<<");
