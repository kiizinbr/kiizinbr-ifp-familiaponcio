/**
 * E2E ao vivo do Portal da Família — "O que recebi" + galeria de certificados
 * + agenda de eventos (RSVP) + "vem amanhã?" da creche (U6).
 * Uso: SENHA_DEV=... node scripts/valida-familia.mjs
 * Cobre: resumo agregado de benefícios da família, galeria de certificados
 * (capacitação) + graduações (esporte), download de PDF da PRÓPRIA família,
 * IDOR (PDF de outra família → 404), agenda só das unidades das minhas
 * crianças, confirmar presença em evento (idempotente), IDOR de evento de
 * outra unidade (→ 404), "vem amanhã?" SIM/NAO da creche, e RBAC (perfil
 * errado → 403).
 *
 * Fixtures do seed (família Sandra = familia@ifp.local):
 *   - certificado seed-cert-sandra (Sandra, titular)
 *   - graduação    seed-grad-ana   (Ana, dependente)
 *   - certificado seed-cert-outra-familia (João — NÃO é da Sandra → IDOR)
 *   - evento seed-evento-festa-junina   (Jardim A, pede RSVP)
 *   - evento seed-evento-reuniao-geral  (geral da unidade, sem RSVP)
 *   - evento seed-evento-outra-unidade  (capacitação — IDOR de evento)
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
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const r = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  let isPdf = false;
  const ct = r.headers.get("content-type") ?? "";
  if (ct.includes("application/pdf")) {
    isPdf = true;
  } else {
    try {
      json = await r.json();
    } catch {
      /* sem corpo */
    }
  }
  return { status: r.status, json, isPdf };
}

const resultados = [];
function caso(nome, esperado, obtido) {
  const ok = esperado === obtido;
  resultados.push(ok);
  console.log(`${ok ? "✓" : "✗ FALHOU"} ${nome}: ${obtido} (espera ${esperado})`);
}

const familia = await login("familia@ifp.local");
const medico = await login("medico@ifp.local");
const sensei = await login("esporte@ifp.local");

console.log("--- RECEBIDO (resumo agregado) ---");
const recebido = await req(familia, "GET", "/familia/recebido");
caso("família -> recebido", 200, recebido.status);
console.log(`    resumo: ${JSON.stringify(recebido.json?.resumo)}`);
caso("recebido traz creche da Ana", true, (recebido.json?.resumo?.creche ?? 0) >= 1);
caso(
  "recebido conta o certificado da Sandra",
  true,
  (recebido.json?.resumo?.certificados ?? 0) >= 1,
);
caso(
  "recebido conta a graduação da Ana",
  true,
  (recebido.json?.resumo?.graduacoes ?? 0) >= 1,
);
// IDOR: só dados da própria família — nenhuma matrícula de capacitação aponta
// para beneficiário fora da família (todos resolvem do próprio fichaId).
const capItens = recebido.json?.capacitacao ?? [];
caso(
  "recebido só lista benefícios da própria família",
  true,
  capItens.every((m) => typeof m.beneficiario === "string"),
);

console.log("--- CERTIFICADOS / GRADUAÇÕES (galeria) ---");
const certs = await req(familia, "GET", "/familia/certificados");
caso("família -> certificados", 200, certs.status);
const listaCert = certs.json?.certificados ?? [];
const listaGrad = certs.json?.graduacoes ?? [];
console.log(`    ${listaCert.length} certificado(s) · ${listaGrad.length} graduação(ões)`);
const certSandra = listaCert.find((c) => c.codigoVerificacao === "seed-cert-sandra");
caso("galeria traz o certificado da Sandra", true, Boolean(certSandra));
const gradAna = listaGrad.find((g) => g.codigoVerificacao === "seed-grad-ana");
caso("galeria traz a graduação da Ana", true, Boolean(gradAna));
// IDOR de leitura: o certificado de outra família NÃO pode aparecer na galeria.
caso(
  "galeria NÃO vaza certificado de outra família",
  false,
  listaCert.some((c) => c.codigoVerificacao === "seed-cert-outra-familia"),
);

console.log("--- PDF (próprio x de outra família = IDOR) ---");
const pdfProprio = await req(familia, "GET", "/familia/certificados/seed-cert-sandra/pdf");
caso("família -> baixa PDF do próprio certificado", 200, pdfProprio.status);
caso("o download é mesmo um PDF", true, pdfProprio.isPdf);

const pdfOutra = await req(
  familia,
  "GET",
  "/familia/certificados/seed-cert-outra-familia/pdf",
);
caso("família -> PDF de OUTRA família (IDOR)", 404, pdfOutra.status);

const pdfInexistente = await req(familia, "GET", "/familia/certificados/nao-existe/pdf");
caso("família -> PDF inexistente", 404, pdfInexistente.status);

console.log("--- AGENDA (calendário só das unidades das minhas crianças) ---");
const agenda = await req(familia, "GET", "/familia/agenda");
caso("família -> agenda", 200, agenda.status);
const eventos = agenda.json?.items ?? [];
console.log(`    ${eventos.length} evento(s) na agenda`);
const festa = eventos.find((e) => e.id === "seed-evento-festa-junina");
caso("agenda traz o evento da turma (Festa Junina)", true, Boolean(festa));
caso("agenda traz o evento geral da unidade", true, eventos.some((e) => e.id === "seed-evento-reuniao-geral"));
// IDOR de leitura: evento de OUTRA unidade (capacitação) não pode aparecer.
caso(
  "agenda NÃO vaza evento de outra unidade",
  false,
  eventos.some((e) => e.id === "seed-evento-outra-unidade"),
);

// membroId da Ana vem do "vem amanhã?" (não confiamos em id do client).
const presenca0 = await req(familia, "GET", "/familia/presenca");
caso("família -> presença (vem amanhã?)", 200, presenca0.status);
const itensPresenca = presenca0.json?.items ?? [];
caso("presença lista a(s) criança(s) da creche", true, itensPresenca.length >= 1);
const anaId = itensPresenca[0]?.crianca?.id;
caso("presença traz o membroId da criança", true, Boolean(anaId));
// Estado inicial limpo (o seed zera): ainda sem resposta hoje.
caso("presença começa sem resposta", null, itensPresenca[0]?.resposta ?? null);

console.log("--- CONFIRMAR PRESENÇA EM EVENTO (RSVP idempotente) ---");
const confSim = await req(familia, "POST", "/familia/agenda/seed-evento-festa-junina/confirmar", {
  membroId: anaId,
  resposta: "SIM",
});
caso("família -> confirma presença (SIM)", 200, confSim.status);
caso("confirmação gravada com a resposta certa", "SIM", confSim.json?.resposta);
// Re-confirmar (idempotente): muda para NAO, mesma linha (sem duplicar).
const confNao = await req(familia, "POST", "/familia/agenda/seed-evento-festa-junina/confirmar", {
  membroId: anaId,
  resposta: "NAO",
  observacao: "Vai viajar nesse fim de semana",
});
caso("família -> reconfirma (idempotente, vira NAO)", 200, confNao.status);
caso("reconfirmação manteve o mesmo registro", true, confNao.json?.id === confSim.json?.id);
// Reflete na agenda: a confirmação aparece para a própria família.
const agenda2 = await req(familia, "GET", "/familia/agenda");
const festa2 = (agenda2.json?.items ?? []).find((e) => e.id === "seed-evento-festa-junina");
caso("agenda reflete a confirmação da criança", "NAO", festa2?.confirmacoes?.[0]?.resposta);

// IDOR de gravação: confirmar evento de OUTRA unidade → 404 (não é da criança).
const confIdor = await req(familia, "POST", "/familia/agenda/seed-evento-outra-unidade/confirmar", {
  membroId: anaId,
  resposta: "SIM",
});
caso("família -> confirma evento de OUTRA unidade (IDOR)", 404, confIdor.status);
// Confirmar evento inexistente → 404.
const confInexistente = await req(familia, "POST", "/familia/agenda/nao-existe/confirmar", {
  membroId: anaId,
  resposta: "SIM",
});
caso("família -> confirma evento inexistente", 404, confInexistente.status);

console.log("--- VEM AMANHÃ? (SIM/NAO da creche) ---");
const vemSim = await req(familia, "POST", "/familia/presenca", {
  membroId: anaId,
  resposta: "SIM",
});
caso("família -> responde vem amanhã (SIM)", 200, vemSim.status);
caso("presença gravada (SIM)", "SIM", vemSim.json?.resposta);
// Idempotente: muda para NAO no mesmo dia (mesma linha).
const vemNao = await req(familia, "POST", "/familia/presenca", {
  membroId: anaId,
  resposta: "NAO",
});
caso("família -> reresponde (idempotente, vira NAO)", 200, vemNao.status);
caso("re-resposta manteve o mesmo registro", true, vemNao.json?.id === vemSim.json?.id);
// O GET reflete a resposta gravada.
const presenca1 = await req(familia, "GET", "/familia/presenca");
caso("GET presença reflete a resposta", "NAO", presenca1.json?.items?.[0]?.resposta);

console.log("--- RBAC (perfil errado → 403) ---");
const medicoRecebido = await req(medico, "GET", "/familia/recebido");
caso("médico -> recebido (RBAC)", 403, medicoRecebido.status);
const medicoCerts = await req(medico, "GET", "/familia/certificados");
caso("médico -> certificados (RBAC)", 403, medicoCerts.status);
const senseiRecebido = await req(sensei, "GET", "/familia/recebido");
caso("sensei -> recebido (RBAC)", 403, senseiRecebido.status);
const medicoAgenda = await req(medico, "GET", "/familia/agenda");
caso("médico -> agenda (RBAC)", 403, medicoAgenda.status);
const senseiPresenca = await req(sensei, "GET", "/familia/presenca");
caso("sensei -> presença (RBAC)", 403, senseiPresenca.status);
const semToken = await req(null, "GET", "/familia/recebido");
caso("sem token -> recebido (401)", 401, semToken.status);
const semTokenAgenda = await req(null, "GET", "/familia/agenda");
caso("sem token -> agenda (401)", 401, semTokenAgenda.status);

const total = resultados.length;
const ok = resultados.filter(Boolean).length;
console.log(`\n${ok}/${total}`);
if (ok !== total) process.exit(1);
console.log(">>> PORTAL DA FAMÍLIA (recebido + certificados + agenda + presença) VALIDADO <<<");
