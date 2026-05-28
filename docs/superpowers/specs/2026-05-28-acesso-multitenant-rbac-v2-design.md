# Arquitetura de acesso multi-tenant + RBAC v2 — IFP Connect

**Data:** 2026-05-28
**Status:** spec aprovada no brainstorm, aguardando plano de implementação
**Research base:** `docs/superpowers/research/2026-05-28-saas-references-por-vertical.md`
**Brainstorm:** `.superpowers/brainstorm/16558-1779984932/`
**Próxima spec dependente:** Design System v2 (cor por unidade, fotos drone, tipografia, fotografia, mascote)

---

## 1. Motivação

Em 2026-05-28 a primeira apresentação do IFP Connect à diretoria da Família Pôncio (Saulo, Simone, Sarah) retornou dois feedbacks:

1. **Visual datado** — "parece software de 5 anos atrás"; Raquel: "longe de ter UI/UX bom de ver e fácil de usar — muito simples".
2. **Modelo mental por unidade** — a diretoria pediu que Erick procurasse SaaS de referência "como se fosse contratar um para cada unidade" (médico, capacitação, recreativo, esportivo).

Em paralelo, dois ajustes organizacionais decididos pela própria diretoria:

- **Raquel rebaixada** — sai do papel `gestor_geral`, fica só `gestor:medico`. Mesmo nível Luciana/Lívia/Danielle.
- **Presidência segregada** — Saulo/Simone/Sarah acessam **só** um dashboard executivo agregado (`/poncio`). Não entram em unidades individuais.

Essa spec trata da **camada estrutural** dessas mudanças: rotas, login, RBAC, gates, migração de schema. A camada visual (paleta, tipografia, fotografia, layout por vertical) entra na spec subsequente de **Design System v2**.

## 2. Decisões fechadas no brainstorm

Registradas no companion visual `.superpowers/brainstorm/16558-1779984932/`.

| # | Pergunta | Decisão |
|---|---|---|
| 1 | Rota por unidade | **Path** (não subdomínio nem domínio próprio) |
| 2 | Login multi-tenant | **Catch-all `/[unidade]/login`** com config por unidade |
| 3 | Escopo da presidência | **Só `/poncio`** com drill-down inline; não entra em unidades |
| 4 | Escopo da Regina (social) | **Path próprio `/social`** (triagem cross-unidade) |
| 5 | Raquel | Rebaixada a `gestor:medico` (perde `gestor_geral`) |
| 6 | Role `gestor_geral` | **Removida totalmente** |
| 7 | Raiz `/` sem path | **Landing institucional pública** |

## 3. Arquitetura

### 3.1 Mapa de rotas

| Path | Função | Auth | Acesso |
|---|---|---|---|
| `/` | Landing institucional pública | — | Público |
| `/[unidade]/login` | Login catch-all (drone+filtro) | — | Público |
| `/[unidade]` | Home da unidade | Sim | Roles compatíveis + `super_admin` |
| `/poncio` | Dashboard executivo agregado | Sim | `presidencia`, `super_admin` |
| `/social` | Triagem cross-unidade | Sim | `social`, `super_admin` |
| `/admin/users` | Manutenção users (existente) | Sim | `super_admin`; `presidencia` read-only |
| `/reset`, `/reset/[token]` | Reset de senha (novo, global) | — | Público |
| `/api/auth/[...nextauth]` | Auth Next.js (existente) | — | — |

Slugs válidos de unidade: `medico`, `capacitacao`, `esportivo`, `recreativo`, `poncio`, `social`. Qualquer outro slug em `/[unidade]/*` retorna 404.

### 3.2 Configuração por unidade — `lib/unidades.ts` (NOVO)

```ts
export type UnidadeSlug =
  | 'medico' | 'capacitacao' | 'esportivo'
  | 'recreativo' | 'poncio' | 'social'

export type UnidadeConfig = {
  slug: UnidadeSlug
  nome: string                       // "Centro Médico", "Capacitação", "Pôncio Executivo"
  corPrimariaPlaceholder: string     // hex ou token CSS; DS v2 substitui
  fotoDronePlaceholder: string | null // path em /public; Erick fornece
  gradientePlaceholder: string       // fallback CSS quando foto não disponível
  rolesAceitas: readonly Role[]      // quem pode logar nessa unidade
  cidadaoScope: 'self' | 'all'       // 'self' = só dados da unidade; 'all' = cross
}

export const UNIDADES: Record<UnidadeSlug, UnidadeConfig> = { ... }

export function unidadeFromSlug(slug: string): UnidadeConfig | null { ... }
```

`super_admin` é tratado fora de `rolesAceitas` — bypassa via `canAccessUnidade()`.

### 3.3 Gates — `proxy.ts`

`proxy.ts` substitui `middleware.ts` no Next 16 (convenção já adotada).

Pseudocódigo:

```
1. path matches /<unidade>/* (qualquer sub-rota):
   1.1 unidade = unidadeFromSlug(slug); se null → 404
   1.2 user autenticado? não → redirect `/<unidade>/login`
   1.3 canAccessUnidade(user.role, unidade)? não → redirect `/` + flash "Sem acesso a essa unidade"
   1.4 ok → segue
2. path === `/`:
   nenhum gate (landing pública)
3. path matches /admin/*:
   gate existente (super_admin / presidência leitura)
4. demais paths (`/api`, estáticos): comportamento atual
```

`canAccessUnidade(role, unidadeSlug)` em `lib/rbac.ts`:
- `role === 'super_admin'` → `true`
- `role in UNIDADES[unidadeSlug].rolesAceitas` → `true`
- senão → `false`

### 3.4 Login — `app/[unidade]/login/page.tsx` (NOVO)

Server component:
- `const unidade = unidadeFromSlug(params.unidade)`; se null → `notFound()`
- Renderiza `<UnidadeLoginShell unidade={unidade} />`:
  - Background: `<img src={unidade.fotoDronePlaceholder ?? gradient}>` com overlay da cor primária e opacidade ~40%
  - Centro: logo leão IFP + nome da unidade
  - Form: email + senha + botão "Entrar"
  - Link "Esqueci senha" → `/reset`

Server action `loginAction(formData, unidadeSlug)`:
1. Valida credenciais via Auth.js → se inválidas, mensagem genérica "Email ou senha incorretos"
2. Se válidas e `!canAccessUnidade(user.role, unidadeSlug)` → mensagem "Não foi possível acessar essa unidade. [Ir para minhas unidades]" (link → `/`)
3. Se válidas e pode acessar → cookie de sessão + redirect `/<unidade>`

### 3.5 Switcher de unidade

Componente `<UnitSwitcher>` (existente, modificado):
- **Visível só para `super_admin`** (hoje aparece também pra `gestor_geral + gestor_unidade:X` — esse caso some)
- Dropdown com as 6 unidades + item "Início" → `/`
- Logout permanece no avatar dropdown (separado)

### 3.6 Landing pública `/` — `app/page.tsx` (REFATOR)

Server component sem auth check:
- Hero: logo IFP + missão da Família Pôncio (copy a ser definida; placeholder OK)
- 4 cards das unidades públicas (`/medico`, `/capacitacao`, `/esportivo`, `/recreativo`) → cada um leva pro respectivo `/login`
- Footer com link discreto "Acesso executivo" → `/poncio/login`
- **Sem link** público pra `/social/login` (Regina usa atalho pessoal)
- Sem CTAs comerciais; tom institucional

## 4. RBAC v2

### 4.1 Roles antes → depois

| Antes (banco atual) | Depois | Mudança |
|---|---|---|
| `super_admin` | `super_admin` | — |
| `presidencia` | `presidencia` | escopo passa a ser só `/poncio` |
| `gestor_geral` | **REMOVIDA** | nenhum user fica com ela |
| `gestor_unidade:medico` | `gestor:medico` | renomeio |
| `gestor_unidade:capacitacao` | `gestor:capacitacao` | renomeio |
| `gestor_unidade:esportivo` | `gestor:esportivo` | renomeio |
| `gestor_unidade:recreativo` | `gestor:recreativo` | renomeio |
| `social` | `social` | escopo passa a ser `/social` |
| `recepcao:medico` | `recepcao:medico` | — |

### 4.2 Matriz role × path

| Role | `/` | `/medico` | `/capacitacao` | `/esportivo` | `/recreativo` | `/poncio` | `/social` |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `super_admin` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `presidencia` | ✓ | — | — | — | — | ✓ | — |
| `gestor:medico` | ✓ | ✓ | — | — | — | — | — |
| `gestor:capacitacao` | ✓ | — | ✓ | — | — | — | — |
| `gestor:esportivo` | ✓ | — | — | ✓ | — | — | — |
| `gestor:recreativo` | ✓ | — | — | — | ✓ | — | — |
| `social` | ✓ | — | — | — | — | — | ✓ |
| `recepcao:medico` | ✓ | ✓ | — | — | — | — | — |

### 4.3 Migração

**Migration Prisma** (uma migration única):
1. Renomear strings de role nas tabelas que armazenam atribuições: `gestor_unidade:X` → `gestor:X` (4 ocorrências)
2. Apagar atribuição `gestor_geral` da Raquel: `DELETE FROM "UserRole" WHERE role = 'gestor_geral'`
3. Atualizar a definição da enum/CHECK constraint em `schema.prisma` removendo `gestor_geral` e `gestor_unidade:*`, adicionando `gestor:*`

**Código**:
- `lib/rbac.ts`: remover constante `GESTOR_GERAL`; remover branch dela (se existir); implementar `canAccessUnidade(role, unidadeSlug)`
- `proxy.ts`: gates path-based via lookup em `UNIDADES`
- `db/seed.ts`: 
  - atualizar atribuições dos 9 demos com as novas chaves
  - Raquel fica só com `gestor:medico`
  - comentário `TODO operacional: criar user real Sarah Pôncio via /admin/users após deploy`

## 5. Fluxos

### 5.1 Login bem-sucedido
1. User abre `/medico/login` (atalho, favorito, Instagram, share)
2. Vê background drone (ou gradiente placeholder) com overlay cor primária + logo IFP
3. Insere email+senha → submit
4. `loginAction` valida via Auth.js
5. `canAccessUnidade('gestor:medico', 'medico')` → true → cookie + redirect `/medico`

### 5.2 Login negado (credencial válida mas pra outra unidade)
- Mesma tela, mensagem: **"Não foi possível acessar essa unidade. [Ir para minhas unidades]"** (link → `/`)
- Mensagem genérica de propósito — não revelar pra qual unidade a credencial seria válida (evita enumeração)

### 5.3 Login negado (credencial inválida)
- Mensagem: **"Email ou senha incorretos"**

### 5.4 Esqueci senha
- Link em `/<unidade>/login` → `/reset` (sem branding de unidade)
- `/reset` pede email → envia link (provedor SMTP fica pro Plano 8)
- Link no email → `/reset/[token]` → nova senha → login automático em `/<unidade-do-user>/login`

### 5.5 Logout
- Botão "Sair" no avatar dropdown
- Redirect pra `/<unidade-em-que-estava>/login` (mantém visual contextual); se super_admin vinha de `/` → `/`

### 5.6 Switcher (só super_admin)
- Erick logado em `/medico` → avatar → "Trocar de unidade" → dropdown 6 opções → escolhe `/capacitacao` → vai direto (sem novo login)
- Sessão de super_admin é cross-unidade por design

## 6. Refactor — arquivos afetados

### Novos
- `lib/unidades.ts`
- `app/[unidade]/login/page.tsx`
- `app/[unidade]/login/login-action.ts`
- `components/UnidadeLoginShell.tsx`
- `app/social/page.tsx` (placeholder funcional)
- `app/poncio/page.tsx` (placeholder funcional)
- `app/reset/page.tsx`, `app/reset/[token]/page.tsx`
- Migration Prisma `XXXX_rbac_v2_drop_gestor_geral_rename_roles`

### Modificados
- `proxy.ts` — gates path-based via lookup `UNIDADES`
- `lib/rbac.ts` — `canAccessUnidade`, drop `gestor_geral`
- `app/page.tsx` — vira landing pública (era redirect/dashboard)
- `AppShell` — switcher só super_admin
- `components/UnitSwitcher.tsx` — visibilidade restrita
- `db/seed.ts` — Raquel só `gestor:medico`; renomear roles em demos

### Removidos
- Rota antiga `/login` global (substituída pelo catch-all); manter como redirect 302 → `/` por 1 release de cortesia

## 7. Decisões deferidas

| Item | Responsável | Quando |
|---|---|---|
| Cores reais por unidade | DS v2 | Próxima spec |
| Fotos drone das 6 unidades | Erick fornece arquivos | Antes do plano DS v2 |
| User real Sarah Pôncio | Operacional (Erick via `/admin/users`) | Pós-deploy |
| Provedor SMTP pro reset | Plano 8 | Deploy |
| Read-only de presidência nas unidades | Spec futura, se a operação pedir | Indefinido |
| Conteúdo da landing `/` | DS v2 + Erick (missão, fotos, copy) | DS v2 |
| RLS Postgres por unidade | Plano 8 | Deploy |
| WhatsApp Business / login passwordless | Spec futura | Indefinido |

## 8. Critérios de sucesso

### Funcionais (e2e Playwright)
1. Erick (`super_admin`) loga em qualquer `/<unidade>/login` → entra `/<unidade>` (6 cenários)
2. Raquel (`gestor:medico`) loga em `/medico/login` → entra; tenta `/capacitacao/login` → erro genérico
3. Saulo (`presidencia`) loga em `/poncio/login` → entra `/poncio`; tenta `/medico/login` → erro
4. Regina (`social`) loga em `/social/login` → entra `/social`
5. Maria (`recepcao:medico`) loga em `/medico/login` → entra; tenta `/social/login` → erro
6. User não autenticado bate `/medico` → redirect `/medico/login`
7. User não autenticado bate `/` → landing pública renderiza (sem redirect)
8. Erick em `/medico` clica switcher → vai `/capacitacao` sem novo login
9. Raquel em `/medico` clica avatar → NÃO vê item "Trocar de unidade"
10. Cada `/<unidade>/login` renderiza background com cor distinta (smoke visual mínimo)

### Não-funcionais
- Build Next 16 sem warnings
- `pnpm typecheck && pnpm lint && pnpm test` verdes
- Migration roda no DB dev sem perda de dados (validar contagem de users antes/depois)
- Nenhuma referência a `gestor_geral` ou `gestor_unidade:*` sobrevive ao refactor (`rg gestor_geral` retorna vazio)

## 9. Não-objetivos (fora do escopo)

- **Design System v2** — paleta final, tipografia, fotografia, mascote
- **Verticalização visual** — adequar visual de cada unidade às referências da pesquisa (Doctolib/Disco/Brightwheel/TeamSnap)
- **Implementação real do `/poncio`** — placeholder funcional aqui; KPIs reais e drill-down ficam pra spec dedicada
- **Implementação real do `/social`** — idem; Regina hoje opera sem essa rota
- **Reset de senha completo** — entrega esqueleto; provedor SMTP fica pro Plano 8
- **Criar user Sarah Pôncio** — operacional pós-deploy
- **WhatsApp Business, Deploy/SSL, RLS Postgres** — Plano 8
- **Refator de modelos de domínio** (Cidadao/Triagem/Vaga/etc.) — preservados intactos

## 10. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Migration drop `gestor_geral` quebra users em produção | Não há produção ainda; dev DB pode ser re-seedado idempotentemente |
| Catch-all `/[unidade]` colide com rotas existentes | Mover páginas privadas pra `app/(authenticated)/[unidade]/page.tsx`; manter login em `app/(public)/[unidade]/login/page.tsx` |
| Placeholder de `/poncio` e `/social` confunde diretoria | Banner explícito "Visual provisório — aguardando DS v2" |
| Sessão de super_admin vaza dados entre unidades | Helper `currentUnidadeFromUrl()` casa com escopo do servidor; testes RBAC por unidade |
| User pré-spec logado quando migration rodar | Forçar logout/refresh de sessão na primeira request pós-deploy local |

## 11. Dependências

- Pesquisa de referências SaaS — **concluída** (`docs/superpowers/research/2026-05-28-saas-references-por-vertical.md`)
- Auth.js v5 (já no projeto)
- Prisma 6 (já no projeto)
- Next 16 + `proxy.ts` (já no projeto)
- Nenhuma dependência externa nova

## 12. Estimativa grossa

Plano de implementação subsequente detalhará tasks. Orientativa: 8–12 tasks, 1–2 dias de trabalho focado com TDD. Não bloqueia outras frentes — brainstorm de DS v2 pode rodar em paralelo; spec dela escreve após esta impl.
