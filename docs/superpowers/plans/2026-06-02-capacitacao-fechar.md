# Plano: Fechar o vertical Capacitação de verdade

**Data:** 2026-06-02
**Arquiteto:** Claude (Opus 4.8)
**Escopo:** Landing pós-login para `gestor_unidade:capacitacao`; login temático; CRUD do catálogo (toggle ativo/inativo); e2e smoke.
**Repo:** `C:/Users/Administrador/ifp-connect` (Next.js 16 App Router, typedRoutes, Prisma/Postgres, RBAC v2).

---

## Decisões-chave (resolvidas contra o código vivo, não só o dossiê)

O dossiê tinha um **conflito interno** sobre o item (2). Resolvi lendo o código real do `/medico`, do proxy e dos pages de `/capacitacao`. Conclusões com evidência:

- **D1 — NÃO criar `src/app/capacitacao/login/page.tsx`.** O `/medico` é a referência canônica e **não tem diretório `medico/login/` físico** (Glob confirmou); a tela de login do médico é servida 100% pela rota dinâmica `src/app/[unidade]/login/page.tsx` + pelo redirect do `proxy.ts`. O slug `capacitacao` já está em `UNIDADE_SLUGS`/`UNIDADES` e o matcher do proxy já cobre `/capacitacao/:path*`. Criar um login estático em `capacitacao/` **duplicaria a shell e a action** e divergiria do padrão das outras 5 unidades. O segmento estático `src/app/capacitacao/` ofusca o `[unidade]` dinâmico para o slug, MAS apenas para os paths que ele define — `capacitacao/login` **não existe** como segmento estático, então `/capacitacao/login` NÃO é ofuscado e cai no `[unidade]/login`. (Verificação obrigatória na execução: confirmar empiricamente que `/capacitacao/login` resolve via dinâmico — ver Risco R1.)

- **D2 — `getLandingPathFor` muda só o branch unitário** (`gestor_unidade | profissional | recepcao`) de `/app/${scope}` para `/${scope}`. NÃO tocar nos branches `super_admin`/`presidencia` (`/app`) nem `social` (`/social`). Isso é uma **correção segura**: hoje `/app/${scope}` só funciona porque o proxy reescreve `/app/{medico|capacitacao|...}` → `/{unit}` (regex `oldUnitMatch`, `proxy.ts:55-58`). Mandar direto pra `/${scope}` elimina o hop pelo alias legado. **Não quebra o médico** — `/medico` já é o destino certo e melhor.

- **D3 — Bug real de divergência de redirect (descoberto na leitura).** As pages de `/capacitacao` redirecionam usuário sem sessão para **`/login`** (login GLOBAL):
  - `capacitacao/page.tsx:18` → `redirect("/login" as Route)`
  - `capacitacao/cursos/page.tsx:15`, `cursos/[id]/page.tsx:18`, `turmas/page.tsx:18`, `turmas/[id]/page.tsx:41` → idem.

  O `/medico` faz `redirect("/medico/login" as Route)` (`medico/page.tsx:34`, `especialidades/page.tsx:14`). **Decisão: alinhar capacitacao ao padrão do médico** → trocar para `redirect("/capacitacao/login" as Route)`. Na prática o **proxy já barra antes** (`proxy.ts:23-30` manda no-session de `/capacitacao` → `/capacitacao/login`), então isso é defense-in-depth e consistência — mas é necessário para o e2e do item (4) assertar `/capacitacao/login$` de forma robusta e para fechar o handshake login↔dashboard descrito no dossiê.

- **D4 — `getLandingPathFor` é dead-code transitivo hoje** (só consumido por `getLandingPath`, que não tem call-site em runtime no fluxo de login: `signInAction` usa `redirectTo:"/"` fixo e a `(auth)/login/page.tsx` só renderiza `<LoginForm>`). Mudar D2 **não altera comportamento em runtime sozinho** — mas é a base correta para quando `getLandingPath` for religado (spec F1.A.1 task 14). Religar `getLandingPath` está **FORA** deste escopo (toca o login global e a home `/`, e o destino canônico `/${slug}` vs `/app` precisa de alinhamento com Erick). Este plano deixa `getLandingPathFor` **correto e pronto**, sem religar.

- **D5 — Toggle de curso vai no DETALHE do curso** (`cursos/[id]/page.tsx`), não na lista. O detalhe já tem `PageHead` com `action` (hoje só "← Catálogo") e já carrega `curso` inteiro (tem `curso.ativo` disponível via `findUnique`). É o lugar natural para o botão ativar/desativar, escopado por `podeGerenciarCurso(session)`. A lista (`cursos/page.tsx`) já reflete `c.ativo` visualmente (`opacity: 0.55`) e ordena `ativo desc` — então o toggle no detalhe propaga pra lista via `revalidatePath`.

---

## Mapa de verdade (símbolos confirmados por leitura)

| Símbolo / fato                                                  | Arquivo                                                | Confirmado                                                             |
| --------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------- |
| `getLandingPathFor(primaryRoleName, primaryUnitScope)` switch   | `src/lib/rbac-types.ts:52-69`                          | branch unitário retorna `` `/app/${primaryUnitScope}` `` (linha 67)    |
| `getLandingPath(session)` único consumidor                      | `src/lib/rbac.ts:106-110`                              | chama `getLandingPathFor(name, unitScope)`                             |
| proxy no-session → `/{slug}/login`                              | `src/proxy.ts:23-30`                                   | regex `^/([a-z]+)/` + `unidadeFromSlug`                                |
| proxy alias legado `/app/{unit}` → `/{unit}`                    | `src/proxy.ts:55-58`                                   | `oldUnitMatch`                                                         |
| `canAccessUnidade(session, "capacitacao")` passa p/ gestor      | `src/lib/rbac.ts:121-134` + `unidades.ts` rolesAceitas | match name+unitScope                                                   |
| medico redireciona p/ `/medico/login`                           | `src/app/medico/page.tsx:34`                           | `redirect("/medico/login" as Route)`                                   |
| **capacitacao redireciona p/ `/login` (DIVERGENTE)**            | `capacitacao/page.tsx:18` etc.                         | `redirect("/login" as Route)`                                          |
| `PageHead` renderiza `title` como `<h1>`                        | `capacitacao/_components/ui.tsx:30-39`                 | `<h1 className={styles.title}>{title}</h1>`                            |
| `criarCursoAction(formData)` padrão de action                   | `capacitacao/actions.ts:36-58`                         | `auth()` → `podeGerenciarCurso` → `db.curso` → `logEvent` → `redirect` |
| `Curso.ativo Boolean @default(true)` soft-delete                | `prisma/schema.prisma:652`                             | + `@@index([ativo, area])`                                             |
| `podeGerenciarCurso(session)`                                   | `src/lib/capacitacao/rbac.ts:11-14`                    | `super_admin` ou `gestor_unidade`                                      |
| detalhe do curso carrega `curso` inteiro (tem `.ativo`)         | `cursos/[id]/page.tsx:22-31`                           | `db.curso.findUnique`                                                  |
| helper e2e `login/loginError/SENHA_DEMO`                        | `tests/e2e/helpers/login.ts`                           | exports prontos                                                        |
| seed: Luciana gestor capacitacao, INFO-2026-01, 2× lista_espera | `prisma/seed.ts:37,346,424,491-496`                    | turma lotada (cap 4) + fila 2                                          |

---

## Ordem de build (sequência exata)

1. **Item (1)** — `getLandingPathFor` (1 linha). Isolado, sem efeito runtime, fundação.
2. **Item (2)** — alinhar redirects de `/capacitacao` ao padrão `/capacitacao/login` (5 pages). Pré-requisito do e2e.
3. **Item (3)** — toggle ativar/desativar curso (action + botão no detalhe).
4. **Item (4)** — e2e smoke `tests/e2e/capacitacao.spec.ts`.
5. **Ritual** — `pnpm format && pnpm format:check && pnpm typecheck && pnpm lint && pnpm test` + `pnpm build` (via WSL); e2e local opcional (precisa seed).

---

## Item (1) — LANDING: gestor_unidade:capacitacao cai em `/capacitacao`

### Decisão

Mapear `scope → módulo` **só no branch unitário** de `getLandingPathFor`. `/${scope}` em vez de `/app/${scope}`. Branches globais intactos.

### Arquivo a editar

`C:/Users/Administrador/ifp-connect/src/lib/rbac-types.ts`

### Mudança exata (linha 67)

```ts
// ANTES
    case "gestor_unidade":
    case "profissional":
    case "recepcao":
      return primaryUnitScope ? `/app/${primaryUnitScope}` : "/app";

// DEPOIS
    case "gestor_unidade":
    case "profissional":
    case "recepcao":
      return primaryUnitScope ? `/${primaryUnitScope}` : "/app";
```

### O que MAIS precisa existir para o destino `/${scope}` funcionar

- `/medico` → `src/app/medico/page.tsx` ✅ EXISTE (MedicoShell real).
- `/capacitacao` → `src/app/capacitacao/page.tsx` ✅ EXISTE (CapacitacaoShell real).
- `/esportivo`, `/recreativo` → ⚠️ **só existem via `src/app/[unidade]/page.tsx`** (stub "Bem-vindo, {nome}"). Gestor desses cai num stub, não num painel. **Aceitável por ora** (esses verticais ainda não foram construídos; F1.A.1 fechou só medico+capacitacao). NÃO é regressão: hoje `/app/esportivo` → proxy → `/esportivo` → mesmo stub. Anotar como dívida.
- Fallback `primaryUnitScope == null` → `/app` → proxy → `/poncio` (inalterado).

### Por que NÃO quebra medico/esportivo/recreativo

- Médico: `/medico` já é o destino correto; tira a dependência do alias `oldUnitMatch`.
- Esportivo/recreativo: destino efetivo idêntico ao de hoje (stub via `[unidade]`).
- super_admin/presidencia (`/app`→`/poncio`) e social (`/social`): branches **não tocados**.

### Efeito runtime

**Nenhum imediato** (D4): `getLandingPath` não é chamado no login hoje. A mudança é correção de fundação. Religar `getLandingPath` no `signInAction`/home `/` é trabalho separado (F1.A.1 t14) — **fora deste escopo**.

---

## Item (2) — LOGIN TEMÁTICO `/capacitacao/login`

### Decisão (resolve o conflito do dossiê)

**ESPELHAR O PADRÃO DO MÉDICO. NÃO criar arquivo de login.** A rota `/capacitacao/login` já é servida por `src/app/[unidade]/login/page.tsx` (slug="capacitacao"), que resolve `unidadeFromSlug("capacitacao")` (config válida: nome "Capacitação", `corFiltroLogin "#FF772E"`, gradiente laranja) e renderiza `<UnidadeLoginShell unidade={...} loginAction={unidadeLoginAction.bind(null,"capacitacao")} />`. O proxy libera `/capacitacao/login` como público (`proxy.ts:14-20`) e redireciona no-session de `/capacitacao` → `/capacitacao/login` (`proxy.ts:23-30`). **Tudo isso já funciona — idêntico ao médico.**

O único gap real é a **divergência D3**: as pages de `/capacitacao` mandam o no-session pro `/login` global em vez do `/capacitacao/login` temático. Alinhar ao médico.

### Arquivos a editar (5 pages)

Trocar `redirect("/login" as Route)` → `redirect("/capacitacao/login" as Route)`:

1. `C:/Users/Administrador/ifp-connect/src/app/capacitacao/page.tsx:18`
2. `C:/Users/Administrador/ifp-connect/src/app/capacitacao/cursos/page.tsx:15`
3. `C:/Users/Administrador/ifp-connect/src/app/capacitacao/cursos/[id]/page.tsx:18`
4. `C:/Users/Administrador/ifp-connect/src/app/capacitacao/turmas/page.tsx:18`
5. `C:/Users/Administrador/ifp-connect/src/app/capacitacao/turmas/[id]/page.tsx:41`

(Conferir também `turmas/nova/page.tsx` e `instrutores/page.tsx` com o mesmo padrão `if (!session) redirect("/login" as Route)` e alinhar todos.)

### Mudança exata (idêntica nas 5+)

```ts
// ANTES
if (!session) redirect("/login" as Route);
// DEPOIS
if (!session) redirect("/capacitacao/login" as Route);
```

### typedRoutes

`"/capacitacao/login"` é Route válida: casa o padrão dinâmico `/${SafeSlug}/login` do typedRoutes (igual a `"/medico/login"`, que o build já aceita). O `as Route` é cinto-e-suspensório e mantém consistência com o médico. **NÃO** criar `Route` dinâmico nem novo arquivo.

### Arquivos que NÃO mudam (reuso confirmado)

- `src/app/[unidade]/login/page.tsx` — serve `/capacitacao/login` parametrizado. Intacto.
- `src/app/[unidade]/login/login-action.ts` (`unidadeLoginAction`) — gatekeeping `rolesAceitas` + `signIn({redirectTo:"/${slug}"})`. Intacto.
- `src/components/unidade-login-shell.tsx` — shell temática (gradiente + overlay `#FF772E`). Intacta.
- `src/lib/unidades.ts` — `UNIDADES.capacitacao` completo. Intacto.
- `src/proxy.ts` — já cobre tudo. Intacto.

---

## Item (3) — CRUD: toggle ativar/desativar curso (soft-delete)

### Decisão

Server action `toggleCursoAtivoAction` + botão no `PageHead.action` do **detalhe do curso** (`cursos/[id]/page.tsx`), escopado por `podeGerenciarCurso`. Usa `Curso.ativo` (já no schema, `@default(true)`, `@@index([ativo, area])`). A lista já reflete `ativo` (opacity + ordem) — `revalidatePath` propaga.

### Arquivo a editar 1 — action

`C:/Users/Administrador/ifp-connect/src/app/capacitacao/actions.ts`

Adicionar import no topo (junto aos existentes):

```ts
import { revalidatePath } from "next/cache";
```

(Conferir se já importado; o arquivo hoje não importa `revalidatePath`. Os redirects existentes já invalidam, mas o toggle volta pra MESMA página, então precisa de revalidate explícito.)

Nova action (espelha `criarCursoAction:36-58` — `auth()` → guard → `db.curso` → `logEvent` → redirect/revalidate):

```ts
export async function toggleCursoAtivoAction(formData: FormData) {
  const session = await auth();
  if (!podeGerenciarCurso(session)) throw new Error("Sem permissão");
  const cursoId = s(formData, "cursoId");
  const curso = await db.curso.findUniqueOrThrow({ where: { id: cursoId } });
  const novo = !curso.ativo;
  await db.curso.update({ where: { id: cursoId }, data: { ativo: novo } });
  await logEvent({
    userId: session!.user.id,
    action: novo ? "curso_reativado" : "curso_desativado",
    entityType: "curso",
    entityId: cursoId,
    meta: { nome: curso.nome, ativo: novo },
  });
  revalidatePath(`/capacitacao/cursos/${cursoId}`);
  revalidatePath("/capacitacao/cursos");
  redirect(`/capacitacao/cursos/${cursoId}` as Route);
}
```

- `podeGerenciarCurso` já está importado em `actions.ts` (linha 11-15). `s()`, `db`, `logEvent`, `auth`, `redirect`, `Route` já importados. Só falta `revalidatePath`.
- `findUniqueOrThrow` é o padrão usado em `criarTurmaAction:64`.
- Strings de `action` no audit: `curso_desativado` / `curso_reativado` (consistente com `curso_criado`).

### Arquivo a editar 2 — botão no detalhe

`C:/Users/Administrador/ifp-connect/src/app/capacitacao/cursos/[id]/page.tsx`

Imports a adicionar:

```ts
import { podeGerenciarCurso } from "@/lib/capacitacao/rbac"; // já importa podeCriarTurma da mesma lib — só somar
import { toggleCursoAtivoAction } from "../../actions";
```

No `PageHead` `action` (hoje só o link "← Catálogo", linhas 47-51), envolver num fragmento e somar o `<form>` com o toggle, condicionado a `podeGerenciarCurso(session)`:

```tsx
action={
  <>
    {podeGerenciarCurso(session) ? (
      <form action={toggleCursoAtivoAction}>
        <input type="hidden" name="cursoId" value={curso.id} />
        <button
          type="submit"
          className={`${styles.btn} ${curso.ativo ? styles.btnGhost : styles.btnPrimary}`}
        >
          {curso.ativo ? "Desativar curso" : "Reativar curso"}
        </button>
      </form>
    ) : null}
    <Link href={"/capacitacao/cursos" as Route} className={`${styles.btn} ${styles.btnGhost}`}>
      ← Catálogo
    </Link>
  </>
}
```

- `curso.ativo` disponível (já vem do `findUnique`, schema tem `ativo`).
- Classes `styles.btn`, `styles.btnGhost`, `styles.btnPrimary` já usadas no arquivo. Reusar — NÃO inventar estilo (regra dura do Design Kit).
- Botão muda label/variante conforme estado (Desativar→ghost / Reativar→primary).

### Sinal visual no detalhe (opcional, recomendado)

Adicionar um `KitBadge variant="danger"` "Inativo" perto do título quando `!curso.ativo`, reusando `KitBadge` (já importado linha 10). Mínimo viável: só o botão já fecha o CRUD.

### Por que detalhe e não lista

A lista (`cursos/page.tsx`) já mostra estado (`opacity` + ordem `ativo desc`); colocar N botões inline polui o grid. O detalhe tem `action` slot livre e `curso` inteiro carregado. `revalidatePath("/capacitacao/cursos")` mantém a lista em sincronia.

---

## Item (4) — E2E smoke `tests/e2e/capacitacao.spec.ts`

### Decisão

Seguir o padrão real: `import { expect, test } from "@playwright/test"` + helper compartilhado `./helpers/login` (caminho limpo; o dossiê confirma que importar funciona, mesmo que specs legados dupliquem). Smoke read-only (não cria lixo → não mexe no `_teardown.ts`). Ancorar nos dados do seed (Luciana, INFO-2026-01).

### Arquivo a criar

`C:/Users/Administrador/ifp-connect/tests/e2e/capacitacao.spec.ts`

### Conteúdo (UTF-8 obrigatório — acentos)

```ts
import { expect, test } from "@playwright/test";
import { login, SENHA_DEMO } from "./helpers/login";

const LUCIANA = "luciana@familiaponcio.org.br";

test.describe("Capacitação — smoke (login temático + painel + turma INFO)", () => {
  test("não autenticado em /capacitacao vai pro login da unidade", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/capacitacao");
    await expect(page).toHaveURL(/\/capacitacao\/login$/);
  });

  test("Luciana (gestor capacitacao) loga e vê o painel da unidade", async ({ page }) => {
    await login(page, "capacitacao", LUCIANA, SENHA_DEMO);
    await expect(page).toHaveURL(/\/capacitacao$/);
    await expect(page.getByRole("heading", { name: "Painel da unidade" })).toBeVisible();
    await expect(page.getByText("PRÓXIMAS TURMAS")).toBeVisible();
    await expect(page.getByText("Informática Básica").first()).toBeVisible();
  });

  test("Luciana abre a turma INFO e vê ocupação + matriculados", async ({ page }) => {
    test.setTimeout(60_000); // detalhe roda vários queries Prisma (matriculas + candidatos)
    await login(page, "capacitacao", LUCIANA, SENHA_DEMO);

    await page.goto("/capacitacao/turmas");
    await expect(page.getByRole("heading", { name: "Turmas" })).toBeVisible();
    await page.getByRole("link", { name: /INFO-2026-01/ }).click();

    await expect(page).toHaveURL(/\/capacitacao\/turmas\/[a-z0-9]+$/);
    await expect(page.getByRole("heading", { name: "Informática Básica" })).toBeVisible();
    // VagasMeter renderiza "<b>n</b> / capacidade vagas" — turma lotada (cap 4):
    await expect(page.getByText(/vagas/)).toBeVisible();
  });
});
```

### Justificativa dos asserts (contra código lido)

- `/\/capacitacao\/login$/` — passa pelo **proxy** (`proxy.ts:23-30`) E pelo page-level redirect alinhado no item (2). Robusto.
- `getByRole("heading", { name: "Painel da unidade" })` — `PageHead` renderiza `<h1>` (`_components/ui.tsx:34`). ✅
- `getByText("PRÓXIMAS TURMAS")` — `<h2 className={styles.cardTitle}>` literal (`page.tsx:77`). ✅
- `getByText("Informática Básica").first()` — `t.curso.nome` no painel; `.first()` evita múltiplos matches.
- `getByRole("link", { name: /INFO-2026-01/ })` — `codigo` único nas linhas-Link de `turmas/page.tsx`; evita hardcodar cuid.
- `getByRole("heading", { name: "Informática Básica" })` — `PageHead title={turma.curso.nome}` no detalhe (`turmas/[id]/page.tsx`). ✅
- `getByText(/vagas/)` — `VagasMeter` renderiza "`<b>{ocupadas}</b> / {capacidade} vagas · lotada`" (`_components/ui.tsx:54-56`). Mais estável que assumir o card "MATRICULADOS"/"LISTA DE ESPERA" (não verifiquei essas strings literais no detalhe — evitei assert frágil; o `VagasMeter` está confirmado).

### Como roda (não é o Playwright que seeda)

`playwright.config.ts` sobe `webServer: pnpm start` (prod build), `baseURL http://localhost:3000`, `reuseExistingServer` local. Banco precisa **pré-seedado**. Fluxo (via WSL, CLAUDE.md):

```
pnpm dev:up → pnpm db:deploy → pnpm db:seed → pnpm build → pnpm test:e2e
```

Smoke read-only → `_teardown.ts` (higiene) não precisa de ajuste.

---

## Verificação final (ritual + gates)

Via WSL (CLAUDE.md — Node roda dentro do Ubuntu):

```
wsl -d Ubuntu -- bash -lc "cd /mnt/c/Users/Administrador/ifp-connect && pnpm format && pnpm format:check && pnpm typecheck && pnpm lint && pnpm test && pnpm build"
```

- **Gates fatais CI** (memória do projeto): unit + build + format + lint + types. Itens (1)-(3) precisam passar todos.
- **Typecheck**: confirmar que `revalidatePath` import resolve e que `toggleCursoAtivoAction` tipa (`Curso.ativo` é `Boolean`).
- **e2e**: legacy ainda não-gate-fatal; escrever pra passar como se fosse. Rodar local só após seed.
- **Verify via arquivo `.sh`** se for rodar e2e por WSL (marshalling PowerShell→wsl mascara exit code — CLAUDE.md).

---

## Riscos / pegadinhas

- **R1 (ofuscação estática — VERIFICAR EMPIRICAMENTE):** `src/app/capacitacao/` é segmento estático que precede `[unidade]` para o slug. O dossiê afirma que `/capacitacao/login` NÃO é ofuscado (não há `capacitacao/login/`), caindo no `[unidade]/login`. Os dois sub-relatórios do dossiê CONCORDAM em não criar arquivo, mas DISCORDAM no porquê. **Antes de fechar, validar com `pnpm dev` + GET `/capacitacao/login`** que renderiza a `UnidadeLoginShell` (fundo laranja `#FF772E`), não 404. Se der 404, fallback é criar `src/app/capacitacao/login/page.tsx` reusando shell+action (o ÚNICO cenário que justificaria o arquivo) — mas a evidência do médico diz que não será preciso.
- **R2 (item 1 sem efeito runtime):** `getLandingPath` é dead-code hoje (D4). A mudança de `getLandingPathFor` NÃO muda o login até religar `getLandingPath` no `signInAction`/home `/`. Não prometer "agora cai no painel" só com o item (1) — o que garante `/capacitacao` é o **proxy** + login per-unidade (`unidadeLoginAction` faz `redirectTo:"/capacitacao"`). O comentário em `(auth)/login/actions.ts:8-13` é DESATUALIZADO (diz que `/` calcula getLandingPath; não calcula). Não confiar no comentário.
- **R3 (Design Kit — regra dura):** botão do toggle usa SÓ `styles.btn/btnGhost/btnPrimary` já existentes. NÃO inventar cor/classe. Sem logo por unidade. Tudo via tokens.
- **R4 (revalidate vs redirect):** o toggle volta pra mesma página → precisa `revalidatePath` explícito; só `redirect` pra mesma URL pode servir cache stale do `curso.ativo`. Revalidar detalhe + lista.
- **R5 (UTF-8):** salvar o spec em UTF-8 (acentos "Informática", "Capacitação"). CLAUDE.md alerta sobre mojibake Latin-1.
- **R6 (e2e depende do seed):** asserts ancorados em INFO-2026-01 lotada (cap 4, 2 lista_espera). Se o seed mudar, quebra — fragilidade aceita de smoke ancorado no seed (mesma dos specs de médico).
- **R7 (esportivo/recreativo sem vertical):** item (1) manda gestores desses pra stub `[unidade]/page.tsx`. Não-regressão, mas anotar como dívida (verticais ainda não construídos).
- **R8 (proxy é `src/proxy.ts`, não `middleware.ts`):** não renomear/mexer — derruba o gating de TODAS as unidades. Este plano NÃO toca o proxy.
- **R9 (não remover alias do proxy):** mesmo que `getLandingPathFor` pare de emitir `/app/*`, NÃO remover `oldUnitMatch` (`proxy.ts:55-58`) nem o catch-all `if (path.startsWith("/app/")) return;` (`proxy.ts:62-64`) — `/app/cidadaos` e `/app/vagas` ainda vivem ali. Fora do escopo deste plano.

---

## Resumo dos arquivos tocados

**Editar (8):**

- `src/lib/rbac-types.ts` (item 1 — 1 linha)
- `src/app/capacitacao/page.tsx` (item 2 — redirect)
- `src/app/capacitacao/cursos/page.tsx` (item 2)
- `src/app/capacitacao/cursos/[id]/page.tsx` (itens 2 + 3 — redirect + botão toggle)
- `src/app/capacitacao/turmas/page.tsx` (item 2)
- `src/app/capacitacao/turmas/[id]/page.tsx` (item 2)
- `src/app/capacitacao/turmas/nova/page.tsx` + `instrutores/page.tsx` (item 2 — conferir/alinhar redirect)
- `src/app/capacitacao/actions.ts` (item 3 — `toggleCursoAtivoAction` + import `revalidatePath`)

**Criar (1):**

- `tests/e2e/capacitacao.spec.ts` (item 4)

**NÃO tocar (decisões):** `src/proxy.ts`, `src/app/[unidade]/login/*`, `src/components/unidade-login-shell.tsx`, `src/lib/unidades.ts`, `(auth)/login/*`, `getLandingPath` (religar é F1.A.1 t14, fora de escopo). **NÃO criar** `src/app/capacitacao/login/page.tsx` (salvo fallback R1).
