# Roteiro — Demo para a Diretoria (IFP Connect, design CASA)

> **Objetivo em 1 frase:** colher a validação da diretoria mostrando que CADA tela responde
> diretamente à pesquisa de SaaS que ELES pediram ("parece software de 5 anos atrás" → não parece mais).
> Fonte da pesquisa: `IFP - Research SaaS References por Vertical.md` (vault, 2026-05-28).
> Duração alvo: **15 min de demo + perguntas**. Siga na ordem. Não improvise tela nova.

---

## 1. Checklist de preparação (30 min antes)

Execute na raiz do repo, **nesta ordem**:

- [ ] **Banco:** `docker compose up -d` (Postgres na 5432). Se o Docker reclamar, `docker compose restart`.
- [ ] **IP da máquina:** `ipconfig` → anote o IPv4 (ex.: `192.168.1.50`). O celular precisa dele.
- [ ] **`.env` apontando pro IP** (sem isso a chamada no celular e o QR QUEBRAM — o browser do
      celular não resolve `localhost`):
  - `NEXTAUTH_URL="http://<IP>:3000"`
  - `NEXT_PUBLIC_API_URL="http://<IP>:3333/api/v1"`
  - `WEB_ORIGIN="http://<IP>:3000"` (CORS da API)
  - Confirme que `SEED_MEDICO_PASSWORD` está definida (é a senha da médica E do instrutor).
- [ ] **Seed:** `pnpm db:seed` — recria a **agenda de HOJE** (João 09:00, Maria 10:30, Pedro 14:00)
      e a **turma fresca BB-2026-2** (3 matrículas, sem aulas). Idempotente.
- [ ] **Subir tudo:** `pnpm dev` (web :3000, API :3333). Health-check: `http://localhost:3333/api/docs` abre o Swagger.
- [ ] **Certificado impresso (Ato 3):** logado, encerre a turma **BB-2026-1** (botão "Encerrar turma"
      no detalhe — ela já tem 2 aulas seladas no seed) → baixe o PDF do certificado → **imprima**.
      ⚠ **NÃO rode o seed de novo depois de imprimir** — o código do QR muda e o papel vira lixo.
- [ ] **Logins de teste** (senha = `SEED_MEDICO_PASSWORD` do `.env`):
  - `medico@ifp.local` — Dra. Ana Souza (Centro Médico)
  - `instrutor@ifp.local` — Carlos Barbosa (Capacitação)
- [ ] **Abas abertas no notebook:** ① `http://<IP>:3000/login` · ② `/medico` (já logado como médica)
      · ③ `/capacitacao/turmas` (aba anônima logada como instrutor).
- [ ] **Celular do Erick:** conectado no MESMO Wi-Fi, logado como instrutor em `http://<IP>:3000/capacitacao`.
      **Teste agora**: abrir a turma BB-2026-2 e marcar 1 presença de mentira (recarregue depois).
- [ ] **Teste o QR impresso com o SEU celular** — tem que abrir "Certificado autêntico". Se não abrir,
      o PDF foi gerado antes do `.env` apontar pro IP: regere e reimprima.
- [ ] **Plano B pronto:** screenshots de cada tela do roteiro tirados no ensaio (pasta na área de
      trabalho); código do certificado anotado em papel (digita `/verificar/<codigo>` na mão se o QR falhar).

---

## 2. Narrativa em 3 atos (~15 min)

### Ato 1 — Centro Médico (7 min, no notebook)

| # | Tela / ação | Frase-chave (amarra na pesquisa DELES) |
|---|---|---|
| 1 | Login → dashboard `/medico` (KPIs: Pacientes hoje, Aguardando, Em atendimento, Concluídos) | "Vocês pediram referências de mercado. Esta é a **densidade operacional** que Doctolib e iClinic usam: número grande, zero enfeite, visão do dia em 3 segundos." |
| 2 | **Agenda do dia** (fila com hora, paciente, idade, motivo, status) | "A pesquisa apontou: no **Doctolib**, agenda + fila do dia é a tela nº 1 — é o que toda secretária já entende. Copiamos o padrão, não inventamos." |
| 3 | Abrir o **João da Silva (09:00)** → prancha com chips vermelhos **Alergia: Dipirona (grave)** e **Asma** | "Isto é o console clínico do **Elation Health** (Best in KLAS) simplificado pro voluntário do IFP. A alergia grita ANTES do médico digitar qualquer coisa — segurança do paciente em primeiro lugar." |
| 4 | Percorrer o stepper **Resumo → Queixa → Exame → Conduta**; preencher SOAP + vitais; na Conduta, digitar "dipirona" de propósito → aparece o aviso de alergia | "O sistema cruza a conduta com as alergias do paciente em tempo real — o padrão **iClinic + Memed** de checagem inline." |
| 5 | Passo **Selo** → "Selar atendimento" → volta pra agenda com status **Concluído** | "Selou, virou documento. Padrão de prontuário médico-legal." |
| 6 | Reabrir o atendimento do João → tudo em **somente leitura** ("Atendimento selado em…") | "**Imutável.** Ninguém — nem eu, admin — edita prontuário selado. E cada leitura fica registrada em auditoria (LGPD)." |

### Ato 2 — Capacitação (5 min, termina NO CELULAR)

| # | Tela / ação | Frase-chave |
|---|---|---|
| 1 | Login instrutor → dashboard `/capacitacao` (KPIs: turmas, alunos ativos, certificados, lista de espera) | "Mesma casa, outra cor — a identidade por unidade vem do accent, como **Disco** e **Thinkific** fazem no white-label. Reparem no vocabulário: aluno é **beneficiário**, não cliente." |
| 2 | Turmas → abrir **BB-2026-2** (Barbearia, turma fresca) → criar a aula de hoje | "Matrícula só de família **APROVADA pelo Serviço Social** — a regra de ouro do Instituto está no sistema, não na boa vontade." |
| 3 | **Pega o celular**: abrir a chamada da aula → P/F/J em **1 toque** por aluno → Salvar → Selar a aula | "A pesquisa foi clara: presença é **mobile-first** (padrão **Brightwheel**, líder nos EUA). O instrutor faz a chamada do celular dele, na sala, em 30 segundos. Selou, a chamada também vira imutável." |
| 4 | De volta ao notebook: detalhe da turma com presença % por aluno | "Frequência alimenta a regra do **CapacitaSUAS: 80% de presença** = certificado. Quem não atinge, o sistema nega sozinho — modelo de fluxo do **Sponte/TOTVS**, sem o visual de ERP." |

### Ato 3 — O golpe de teatro (3 min, no celular DO DIRETOR)

1. Entregue o **certificado impresso** (da BB-2026-1) na mão do diretor.
2. Peça: **"Escaneia esse QR com o SEU celular."** (não toque no celular dele)
3. Abre a página pública: ✅ **"Certificado autêntico"** — nome do aluno, curso, turma, carga
   horária cumprida, % de presença, data de emissão. **Sem login, sem CPF exposto.**
4. Ele mesmo toca em **"Baixar certificado (PDF)"**.

**Frase de fechamento:** "Esse papel pode ser o **primeiro certificado da vida** desse aluno — e
qualquer empregador de Caxias valida a autenticidade em 5 segundos. Nenhum dos SaaS que pesquisamos
entrega isso de graça. **Anti-fraude + dignidade**, na infraestrutura do próprio Instituto."

> Se o QR falhar no celular dele: digite `http://<IP>:3000/verificar/<codigo>` (papel do checklist) — sem drama, continue falando.

---

## 3. Perguntas prováveis × respostas curtas

- **"Quanto custa?"** — Licença: zero. Roda em servidor próprio (Docker, já documentado para o
  on-prem). Os SaaS de referência cobram por profissional/aluno/mês; aqui o custo é a infra que já
  existe + meu tempo de desenvolvimento, acelerado por IA.
- **"Quando entra em produção?"** — As duas verticais que vocês viram funcionam ponta a ponta com
  dado real hoje, em ambiente de desenvolvimento. Falta: deploy no servidor (roteiro pronto em
  `docs/deploy-onprem-hyperv.md`), testes de ponta a ponta e um reforço de segurança de banco já
  mapeado. Proposta: **piloto controlado com 1 médico e 1 turma real** nas próximas semanas.
- **"E os dados de menores / LGPD?"** — Dado socioeconômico fica trancado no Serviço Social; o
  instrutor vê só nome e presença. Toda leitura de prontuário gera registro de auditoria. A página
  pública do certificado não expõe CPF. Matrícula de menor exige consentimento do titular. Pendência
  conhecida (isolamento por unidade no banco) está documentada e entra antes do piloto.
- **"Quem mantém isso?"** — Eu (TI), usando IA como ferramenta de desenvolvimento. A stack é padrão
  de mercado (TypeScript, Next.js, NestJS, Postgres) — qualquer dev contratado assume; tudo
  documentado em blueprints dentro do repositório.
- **"Dá pra usar nas outras unidades?"** — Sim, é o desenho: Recreativo e Esportivo seguem o mesmo
  molde (a pesquisa já mapeou Brightwheel/ClassApp e TeamSnap/Heja como referências). Cada vertical
  nova reusa login, perfis, auditoria e a Ficha Cidadã.

---

## 4. O que NÃO mostrar (e como desviar)

- **Serviço Social** — ainda no visual antigo (sem tema CASA). Se pedirem: *"É a próxima a ganhar
  esta roupagem — hoje quis mostrar as duas que já estão de ponta a ponta."* Não abra a tela.
- **Login de admin na agenda médica** — dá "acesso negado" (admin não tem cadastro de profissional).
  Use SEMPRE os logins do checklist.
- **Editar atendimento/aula selados** — devolve erro 409. Só toque no assunto como argumento de
  imutabilidade (Ato 1, passo 6); nunca clique em salvar numa tela selada.
- **Ditado por voz, prescrição estruturada, alerta automático de evasão** — fase 2. Se perguntarem:
  *"Está no mapa; hoje mostrei o que já funciona de verdade."* Não prometa data.
- **Modo offline da chamada** — hoje é retry de rede, não offline real. NÃO desligue o Wi-Fi para
  "provar". Se perguntarem: *"Tolera oscilação; offline completo está planejado."*
- **Turma BB-2026-1 depois de encerrada** — não tente reencerrar nem mexer; ela só existe para o
  certificado impresso.
- **Rodar seed na frente deles / mexer em `.env`** — preparação é antes. Na demo, só navegação.

---

## 5. Se algo quebrar ao vivo (plano B em 1 linha cada)

- **API caiu** → alt-tab pro terminal, `pnpm dev` de novo; enquanto sobe, fale da pesquisa (tabela do Ato 1).
- **Celular sem rede** → faça a chamada no notebook com a janela estreitada ("é a mesma tela, responsiva").
- **QR não lê** → URL manual `/verificar/<codigo>` (papel do checklist).
- **Tudo caiu** → screenshots do ensaio, sem pedir desculpas duas vezes: *"ambiente de desenvolvimento;
  o que importa é o fluxo, que vocês acabaram de ver funcionando."*

**Última frase da demo (peça a validação explicitamente):** *"Isso responde ao que vocês pediram na
pesquisa? Se sim, eu sigo: piloto real dessas duas unidades e a mesma receita para as outras duas."*
