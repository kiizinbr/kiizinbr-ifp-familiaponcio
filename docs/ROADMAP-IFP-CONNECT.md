# Roadmap IFP Connect — Onde Estamos e o Caminho até o Fim

> Documento de consolidação para retomar o fio depois dos brainstorms.
> Data: 2026-06-18 · Branch atual: `claude/continue-projetoifp-section-10` (linha CASA)

---

## 1. Recapitulação da ideia (o que estamos construindo)

O **IFP Connect** é a plataforma única do **Instituto Família Pôncio**: um monorepo Turbo
(API **NestJS** + web **Next.js**) com **um login só**, **tema por unidade** e **4 verticais**
operacionais. O eixo que diferencia o IFP de qualquer outro instituto é a **Ficha Cidadã
unificada**: a MESMA família pode receber consulta médica + curso + vaga na creche + faixa no
judô, e o sistema prova essa transformação cruzando unidades.

### A porta de entrada: "site → acesse o sistema → unidades"

O fluxo de acesso já está operacional e é o esqueleto da navegação:

```
Site público (vitrine)  →  /acesso (cards por unidade)  →  /login?unidade=<slug>  →  destino
   [HOJE é GAP]              [PRONTO]                        [PRONTO]                  [PRONTO]
```

- A **home pública** deveria ser a vitrine institucional (missão, 6 salões, impacto). Hoje a `/`
  é um hub logado — esse é o **gap nº 1**.
- `/acesso` lista as 4 unidades + Serviço Social + Portal da Família, cada card herda
  `data-theme` (cor do salão).
- `/login` herda a unidade pela URL, e pós-login joga direto no destino certo.
- **Anti-padrão proposital**: não há botão "trocar unidade" no header — a escolha é no login.

### As 3 audiências

| Audiência | O que recebe |
|---|---|
| **Público** | Vitrine institucional + verificação de certificados/graduações (sem login) |
| **Interno (por unidade)** | Console robusto: profissionais e gestores operando o domínio |
| **Família** | Portal mobile enxuto (3-4 telas): diário, comunicados, mensagens, ficha da criança |

---

## 2. ✅ PRONTO (entregue e validado)

| Item | Audiência | Prova |
|---|---|---|
| **Fundação CASA** (design system React) | interno | Galeria `/casa-ui`, tokens em `packages/design-tokens/tokens.css` |
| **Vertical Médico** (agenda + SOAP 5 passos + selo imutável) | interno | API `medico/` + web `/medico` · regressão 7/7 |
| **Vertical Capacitação** (turmas + matrícula c/ lock + certificado QR) | interno/público | Verificação pública `/verificar` · regressão 23/23 |
| **Vertical Educacional/Creche** (check-in/out + diário selado + portal família) | interno/família | 6 models Prisma + AutorizacaoImagem granular · 23/23 |
| **Vertical Esportivo** (modalidades + graduações + treinos) | interno/público | Verificação `/verificar-graduacao` · 29/29 |
| **Serviço Social** (Ficha Cidadã unificada + elegibilidade por unidade) | interno | API `fichas-cidadas/` + web `/servico-social` |
| **Mensagens 1:1 família↔instituto** (killer feature ClassApp) | família/interno | 1 conversa por criança, recibo por mensagem, anti-enumeração · 29/29 |
| **Fluxo de acesso por unidade** (`/` → `/acesso` → `/login`) | público/interno | Mapa em `apps/web/lib/unidades.ts` |
| **Reskin CASA de ~23 telas internas** | interno | Cada tela valida contra o Atlas |
| **Segurança adversarial** (23 achados tratados) | interno | Parede tenant em 21 call-sites, audit READ, locks, timezone fixo |
| **Migração Amplimed → IFP** (T1-T15, 47 profissionais) | gestão | Pronta na `main`, produção mirada p/ jun-2026 |
| **Presidência / Sala de Comando (Fase 1)** (painel, famílias, unidades, impacto, jornada) | gestão | API `presidencia/` + web `/presidencia` · dado REAL cross-unidade · regressão 30/30 |
| **Ambiente dev** (Docker WSL2: workstation + servidor CL-SRV-DC01) | interno | `ONDE-PARAMOS.md` |

**Resumo:** as 4 verticais + Serviço Social + acesso + design system estão **vivos e testados**
(122/122 em 5 suítes de regressão). A espinha dorsal do produto existe.

---

## 3. 🔄 EM ANDAMENTO (parcial — começou, falta acabar)

| Item | Audiência | O que falta |
|---|---|---|
| **Médico — prontuário/atendimento** | interno | Refino visual + prescrição estruturada, atestado, exame anexado, fila/triagem |
| **Capacitação — chamada dinâmica** | interno | UX da chamada (presença/falta) + catálogo de cursos público |
| **Esportivo — telas no rail** | interno | `ROTAS_PRONTAS=['/esportivo']`; resto "em breve" |
| **Educacional — indicadores + cadastro de autorizados** | interno/família | Tela de indicadores (só CASA) + cobertura de revogação |
| **Mensagens (web)** | interno/família | Integração tempo real (WebSocket/polling) não confirmada; sem paginação/rate-limit |
| **Detalhe de Criança / Ficha** | interno | Perguntas dinâmicas em refino |
| **Refino CASA** nas telas reskinadas | interno | Aplicar blocos PageHeader/Card/Kpi/ListRow (fila 🟢 loop autônomo) |
| **Reconciliação main × CASA** | gestão | **Decisão estratégica em aberto** (ver §6) |

---

## 4. ⏳ FALTANDO (gaps puros — não existe nada ainda)

### Público (o maior bloco de gaps — bloqueia go-to-market)
- **Landing institucional** (`(site)`): missão, 6 salões, impacto vivo. **Hoje `/` é hub logado.**
- **/transparencia** — indicadores agregados anonimizados + relatórios (exigência de OSC).
- **/doe** — doação Pix/recorrente + doação direcionada por unidade.
- **/voluntario** — captação + match por unidade + onboarding no RBAC.
- **/contato** — formulário + FAQ.
- **/unidades/[slug]** — páginas institucionais por salão com vagas em tempo real.
- **/como-ser-atendido** — triagem pública → pré-Ficha Cidadã.

### Interno
- **Médico**: fila de chegada/triagem de enfermagem, odontograma, indicadores, equipe.
- **Prescrição estruturada com bloqueio de alergia server-side** (⚠️ risco clínico, ver §6).
- **Encaminhamento entre unidades** como objeto de workflow (hoje é string solta).

### Família
- **Recuperar senha / primeiro acesso** (ZERO implementação — bloqueia go-live real).
- **Confirmação de presença / justificativa de falta** em 1 toque.
- **Fotos no diário** (com checagem AutorizacaoImagem + watermark).

### Gestão
- ~~**Presidência / Sala de Comando**~~ → **Fase 1 ENTREGUE** (19/06): painel, famílias, unidades,
  impacto e jornada da família, com dado REAL cross-unidade. Falta a **Fase 2** (telas que
  dependem de dado novo: custo/ROI, CRM de doadores, saúde populacional, prestação de contas e
  histórias por IA) + a tela "Relatórios" (hoje "em breve" no rail).
- **Admin / RBAC** — sem console de usuários/perfis/unidades/auditoria. Hoje é seed-dependente.

### Plataforma
- **Camada de notificação** (WhatsApp Business oficial + e-mail) — nada dispara hoje (é TODO).
- **Rate-limit** nos endpoints públicos de verificação (anti força-bruta).

---

## 5. 🚀 FASES até o fim (ordem recomendada e o porquê)

> Princípio de ordenação: primeiro **destravar o go-live** (acesso + admin + site), depois
> **encantar e diferenciar** (IA + WhatsApp), tratando o **risco clínico** em paralelo logo no começo.

### Fase A — Decisão e fundação (semana 0-1)
**Reconciliar com a `main` (Estratégia A)** e **blindar a prescrição/alergia**.
*Por quê:* a divergência de 314 commits só cresce; a `main` tem o motor de agenda + Amplimed
prontos para produção. E o bloqueio de alergia só no front é risco real para população vulnerável.
Tem que vir antes de empilhar features novas.

### Fase B — Destravar o go-live (semanas 1-4)
1. **Auth completo**: recuperar senha + primeiro acesso **por WhatsApp/SMS (OTP)** — público sem e-mail.
2. **Admin/RBAC**: console de usuários + **auto-provisionamento** (Serviço Social aprova → cria User família).
3. **Camada de notificação** (WhatsApp Business oficial) — peça transversal que faz o sistema "sair da tela".
*Por quê:* sem acesso autônomo, sem admin e sem notificação, o sistema não roda sem a equipe de TI no meio.

### Fase C — Porta de entrada pública (semanas 3-6, paralelizável com B)
1. **Landing CASA** com 6 salões + impacto vivo (contadores reais do banco).
2. **/transparencia** auto-gerada do banco operacional.
3. **/doe**, **/voluntario**, **/contato**, **/unidades/[slug]**.
*Por quê:* é o bloqueador nº1 de captação e presença institucional; reaproveita 100% do CASA + `/acesso`.

### Fase D — Olhos da diretoria (semanas 5-8)
1. **Sala de Comando da Presidência** com **Painel de Jornada da Família** (famílias ÚNICAS, profundidade por unidade).
2. **Gerador de prestação de contas em PDF com sumário escrito por IA**.
*Por quê:* governança pós-piloto e captação de doador/edital dependem disso.

### Fase E — Diferencial de IA e família (contínuo, alto valor/baixo esforço)
1. **Resumo do diário em áudio por IA** (literacia baixa).
2. **Linha do tempo da criança** cruzando unidades.
3. **Lembretes anti-evasão** (consulta, reavaliação, vencimento de autorização).
4. **Resumo clínico/social por IA** na abertura da prancha.
5. **Fotos no diário** + Banco de Modelos.
*Por quê:* são features que reaproveitam dados existentes e a IA gera sozinha — encaixam na meta
central do Erick (IA reduzindo trabalho manual) e dão o "uau" que retém família e abre carteira de doador.

---

## 6. ⚠️ Riscos e decisões em aberto

### Decisão 1 — Reconciliação `main` × branch CASA (BLOQUEADOR ESTRATÉGICO)
- **Situação:** 314 commits divergentes, 2 linhas sem ancestral comum.
- **`main`** tem: motor de agenda maduro (TDD), migração Amplimed pronta (produção ~30 dias), RBAC e consentimento LGPD versionados.
- **branch CASA** tem: arquitetura monorepo melhor, design aplicado, testes E2E cobrindo verticais.
- **Recomendação:** **Estratégia A** — usar `main` como base e portar o design CASA + E2E para ela (esforço **M**, 3-4 semanas). Preserva o motor de produção.
  - *Alternativa B* (branch CASA vira main): **XL**, refaz a migração Amplimed. *Não recomendada.*
- **Ação do Erick:** confirmar Estratégia A. Semana 1: validar motor em staging.

### Risco 2 — Segurança clínica (prescrição/alergia)
- O bloqueio de contraindicação (ex.: Dipirona) existe **só no front** da prancha SOAP.
- **Exige:** models `Prescricao`/`Atestado` + catálogo `Medicamento` + checagem **server-side** (409 + override auditado) antes de gravar.
- Fila 🔴 fullstack, **revisão humana obrigatória antes de mesclar**.

### Risco 3 — RLS PostgreSQL não configurado
- A parede multi-tenant é só na aplicação (TODO no schema). Bug de resolução de tenant = vazamento entre unidades. Considerar RLS de verdade no banco.

### Risco 4 — Endpoints públicos sem rate-limit
- Verificação de certificado/graduação pode ser raspada por força-bruta (nomes de beneficiários). Adicionar `@nestjs/throttler` + normalizar erros. Esforço baixo, valor alto.

### Risco 5 — Notificação é TODO
- Comunicados críticos, mensagens e fechamento de diário **não disparam nada**. Em público de baixa literacia, ninguém abre o app sozinho. Sem a camada de notificação, a adoção real não acontece.
