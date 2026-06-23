/**
 * E2E ao vivo da EDIÇÃO da Ficha Cidadã (C1) — Serviço Social passa a editar
 * inline os dados do TITULAR e a COMPOSIÇÃO FAMILIAR (não só a elegibilidade).
 *
 * Cobre:
 *  - admin (SUPER_ADMIN, mesmo gate de SERVICO_SOCIAL) edita o titular → 200 e PERSISTE
 *    (relê a ficha e confere os campos gravados);
 *  - edita um membro da composição familiar (PUT /membros) → 200 e persiste;
 *  - CPF é IMUTÁVEL: PATCH tentando trocar o CPF não altera o CPF da ficha;
 *  - RBAC: perfil errado (família/médico) → 403; sem token → 401.
 *
 * Anti-flaky: o script CRIA a própria ficha (CPF aleatório) e edita o ID que
 * criou — não depende de contagem nem de fixtures de outras regressões.
 *
 * Uso: SENHA_ADMIN=<senha admin> SENHA_DEV=<senha dev/profissionais> \
 *      node scripts/valida-social-ficha.mjs
 */
const API = process.env.API_URL_TESTE ?? "http://127.0.0.1:3333/api/v1";
const SENHA = process.env.SENHA_DEV;
const SENHA_ADMIN = process.env.SENHA_ADMIN ?? SENHA;
if (!SENHA) {
  console.error("Defina SENHA_DEV (e SENHA_ADMIN)");
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

async function req(token, method, path, body) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const r = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
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
function ok(nome, cond) {
  resultados.push(Boolean(cond));
  console.log(`${cond ? "✓" : "✗ FALHOU"} ${nome}`);
}

/** CPF de 11 dígitos pseudo-aleatório (não precisa ser válido p/ o teste). */
function cpfAleatorio() {
  let s = "";
  for (let i = 0; i < 11; i++) s += Math.floor(Math.random() * 10);
  return s;
}

const admin = await login("admin@ifp.local", SENHA_ADMIN); // SUPER_ADMIN passa no gate
const familia = await login("familia@ifp.local"); // RESPONSAVEL_FAMILIAR (perfil errado)
const medico = await login("medico@ifp.local"); // PROFISSIONAL (perfil errado)

const cpfTitular = cpfAleatorio();
console.log("--- SETUP: cria a ficha que vou editar ---");
const criada = await req(admin, "POST", "/fichas-cidadas", {
  nomeCompleto: "Titular Edicao Teste",
  cpf: cpfTitular,
  dataNascimento: "1985-03-10",
  telefone: "2133334444",
  estadoCivil: "SOLTEIRO",
});
caso("admin cria ficha base (201)", 201, criada.status);
const fichaId = criada.json?.id;
ok("ficha criada tem id", Boolean(fichaId));
ok("ficha nasce com protocolo", Boolean(criada.json?.protocolo));
const protocoloOriginal = criada.json?.protocolo;

console.log("--- EDITAR TITULAR (PATCH) → 200 + persiste ---");
const editTitular = await req(admin, "PATCH", `/fichas-cidadas/${fichaId}`, {
  nomeCompleto: "Titular Editado QA",
  telefone: "2199998888",
  estadoCivil: "CASADO",
  escolaridade: "MEDIO_COMPLETO",
  email: "titular.qa@example.com",
  cep: "25000000",
  logradouro: "Rua das Flores",
  numero: "123",
  bairro: "Centro",
  cidade: "Duque de Caxias",
  uf: "RJ",
});
caso("admin edita titular (200)", 200, editTitular.status);
caso("nome atualizado na resposta", "Titular Editado QA", editTitular.json?.nomeCompleto);

// Persistência: relê a ficha e confere os campos gravados.
const relido = await req(admin, "GET", `/fichas-cidadas/${fichaId}`);
caso("relê a ficha (200)", 200, relido.status);
caso("nome PERSISTIU", "Titular Editado QA", relido.json?.nomeCompleto);
caso("telefone PERSISTIU", "2199998888", relido.json?.telefone);
caso("estado civil PERSISTIU", "CASADO", relido.json?.estadoCivil);
caso("escolaridade PERSISTIU", "MEDIO_COMPLETO", relido.json?.escolaridade);
caso("e-mail PERSISTIU", "titular.qa@example.com", relido.json?.email);
caso("logradouro PERSISTIU", "Rua das Flores", relido.json?.logradouro);
caso("bairro PERSISTIU", "Centro", relido.json?.bairro);

console.log("--- CPF/PROTOCOLO IMUTÁVEIS ---");
const novoCpf = cpfAleatorio();
const tentaTrocarCpf = await req(admin, "PATCH", `/fichas-cidadas/${fichaId}`, {
  cpf: novoCpf,
  nomeCompleto: "Titular Editado QA 2",
});
caso("PATCH com cpf no corpo → 200 (ignora o cpf)", 200, tentaTrocarCpf.status);
const depoisCpf = await req(admin, "GET", `/fichas-cidadas/${fichaId}`);
caso("CPF NÃO mudou (imutável)", cpfTitular, depoisCpf.json?.cpf);
caso("protocolo NÃO mudou (imutável)", protocoloOriginal, depoisCpf.json?.protocolo);
caso("nome do mesmo PATCH foi aplicado", "Titular Editado QA 2", depoisCpf.json?.nomeCompleto);

console.log("--- EDITAR MEMBRO (PUT /membros) → 200 + persiste ---");
// Cria um membro novo via PUT (reconciliação por chave natural).
const cpfMembro = cpfAleatorio();
const addMembro = await req(admin, "PUT", `/fichas-cidadas/${fichaId}/membros`, {
  membros: [
    {
      nomeCompleto: "Membro Edicao Teste",
      cpf: cpfMembro,
      dataNascimento: "2010-07-01",
      parentesco: "FILHO",
      ocupacao: "Estudante",
    },
  ],
});
caso("admin adiciona membro (200)", 200, addMembro.status);
const membroId = addMembro.json?.membros?.find((m) => m.cpf === cpfMembro)?.id;
ok("membro criado tem id", Boolean(membroId));

// Edita o MESMO membro (mesma chave natural = cpf): muda ocupação e escolaridade.
const editMembro = await req(admin, "PUT", `/fichas-cidadas/${fichaId}/membros`, {
  membros: [
    {
      nomeCompleto: "Membro Editado QA",
      cpf: cpfMembro,
      dataNascimento: "2010-07-01",
      parentesco: "FILHA",
      ocupacao: "Aluna do fundamental",
      escolaridade: "FUND_INCOMPLETO",
    },
  ],
});
caso("admin edita membro (200)", 200, editMembro.status);
const membroDepois = editMembro.json?.membros?.find((m) => m.cpf === cpfMembro);
caso("membro preserva o MESMO id (reconciliação)", membroId, membroDepois?.id);
caso("nome do membro PERSISTIU", "Membro Editado QA", membroDepois?.nomeCompleto);
caso("parentesco do membro PERSISTIU", "FILHA", membroDepois?.parentesco);
caso("ocupação do membro PERSISTIU", "Aluna do fundamental", membroDepois?.ocupacao);
caso("escolaridade do membro PERSISTIU", "FUND_INCOMPLETO", membroDepois?.escolaridade);

console.log("--- VALIDAÇÃO class-validator (campo inválido → 400) ---");
const invalido = await req(admin, "PATCH", `/fichas-cidadas/${fichaId}`, {
  email: "isto-nao-e-email",
});
caso("e-mail inválido no PATCH → 400", 400, invalido.status);

console.log("--- RBAC (perfil errado → 403; sem token → 401) ---");
caso(
  "família -> PATCH titular (RBAC)",
  403,
  (await req(familia, "PATCH", `/fichas-cidadas/${fichaId}`, { nomeCompleto: "Hacker" })).status,
);
caso(
  "médico -> PATCH titular (RBAC)",
  403,
  (await req(medico, "PATCH", `/fichas-cidadas/${fichaId}`, { nomeCompleto: "Hacker" })).status,
);
caso(
  "família -> PUT membros (RBAC)",
  403,
  (await req(familia, "PUT", `/fichas-cidadas/${fichaId}/membros`, { membros: [] })).status,
);
caso(
  "médico -> PUT membros (RBAC)",
  403,
  (await req(medico, "PUT", `/fichas-cidadas/${fichaId}/membros`, { membros: [] })).status,
);
caso(
  "sem token -> PATCH titular (401)",
  401,
  (await req(null, "PATCH", `/fichas-cidadas/${fichaId}`, { nomeCompleto: "Anon" })).status,
);
caso(
  "sem token -> PUT membros (401)",
  401,
  (await req(null, "PUT", `/fichas-cidadas/${fichaId}/membros`, { membros: [] })).status,
);

const total = resultados.length;
const okc = resultados.filter(Boolean).length;
console.log(`\n${okc}/${total}`);
if (okc !== total) process.exit(1);
console.log(">>> EDIÇÃO DA FICHA CIDADÃ (TITULAR + MEMBROS) VALIDADA <<<");
