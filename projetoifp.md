# Projeto IFP Connect — Instituto Família Poncio

Arquivo de memória do projeto. Sempre que retomar a sessão (Claude Code, Claude.ai ou outro agente), leia este documento PRIMEIRO. Ele contém o contexto, decisões já tomadas, status atual e os próximos passos. Mantenha este arquivo atualizado a cada rodada de trabalho.

---

## 1. Sobre o Instituto Família Poncio

O Instituto Família Poncio (IFP) é uma organização filantrópica sediada em Duque de Caxias (Jardim Gramacho — Rod. Washington Luiz). Presidente: Simone Poncio.

### Missão

Excelência, comprometimento e amor ao próximo. Atender gratuitamente pessoas em situação de vulnerabilidade social oferecendo saúde, capacitação profissional, esporte e educação infantil, sempre com triagem feita por Serviço Social próprio.

### As 4 unidades (todas em Caxias, locais e gestores distintos)

1. **Centro Médico** — atendimento médico filantrópico (odontologia completa, endocrinologia, ginecologia, cardiologia, psiquiatria, psicologia e outras especialidades).
2. **Centro de Capacitação** — cursos gratuitos: costura, informática, barbeiro, cabeleireira, massagem, design etc.
3. **Centro Esportivo** — hoje apenas Jiu-Jitsu, com previsão de novas modalidades.
4. **Centro Recreativo / Educacional** — modelo de creche: atividades interativas, descanso, brincadeiras e alimentação para crianças.

Todas as unidades atendem pessoas previamente avaliadas pelo Serviço Social (entrevista, critérios de renda, benefícios, vulnerabilidade).

---

## 2. Arquitetura aprovada — IFP Connect

Plataforma única, multi-tenant lógico, com 4 módulos verticais isolados + camada transversal de Serviço Social + visão executiva da Presidência.

```
                    PRESIDÊNCIA (Simone Poncio)
           Dashboard consolidado • KPIs • Auditoria
                              |
             SERVIÇO SOCIAL (camada transversal)
   Ficha Cidadã única • Triagem • Aprovação • Reavaliação
   Vê dados sociais e de matrícula de TODAS as unidades
       |             |              |              |
   CENTRO        CAPACI-         CENTRO         EDUCAC.
   MÉDICO        TAÇÃO         ESPORTIVO       (Creche)
   teal          laranja        terracota        teal
  #10C2BB        #FF772E        #752C05        #007571
```

### Princípios

- **Isolamento entre unidades**: gestor de uma unidade nunca vê dados operacionais de outra.
- **Serviço Social é a única camada transversal** (vê parte dos dados das 4 unidades).
- **Presidência** vê dashboards agregados, não dados clínicos individuais.
- **Ficha Cidadã única**: o mesmo cidadão pode ser beneficiário de várias unidades sem duplicar cadastro.
- **Multi-tenant lógico**: 1 banco, tenant_id em cada registro, Row-Level Security no Postgres.
- **LGPD desde o dia 1**: consentimentos, logs de auditoria, criptografia, direito ao esquecimento.

---

## 3. Design System (extraído do brandbook oficial)

### Paleta de cores

| Token | HEX | Uso |
|---|---|---|
| --ifp-orange-primary | #FF772E | Cor institucional, CTAs, tema Capacitação |
| --ifp-orange-mid | #C24D0F | Hover, textos de destaque |
| --ifp-orange-deep | #752C05 | Tema Esportivo, dark accents |
| --ifp-teal-deep | #007571 | Tema Centro Recreativo / Educacional |
| --ifp-teal-bright | #10C2BB | Tema Centro Médico |
| --ifp-gray | #4A4A49 | Texto corpo |
| --ifp-white | #FFFFFF | Background |

Degradês oficiais: laranja #FF772E → #C24D0F → #752C05 e teal #10C2BB → #007571.

### Tipografia

- **Fonte principal**: Garet (Light, Book, Regular, Bold, Heavy).
- **Fallback web**: Inter ou Plus Jakarta Sans.

### Identidade visual

- Logo: leão coroado dentro de moldura ogival. Versões por unidade: Instituto, Centro Médico, Centro de Capacitação, Centro Esportivo, Centro Recreativo.
- Grafismo: leão pode ser usado como elemento gráfico complementar (gradiente ou contorno), nunca como janela para imagens, nunca em cores fora da paleta.
- Fotografia: humanizada, espontânea, luz natural, fundo desfocado, representando diversidade, cuidado e acolhimento. Evitar imagens frias, clínicas ou poses artificiais.

---

## 4. Ficha Cidadã (núcleo do Serviço Social)

Registro unificado da família atendida. Criado uma única vez pelo Serviço Social.

### Campos principais

- **Responsável familiar (titular)**: CPF, RG, nome completo, foto, endereço, contatos, data de nascimento.
- **Composição familiar**: cada membro vira sub-cadastro (nome, parentesco, idade, ocupação).
- **Dados socioeconômicos**: renda familiar total, renda per capita, benefícios (Bolsa Família, BPC, Auxílio Gás), situação de moradia (própria/alugada/cedida), escolaridade do titular, vulnerabilidades observadas.
- **Documentação anexada**: RG, CPF, comprovante de residência, comprovante de renda, CadÚnico.
- **Histórico de entrevistas** com assistente social (data, profissional, observações).
- **Status de elegibilidade por unidade**: cada unidade tem critérios próprios; o Serviço Social marca elegibilidade como pendente / aprovado / reprovado / suspenso por unidade.
- **Termos de consentimento LGPD** (uso de dados, uso de imagem, comunicação por WhatsApp).

### Regra de visibilidade

Gestores de unidade veem apenas pessoas com status aprovado para sua unidade, e só veem: nome, foto, contato, flag de elegibilidade. Dados socioeconômicos sensíveis ficam restritos ao Serviço Social. Prontuário clínico é sigilo exclusivo do Centro Médico.

---

## 5. Módulos por unidade (resumo)

### 5.1 Centro Médico (tema teal #10C2BB)

Referências: iClinic, Feegow, Tasy, ProDoctor.

- Agenda multi-profissional por especialidade
- Prontuário Eletrônico (anamnese, evolução, SOAP, CID-10)
- Recepção / triagem de enfermagem / check-in
- Prescrição e atestado digital
- Confirmação por WhatsApp (redução de no-show)
- Indicadores e relatórios; integração CNES/e-SUS (fase 3)

### 5.2 Centro de Capacitação (tema laranja #FF772E)

Referências: Sponte, Moodle, Sympla.

- Catálogo de cursos com ementa, turmas, vagas
- Matrícula vinculada à Ficha Cidadã
- Diário de classe digital, chamada por QR Code
- Controle de frequência e evasão automática
- Emissão de certificados com identidade do Instituto
- Banco de talentos / encaminhamento ao mercado

### 5.3 Centro Esportivo (tema terracota #752C05)

Referências: Tatame Manager, SportSystem.

- Modalidades, turmas e horários
- Controle de graduação (faixas, listras, histórico)
- Frequência por aula (tablet/celular do professor)
- Atestado médico com bloqueio se vencido
- Eventos e autorizações de responsáveis

### 5.4 Educacional / Centro Recreativo (tema teal #007571)

Referências: Agenda Edu, ClassApp.

- Cadastro da criança vinculado ao responsável
- Rotina diária (alimentação, sono, atividades, troca)
- Diário de bordo com fotos (acesso restrito aos pais)
- Comunicados e autorizações
- Check-in/out com QR Code do responsável
- Ficha de saúde da criança (alergias, medicações)
- App dos pais (PWA mobile-first)

---

## 6. Stack tecnológica definida

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: NestJS (Node.js + TypeScript)
- **Banco**: PostgreSQL com Row-Level Security + Redis (cache/filas)
- **ORM**: Prisma
- **Auth**: Auth.js (NextAuth) — SSO entre módulos
- **Storage**: S3-compatible (AWS S3 / Cloudflare R2 / MinIO)
- **Filas**: BullMQ
- **Mensageria**: WhatsApp via Z-API ou Twilio; e-mail via Resend/SES
- **Infra**: Docker + GitHub Actions; deploy em AWS/GCP (créditos para ONG) ou Hetzner
- **Mobile**: PWA mobile-first (app nativo React Native em fase 2 se necessário)
- **Monorepo**: Turborepo + pnpm workspaces

---

## 7. Estrutura de pastas planejada

```
kiizinbr-ifp-familiaponcio/
├── projetoifp.md                  # este arquivo (memória do projeto)
├── README.md
├── .gitignore
├── package.json                   # root (pnpm workspaces + turbo)
├── turbo.json
├── apps/
│   ├── web/                       # Next.js (frontend único com todos os módulos)
│   │   ├── tailwind.config.ts
│   │   └── app/
│   └── api/                       # NestJS (backend)
├── packages/
│   ├── ui/                        # componentes compartilhados (shadcn customizado)
│   ├── design-tokens/             # tokens.css com paleta IFP
│   └── database/                  # Prisma schema + migrations
└── docs/                          # documentação técnica detalhada
```

---

## 8. RBAC — perfis previstos

| Perfil | Escopo | Pode ver |
|---|---|---|
| Super Admin | Global | Tudo (uso técnico) |
| Presidência | Global | Dashboards agregados, auditoria, sem PEP individual |
| Serviço Social | Global (transversal) | Fichas Cidadãs completas, status em todas unidades |
| Gestor de Unidade | 1 unidade | Operação completa da sua unidade |
| Profissional (médico/professor/instrutor) | 1 unidade, seus pacientes/alunos | Dados clínicos/pedagógicos dos seus atendidos |
| Recepção | 1 unidade | Agendamento, check-in, busca de fichas aprovadas |
| Responsável Familiar | Próprio núcleo | App: rotina do filho, agenda médica, certificados |

---

## 9. Roadmap em fases

- **Fase 0 — Fundação (4–6 semanas)**: monorepo, design system, auth, RBAC, Serviço Social + Ficha Cidadã.
- **Fase 1 — MVP por unidade (8–12 semanas)**: agendamento + presença + busca de beneficiários. Começar por Centro Médico e Educacional.
- **Fase 2 — Aprofundamento (3–4 meses)**: prontuário completo, certificados, app dos pais, WhatsApp, dashboards.
- **Fase 3 — Integrações**: e-SUS/CNES, BI para doadores, app mobile nativo.

---

## 10. Status atual do projeto

### Concluído

- [x] Levantamento de requisitos e contexto
- [x] Análise do brandbook (cores, tipografia, logos por unidade, fotografia, grafismos)
- [x] Arquitetura macro aprovada (multi-tenant lógico, Serviço Social transversal)
- [x] Definição do conceito da Ficha Cidadã
- [x] Modelagem inicial dos 4 módulos
- [x] Stack tecnológica definida
- [x] Roadmap em 4 fases aprovado
- [x] Repositório criado (kiizinbr/kiizinbr-ifp-familiaponcio)
- [x] Criação do projetoifp.md (este arquivo)

### Em andamento (sessão atual)

- [ ] Estrutura inicial de pastas (.gitkeep nos diretórios)
- [ ] .gitignore para Node/Next.js/Prisma
- [ ] packages/design-tokens/tokens.css com paleta IFP
- [ ] packages/database/schema.prisma com modelos iniciais
- [ ] apps/web/tailwind.config.ts

### Próximos passos (próxima sessão)

1. Setup do monorepo de verdade: rodar pnpm init, configurar turbo.json, criar pnpm-workspace.yaml.
2. Bootstrap do Next.js em apps/web com App Router, Tailwind e shadcn/ui.
3. Bootstrap do NestJS em apps/api com módulos base (auth, users, tenants).
4. Migração inicial do Prisma com os modelos da Ficha Cidadã.
5. Telas iniciais do Serviço Social: login, dashboard, listagem de fichas, formulário de nova ficha (etapa 1: titular).
6. Implementar Row-Level Security no Postgres por tenant_id.
7. Configurar Auth.js com login por e-mail/senha + magic link.

### Decisões pendentes (perguntar ao Erick / Simone)

- Volume aproximado de atendidos por unidade (mês) — para dimensionar infra.
- Hoje vocês usam alguma planilha/sistema que precisará ser migrado?
- Quem serão os primeiros usuários piloto?
- Vocês emitem produção SUS? (define se precisamos integrar CNES já no MVP)
- Hospedagem preferida (AWS com créditos ONG, GCP, Hetzner)?
- Logotipo em SVG vetorial disponível? Fonte Garet (.otf/.woff2) disponível?

---

## 11. Como retomar este projeto

Ao iniciar uma nova sessão (Claude Code, Claude.ai, etc.):

1. Leia este projetoifp.md inteiro.
2. Verifique a seção Status atual para saber onde paramos.
3. Confirme com o Erick se as decisões pendentes foram resolvidas.
4. Comece pela primeira tarefa não marcada em Em andamento ou Próximos passos.
5. Ao terminar a sessão, atualize este arquivo: mova itens de Em andamento para Concluído e atualize Próximos passos.

Contato do projeto:

- Dev: Erick Ramos (kiizinbr)
- Cliente: Instituto Família Poncio — Presidente Simone Poncio
- Endereço: Rod. Washington Luiz, Jardim Gramacho, Duque de Caxias/RJ

---

Última atualização: sessão inicial de arquitetura e bootstrap do repositório.
