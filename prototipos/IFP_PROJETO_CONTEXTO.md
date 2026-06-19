# IFP — Instituto Família Pôncio
## Arquivo de Contexto do Projeto
> Atualizar ao final de cada sessão com o Claude. Colar no início de cada nova sessão.

---

## 📌 Resumo do Projeto

Sistema web unificado para gestão das 4 unidades do Instituto Família Pôncio.
Um único domínio, múltiplos perfis de acesso, banco de dados compartilhado.

---

## 🏗️ Stack Técnica Definida

| Camada | Tecnologia | Motivo |
|---|---|---|
| Frontend | Next.js 14 (App Router) | Deploy fácil, Claude conhece bem |
| Backend/DB | Supabase (PostgreSQL) | Gratuito, auth pronta, storage |
| Hospedagem | Vercel | Deploy automático via GitHub |
| Auth | Supabase Auth | Já incluso no Supabase |
| Storage (docs) | Supabase Storage | Já incluso no Supabase |
| Email | Resend (free tier) | 3.000 emails/mês grátis |
| Domínio | Registro.br (.org.br) | ~R$40/ano |

---

## 📋 Fases do Projeto

### ✅ FASE 0 — Planejamento (CONCLUÍDA)
- [x] Mapeamento de todas as unidades e processos
- [x] Definição da stack técnica
- [x] Prototipagem visual completa (alpha no Claude)
- [x] Modelo de dados definido
- [x] Estratégia de hospedagem e custos definida

### 🔄 FASE 1 — Base e Infraestrutura (EM ANDAMENTO)
- [ ] Instalar Node.js (v20+) na máquina
- [ ] Criar conta no GitHub
- [ ] Criar projeto Next.js
- [ ] Criar conta e projeto no Supabase
- [ ] Conectar Next.js ao Supabase
- [ ] Criar tabelas iniciais no banco
- [ ] Sistema de login funcional
- [ ] Layout base com sidebar (baseado no protótipo)
- [ ] Perfis de acesso (RBAC) configurados
- [ ] Deploy inicial na Vercel

### ⏳ FASE 2 — Assistência Social
- [ ] Formulário público de cadastro (link Instagram)
- [ ] Agendamento de triagens
- [ ] Ficha completa do beneficiário
- [ ] Upload de documentos (CPF, renda, residência)
- [ ] Cálculo automático de elegibilidade (renda per capita ≤ R$600)
- [ ] Aprovação e vinculação às unidades
- [ ] Histórico da família

### ⏳ FASE 3 — Módulos das Unidades
- [ ] Centro Médico (agenda, prontuário simplificado)
- [ ] Capacitação (cursos, turmas, frequência, certificados)
- [ ] Esportivo (turmas Jiu-Jitsu, faixas, presenças)
- [ ] Recreativo (crianças, responsáveis, frequência diária)

### ⏳ FASE 4 — Dashboard e Relatórios
- [ ] Indicadores em tempo real por unidade
- [ ] Gráficos de atendimento
- [ ] Exportação PDF e Excel

### ⏳ FASE 5 — Deploy e Domínio
- [ ] Publicar na Vercel (produção)
- [ ] Conectar domínio .org.br
- [ ] Configurar emails transacionais
- [ ] Testes finais

---

## 🗄️ Modelo de Dados (Supabase/PostgreSQL)

### Tabelas principais

```sql
-- Perfis de usuário do sistema
profiles (
  id uuid references auth.users,
  nome text,
  email text,
  perfil text CHECK (perfil IN ('admin','assistente_social','lider_medico','lider_capacitacao','lider_esportivo','lider_recreativo','visualizador')),
  ativo boolean default true,
  created_at timestamptz default now()
)

-- Famílias/titulares cadastrados
beneficiarios (
  id uuid default gen_random_uuid(),
  nome text not null,
  cpf text unique,
  data_nascimento date,
  telefone text,
  email text,
  endereco text,
  bairro text,
  municipio text,
  membros_familia int,
  renda_familiar numeric,
  renda_per_capita numeric GENERATED ALWAYS AS (renda_familiar / membros_familia) STORED,
  elegivel boolean,
  status text CHECK (status IN ('pendente','em_analise','ativo','reprovado','inativo')),
  observacoes text,
  assistente_id uuid references profiles(id),
  created_at timestamptz default now()
)

-- Vinculação beneficiário ↔ unidade
beneficiario_unidades (
  id uuid default gen_random_uuid(),
  beneficiario_id uuid references beneficiarios(id),
  unidade text CHECK (unidade IN ('medico','capacitacao','esportivo','recreativo')),
  data_vinculo date,
  ativo boolean default true
)

-- Documentos enviados
documentos (
  id uuid default gen_random_uuid(),
  beneficiario_id uuid references beneficiarios(id),
  tipo text, -- 'cpf','renda','residencia','outros'
  url text,
  created_at timestamptz default now()
)

-- Triagens agendadas
triagens (
  id uuid default gen_random_uuid(),
  nome text,
  telefone text,
  renda_declarada numeric,
  membros int,
  data_agendamento date,
  hora text,
  status text CHECK (status IN ('agendado','realizado','faltou','cancelado')),
  beneficiario_id uuid references beneficiarios(id), -- preenchido após aprovação
  created_at timestamptz default now()
)

-- UNIDADE: Médico — Consultas
consultas (
  id uuid default gen_random_uuid(),
  beneficiario_id uuid references beneficiarios(id),
  tipo text, -- 'clinico_geral','odontologia','pediatria','ginecologia','exame'
  profissional text,
  data_consulta date,
  hora text,
  status text CHECK (status IN ('agendado','realizado','faltou','cancelado')),
  observacoes text,
  created_at timestamptz default now()
)

-- UNIDADE: Capacitação — Cursos
cursos (
  id uuid default gen_random_uuid(),
  nome text,
  professor text,
  vagas int,
  data_inicio date,
  data_fim date,
  status text CHECK (status IN ('aberto','em_andamento','concluido','cancelado'))
)

-- Matrículas em cursos
matriculas_cursos (
  id uuid default gen_random_uuid(),
  beneficiario_id uuid references beneficiarios(id),
  curso_id uuid references cursos(id),
  data_matricula date,
  certificado_emitido boolean default false
)

-- UNIDADE: Esportivo — Turmas
turmas_esportivo (
  id uuid default gen_random_uuid(),
  nome text,
  modalidade text default 'jiu-jitsu',
  professor text,
  horario text,
  faixa_etaria text
)

-- Atletas
atletas (
  id uuid default gen_random_uuid(),
  beneficiario_id uuid references beneficiarios(id),
  turma_id uuid references turmas_esportivo(id),
  faixa text default 'branca',
  data_matricula date
)

-- UNIDADE: Recreativo — Crianças
criancas (
  id uuid default gen_random_uuid(),
  nome text,
  data_nascimento date,
  responsavel_nome text,
  responsavel_cpf text,
  beneficiario_id uuid references beneficiarios(id),
  turma text CHECK (turma IN ('A','B','C')),
  horario_entrada text,
  horario_saida text,
  ativo boolean default true
)

-- Frequência diária (recreativo)
frequencia_recreativo (
  id uuid default gen_random_uuid(),
  crianca_id uuid references criancas(id),
  data date,
  presente boolean,
  hora_entrada text,
  hora_saida text
)
```

---

## 📁 Estrutura de Pastas do Projeto Next.js

```
ifp-sistema/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx          ← Tela de login
│   ├── (dashboard)/
│   │   ├── layout.tsx            ← Layout com sidebar
│   │   ├── page.tsx              ← Dashboard principal
│   │   ├── assistencia/
│   │   │   └── page.tsx
│   │   ├── beneficiarios/
│   │   │   ├── page.tsx
│   │   │   └── novo/
│   │   │       └── page.tsx
│   │   ├── medico/
│   │   │   └── page.tsx
│   │   ├── capacitacao/
│   │   │   └── page.tsx
│   │   ├── esportivo/
│   │   │   └── page.tsx
│   │   ├── recreativo/
│   │   │   └── page.tsx
│   │   └── relatorios/
│   │       └── page.tsx
│   └── cadastro/
│       └── page.tsx              ← Formulário público (sem login)
├── components/
│   ├── ui/                       ← Botões, inputs, cards reutilizáveis
│   ├── sidebar.tsx
│   ├── topbar.tsx
│   └── stats-card.tsx
├── lib/
│   ├── supabase.ts               ← Cliente Supabase
│   └── utils.ts
├── types/
│   └── index.ts                  ← Tipos TypeScript
└── middleware.ts                 ← Proteção de rotas por perfil
```

---

## 🔑 Perfis de Acesso (RBAC)

| Perfil | Acesso |
|---|---|
| `admin` | Tudo — todas as unidades, todos os dados |
| `assistente_social` | Triagens, beneficiários, vinculação às unidades |
| `lider_medico` | Somente módulo Centro Médico |
| `lider_capacitacao` | Somente módulo Capacitação |
| `lider_esportivo` | Somente módulo Esportivo |
| `lider_recreativo` | Somente módulo Recreativo |
| `visualizador` | Relatórios somente leitura |

---

## 🎨 Design System (baseado no protótipo)

```css
/* Cores principais */
--verde: #1a6b4a        /* cor principal IFP */
--coral: #e05c3a        /* Centro Médico */
--amber: #c97b1a        /* Capacitação */
--azul:  #2055a4        /* Esportivo */
--verde: #1a6b4a        /* Recreativo */

/* Fontes */
--font-display: 'Sora'
--font-body:    'DM Sans'
```

---

## 📍 Estado Atual da Sessão

**Última atualização:** [DATA DA SESSÃO]
**Fase atual:** Fase 1 — Base e Infraestrutura
**Próximo passo:** Instalar Node.js e criar o projeto Next.js

### O que foi feito até agora:
- Planejamento completo do sistema
- Protótipo visual alpha construído e validado
- Stack técnica definida
- Modelo de dados completo definido
- Este arquivo de contexto criado

### Próximos passos da Fase 1:
1. Instalar Node.js v20 (https://nodejs.org)
2. Instalar VS Code (https://code.visualstudio.com)
3. Criar conta no GitHub (https://github.com)
4. Criar conta no Supabase (https://supabase.com)
5. Rodar: `npx create-next-app@latest ifp-sistema`
6. Conectar Supabase ao Next.js
7. Criar as tabelas no banco
8. Criar layout base com sidebar

### Arquivos já gerados pelo Claude:
- `IFP_PROJETO_CONTEXTO.md` ← este arquivo

---

## 💬 Como usar este arquivo

**No início de cada sessão**, cole este arquivo no chat e diga:
> "Continuando o projeto IFP. Segue o contexto atualizado."

**No final de cada sessão**, peça ao Claude:
> "Atualize o arquivo de contexto com o que fizemos hoje."

O Claude vai gerar uma versão atualizada para você salvar e substituir este arquivo.
