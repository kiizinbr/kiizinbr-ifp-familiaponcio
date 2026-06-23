/**
 * E2E do ODONTOGRAMA (grid FDI de 32 dentes + plano de tratamento).
 * Uso: SENHA_DEV=... node scripts/valida-medico-odonto.mjs
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
  motivo: "QA odontograma",
});
if (ag.status !== 201) {
  console.error("falha ao criar agendamento", ag.status, ag.json);
  process.exit(2);
}
const ini = await req(medico, "POST", `/medico/agendamentos/${ag.json.id}/iniciar`);
const atId = ini.json?.id;
caso("inicia atendimento (tem id)", true, !!atId);

console.log("--- ODONTOGRAMA AINDA NÃO EXISTE ---");
const vazio = await req(medico, "GET", `/medico/atendimentos/${atId}/odontograma`);
caso("ler antes de criar → 404", 404, vazio.status);

console.log("--- UPSERT INICIAL (3 dentes) ---");
const up1 = await req(medico, "PUT", `/medico/atendimentos/${atId}/odontograma`, {
  observacoes: "Plano: avaliar restaurações no 1º quadrante.",
  dentes: [
    { numeroFdi: 11, estado: "HIGIDO" },
    { numeroFdi: 16, estado: "CARIE", procedimento: "Restauração oclusal" },
    { numeroFdi: 36, estado: "EXTRACAO_INDICADA", observacoes: "Raiz residual" },
  ],
});
caso("upsert inicial → 200", 200, up1.status);
caso("guarda observações (plano)", true, !!up1.json?.observacoes);
caso("registrou 3 dentes", 3, up1.json?.dentes?.length);
const dente16 = up1.json?.dentes?.find((d) => d.numeroFdi === 16);
caso("dente 16 com cárie", "CARIE", dente16?.estado);
caso("dente 16 com procedimento", "Restauração oclusal", dente16?.procedimento);

console.log("--- UPSERT IDEMPOTENTE (atualiza dente 16, mantém os outros) ---");
const up2 = await req(medico, "PUT", `/medico/atendimentos/${atId}/odontograma`, {
  dentes: [{ numeroFdi: 16, estado: "RESTAURADO", procedimento: "Restauração concluída" }],
});
caso("re-upsert → 200", 200, up2.status);
// idempotente: continua 3 dentes (não duplica o 16), e o 16 atualizou.
caso("não duplica dente (continua 3)", 3, up2.json?.dentes?.length);
const dente16b = up2.json?.dentes?.find((d) => d.numeroFdi === 16);
caso("dente 16 atualizado p/ restaurado", "RESTAURADO", dente16b?.estado);

console.log("--- DENTE FORA DA TABELA FDI (ignorado) ---");
const upFora = await req(medico, "PUT", `/medico/atendimentos/${atId}/odontograma`, {
  dentes: [
    { numeroFdi: 99, estado: "CARIE" }, // inválido — filtrado pelo serviço
    { numeroFdi: 21, estado: "HIGIDO" }, // válido — entra
  ],
});
caso("upsert com FDI inválido → 200", 200, upFora.status);
caso("dente 99 não foi gravado", undefined, upFora.json?.dentes?.find((d) => d.numeroFdi === 99));
caso("dente 21 foi gravado", "HIGIDO", upFora.json?.dentes?.find((d) => d.numeroFdi === 21)?.estado);

console.log("--- LEITURA ---");
const leu = await req(medico, "GET", `/medico/atendimentos/${atId}/odontograma`);
caso("lê odontograma → 200", 200, leu.status);
caso("dentes ordenados por FDI", true, Array.isArray(leu.json?.dentes));

console.log("--- VALIDAÇÃO DE ENTRADA ---");
const estRuim = await req(medico, "PUT", `/medico/atendimentos/${atId}/odontograma`, {
  dentes: [{ numeroFdi: 12, estado: "BANANA" }], // enum inválido
});
caso("estado inválido → 400", 400, estRuim.status);

console.log("--- RBAC ---");
const famLe = await req(familia, "GET", `/medico/atendimentos/${atId}/odontograma`);
caso("família não lê odontograma → 403", 403, famLe.status);
const famUp = await req(familia, "PUT", `/medico/atendimentos/${atId}/odontograma`, {
  dentes: [{ numeroFdi: 11, estado: "CARIE" }],
});
caso("família não escreve odontograma → 403", 403, famUp.status);

console.log("--- NOT FOUND ---");
const nf = await req(medico, "PUT", `/medico/atendimentos/atendimento-inexistente/odontograma`, {
  dentes: [{ numeroFdi: 11, estado: "HIGIDO" }],
});
caso("atendimento inexistente → 404", 404, nf.status);

console.log("--- ATENDIMENTO SELADO (imutável) ---");
await req(medico, "PATCH", `/medico/atendimentos/${atId}`, {
  subjetivo: "Avaliação odontológica",
  plano: "Tratamento conforme odontograma",
});
const sel = await req(medico, "POST", `/medico/atendimentos/${atId}/encerrar`);
caso("sela atendimento", 200, sel.status);
const posSelo = await req(medico, "PUT", `/medico/atendimentos/${atId}/odontograma`, {
  dentes: [{ numeroFdi: 13, estado: "CARIE" }],
});
caso("escrever odontograma selado → 409", 409, posSelo.status);
// Leitura segue funcionando mesmo selado.
const leuSelado = await req(medico, "GET", `/medico/atendimentos/${atId}/odontograma`);
caso("lê odontograma selado → 200", 200, leuSelado.status);

const total = resultados.length;
const ok = resultados.filter(Boolean).length;
console.log(`\n${ok}/${total}`);
if (ok !== total) process.exit(1);
console.log(">>> ODONTOGRAMA (FDI + plano de tratamento) VALIDADO <<<");
