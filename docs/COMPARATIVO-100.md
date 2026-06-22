# COMPARATIVO — o que falta para o IFP Connect ficar 100%

> **Gerado em 2026-06-22** por auditoria automatizada (10 agentes em paralelo + 2ª passada
> cética que abriu os arquivos para confirmar cada veredito). Método: cruzar o **Atlas**
> (telas-alvo, `…\IFP-Instituto\atlas\*.html`) e o **PLANO-FECHAR-GAP.json** contra o que
> **realmente existe** no app React (`apps/web`) e na API (`apps/api`) — verificando se a
> tela consome endpoint real (sem mock/stub/placeholder).
>
> **Este doc é a fonte de verdade do gap** (o `ONDE-PARAMOS.md` está defasado em ~11 dias).
> Branch: `claude/continue-projetoifp-section-10-RKC1n`.

## 📊 Placar global

| | Telas | % |
|---|---|---|
| ✅ **COMPLETO** (tela + API reais cobrindo o alvo) | **42** | 45% |
| 🟡 **PARCIAL** (existe, mas incompleta / sem API / placeholder) | **8** | 9% |
| 🔴 **FALTA** (não existe) | **43** | 46% |
| **Total avaliado** | **93** | — |

**Conclusão global ponderada por cobertura: ~48%.**

O **núcleo operacional logado está maduro e ponta-a-ponta** (verticais Médico, Capacitação,
Educacional, Esportivo, Serviço Social e a Sala de Comando da Presidência têm fluxo real com
RBAC + auditoria LGPD). O que falta concentra-se em **3 frentes**: (1) **camadas de analytics
e IA** das áreas, (2) o **Portal da Família** ainda enxuto, e (3) **tudo que é "borda do
sistema"** — site público, admin/plataforma e telas comuns (perfil/busca/notificações/403).

## 🏅 Ranking de prontidão por área

| # | Área | % | ✅ | 🟡 | 🔴 |
|---|------|---|----|----|----|
| 1 | Serviço Social (porta de entrada) | **74%** | 7 | 1 | 2 |
| 2 | Capacitação | **71%** | 7 | 2 | 1 |
| 3 | Médico (Centro Médico) | **60%** | 9 | 0 | 6 |
| 4 | Esportivo | **56%** | 1 | 2 | 1 |
| 5 | Educacional (Creche) | **50%** | 4 | 0 | 4 |
| 6 | Portal da Família | **41%** | 4 | 1 | 6 |
| 7 | Auth + Comum (cross-cutting) | **40%** | 3 | 2 | 4 |
| 8 | Presidência (analytics + IA) | **37%** | 5 | 0 | 6 |
| 9 | Site Público institucional | **25%** | 1 | 0 | 7 |
| 10 | Admin / Plataforma | **19%** | 1 | 0 | 6 |

---

## 1. Serviço Social — 74% ✅ quase pronto

| Tela | Status | Cob. | O que falta |
|------|--------|------|-------------|
| social-fichas | ✅ | 100 | — |
| social-ficha-nova | ✅ | 90 | upload de docs + termo de consentimento (alertado como indisponível) |
| social-ficha-detalhe | ✅ | 95 | edição inline de titular/membros (só elegibilidade é editável) |
| social-triagem | ✅ | 100 | — (fila + KPIs + 409 anti-race) |
| social-elegibilidade | ✅ | 95 | motivo obrigatório só validado no front (backend não força) |
| social-encaminhamentos | ✅ | 90 | timeline por ficha (endpoint existe, UI não usa) |
| social-ponte | ✅ | 95 | botão "Sinalizar ao Social" no shell das outras verticais |
| social-inicio | 🟡 | 50 | painel de KPIs + prévia da fila (hoje é só 3 atalhos estáticos) |
| social-triagem-ia | 🔴 | 0 | tela inteira: IA sugere elegibilidade por unidade c/ % de confiança; sem model/endpoint |
| social-agenda | 🔴 | 0 | visão transversal das 4 unidades por dia (pulso + agendamentos); sem endpoint |

## 2. Capacitação — 71% ✅

| Tela | Status | Cob. | O que falta |
|------|--------|------|-------------|
| cap-painel | ✅ | 90 | widgets extras (próximas turmas/atalhos) |
| cap-turmas | ✅ | 95 | filtros/abas/busca |
| cap-turma | ✅ | 95 | — (matrícula + consentimento de menor + encerrar c/ certificados) |
| cap-chamada | ✅ | 95 | KPIs de resumo da chamada |
| cap-cursos | ✅ | 85 | filtros + % ocupação |
| cap-certificados | ✅ | 90 | filtro/busca (PDF c/ QR já real, via pdfkit) |
| cap-indicadores | ✅ | 80 | dimensão de impacto/longitudinal |
| cap-curso (detalhe) | 🟡 | 40 | rota `cursos/[id]` + ementa/módulos/trilha (não modelado no Prisma) |
| cap-matriculas | 🟡 | 45 | tela consolidada de matrículas do semestre (hoje só dentro da turma) |
| cap-sessoes (Banco de Modelos) | 🔴 | 0 | feature inteira: agenda de sessões práticas + matching aluno↔modelo voluntário |

## 3. Médico — 60% ✅ núcleo clínico forte / falta Fase 2

| Tela | Status | Cob. | O que falta |
|------|--------|------|-------------|
| medico-painel | ✅ | 90 | próximo paciente/avisos |
| medico-agenda | ✅ | 95 | — |
| medico-atendimento (prancha SOAP) | ✅ | 95 | — (5 passos, selo atômico, chips clínicos) |
| medico-fila | ✅ | 90 | — |
| medico-beneficiarios | ✅ | 95 | — (CRUD de alergias/condições + histórico) |
| medico-prontuarios | ✅ | 85 | export/PDF (é a tela atestado) |
| medico-equipe | ✅ | 90 | — |
| medico-indicadores | ✅ | 85 | dashboard mais rico |
| **prescrição + bloqueio de alergia** | ✅ | 95 | bloqueio server-side 409 + override auditado + teste 11/11 (impressão fica no atestado) |
| medico-fila-chegada (recepção) | 🔴 | 15 | "marcar chegada" + KPIs de presença |
| medico-triagem (leitura) | 🔴 | 0 | leitura da triagem de enfermagem |
| medico-triagem-enfermagem | 🔴 | 0 | vitais na chegada + classificação de risco |
| medico-odonto (odontograma) | 🔴 | 0 | grid FDI 32 dentes + plano de tratamento (model novo) |
| medico-atestado (PDF/QR) | 🔴 | 0 | gerador de atestado/receita/declaração + verificação pública |
| medico-resumo-ia | 🔴 | 0 | resumo clínico por Claude na abertura do prontuário |

## 4. Esportivo — 56%

| Tela | Status | Cob. | O que falta |
|------|--------|------|-------------|
| esp-frequencia (chamada de treino) | ✅ | 90 | 4º estado "Atrasado" + KPIs da chamada (hoje P/F/J) |
| esp-painel | 🟡 | 60 | dashboard rico do Atlas (turmas em quadra hoje, anel de ocupação, próximo exame de faixa) |
| esp-turmas | 🟡 | 65 | catálogo c/ filtros + grade de horários (detalhe da turma já é completo) |
| esp-indicadores | 🔴 | 8 | dashboard inteiro (graduações/mês, frequência por modalidade, evasão) |

## 5. Educacional (Creche) — 50%

| Tela | Status | Cob. | O que falta |
|------|--------|------|-------------|
| edu-painel | ✅ | 100 | — (presentes agora, diários, críticos sem leitura) |
| edu-turma | ✅ | 100 | — (check-in/out + rotina + bloqueio de segurança) |
| edu-comunicados | ✅ | 100 | — |
| edu-crianca | ✅ | 100 | — |
| edu-indicadores | 🔴 | 0 | dashboard da creche |
| edu-diario-lote | 🔴 | 0 | lançar rotina para a turma inteira de uma vez |
| edu-fotos-diario | 🔴 | 0 | fotos no diário c/ checagem de AutorizacaoImagem + watermark |
| edu-resumo-ia | 🔴 | 0 | resumo do dia por IA |

## 6. Portal da Família — 41% (gap grande, mas núcleo real)

| Tela | Status | Cob. | O que falta |
|------|--------|------|-------------|
| familia-comunicados | ✅ | 95 | — (confirmação de leitura) |
| familia-criancas | ✅ | 95 | — |
| familia-diario | ✅ | 95 | — (modelo Brightwheel) |
| familia-mensagens | ✅ | 90 | anexos (chat 1:1 real) |
| familia-ficha | 🟡 | 80 | só leitura (sem ações de consentimento ao titular) |
| familia-agenda | 🔴 | 0 | calendário + confirmar presença (model `Evento`) |
| familia-certificados | 🔴 | 0 | galeria de certificados/graduações + PDF |
| familia-presenca | 🔴 | 0 | "vem amanhã?" SIM/NÃO (model novo) |
| familia-linha-tempo | 🔴 | 0 | jornada narrativa da criança (model `TimelineEvento`) |
| familia-audio | 🔴 | 0 | diário em áudio (IA TTS + model `DiarioAudio`) — feature pesada |
| familia-recebido | 🔴 | 0 | resumo de benefícios recebidos (leitura/agregação) |

## 7. Auth + Comum (cross-cutting) — 40%

| Tela | Status | Cob. | O que falta |
|------|--------|------|-------------|
| auth-login | ✅ | 90 | link "esqueci a senha" (hoje texto estático) |
| auth-hub (pós-login por perfil) | ✅ | 88 | badges/contadores |
| auth-primeiro-acesso (trocar senha) | ✅ | 92 | — (middleware força troca, auditado) |
| auth-switcher | 🟡 | 40 | seletor de unidade **pós-login** (só existe o pré-login `/acesso`) |
| comum-403 | 🟡 | 30 | tela 403 dedicada (hoje é parágrafo inline repetido por layout) |
| auth-recuperar-senha | 🔴 | 0 | autorrecuperação por e-mail (só existe reset por admin) |
| comum-busca | 🔴 | 8 | **placeholder falso** na topbar (`<span>`, sem input) → busca global real |
| comum-notificacoes | 🔴 | 8 | **badge "3" hardcoded** na topbar → lista + contador real |
| comum-perfil | 🔴 | 8 | avatar não-clicável → tela "Minha conta" |

## 8. Presidência (analytics + IA) — 37%

| Tela | Status | Cob. | O que falta |
|------|--------|------|-------------|
| presidencia-unidades | ✅ | 95 | — |
| presidencia-impacto | ✅ | 95 | — |
| presidencia-familias | ✅ | 92 | — (retrato anonimizado) |
| presidencia-jornada | ✅ | 95 | — (diferencial: família cruzando 2+ unidades) |
| presidencia-prestacao-contas | ✅ | 95 | — (PDF c/ selo CASA + auditoria EXPORT) |
| presidencia-relatorios | 🔴 | 10 | tela não existe (model `RelatorioPDF` + endpoints); o Rail já a exibe como "Em breve" — **não é 404** (achado da auditoria corrigido após verificação) |
| pres-mapa-territorial | 🔴 | 5 | heatmap por bairro + demanda reprimida |
| pres-saude-populacional | 🔴 | 5 | dashboard de saúde pública agregada |
| pres-custo-beneficiario | 🔴 | 5 | eficiência financeira (precisa de dados de custo, inexistentes) |
| pres-historias-ia | 🔴 | 5 | **única feature de IA da área** (histórias via Claude); nada de integração Anthropic |
| pres-crm-doadores | 🔴 | 5 | funil/CRM de doadores (sem fonte de dados) |

## 9. Site Público institucional — 25% (a "cara" externa não existe)

| Tela | Status | Cob. | O que falta |
|------|--------|------|-------------|
| publico-verificar (cert/graduação) | ✅ | 90 | só falta tela de entrada de código (hoje só via URL do QR) |
| publico-landing | 🔴 | 0 | landing institucional (a `/` é o hub **interno** logado, não a landing) |
| publico-unidades | 🔴 | 0 | página pública das 4 unidades |
| publico-doe | 🔴 | 0 | doações (captação) |
| publico-transparencia | 🔴 | 0 | transparência/prestação pública |
| publico-voluntario | 🔴 | 0 | formulário de voluntariado + banco de modelos |
| publico-contato | 🔴 | 0 | formulário de contato |
| publico-como-ser-atendido | 🔴 | 0 | guia de acesso (estático) |

## 10. Admin / Plataforma — 19% (governança)

| Tela | Status | Cob. | O que falta |
|------|--------|------|-------------|
| admin-usuarios | ✅ | 95 | edição completa + busca/paginação (CRUD + senha provisória já reais) |
| admin-unidades | 🔴 | 15 | CRUD de unidades (`tenants.module.ts` é placeholder vazio) |
| admin-auditoria | 🔴 | 10 | **viewer da trilha LGPD** (o `AuditService` só grava; não há leitura/export) |
| admin-config | 🔴 | 0 | painel de configuração (dados, segurança, integrações, LGPD) |
| admin-notificacao | 🔴 | 0 | templates/canais (WhatsApp/e-mail) |
| admin-auto-provisionamento | 🔴 | 0 | criar acesso da família ao aprovar elegibilidade + convite |
| admin-entrega-comunicados | 🔴 | 10 | rastreamento transversal de entrega/leitura |

---

## 🧹 Correções rápidas (alto sinal, baixo esforço) — **ONDA A, feita em 2026-06-22**

Coisas que **pareciam prontas mas estavam fake/quebradas** — passavam impressão ruim e custavam pouco:

1. ~~`/presidencia/relatorios` link morto/404~~ → **FALSO ALARME**: o `Rail.tsx` já mostra rotas fora de `ROTAS_PRONTAS` como "Em breve" (cinza, não clicável). Verificado; nada a corrigir aqui.
2. ✅ **Busca na topbar** (`<span>` decorativo) → marcada como "Em breve" (honesta, não simula input).
3. ✅ **Sino com badge "3" hardcoded** → badge fake removido; sino marcado "Em breve".
4. 🔭 **Avatar do usuário** sem "Minha conta" → adiado para a Onda F (tela `comum-perfil`); o botão **Sair** já existe e funciona.
5. ✅ **Tela 403 dedicada** (`AcessoRestrito`) → antes era um parágrafo copiado em 8 layouts; agora é um componente único reaproveitado (com nº 403, ícone e "Voltar ao início").
6. ✅ **Início do Serviço Social** ganhou KPIs reais (na fila / prioritárias) + prévia da fila de triagem.

> Defaults `"Erick Ramos"/"Presidência"` no `ShellInterno` foram **deixados** de propósito: os layouts reais sempre passam os dados da sessão; o default só serve de fallback de dev.

## 🗺️ Rota sugerida para 100% (por onda, com o porquê)

> Ordenado por **valor ÷ esforço** e dependências. Não é ordem obrigatória — é recomendação.

- **Onda A — Polimento de credibilidade (1–2 dias).** Os 5 itens de "correções rápidas" + `social-inicio` (KPIs) + tela `comum-403` dedicada. *Porquê:* tira o ar de "demo" do que já existe; barato e visível.
- **Onda B — Fechar as verticais quase-prontas.** `esp-indicadores`, `edu-indicadores`, `esp-painel/turmas` (dashboards), `cap-curso`/`cap-matriculas`. *Porquê:* sobem 4 áreas de ~50–70% para ~90% reaproveitando padrão e API existentes (baixo risco).
- **Onda C — Portal da Família (valor p/ o beneficiário).** `familia-agenda`, `familia-recebido`, `familia-certificados`, `familia-presenca`. *Porquê:* é a cara do sistema para a família; `recebido`/`certificados` reusam schema (sem model novo).
- **Onda D — Site Público (captação + transparência).** landing + unidades + doe + transparência + voluntário + contato. *Porquê:* hoje 0%; é a porta de entrada externa e a base de captação/voluntariado. Decisão estratégica: precisa estar no go-live?
- **Onda E — Médico Fase 2 (profundidade clínica).** triagem-enfermagem → fila-chegada → atestado/PDF → odontograma → resumo-IA. *Porquê:* alto valor clínico, mas exige models novos + (resumo-IA) integração Claude com cuidado LGPD; fazer com banco de pé + revisão humana.
- **Onda F — Admin/Plataforma (governança/LGPD).** viewer de auditoria → CRUD de unidades → config → notificações → auto-provisionamento. *Porquê:* viewer de auditoria é exigência prática de LGPD; o resto destrava operação sem depender de código.
- **Onda G — Analytics avançada + IA da Presidência.** relatórios selados → mapa territorial → saúde populacional → histórias-IA → custo/CRM. *Porquê:* custo/beneficiário e CRM dependem de **dados que ainda não existem no schema** (orçamento/doadores) — deixar por último.
