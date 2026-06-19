# IFP — Instituto Família Pôncio
## Arquivo de Contexto do Projeto
> Atualizar ao final de cada sessão com o Claude. Colar no início de cada nova sessão.

---

## 📌 Resumo do Projeto

Sistema web unificado para gestão das 4 unidades do Instituto Família Pôncio.
Um único domínio, múltiplos perfis de acesso, banco de dados compartilhado.
Sendo construído com Next.js + Supabase, com apoio do Claude sessão a sessão.

---

## 🏗️ Stack Técnica

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 15 (App Router) |
| Backend/DB | Supabase (PostgreSQL) |
| Hospedagem | Vercel (a fazer) |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Email | Resend (a configurar) |
| Domínio | Registro.br .org.br (a fazer) |

---

## 🔧 Configurações importantes

- **Next.js sem Turbopack** — `"dev": "next dev --port 3000"` no package.json
- **next.config.ts** limpo: `const nextConfig: NextConfig = {}`
- **Supabase Auth** — confirmação de e-mail desativada
- **URL do Supabase** no `.env.local` sem barra no final
- **Fonte** — Plus Jakarta Sans (substituta da Garet do brandbook, muito próxima visualmente)

---

## 👤 Usuário Admin

- **Email:** erickramos@ifp.org.br
- **Senha:** S8u$acayud
- **Status:** confirmado via SQL

---

## 🎨 Design System — Brandbook Oficial IFP

### Paleta de cores
```css
--laranja: #FF772E        /* cor primária IFP */
--laranja-dark: #C24D0F   /* hover/gradiente */
--marrom: #752C05         /* terracota escuro */
--teal: #10C2BB           /* verde-teal claro */
--teal-dark: #007571      /* verde-teal escuro */
--cinza-texto: #4A4A49    /* texto principal */
--white: #FFFFFF
```

### Gradientes oficiais
```css
--grad-principal: linear-gradient(135deg, #FF772E, #C24D0F, #752C05)
--grad-teal: linear-gradient(135deg, #10C2BB, #007571)
--grad-login: linear-gradient(160deg, #FF9A5C 0%, #FF772E 40%, #C24D0F 100%)
```

### Cores por unidade
| Unidade | Cor principal | Cor dark | Light |
|---|---|---|---|
| Centro Médico | `#10C2BB` | `#007571` | `#E6FAFA` |
| Capacitação | `#FF772E` | `#C24D0F` | `#FFF2EB` |
| Centro Esportivo | `#C24D0F` | `#752C05` | `#FAEEE8` |
| Centro Recreativo | `#007571` | `#004F4C` | `#E6F5F5` |

### Fonte
- **Brandbook oficial:** Garet
- **Implementada:** Plus Jakarta Sans (substituta próxima, disponível no Google Fonts)

### Sistema de temas dinâmicos
- Arquivo `lib/temas.ts` criado
- Sidebar e destaques mudam de cor automaticamente conforme a unidade acessada
- Função `getTema(pathname)` detecta a unidade pela URL

---

## 📋 Fases do Projeto

### ✅ FASE 0 — Planejamento (CONCLUÍDA)
- [x] Mapeamento de todas as unidades e processos
- [x] Definição da stack técnica
- [x] Prototipagem visual alpha construído e validado
- [x] Modelo de dados completo definido
- [x] Estratégia de hospedagem e custos definida
- [x] Brandbook analisado e incorporado ao design system

### ✅ FASE 1 — Base e Infraestrutura (CONCLUÍDA)
- [x] Node.js, VS Code e Git instalados
- [x] Projeto Next.js criado (`ifp-sistema`)
- [x] Conta e projeto criados no Supabase (região São Paulo)
- [x] Dependências instaladas (`@supabase/supabase-js`)
- [x] `.env.local` configurado
- [x] `lib/supabase.ts` criado com instância singleton
- [x] 12 tabelas criadas no banco com RLS habilitado
- [x] Políticas de acesso básicas criadas
- [x] Layout base com sidebar funcionando
- [x] Sistema de login funcional
- [x] Usuário admin criado e confirmado
- [x] Dashboard acessível após login
- [x] Problema de Turbopack/CPU resolvido
- [x] Design system atualizado com brandbook oficial
- [x] Sistema de temas dinâmicos por unidade (`lib/temas.ts`)
- [x] Tela de login com gradiente laranja oficial + logo IFP
- [x] Sidebar escura com topo colorido dinâmico por unidade
- [x] Logo salvo em `public/logo.png`

### 🔄 FASE 2 — Assistência Social (EM ANDAMENTO)
- [x] Página `/dashboard/assistencia` criada com listagem de triagens
- [x] Cálculo automático de elegibilidade (renda per capita ≤ R$600)
- [x] Dados de exemplo inseridos no banco (8 triagens)
- [ ] Formulário público de cadastro `app/cadastro/page.tsx` (link Instagram)
- [ ] Agendamento de triagens com data/hora
- [ ] Ficha completa do beneficiário
- [ ] Upload de documentos (CPF, renda, residência)
- [ ] Aprovação e vinculação às unidades
- [ ] Histórico da família

### ⏳ FASE 3 — Módulos das Unidades
- [ ] Centro Médico — agenda por profissional (inspirado no Amplimed)
- [ ] Capacitação — cursos, turmas, frequência, certificados
- [ ] Esportivo — turmas Jiu-Jitsu, faixas, presenças
- [ ] Recreativo — crianças, responsáveis, frequência diária

### ⏳ FASE 4 — Beneficiários e Migração
- [ ] Página `/dashboard/beneficiarios` com listagem completa
- [ ] Formulário de cadastro novo beneficiário
- [ ] Script de importação CSV do Amplimed (18.377 pacientes)
- [ ] Campos compatíveis: código, nome, nascimento, sexo, celular, CPF, cidade

### ⏳ FASE 5 — Dashboard e Relatórios
- [ ] Indicadores em tempo real por unidade
- [ ] Gráficos de atendimento (estilo Amplimed)
- [ ] Exportação PDF e Excel

### ⏳ FASE 6 — Deploy e Domínio
- [ ] Publicar na Vercel
- [ ] Conectar domínio .org.br
- [ ] Configurar emails transacionais (Resend)
- [ ] Testes finais

---

## 🗄️ Banco de Dados (Supabase) — 12 tabelas ✅

- `profiles` — perfis de usuário
- `beneficiarios` — famílias/titulares
- `beneficiario_unidades` — vinculação beneficiário ↔ unidade
- `triagens` — triagens agendadas (8 registros de exemplo inseridos)
- `documentos` — documentos enviados
- `consultas` — consultas médicas
- `cursos` — cursos de capacitação
- `matriculas_cursos` — matrículas
- `turmas_esportivo` — turmas Jiu-Jitsu
- `atletas` — atletas vinculados
- `criancas` — crianças do recreativo
- `frequencia_recreativo` — frequência diária

---

## 📁 Estrutura de Arquivos Atual

```
ifp-sistema/
├── app/
│   ├── dashboard/
│   │   ├── assistencia/
│   │   │   └── page.tsx       ✅ Listagem de triagens com elegibilidade
│   │   ├── layout.tsx         ✅ Sidebar dinâmica com temas por unidade
│   │   └── page.tsx           ✅ Página inicial do dashboard
│   ├── login/
│   │   └── page.tsx           ✅ Login com gradiente laranja + logo IFP
│   ├── globals.css            ✅ Paleta oficial do brandbook
│   └── layout.tsx             ✅ Plus Jakarta Sans
├── lib/
│   ├── supabase.ts            ✅ Cliente singleton
│   └── temas.ts               ✅ Temas dinâmicos por unidade
├── public/
│   └── logo.png               ✅ Logo oficial IFP
├── next.config.ts             ✅ Config limpa
├── package.json               ✅ Script dev sem Turbopack
└── .env.local                 ✅ Configurado
```

---

## 🔑 Perfis de Acesso (RBAC)

| Perfil | Acesso |
|---|---|
| `admin` | Tudo |
| `assistente_social` | Triagens e beneficiários |
| `lider_medico` | Somente Centro Médico |
| `lider_capacitacao` | Somente Capacitação |
| `lider_esportivo` | Somente Esportivo |
| `lider_recreativo` | Somente Recreativo |
| `visualizador` | Relatórios somente leitura |

---

## 💰 Infraestrutura e Custos

- **Plano inicial (gratuito):** Vercel Hobby + Supabase Free — ~R$ 4/mês (só domínio)
- **Plano robusto (50+ usuários, 18k+ registros):** ~R$ 381/mês
- **Migração:** 18.377 pacientes do Amplimed via exportação CSV
- **Solicitar desconto nonprofit:** Vercel e Supabase têm programas para ONGs

---

## 📍 Estado Atual

**Última atualização:** 22/04/2025
**Fase atual:** Fase 2 — Assistência Social
**Próximo passo:** Criar formulário público de cadastro (`app/cadastro/page.tsx`)

### O que falta na Fase 2:
1. `app/cadastro/page.tsx` — formulário público sem login (link do Instagram)
2. `app/dashboard/beneficiarios/page.tsx` — listagem completa
3. `app/dashboard/beneficiarios/novo/page.tsx` — cadastro manual
4. Botão "Entrevistar" funcional na página de assistência
5. Aprovação e vinculação às unidades

---

## 💬 Como usar este arquivo

**No início de cada sessão**, cole este arquivo no chat e diga:
> "Continuando o projeto IFP. Segue o contexto atualizado."

**No final de cada sessão**, peça ao Claude:
> "Atualize o arquivo de contexto com o que fizemos hoje."
