# RFC — Onda D: fechar o que sobrou do "conjunto seguro" (sem schema)

> Gerado em 2026-06-23 para a esteira ralphinho (skill `ralphinho-rfc-pipeline`).
> Fonte do escopo: `docs/COMPARATIVO-100.md` (cruzado com o código atual — vários itens
> do comparativo já foram fechados pelas Ondas original/A/B/C; aqui só o que **ainda tem gap**).
> Branch: `claude/continue-projetoifp-section-10-RKC1n` (commit direto + push; `git fetch`+rebase antes).

## Objetivo
Subir as últimas telas **seguras** que ainda faltam, **sem mexer no schema** (só agregação
read-only + UI CASA + endurecimento de validação backend). Tudo aditivo, testável por
regressão backend, reversível.

## Restrição-chave desta onda: ZERO migrations
Toda unidade é **schema-free**. Isso elimina o risco mais perigoso da esteira (migrate/reset
interativo travando) e mantém o deploy futuro trivial. Se uma ideia exigir model novo, ela
**não entra** na Onda D — vira pendência pro Erick decidir.

## Fora de escopo (continua exigindo humano/decisão)
IA (triagem-ia, resumo-ia, histórias-ia, áudio TTS), site público (design), telas que
dependem de **dados inexistentes** (custo/beneficiário, CRM doadores, demanda reprimida,
saúde populacional clínica — decisão de indicadores+anonimização), recuperar-senha (SMTP),
upload de arquivos (storage), e tudo de **produção** (rotação de segredos, cutover da `ifp-app`).

## Unidades (DAG — sequenciais; working tree + DB únicos)

| # | Unidade | Telas-alvo | Escopo | Aceite (valida) | Schema | Tier |
|---|---------|-----------|--------|-----------------|--------|------|
| D1 | Serviço Social a ~100% | social-ficha-detalhe, social-elegibilidade | **Web:** timeline de encaminhamentos na ficha (consome `GET /servico-social/encaminhamentos/:fichaId/historico` já existente). **API:** forçar `motivo` obrigatório **no backend** ao REPROVAR/SUSPENDER/DESLIGAR elegibilidade (hoje só no front) → 400 sem motivo. | estende `valida-encaminhamentos` (historico por ficha) + `valida-fichas-cidadas`/`valida-social-ficha` (PUT elegibilidade sem motivo → 400) | não | 2 |
| D2 | Ponte cross-vertical | social-ponte (100%) | **Web:** ação reutilizável "Sinalizar ao Social" nos shells das outras verticais (médico/educador/capacitação/esportivo) → painel inline → `POST /servico-social/ponte` (endpoint já existe; perfis PROFISSIONAL/GESTOR_UNIDADE/SUPER_ADMIN). | `valida-ponte` (mantém 9/9+; cobre criação via UI-path) + typecheck | não | 2 |
| D3 | Central de Avisos real | comum-notificacoes | **API:** `GET /notificacoes` (novo módulo comum) **agregando sinais reais por perfil** do logado (read-only, sem model): triagens na fila, ponte pendente, encaminhamentos a aceitar, comunicados não lidos, etc. Retorna `{ total, itens:[{tipo,titulo,descricao,href,em}] }`, respeitando RBAC/tenant. **Web:** sino no Shell/Rail consome o endpoint (contador + dropdown), substitui o "Em breve". | novo `valida-notificacoes` (total==itens.length; perfis veem contagens coerentes; RBAC/tenant) | não | 2 |
| D4 | Panorama Territorial | pres-mapa-territorial (versão honesta) | **API:** `GET /presidencia/territorio` (RBAC presidência/super-admin) agregando `fichaCidada.bairro` (× unidade), reusando `consolidarBairros`. SEM "demanda reprimida" (não há dado) e SEM geo falso. **Web:** tela `presidencia/territorio` = distribuição/ranking por bairro (barras CASA) + cruzamento por unidade, rotulada "Panorama territorial por bairro". | novo `valida-territorio` ou estende `valida-presidencia` (403 p/ não-presidência; soma por bairro == total) | não | 2 |
| D5 | Polimento de credibilidade | medico-painel, cap-chamada, cap-painel, medico-indicadores | Pequenos incrementos de **dado real** nas telas parciais de alta cobertura (próximo paciente/avisos, KPIs de resumo da chamada, widget de próximas turmas, 1-2 cards). **Nada de mock.** Priorizar 2-3 de maior sinal. | typecheck + não-regressão dos `valida-*` das áreas tocadas | não | 1 |

## Quality pipeline por unidade
`research (abrir os arquivos, confirmar o gap) → implementar (CASA + API) → escrever/estender valida-*.mjs → operador roda restart+valida → verde? commit+fetch+rebase+push : feedback+retry : evict+snapshot(.patch)+árvore limpa`.

## Execução (decisão desta sessão)
Esteira **serial operada** (não background): por unidade, **1 subagente de implementação**
pesquisa+implementa+escreve o valida+autoconfere `pnpm typecheck` (typecheck não precisa de
DB). Depois **o operador (Claude no loop principal)** roda `ifp-ci.ps1 restart` + `valida -Name <x>`
em runtime e **commita/empurra** se verde. Motivo: o ambiente local é recurso único (1 DB + 1
working tree) e frágil (forward decai, EPERM, API presa na :3333); operar a env num só lugar
evita contenção e garante verificação real (não auto-relato). Reset é **só do operador**.

## Merge queue / recovery
- Sequencial (DB+tree únicos). `git fetch`+rebase em `origin/<branch>` antes de cada push.
- Unidade que não fica verde após esforço razoável: **não commita**; `.patch` no scratchpad, árvore limpa, segue. Não bloqueia a fila.
- Sem migrations nesta onda → sem reseed/reset no caminho feliz.

## Saídas
Scorecard por unidade (green/failed/partial) + commits + pendências que sobram pro humano.
