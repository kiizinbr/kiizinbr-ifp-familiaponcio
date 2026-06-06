# Design — Painel de Chamada na TV (Centro Médico + Capacitação)

**Data:** 2026-06-06 · **Autor:** brainstorming Erick + Claude · **Status:** aprovado, pronto p/ plano de implementação

## Contexto e objetivo

O IFP tem TVs espalhadas no Centro Médico e na Capacitação. Objetivo: usá-las como **painel de chamada acessível** + **mídia institucional**.

- **Centro Médico:** quando médico/triagem/recepção chama o próximo, o painel anuncia o paciente **na tela grande + por voz**. O público é carente — há pessoas com baixa visão e pessoas que não leem bem, então **a voz é o canal principal de acessibilidade**, não um extra.
- **Tempo ocioso (ambas as unidades):** a TV passa um vídeo do canal do YouTube do IFP (link trocado por mês) + um **rodapé rolante** com anúncios ("DIA X TEM WORKSHOP COM O CABELEREIRO LOTUFU").

Referência: o painel do Amplimed, **mas com voz** (que o Amplimed não tinha).

## Decisões fechadas (brainstorming)

1. **Layout da chamada:** vídeo continua tocando **mudo** (não pausa) + tela escurece + **cartão grande** central com o nome + voz. (não pausar = uma ação a menos; mute deixa a voz limpa)
2. **Conteúdo da tela:** chamada atual em destaque **+ lista discreta dos últimos 3-4 chamados** (nome + destino + horário).
3. **Disparo da chamada:** **ação própria "Chamar"** (não acoplada a "iniciar atendimento"), **re-chamável**, disparada das telas onde a equipe já trabalha a fila.
4. **Capacitação:** por enquanto **só vídeo + rodapé** (sem chamada). O painel é construído genérico, mas a chamada só liga no médico agora.
5. **Destino:** derivado de **quem chamou** — "Dr. Fulano" (médico), "Triagem", "Recepção". Sem cadastro de salas (o espaço não tem salas numeradas; um guia no corredor orienta).
6. **Transporte (tempo real):** **polling ~2s** (sem SSE/Redis). Robustez > instantaneidade; 2s é imperceptível pra chamar paciente.
7. **Autenticação da TV:** **login de quiosque** com um papel mínimo "painel" por unidade (o app é exposto pelo Tailscale Funnel = internet pública, então a TV precisa de sessão).
8. **Voz:** Web Speech API do navegador (`speechSynthesis`), pt-BR, grátis e local.

## Superfícies (3)

### 1. Tela da TV — `/painel/[unidade]`

Página em tela cheia aberta no navegador da TV. Server Component carrega `videoUrl` + anúncios ativos e renderiza o client `PainelTV`. Estados:

- **Gesto inicial:** "▶ Iniciar painel" em tela cheia. Um clique do operador ao montar a TV libera áudio/autoplay (limitação de browser — sem o gesto, nem vídeo-com-som nem voz tocam). Depois roda desatendido.
- **Ocioso:** vídeo do YouTube em tela cheia (com som) + rodapé rolante com anúncios ativos.
- **Chamando:** muta o vídeo, escurece, cartão grande central (nome + destino), **fala o nome** (~2x, ritmo mais lento). Após ~8s, desfaz o overlay e desmuta. Atualiza a lista de últimos chamados.

### 2. Botão "Chamar" — nas telas da equipe

Aparece em **minha-fila do médico**, **painel da recepção** e **triagem** (telas que já gerenciam a fila, já RBAC-gated). Cada botão conhece seu contexto e passa o `destino` correto. Clica → `chamarAction`.

### 3. Config do painel — `/painel/[unidade]/config`

Tela simples (gestão/super_admin) pra definir o **link do vídeo** e gerenciar **anúncios** (texto + validade), por unidade.

## Modelo de dados (Prisma)

```prisma
model Chamada {
  id          String   @id @default(cuid())
  unidade     String   // slug (medico/capacitacao/...)
  nomeChamado String   // snapshot de nomeSocial || nomeCompleto (congela no momento da chamada)
  destino     String   // "Dr. Fulano" | "Triagem" | "Recepcao"
  chamadoPor  String   // userId
  cidadaoId   String?  // link opcional p/ auditoria/timeline
  consultaId  String?  // link opcional
  criadoEm    DateTime @default(now())

  @@index([unidade, criadoEm])
}

model PainelConfig {
  id        String   @id @default(cuid())
  unidade   String   @unique
  videoUrl  String?  // link do YouTube do mes
  updatedAt DateTime @updatedAt
}

model PainelAnuncio {
  id       String    @id @default(cuid())
  unidade  String
  texto    String
  ativoAte DateTime? // null = sem prazo; senao some sozinho depois da data
  criadoEm DateTime  @default(now())

  @@index([unidade])
}
```

- **Snapshot do nome** (`nomeChamado`) evita join no polling e congela o nome usado na chamada. Preferir `nomeSocial` quando houver (dignidade + é o nome que a pessoa atende).
- **Audit:** nova ação `paciente_chamado` em `AuditAction`.

## Fluxo da chamada

1. Equipe clica **"Chamar [paciente]"** → `chamarAction(formData)`:
   - RBAC: `canAccessUnidade(unidade)` + papel adequado à superfície (médico: profissional/gestor; triagem: social; recepção: recepção). O papel "painel" **não** pode chamar.
   - Cria `Chamada` (destino derivado do contexto do botão; `nomeChamado` snapshot).
   - `logEvent({ action: "paciente_chamado", rootEntityType: "cidadao", rootEntityId: cidadaoId, meta: { unidade, destino } })`.
2. A TV (`/painel/[unidade]`) faz **polling ~2s** em `GET /api/painel/[unidade]/chamadas`:
   - Exige sessão (quiosque) + `canAccessUnidade(unidade)` — a rota faz auth própria (não passa pelo proxy, como as outras `/api/*`).
   - Retorna `{ atual: <última Chamada>, recentes: [<últimas 3-4>] }`.
3. O painel compara o **id da chamada atual** com o que já anunciou. Se mudou → muta vídeo, mostra cartão, fala o nome, ~8s depois volta ao ocioso. **Re-chamar** = nova `Chamada` (novo id) → re-anuncia mesmo sendo a mesma pessoa.

## Comportamento da TV (client)

- **Vídeo:** **YouTube IFrame Player API** (não iframe simples — precisa controlar mute por código). Autoplay, loop, sem controles, `youtube-nocookie`. `player.mute()` na chamada, `player.unMute()` ao fim. Link vazio/erro de carga → **tela institucional do IFP** (logo/marca) no lugar do preto.
- **Voz:** `speechSynthesis.speak(...)` com `lang="pt-BR"`, `rate` ~0.95, fala "{nome}, {destino}" ~2x. Sem voz pt-BR → voz padrão (cartão visual é o reforço).
- **Rodapé:** faixa rolante (animação CSS via `transform`, compositor-friendly) com os anúncios ativos. Sem anúncio ativo → sem rodapé.
- **Últimos chamados:** canto discreto com os últimos 3-4 (nome + destino + horário), atualizado a cada polling.

## RBAC, proxy e quiosque

- **Papel "painel":** novo `RoleName` mínimo, com `unitScope` por unidade. Adicionado a `UNIDADES[slug].rolesAceitas` pra `canAccessUnidade` aceitar. **Só** enxerga a tela do painel + o endpoint de polling — não chama, não vê ficha, nada mais.
- **Usuário de quiosque:** um usuário por unidade (ex.: `painel.medico`) com o papel "painel" daquela unidade, `mustChangePassword=false`, senha definida. A TV loga uma vez. Criado por script (`scripts/criar-usuario-painel.ts`) ou seed.
- **Proxy (`src/proxy.ts`):** adicionar `/painel/:path*` ao matcher; exigir sessão + `canAccessUnidade(slug)`. A subrota `/painel/[unidade]/config` é gestor/super_admin — o próprio page component re-checa o papel e redireciona o usuário de quiosque.
- **`podeGerirPainel(session)`** = super_admin/gestor_unidade (config). **`podeChamar(session, unidade)`** = quem opera a fila da superfície.

## Tratamento de erros (degradar com elegância — nunca tela preta)

- Polling falha (rede) → mantém o último estado, retenta no próximo ciclo; indicador minúsculo "reconectando". Nunca quebra.
- Sem TTS / sem voz pt-BR → segue só com o cartão visual.
- YouTube não carrega / link inválido → tela institucional do IFP.
- Sessão de quiosque expira → polling vê 401 → "reconecte o painel" (sessão longa torna isso raro).
- "Chamar" sem permissão / erro → action barra no servidor; nada é anunciado; botão dá feedback.

## Testes

- **Unit (lógica pura, `src/lib/painel/*`):** "tem chamada nova desde X?" (comparação de id), filtro de anúncio ativo (`ativoAte`), derivação do destino.
- **Integração (DB-real, como `tests/unit/medico-agenda.test.ts`):** `chamarAction` exige RBAC + cria `Chamada` + audita; endpoint de polling exige sessão, é unit-scoped e retorna o shape certo.
- **Manual/Playwright smoke:** abrir o painel, simular uma chamada, ver o overlay aparecer. TTS/YouTube ficam no teste manual na própria TV (difícil automatizar).

## Arquivos (criar/alterar)

| Arquivo                                               | Ação   | Por quê                                              |
| ----------------------------------------------------- | ------ | ---------------------------------------------------- |
| `prisma/schema.prisma` + migration                    | CREATE | models `Chamada`/`PainelConfig`/`PainelAnuncio`      |
| `src/lib/audit.ts`                                    | UPDATE | ação `paciente_chamado`                              |
| `src/lib/rbac-types.ts`                               | UPDATE | `RoleName` "painel" + `rolesAceitas`                 |
| `src/lib/rbac.ts`                                     | UPDATE | `podeChamar`, `podeGerirPainel`                      |
| `src/lib/painel/*.ts`                                 | CREATE | helpers puros (destino, anúncio ativo, nova-chamada) |
| `src/app/painel/[unidade]/page.tsx` + `painel-tv.tsx` | CREATE | tela da TV (server + client)                         |
| `src/app/api/painel/[unidade]/chamadas/route.ts`      | CREATE | endpoint de polling (auth própria)                   |
| `src/app/painel/chamar-actions.ts`                    | CREATE | `chamarAction`                                       |
| minha-fila / recepção / triagem                       | UPDATE | botão "Chamar" + destino do contexto                 |
| `src/app/painel/[unidade]/config/page.tsx` + actions  | CREATE | config de vídeo + anúncios (gestor)                  |
| `src/proxy.ts`                                        | UPDATE | matcher `/painel/:path*` + gate de unidade           |
| `scripts/criar-usuario-painel.ts`                     | CREATE | usuário de quiosque por unidade                      |
| `tests/unit/painel*.test.ts`                          | CREATE | unit + integração                                    |

## Fora de escopo (futuro)

- Chamada na Capacitação (hoje só vídeo + rodapé).
- Cadastro de salas/consultórios como destino.
- Múltiplos painéis por unidade com filtros distintos.
- SSE/realtime instantâneo (só se a latência do polling incomodar).
- Fila de anúncios com agendamento avançado / mídia (imagem) no rodapé.

## Nota LGPD

Anunciar nome em área semipública é escolha explícita de acessibilidade do Erick (público que não lê). Mitigações: a tela da TV e o endpoint de polling **exigem sessão** (quiosque) + são unit-scoped (sem exposição pública pelo Funnel); usa-se **nome social** quando houver; a ação "Chamar" é **auditada**. Atualizar a ROPA (`docs/seguranca/2026-06-06-ropa.md`) com esta operação (exibição/locução de nome em painel) quando implementado.
