# Auditoria pré-lançamento — IFP Connect · RODADA 2 (retomada do go-live)

**Data:** 2026-06-22 · **Branch:** `claude/continue-projetoifp-section-10-RKC1n`
**Modo:** revisão estática multi-agente (8 dimensões) — superfície NOVA (Serviço Social / prescrição / consentimento) + re-verificação dos P2/P3 da auditoria de 22/06. Cada achado novo passou por verificação adversarial (refutar por padrão).
**Continuação de:** `docs/AUDITORIA-PRELANCAMENTO-2026-06-22.md` (rodada 1: 31 achados, os 4 P1 já corrigidos).

**Resultado:** 53 achados brutos → **52 confirmados** (50 abertos · 2 já corrigidos) · 1 refutado.
**Abertos por severidade:** P1=2 · P2=21 · P3=27

## Veredito de prontidão: **NAO_LANCAR**

Nao lance ainda para o piloto com dado de familia vulneravel. A superficie nova do Servico Social trouxe DOIS bloqueadores reais e confirmados no codigo: (1) o POST /servico-social/ponte deixa qualquer PROFISSIONAL ou GESTOR_UNIDADE autenticado criar sinalizacao sobre QUALQUER ficha do instituto e forjar a unidade de origem (ponte.service.ts:108-149 nao amarra o ator a unidade dele nem a ficha, diferente de todos os outros modulos que usam resolverPorUser; o controller reabre o metodo via override em ponte.controller.ts:50-51) -- e escrita cross-unidade nao autorizada + auditoria LGPD com origem falsa sobre dado sensivel; e (2) o wizard de Nova Ficha (apps/web/.../fichas/nova/page.tsx:264-271) navega para o detalhe FORA do try/catch, entao uma falha ao salvar membros e dados socioeconomicos (renda/vulnerabilidades, a base da elegibilidade) e mascarada como sucesso e o operador nunca ve o aviso. Soma-se a isso um bypass de governanca LGPD: o motivo obrigatorio ao revogar/suspender/desligar elegibilidade so existe no client; o backend (update-elegibilidade.dto.ts:8-11 + fichas-cidadas.service.ts:399-410) aceita revogar sem justificativa, gravando a trilha sem o porque -- justamente a acao que mais precisa ser defensavel. Mais dois P2 de borda baratos e perigosos seguem abertos do re-check de 22/06: o middleware nao empurra senha-provisoria em /presidencia (rota sensivel cross-unidade ficou fora do matcher) e o login nao tem throttle dedicado (o global de 120 req/min e frouxo demais como anti-brute-force). Nenhum P0/anonimo, e a base clinica (bloqueio de alergia 409, consentimento de menor 400) esta solida -- mas esses itens travam o primeiro usuario real. Corrija os 6 bloqueadores e relance: vira QUASE_PRONTO assim que o ponte e o wizard cairem.

---

## 🔴 Bloqueadores do go-live (corrigir antes do 1º usuário)

### 1. [P1] POST /ponte: profissional forja unidade de origem e sinaliza qualquer familia (escrita cross-unidade / IDOR)
- **Arquivo:** `apps/api/src/servico-social/ponte.service.ts:108-149 (+ ponte.controller.ts:50-51)`
- **Ação:** Antes do create, resolver o profissional do ator pelo cadastro (prisma.profissional.findUnique by userId, exigir ativo) e usar a unidade DELE como unidadeOrigemId, ignorando/validando dto.unidadeOrigemSlug (bypass so para SUPER_ADMIN). Idealmente restringir fichaId as fichas com elegibilidade/atendimento na unidade do ator, espelhando o padrao resolverPorUser usado em todos os outros modulos.

### 2. [P1] Wizard de Nova Ficha mascara falha parcial como sucesso (router.push fora do try/catch)
- **Arquivo:** `apps/web/app/servico-social/fichas/nova/page.tsx:264-271`
- **Ação:** Mover o router.push para DENTRO do try, apos upsertSocio (so navegar no sucesso). No catch NAO navegar: manter o operador na tela com o Alerta de erro. Garante que membros e dados socioeconomicos perdidos sejam percebidos.

### 3. [P2] Motivo obrigatorio ao revogar elegibilidade so validado no client; backend aceita sem motivo (trilha LGPD burlavel)
- **Arquivo:** `apps/api/src/fichas-cidadas/dto/update-elegibilidade.dto.ts:8-11 (+ fichas-cidadas.service.ts:399-410)`
- **Ação:** No DTO usar ValidateIf por status (REPROVADO/SUSPENSO/DESLIGADO) + IsString + IsNotEmpty + MinLength(3) no motivo (ou checar no service e lancar BadRequestException). Incluir o motivo nos metadados do audit UPDATE. Aplicar tambem no CardElegibilidade da tela de detalhe, que hoje nem avisa.

### 4. [P2] Middleware de senha-provisoria nao cobre /presidencia (rota sensivel cross-unidade fora do portao)
- **Arquivo:** `apps/web/middleware.ts:26-35`
- **Ação:** Acrescentar /presidencia/:path* ao array matcher. Conferir se nao ha outras rotas internas novas fora do matcher.

### 5. [P2] Sem rate limiting dedicado no login (brute-force); global de 120/min e frouxo
- **Arquivo:** `apps/api/src/auth/auth.controller.ts:16-22 (config em app.module.ts:24,39)`
- **Ação:** Adicionar Throttle dedicado no metodo login (ex.: ttl 60s limit 5, ou ttl de 15 min), mantendo o global frouxo para o resto. Considerar bloqueio progressivo por email+IP.

### 6. [P2] Open redirect via callbackUrl nao validado no login (phishing pos-login)
- **Arquivo:** `apps/web/app/login/page.tsx:19,44`
- **Ação:** Validar antes do router.replace: aceitar so caminho que comeca com / e NAO com // , senao cair para /. Ou usar allowlist de destinos internos.

---

## ✅ O que mudou desde 22/06

CORRIGIDOS desde 22/06 (progresso, nao pendencia): GET /fichas-cidadas (lista de PII) agora registra audit READ com o userId do ator (fix do P1, commit 09dd655, fichas-cidadas.service.ts:153-165); bug de fuso vigenteAte na creche resolvido com fimDoDiaSP() (criancas.service.ts:119); os 4 P1 originais foram fechados antes desta rodada. PARCIALMENTE MUDADO: passou a existir ThrottlerModule global (120/min) onde antes nao havia nenhum, mas ainda sem teto dedicado no /auth/login. SEGUEM ABERTOS do re-check: Swagger /api/docs exposto sem guard em producao (main.ts:36); audit READ ausente em agenda do dia / fila da unidade (agenda.service.ts), no diario do menor (rotina.service.ts:220) e em /medico/indicadores (agregado, sem PII); prancha medica expoe elegibilidades cross-vertical da familia (agenda.service.ts:51-67); races sem transacao no check-in/out da creche e P2002 vira 500 na graduacao esportiva; matricula TRANCADA orfa ao encerrar turma; JWT 8h sem refresh/revogacao; faltam indices em Graduacao/Certificado/ConversaFamilia. RISCOS NOVOS do Servico Social: o modulo e CROSS-UNIDADE por design (SUPER_ADMIN/SERVICO_SOCIAL), correto para leitura/triagem, mas a CRIACAO da Ponte abriu para PROFISSIONAL/GESTOR sem amarrar tenant (P1); criar() de triagem/encaminhamento/ponte nao e idempotente (sem unique, duplo-clique duplica a fila); campos de texto livre cross-unidade (descricao/motivo) sem controle anti-PII; lista de triagem devolve telefone+dataNascimento de toda a fila (minimizacao). Trilha clinica nova: TOCTOU na barreira de alergia (leitura fora do lock, atendimentos.service.ts:188) e prescricao nao idempotente (P3). Varias falhas de acessibilidade AA novas nas telas do Servico Social (foco visivel, contraste, labels de prescricao, erro classificado por substring).

**Confirmados como CORRIGIDOS nesta rodada (progresso, não pendência):**
- [P2] GET /fichas-cidadas (lista de PII) sem audit READ — `apps/api/src/fichas-cidadas/fichas-cidadas.service.ts:153-165`
- [P2] vigenteAte em UTC (bug de fuso na vertical creche) — `apps/api/src/educacional/criancas.service.ts:119`

---

## 📋 Todos os achados abertos (50)

> `novo` = achado na superfície nova · `re-check` = item dos P2/P3 de 22/06 reconfirmado como ainda aberto/mudado. Severidade = calibrada na verificação adversarial.

### 1. [P1] POST /ponte: profissional forja unidadeOrigemSlug e sinaliza qualquer família (ator não é amarrado à unidade nem à ficha)
- **Arquivo:** `apps/api/src/servico-social/ponte.service.ts:108-149` · **dimensão:** rbac-tenant · **tipo:** novo · **status:** NOVO
- **Por quê:** O override de método em ponte.controller.ts:50-51 abre o POST para PROFISSIONAL e GESTOR_UNIDADE. O criar() só verifica que a ficha existe (linha 109-113), que o membro pertence à ficha (115-121) e que a unidade do slug existe (123-127) — mas NUNCA valida que o usuário logado pertence à unidadeOrigemSlug informada, nem que a ficha tem qualquer vínculo com a unidade do ator. Em todos os outros módulos (turmas/aulas/cursos/agenda/educacional/esportivo) o ator é amarrado por resolverPorUser(user, TipoUnidade.X) (ver os 30+ hits). Aqui não há nada disso. Consequência: um PROFISSIONAL da unidade A (ou um GESTOR_UNIDADE) pode criar uma SinalizacaoPonte sobre QUALQUER FichaCidada do instituto (fichaId arbitrário, dado social/clínico de família vulnerável) e estampar unidadeOrigemId de uma unidade B à qual ele não pertence (origem forjada, indexada em sinalizacoes_ponte e usada pelo Serviço Social para triar/atribuir). É escrita cross-unidade não autorizada + poluição da fila do Serviço Social + trilha de auditoria com origem falsa, num dado LGPD-sensível.
- **Correção:** Antes do create, resolver o profissional do ator e usar a unidade DELE como origem, em vez de confiar no slug do corpo. Ex.: const prof = await this.profissionais.resolverPorUser(user, <tipo do solicitante>); e setar unidadeOrigemId = prof.unidadeId (ignorar dto.unidadeOrigemSlug, ou validar que origem.id === prof.unidadeId, com bypass só para SUPER_ADMIN). Como o POST aceita múltiplos TipoUnidade (médico/educacional/etc.), derivar a unidade pelo cadastro de Profissional do usuário (this.prisma.profissional.findUnique({where:{userId:user.id}})) e exigir profissional.ativo, em vez de aceitar slug livre. Idealmente também restringir fichaId às fichas com elegibilidade/atendimento na unidade do ator (defesa contra escolher qualquer família).

### 2. [P1] Wizard de Nova Ficha mascara falha parcial como sucesso: navega antes de mostrar o erro de membros/dados socioeconômicos
- **Arquivo:** `apps/web/app/servico-social/fichas/nova/page.tsx:264-271` · **dimensão:** silent-failures · **tipo:** novo · **status:** NOVO
- **Por quê:** No finalizar(): a ficha é criada (passo 1), e o try/catch dos passos 2-3 (replaceMembros / upsertDadosSocio) seta setErroEnvio no catch — MAS o router.push(`/servico-social/fichas/${fichaId}`) está FORA do try/catch e executa SEMPRE, inclusive no caminho de erro. setErroEnvio só agenda um re-render; o router.push dispara a navegação e desmonta NovaFichaPage antes de o <Alerta> com 'A ficha foi criada, mas houve um erro ao salvar membros/dados...' ser pintado. Resultado: o operador do Serviço Social é levado ao detalhe da ficha sem ver o aviso e acredita que o cadastro está completo, quando a composição familiar e os dados socioeconômicos (renda, vulnerabilidades — exatamente o que fundamenta a elegibilidade de uma família vulnerável) NÃO foram persistidos. Falha silenciosa de dado sensível LGPD/social.
- **Correção:** Só navegar no caminho de sucesso. Mover o router.push para dentro do try (após upsertSocio) OU, no catch, NÃO navegar e manter o usuário na tela com o alerta (botão 'ir para o detalhe' opcional). Ex.: try { ...membros/socio...; router.push(detalhe) } catch (e) { setErroEnvio(`A ficha foi criada, mas... ${msg}`) /* sem push */ }.

### 3. [P2] Sem foco visível em botões, links, tabs e células interativas das telas novas
- **Arquivo:** `apps/web/components/ui.tsx:128-135 (Botao) e apps/web/app/servico-social/elegibilidade/page.tsx:174-180 (CelulaUnidade), encaminhamentos/page.tsx:354-369 (tabs), triagem/page.tsx:291` · **dimensão:** a11y · **tipo:** novo · **status:** NOVO
- **Por quê:** O componente Botao só tem 'transition' (sem focus-visible:ring); os <button> nativos custom (células da matriz, tabs de Encaminhamentos/Ponte, toggles 'Nova triagem'/'trocar'/'Fechar', botões de ação de matrícula) também não têm indicador de foco. globals.css só define ::selection, sem regra :focus-visible global. Quem navega por teclado (e é uma operação de back-office inteira: triar, aprovar elegibilidade, aceitar/recusar encaminhamento) não enxerga onde está o foco. Só os inputs (controleBase em ui.tsx:14-17) têm ring.
- **Correção:** Adicionar focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:outline-none ao Botao (ui.tsx) e às classes dos <button>/Link interativos; ou uma regra global em globals.css: :focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px }. A célula da matriz já tem ring quando ativa, mas falta ring de FOCO (estado != selecionado).

### 4. [P2] Token muted-foreground (#737373) segue <4.5:1 sobre o fundo papel — contraste insuficiente em texto pequeno
- **Arquivo:** `packages/design-tokens/tokens.css:41 (--ifp-gray-500:#737373) e :56 (--color-text-muted) → tailwind.config.ts:61 (muted.foreground)` · **dimensão:** a11y · **tipo:** re-check · **status:** ABERTO
- **Por quê:** muted-foreground sobre o fundo papel #FAF7F2 dá 4.44:1 (sobre surface branca 4.74:1) — abaixo do mínimo 4.5:1 para texto normal. É usado massivamente como texto de informação real (subtítulos de ListRow, protocolo/telefone na triagem, paginação 'X na fila · página Y', dicas, datas 'Aberto em', cabeçalhos de coluna da matriz). Usuários com baixa visão perdem leitura de dados de famílias. A hipótese 'sobre o header teal 1.17:1' do enunciado NÃO ocorre: o Topbar (Shell.tsx:20) usa bg-background, não teal.
- **Correção:** Escurecer o token de texto secundário para passar 4.5:1 no papel — ex.: trocar --color-text-muted para ~#5C5C5C (≈5.7:1 no papel) ou usar --ifp-gray-700 (#404040) para textos que carregam informação; reservar #737373 só para texto >=18.66px bold (limite 3:1).

### 5. [P2] Inputs de prescrição (medicamento/posologia) sem label associado — só placeholder
- **Arquivo:** `apps/web/components/medico/prescricao-bloco.tsx:148-164` · **dimensão:** a11y · **tipo:** novo · **status:** NOVO
- **Por quê:** Os dois <Input> de 'Medicamento' e 'Posologia' não usam <Campo>/label nem aria-label; a identificação vive apenas no placeholder, que some ao digitar e não é nome acessível confiável. Em uma tela CLÍNICA (emissão de prescrição com bloqueio de alergia), um leitor de tela anuncia campos sem nome — risco de erro de medicação. (As Observações logo abaixo, linha 175, têm label correto, evidenciando a inconsistência.)
- **Correção:** Associar label visível ou aria-label: envolver cada Input em <Campo label="Medicamento" htmlFor="presc-med"> / <Campo label="Posologia" htmlFor="presc-pos"> com ids correspondentes, mantendo o placeholder como exemplo.

### 6. [P2] Pílulas de status com texto de baixo contraste (success 3.30:1) e CoroaSeal 'analise' 3.16:1
- **Arquivo:** `apps/web/app/servico-social/triagem/page.tsx:56 (CONCLUIDA text-success) e encaminhamentos/page.tsx:43 (ACEITO) e ponte/page.tsx; CoroaSeal: apps/web/components/casa/CoroaSeal.tsx:11 (analise color #9a8f84)` · **dimensão:** a11y · **tipo:** novo · **status:** NOVO
- **Por quê:** success #16A34A como cor de TEXTO dá 3.30:1 no branco / 3.08:1 no papel — falha para o texto pequeno (10-12px) das pílulas 'Concluída'/'Aceito'/'%pres.'. A variante 'analise' da CoroaSeal (texto #9a8f84) na matriz de elegibilidade dá 3.16:1 — o estado 'EM ANÁLISE/PENDENTE' fica quase ilegível. São justamente os indicadores de estado que o operador precisa ler de relance.
- **Correção:** Para texto, usar um verde mais escuro (ex.: #15803D ≈4.5:1 no branco) só nas pílulas/percentual; subir o color da CoroaSeal 'analise' para ~#6E6358 (≈4.6:1). Manter o verde claro apenas em fundos/ícones, não em glifos de texto pequeno.

### 7. [P2] criar() de Triagem/Encaminhamento/Sinalização não é idempotente — clique-duplo gera registros duplicados
- **Arquivo:** `apps/api/src/servico-social/triagem.service.ts:90 (e encaminhamentos.service.ts:134, ponte.service.ts:129)` · **dimensão:** integridade · **tipo:** novo · **status:** NOVO
- **Por quê:** Os models Triagem, Encaminhamento e SinalizacaoPonte (schema.prisma:677, :724, :749) só têm @id — nenhum @@unique de negócio. Os criar() fazem prisma.create() direto, sem checar duplicata e sem WHERE condicional. Um duplo-clique (ou retry de rede) abre DUAS triagens PENDENTE para a mesma ficha, dois encaminhamentos PENDENTE para o mesmo destino, ou duas sinalizações idênticas. Isso polui a fila do Serviço Social (KPIs naFila/pendentes inflados), permite dupla-aceitação 'legítima' (cada duplicata é aceitável uma vez) e fragmenta a trilha LGPD. O projeto JÁ resolve exatamente esse problema em agenda.service.ts:294-302 (unique de agendamentoId + tradução de P2002 → devolve o vencedor), então é um desvio do padrão da própria casa.
- **Correção:** Decidir a regra: se 'no máximo 1 triagem/encaminhamento ABERTO por ficha (+destino)' for invariante, adicionar índice único parcial (ex.: @@unique condicional via migration raw `CREATE UNIQUE INDEX ... WHERE status = 'PENDENTE'`) e tratar P2002 → 409 como em agenda.service.ts. Se duplicar for aceitável no negócio, ao menos travar o duplo-clique técnico (verificação de existência recente sob transação, ou idempotency-key no header). Mínimo: replicar o try/catch P2002 do agenda para não vazar 500.

### 8. [P2] Prescrição: leitura de alergias fora da transação → TOCTOU na barreira de segurança clínica
- **Arquivo:** `apps/api/src/medico/atendimentos.service.ts:188` · **dimensão:** integridade · **tipo:** novo · **status:** NOVO
- **Por quê:** O bloqueio de alergia lê prisma.alergia.findMany() na linha 188 e computa os conflitos na 193, ANTES de abrir a transação (linha 212). Dentro da transação o SELECT ... FOR UPDATE (linha 214) só re-valida `encerradoEm` — NÃO re-lê as alergias. Se uma alergia ATIVA (ex.: GRAVE) for cadastrada no intervalo entre a leitura (188) e o create (220), a prescrição é gravada sem flag de conflito e sem exigir override, furando justamente a barreira que o módulo existe para garantir. A janela é curta e o cenário (cadastrar alergia exatamente durante uma prescrição concorrente) é raro, mas para uma trava de segurança do paciente o snapshot deveria ser lido sob o mesmo lock.
- **Correção:** Mover o findMany de alergias e o verificarConflitoAlergia para DENTRO da $transaction, após o SELECT ... FOR UPDATE do atendimento, e decidir o bloqueio com o snapshot consistente. Mantém a função pura alergia-check intacta; só reordena a leitura para dentro do lock.

### 9. [P2] POST /ponte e POST /encaminhamentos: fichaId do corpo sem vínculo de tenant (defesa em profundidade)
- **Arquivo:** `apps/api/src/servico-social/ponte.service.ts:109-113` · **dimensão:** rbac-tenant · **tipo:** novo · **status:** NOVO
- **Por quê:** Em ponte.service.criar (109-113) e encaminhamentos.service.criar (107-111), o fichaId é aceito do corpo e só se confirma que a ficha existe. Para encaminhamentos isso é mitigado pela regra de negócio que exige elegibilidade APROVADA na unidade de origem (encaminhamentos.service.ts:124-132) e pelo @Perfis SERVICO_SOCIAL (cross-unidade por desenho), então lá o risco é baixo. Mas no /ponte, somado ao furo P1 acima, qualquer fichaId vira alvo. Mesmo após corrigir o P1, vale amarrar a ficha à unidade do ator (existe atendimento/elegibilidade/matrícula daquela família na unidade dele) para evitar que um profissional legítimo sinalize uma família com a qual nunca teve contato — princípio do menor privilégio sobre PII de família vulnerável.
- **Correção:** Após resolver a unidade do ator, validar que a ficha tem relacionamento com essa unidade antes de criar a sinalização — p.ex. exigir ElegibilidadePorUnidade (ou Atendimento/Matrícula) da ficha naquela unidade, espelhando a 'regra de ouro' já usada em turmas.service.matricular (linhas 199-210). Se a regra de produto for que qualquer profissional pode sinalizar qualquer família, então registrar explicitamente essa decisão; caso contrário, escopar.

### 10. [P2] Sem rate limiting dedicado no login (brute-force)
- **Arquivo:** `apps/api/src/app.module.ts:24,39` · **dimensão:** recheck-p2 · **tipo:** re-check · **status:** MUDOU
- **Por quê:** STATUS: MUDOU. Na auditoria não havia throttling nenhum. Agora app.module.ts:24 registra ThrottlerModule.forRoot([{ttl:60_000,limit:120}]) e a linha 39 instala ThrottlerGuard como APP_GUARD global — então POST /auth/login passou a ter um teto (120 req/min por IP). Porém 120 tentativas/min é frouxo demais como anti-brute-force de credenciais, e não há @Throttle dedicado no auth.controller.ts (login nas linhas 16-22 sem decorator próprio). Grep por Throttle só acha o registro global, nenhum override no /auth.
- **Correção:** Adicionar @Throttle({ default: { ttl: 60_000, limit: 5 } }) (ou ttl maior, ex. 15 min) especificamente no método login do auth.controller.ts, mantendo o global frouxo para o resto da API. Considerar bloqueio progressivo por e-mail+IP.

### 11. [P2] Agenda do dia e fila da unidade sem audit READ
- **Arquivo:** `apps/api/src/medico/agenda.service.ts:91-105,356-369` · **dimensão:** recheck-p2 · **tipo:** re-check · **status:** ABERTO
- **Por quê:** STATUS: ABERTO. listarDia (91-105) retorna a agenda do dia com nome+nascimento dos pacientes (agendaInclude, 32-45) e NÃO chama audit.registrar. filaUnidade (356-369) retorna a fila inteira da unidade (todos os profissionais, com nome do paciente) e também NÃO audita. No mesmo arquivo, prancha (120-126), buscarFichas (158-163) e iniciar (264-270) auditam READ — confirmando que essas duas leituras de PII são lacunas reais. Inalterado desde a auditoria.
- **Correção:** Adicionar audit.registrar READ (entidade 'Agendamento', metadados {contexto:'medico.listarDia'/'medico.filaUnidade', dia, resultados}) ao fim de listarDia e filaUnidade.

### 12. [P2] Swagger UI exposto em produção sem proteção
- **Arquivo:** `apps/api/src/main.ts:30-36` · **dimensão:** recheck-p2 · **tipo:** re-check · **status:** ABERTO
- **Por quê:** STATUS: ABERTO. main.ts:36 chama SwaggerModule.setup("api/docs", ...) incondicionalmente, sem nenhum guard de NODE_ENV/ambiente nem autenticação. Em produção, GET /api/docs expõe o mapa completo da API (todas as rotas, DTOs, contratos) a qualquer um. Nada mudou desde a auditoria.
- **Correção:** Envolver o bloco DocumentBuilder/SwaggerModule.setup em if (process.env.NODE_ENV !== 'production') {...}, ou proteger a rota /api/docs com basic-auth/guard quando exposta.

### 13. [P2] Middleware não cobre /presidencia em mustChangePassword
- **Arquivo:** `apps/web/middleware.ts:26-35` · **dimensão:** recheck-p2 · **tipo:** re-check · **status:** ABERTO
- **Por quê:** STATUS: ABERTO. O matcher (26-35) lista /, /medico, /capacitacao, /educacional, /esportivo, /servico-social, /familia e /admin — mas NÃO /presidencia. As rotas /presidencia EXISTEM (confirmado: apps/web/app/presidencia/{page,familias,impacto,prestacao-contas,jornada,unidades}/page.tsx). Logo, um usuário com senha provisória (mustChangePassword) que acesse /presidencia NÃO é empurrado para /trocar-senha — fura o portão de troca de senha obrigatória justamente na área mais sensível (sala de comando da presidência, dados cross-unidade). Inalterado e agravado pela existência do módulo presidência.
- **Correção:** Acrescentar '/presidencia/:path*' ao array matcher do middleware.ts. Conferir se não há outras rotas internas novas fora do matcher (auditar contra app/ periodicamente).

### 14. [P2] Prancha expõe elegibilidades cross-vertical da família (minimização)
- **Arquivo:** `apps/api/src/medico/agenda.service.ts:51-67` · **dimensão:** recheck-p2 · **tipo:** re-check · **status:** ABERTO
- **Por quê:** STATUS: ABERTO. pranchaInclude (51-67) traz ficha.elegibilidades: { include: { unidade: true } } SEM filtrar pela unidade médica — ou seja, o clínico vê em qual estado (APROVADO/etc.) a família está em TODAS as verticais (educacional, esportivo, capacitação, serviço social). O comentário em 47-50 diz que RG/contatos/renda ficam de fora, mas o leque de elegibilidades cross-vertical é exatamente o excesso de dado. Inalterado.
- **Correção:** Filtrar elegibilidades para a unidade médica do profissional (where: { unidadeId: prof.unidadeId }) ou remover do include da prancha — o clínico só precisa saber que está APROVADO no MÉDICO, não o mapa da família no instituto inteiro.

### 15. [P2] Encerramento de turma ignora matrícula TRANCADA (status órfão)
- **Arquivo:** `apps/api/src/capacitacao/turmas.service.ts:394-432` · **dimensão:** recheck-p2 · **tipo:** re-check · **status:** ABERTO
- **Por quê:** STATUS: ABERTO. No loop de encerrar (394-432): LISTA_ESPERA vira CANCELADA (397-404) e a linha 405 faz 'if (mat.status !== ATIVA) continue;' — então uma matrícula TRANCADA é pulada e permanece TRANCADA depois que a turma vira ENCERRADA (433-436), gerando status órfão (aluno trancado numa turma que não existe mais para cursar). O arquivo mudou no commit de consentimento (b64f154), mas a alteração foi só no matricular (consentimento de menor, 212-222) — a lógica do encerrar não foi tocada. Confirmado inalterado.
- **Correção:** No loop de encerrar, tratar explicitamente TRANCADA (ex.: transicionar para CANCELADA ou um status terminal) antes/junto do continue, para não deixar matrícula pendurada numa turma ENCERRADA.

### 16. [P2] Race na graduação esportiva: P2002 vira HTTP 500
- **Arquivo:** `apps/api/src/esportivo/graduacoes.service.ts:56-72` · **dimensão:** recheck-p2 · **tipo:** re-check · **status:** ABERTO
- **Por quê:** STATUS: ABERTO. conceder faz check-then-create: findUnique jaConcedida no unique matriculaId_nivel (56-59) e depois create (64-72), sem try/catch. Em concorrência os dois passam pelo check e o segundo create estoura Prisma P2002, que não é capturado → vaza como 500. O padrão correto existe no mesmo repo (agenda.service.ts:293-304 captura P2002 e devolve o vencedor), mas não foi aplicado aqui. Inalterado.
- **Correção:** Envolver o create em try/catch e, em PrismaClientKnownRequestError code 'P2002', responder 409 ConflictException ('nível já concedido') em vez de deixar virar 500 — espelhando agenda.service.iniciar.

### 17. [P2] Open redirect via callbackUrl não validado no login
- **Arquivo:** `apps/web/app/login/page.tsx:19,44` · **dimensão:** recheck-p2 · **tipo:** re-check · **status:** ABERTO
- **Por quê:** STATUS: ABERTO. page.tsx:19 lê callbackUrl = params.get('callbackUrl') ?? unidade?.destino ?? '/' direto da query, sem validar que é um caminho relativo/same-origin. Em 44, após login bem-sucedido, router.replace(callbackUrl) navega para esse valor. Um link /login?callbackUrl=https://evil.com (ou //evil.com) redireciona o usuário autenticado para fora do domínio — vetor clássico de phishing pós-login. Inalterado.
- **Correção:** Validar callbackUrl antes do replace: aceitar só caminhos que começam com '/' e NÃO com '//' (ex.: const safe = callbackUrl.startsWith('/') && !callbackUrl.startsWith('//') ? callbackUrl : '/'), ou usar uma allowlist de destinos internos.

### 18. [P2] Race no check-in/check-out de criança (duplo registro)
- **Arquivo:** `apps/api/src/educacional/rotina.service.ts:102-116,140-156` · **dimensão:** recheck-p2 · **tipo:** re-check · **status:** ABERTO
- **Por quê:** STATUS: ABERTO. checkin lê ultimoCheckDoDia (102) e só então cria o CheckInOut (107-116); checkout faz o mesmo (140-147). Não há transação nem lock de linha entre o SELECT e o INSERT, e ultimoCheckDoDia (83-89) é um findFirst comum — dois cliques simultâneos passam ambos pela checagem e gravam dois ENTRADA (ou dois SAIDA) seguidos. Contraste claro: registrarRotina (182-207) e fecharDiario (258-272) usam $transaction com FOR UPDATE; o check-in/out não. Sem unique de banco que impeça. Inalterado.
- **Correção:** Serializar com $transaction + SELECT ... FOR UPDATE na linha de controle (ex. último check do dia do membro) ou adicionar um índice/constraint que impeça dois sentidos iguais consecutivos, espelhando o padrão já usado em registrarRotina.

### 19. [P2] Diário do dia do menor lido pelo educador sem audit READ
- **Arquivo:** `apps/api/src/educacional/rotina.service.ts:220-235` · **dimensão:** recheck-p2 · **tipo:** re-check · **status:** ABERTO
- **Por quê:** STATUS: ABERTO. diarioDoDia (220-235) carrega o diário do menor com todos os registros de rotina e quem fechou, e retorna sem nenhum audit.registrar. No mesmo service, checkin/checkout/registrarRotina/fecharDiario auditam (118,158,209,274) — só a LEITURA do dossiê do menor fica fora da trilha. Dado de criança vulnerável; inalterado.
- **Correção:** Adicionar audit.registrar({ userId: user.id, acao: READ, entidade: 'DiarioDia', entidadeId: diario?.id ?? membroId, metadados: { contexto: 'educacional.diarioDoDia', membroId, dia } }) em diarioDoDia.

### 20. [P2] Busca de família mostra 'Nenhuma ficha encontrada' quando a busca na verdade FALHOU (isError ignorado)
- **Arquivo:** `apps/web/app/servico-social/triagem/page.tsx:208-211` · **dimensão:** silent-failures · **tipo:** novo · **status:** NOVO
- **Por quê:** O painel NovaTriagemPanel consome useFichas mas só desestrutura { data: fichas, isFetching } — ignora isError/error. Em erro da query (ex.: 500, token expirado, rede), o React Query deixa fichas como undefined e o branch '!fichas || fichas.items.length === 0' renderiza 'Nenhuma ficha encontrada.', mascarando a falha como 'busca vazia'. O operador conclui (erradamente) que a família não está cadastrada e pode abrir uma triagem para a ficha errada ou recadastrar. Mesmo padrão em NovoEncaminhamentoPanel (encaminhamentos/page.tsx:232-235) e em MatricularAluno (capacitacao/turmas/[turmaId]/page.tsx:171-175, que usa useFichasElegiveis e só olha isFetching).
- **Correção:** Desestruturar isError/error de useFichas/useFichasElegiveis e renderizar um estado de erro distinto do estado vazio no dropdown de resultados (ex.: 'Não foi possível buscar agora — tente de novo.'), para não confundir 'falhou' com 'não existe'.

### 21. [P2] Tela de turma classifica erro vs. sucesso por substring da mensagem — erro da API pode aparecer como 'info' (e como status, não alert)
- **Arquivo:** `apps/web/app/capacitacao/turmas/[turmaId]/page.tsx:180` · **dimensão:** silent-failures · **tipo:** novo · **status:** NOVO
- **Por quê:** No MatricularAluno, o mesmo estado 'aviso' é usado para sucesso e erro, e o tipo do Alerta é inferido por aviso.includes('Falha') || aviso.includes('não'). Mensagens de erro reais da API que não contêm essas substrings caem em tipo='info' (estilo neutro/cinza e role='status' em vez de role='alert'). Ex.: ConflictException 'Este aluno já está matriculado nesta turma.' (turmas.service.ts:241) não tem 'Falha' nem 'não' → é exibida como informação benigna, fazendo um erro parecer confirmação; além disso o leitor de tela a anuncia como status passivo, não como alerta. Risco de o instrutor não perceber que a matrícula não ocorreu.
- **Correção:** Separar o estado de sucesso do estado de erro (ex.: setAviso para sucesso e setErro para falha, como já é feito em AcoesMatricula no mesmo arquivo) e passar tipo='erro' explicitamente no catch, em vez de inferir por string. Assim role='alert' e a cor de perigo ficam corretos.

### 22. [P2] Motivo obrigatório ao revogar elegibilidade (REPROVADO/SUSPENSO/DESLIGADO) só é exigido no client — backend aceita sem motivo (trilha LGPD burlável)
- **Arquivo:** `apps/web/app/servico-social/elegibilidade/page.tsx:66-74 + apps/api/src/fichas-cidadas/dto/update-elegibilidade.dto.ts:8-11 + apps/api/src/fichas-cidadas/fichas-cidadas.service.ts:394-413` · **dimensão:** web-novas-telas · **tipo:** novo · **status:** NOVO
- **Por quê:** Revogar/suspender/desligar o acesso de uma família vulnerável é justamente a ação que mais precisa de justificativa registrada para a trilha LGPD/auditoria. A tela bloqueia o salvar sem motivo (linha 71), mas o DTO UpdateElegibilidadeDto declara motivo como @IsOptional() (sem ValidateIf por status) e o service grava direto (dto.motivo pode ser undefined). Logo a regra é puramente cosmética: qualquer cliente que chame PUT /fichas-cidadas/:id/elegibilidade/:slug com {status:'DESLIGADO'} sem motivo passa, e o audit UPDATE registra status mas sem o porquê. Em go-live de dado social sensível isso compromete a defensabilidade da decisão.
- **Correção:** Espelhar a regra no backend: no UpdateElegibilidadeDto usar @ValidateIf((o)=>['REPROVADO','SUSPENSO','DESLIGADO'].includes(o.status)) + @IsString() @IsNotEmpty() @MinLength(3) em motivo (ou checar no service e lançar BadRequestException). Manter a validação do client como UX, mas a fonte de verdade tem que ser o servidor.

### 23. [P2] Tela de detalhe da ficha permite revogar elegibilidade SEM nem o aviso de motivo obrigatório (regra do client ausente aqui)
- **Arquivo:** `apps/web/app/servico-social/fichas/[id]/page.tsx:52-126 (CardElegibilidade.salvar, linhas 69-81)` · **dimensão:** web-novas-telas · **tipo:** novo · **status:** NOVO
- **Por quê:** O CardElegibilidade da tela de detalhe usa o MESMO PUT (useUpdateElegibilidade) mas NÃO tem a checagem exigeMotivo que existe na matriz de Elegibilidade. Envia motivo só 'if (motivo.trim())' e nada impede salvar DESLIGADO/SUSPENSO com motivo vazio. Como o backend também não exige (achado acima), por esta tela a revogação sem justificativa é trivial e silenciosa — pior que a matriz, pois aqui nem há feedback ao operador. Inconsistência entre duas telas que fazem a mesma operação confunde e abre brecha.
- **Correção:** Extrair a regra STATUS_EXIGE_MOTIVO + validação para um helper compartilhado e aplicar também no CardElegibilidade (bloquear salvar e mostrar a mensagem). Idealmente reusar o mesmo componente editor nas duas telas. A correção definitiva é o backend exigir (achado P1).

### 24. [P3] Classe bg-surface-2 inexistente no bloco de prescrição (token não definido)
- **Arquivo:** `apps/web/components/medico/prescricao-bloco.tsx:88` · **dimensão:** a11y · **tipo:** novo · **status:** NOVO
- **Por quê:** A <section> usa className 'bg-surface-2', mas não existe token --color-surface-2 nem cor 'surface-2' no tailwind.config.ts (só 'surface'). A classe é descartada, então a seção fica com fundo transparente herdando o papel em vez da superfície pretendida — quebra a separação visual planejada (e, se a intenção era um fundo levemente diferente para realçar conteúdo clínico, ela não acontece). Não é falha WCAG direta, mas é uma regressão visual silenciosa numa tela sensível.
- **Correção:** Trocar por 'bg-surface' (ou 'bg-muted') ou definir o token --color-surface-2 em tokens.css + mapear em tailwind.config.ts. Vale um lint que rejeite classes utilitárias de cor sem token correspondente.

### 25. [P3] Tabs e botões-toggle sem semântica ARIA (role=tab/aria-selected, aria-expanded)
- **Arquivo:** `apps/web/app/servico-social/encaminhamentos/page.tsx:352-371 e ponte/page.tsx:103-122 (tabs); triagem/page.tsx:291 e encaminhamentos/page.tsx:334 (toggle de painel)` · **dimensão:** a11y · **tipo:** novo · **status:** NOVO
- **Por quê:** As abas Pendentes/Aceitos/Recusados (e Ponte) são <button> sem role="tab"/aria-selected dentro de role="tablist", então o leitor de tela não anuncia 'aba selecionada 1 de 3'. Os botões 'Nova triagem'/'Novo encaminhamento' alternam um painel (setX((v) => !v)) sem aria-expanded, então o estado aberto/fechado não é exposto.
- **Correção:** Marcar o container das abas com role="tablist" e cada botão com role="tab" aria-selected={tab===t.key}; adicionar aria-expanded={novaAberta} (e aria-controls do painel) aos botões de toggle.

### 26. [P3] Recarregamento/loading não é anunciado a leitor de tela (sem aria-live/aria-busy)
- **Arquivo:** `apps/web/app/servico-social/triagem/page.tsx:414-417 ('· atualizando...'), elegibilidade/page.tsx:326-328, encaminhamentos/page.tsx:434-436, ponte/page.tsx:172-174` · **dimensão:** a11y · **tipo:** novo · **status:** NOVO
- **Por quê:** Quando a fila/matriz recarrega (isFetching) ou ações mudam o status (aceitar/recusar/iniciar/concluir), o feedback ('atualizando...', 'salvo', a lista trocar) aparece só visualmente. Usuário de leitor de tela não percebe que o conteúdo mudou nem que a operação concluiu. O Spinner também não tem role=status (só texto visual). O Alerta de erro tem role corretos (ui.tsx:179), mas os micro-status não.
- **Correção:** Envolver o trecho de status de paginação e o badge 'salvo' (elegibilidade/page.tsx:144-148) em um container com role="status" aria-live="polite"; aplicar aria-busy={isFetching} na região da lista; dar role="status" ao Spinner.

### 27. [P3] Prescrição não é idempotente — duplo-clique cria duas prescrições para o mesmo atendimento
- **Arquivo:** `apps/api/src/medico/atendimentos.service.ts:212` · **dimensão:** integridade · **tipo:** novo · **status:** NOVO
- **Por quê:** prescrever() abre transação, faz SELECT ... FOR UPDATE só para checar o selo e em seguida tx.prescricao.create(). O model Prescricao (schema.prisma:618) não tem @@unique — duas requisições idênticas (duplo-clique) passam ambas pela checagem de selo aberto e gravam DUAS prescrições idênticas com os mesmos itens. Em registro clínico isso gera prescrição em dobro no prontuário do paciente. Diferente da vaga de turma (onde o lock impede overbooking porque há contagem), aqui o lock não impede o duplicado porque não há contagem nem constraint.
- **Correção:** Avaliar idempotency-key no endpoint POST .../prescricoes, ou aceitar duplicata como decisão de produto e deixar o front desabilitar o botão no submit. Não é integridade de banco quebrada (cada prescrição é válida), por isso P3.

### 28. [P3] matricular(): checagem de elegibilidade APROVADA acontece fora do lock da turma (TOCTOU de baixo impacto)
- **Arquivo:** `apps/api/src/capacitacao/turmas.service.ts:199` · **dimensão:** integridade · **tipo:** novo · **status:** NOVO
- **Por quê:** A regra de ouro (elegibilidadePorUnidade APROVADO) é verificada na linha 199, ANTES do SELECT ... FOR UPDATE da turma (linha 228). O lock serializa vagas/duplicata/consentimento corretamente, mas a elegibilidade lida é um snapshot pré-lock: se o Serviço Social revogar a aprovação no intervalo, a matrícula ainda é criada. Janela curta e evento administrativo raro (revogação concorrente com matrícula), por isso P3 — mas para a 'regra de ouro' do isolamento valeria re-ler dentro da transação. Observação: a verificação de menor/consentimento (linhas 213-222) também usa dataNascimento lida fora do lock, mas data de nascimento não muda concorrentemente, então ali não há risco real.
- **Correção:** Opcional: mover o findFirst de elegibilidade para dentro da $transaction (após o FOR UPDATE da turma) para o snapshot ser consistente com a criação. Custo baixo; ganho marginal de robustez.

### 29. [P3] Campos de texto livre cross-unidade (descricao/motivo) protegidos só por comentário, sem controle técnico
- **Arquivo:** `apps/api/src/servico-social/dto/criar-sinalizacao.dto.ts:23-27` · **dimensão:** lgpd-audit · **tipo:** novo · **status:** NOVO
- **Por quê:** descricao (sinalização) e motivo (encaminhamento) entram na superfície de leitura cross-unidade (ponte.service detalhe/listar; encaminhamentos historico). A única salvaguarda contra copiar prontuário/CPF/dado clínico para dentro desse texto é um comentário ('descreva sem copiar prontuário/dados sensíveis', linha 23) — não há nenhum controle. Um profissional pode colar dado clínico no campo e ele será lido por toda unidade de destino sem rastro de que ali há dado sensível extra. Risco real porém baixo (depende de uso indevido; tamanho já é limitado a 500).
- **Correção:** Tratar como aceite consciente de risco do projeto OU adicionar controle leve: validação que rejeite padrões óbvios de PII bruta (CPF com 11 dígitos, etc.) no texto livre, e/ou marcar esses campos como 'contém possível PII' no audit. No mínimo manter o comentário e documentar a decisão.

### 30. [P3] Lista de triagem devolve telefone e dataNascimento de cada família na fila (minimização)
- **Arquivo:** `apps/api/src/servico-social/triagem.service.ts:9-13` · **dimensão:** lgpd-audit · **tipo:** novo · **status:** NOVO
- **Por quê:** triagemInclude expõe telefone e dataNascimento de toda ficha em CADA linha da fila (listar(), endpoint cross-unidade acessível a qualquer SERVICO_SOCIAL). Um card de fila precisa de protocolo/nome/prioridade/diasEspera; telefone e data de nascimento (idade) são PII que só a tela de detalhe precisa. Cada GET da fila vira leitura em massa de contato+idade de todas as famílias — mais dado do que a tela exige. O encaminhamentoInclude (encaminhamentos.service.ts:21-25) já faz o certo (só id/protocolo/nomeCompleto), então é inconsistência de minimização só na triagem.
- **Correção:** Remover telefone e dataNascimento do triagemInclude usado na LISTA; manter um include enxuto (id, protocolo, nomeCompleto) na fila e só carregar telefone/dataNascimento no detalhe(). Se a fila precisar da idade, derivar/expor uma faixa em vez da data exata.

### 31. [P3] Audit das escritas/leituras autenticadas do código novo não captura ip/userAgent
- **Arquivo:** `apps/api/src/servico-social/encaminhamentos.service.ts:145-151` · **dimensão:** lgpd-audit · **tipo:** novo · **status:** NOVO
- **Por quê:** AuditService aceita ip/userAgent (audit.service.ts:11-12,34-35) e os fluxos públicos (verificacao, PDF, presidencia) os preenchem a partir do req. Já as chamadas de audit do código novo (servico-social, medico, capacitacao) registram só userId, sem ip/userAgent — inclusive no CREATE do encaminhamento cross-unidade e na Prescricao (dado clínico). Não é regressão exclusiva do código novo (é o padrão da camada de serviço autenticada do projeto), por isso P3, mas para um compartilhamento inter-unidade de PII de família o ip/userAgent do ator reforçaria a trilha LGPD.
- **Correção:** Opcional/baixa prioridade: propagar req.ip/user-agent (ou já anexá-los ao AuthenticatedUser) até as chamadas de audit dos eventos sensíveis (encaminhamento CREATE/aceitar/recusar e Prescricao CREATE), reaproveitando o padrão dos controllers que já passam ip/userAgent.

### 32. [P3] Encaminhamento cross-unidade compartilha PII de família (incl. menores) sem verificar/registrar base legal (consentimento)
- **Arquivo:** `apps/api/src/servico-social/encaminhamentos.service.ts:106-153` · **dimensão:** lgpd-audit · **tipo:** novo · **status:** NOVO
- **Por quê:** criar() move dados pessoais de uma FichaCidada (nomeCompleto/protocolo + todo o vínculo da família, que pode incluir menores) da unidadeOrigem para a unidadeDestino. A única verificação é ElegibilidadePorUnidade=APROVADO na ORIGEM (linha 124-132); o serviço nunca lê nem cria um registro em Consentimento. O schema tem TipoConsentimento.COMPARTILHAMENTO_PARCEIROS (schema.prisma:392) mas nada liga a transferência inter-unidade a um consentimento. Resultado: dado sensível de família vulnerável chega a uma unidade sem vínculo prévio e sem qualquer registro de base legal para o compartilhamento — exatamente o cenário LGPD de compartilhamento de PII de família/menor sem trilha de base legal. A trilha de AUDITORIA de quem encaminhou existe (CREATE linha 145-151) e de quem aceitou (linha 178); o que falta é o registro do CONSENTIMENTO/base legal.
- **Correção:** Antes de criar o encaminhamento, exigir e verificar um Consentimento ativo da ficha para compartilhamento inter-unidade (ex.: novo TipoConsentimento.COMPARTILHAMENTO_INTERUNIDADE ou reuso de COMPARTILHAMENTO_PARCEIROS) e bloquear (409/400) se ausente, espelhando o padrão de consentimento de menor da capacitação (turmas.service.ts:215). Persistir a base legal usada (versaoTermo/consentimentoId) no próprio Encaminhamento e incluí-la nos metadados do audit CREATE. No mínimo, gravar no audit CREATE qual base legal autorizou a transferência.

### 33. [P3] Triagem/Encaminhamento/Ponte: GET por id e historico confiam só em @Perfis (cross-unidade) — verificado, é o desenho legítimo
- **Arquivo:** `apps/api/src/servico-social/encaminhamentos.service.ts:155-225` · **dimensão:** rbac-tenant · **tipo:** novo · **status:** NOVO
- **Por quê:** detalhe()/historico()/aceitar()/recusar() de triagem, encaminhamento e ponte resolvem o registro só pelo id da rota, sem checagem de unidade do ator, contando apenas no @Perfis(SUPER_ADMIN, SERVICO_SOCIAL) de classe. Confirmei lendo os 3 controllers (triagem.controller.ts:26, encaminhamentos.controller.ts:27, ponte.controller.ts:26) que o GET/aceitar/recusar/historico/marcar-atendida permanecem restritos a SUPER_ADMIN/SERVICO_SOCIAL — papéis que SÃO cross-unidade por design declarado (comentários ponte.service.ts:27-31, encaminhamentos.service.ts:36-39). Logo NÃO é IDOR explorável por um perfil indevido: nenhum PROFISSIONAL/GESTOR alcança esses endpoints de leitura. Registro como P3/verificado para fechar a dúvida do escopo, não como furo. O único endpoint que profissional alcança é o POST /ponte (coberto pelos itens P1/P2).
- **Correção:** Nenhuma ação obrigatória para go-live: o acesso cross-unidade aqui é intencional e restrito a SERVICO_SOCIAL/SUPER_ADMIN. Se no futuro o Serviço Social passar a ter recorte por unidade, reavaliar; por ora a auditoria READ com user.id já cobre a trilha LGPD (linhas 92-97, 161-167, 218-224).

### 34. [P3] 403 em vez de 404 em fecharDiario vaza existência de diário
- **Arquivo:** `apps/api/src/educacional/rotina.service.ts:240-247` · **dimensão:** recheck-p2 · **tipo:** re-check · **status:** ABERTO
- **Por quê:** STATUS: ABERTO. fecharDiario busca o diário por id sem filtrar unidade (240-243) e, quando diario.unidadeId !== profissional.unidadeId, lança ForbiddenException (245-247) em vez de NotFoundException. A diferença 403-vs-404 confirma a um educador de outra unidade que aquele diarioId EXISTE (enumeração de IDs entre unidades). Padrão anti-enum do projeto é responder 404 (ex.: beneficiarios.service.ts:25 'não encontrado nesta unidade'). Baixo impacto (id é cuid, não sequencial; só revela existência), por isso P3. Inalterado.
- **Correção:** Trocar o ForbiddenException de cross-unidade por NotFoundException ('Diário não encontrado'), unificando com o padrão anti-enumeração 404 do resto do sistema.

### 35. [P3] Token de 8h sem renovação (sessão morta vira tela em branco)
- **Arquivo:** `apps/web/lib/auth.ts:19` · **dimensão:** recheck-p2 · **tipo:** re-check · **status:** ABERTO
- **Por quê:** STATUS: ABERTO. auth.ts:19 define session: { strategy: 'jwt', maxAge: 8*60*60 } sem nenhuma estratégia de refresh/rotação do accessToken da API. O JWT do NextAuth e o accessToken da API expiram em 8h e não são renovados em background; quando vencem no meio do uso, as chamadas à API passam a dar 401 e a UI pode quebrar sem redirecionar para login limpo. É mais UX/robustez que segurança (não é vazamento). Inalterado.
- **Correção:** Implementar refresh no callback jwt (detectar expiração e renovar o accessToken via endpoint de refresh) e/ou um interceptor no client que, em 401, faça signOut e redirecione a /login. Severidade P3 (impacto operacional, não de confidencialidade).

### 36. [P3] GET /medico/indicadores sem audit READ
- **Arquivo:** `apps/api/src/medico/beneficiarios.service.ts:280-316` · **dimensão:** recheck-p2 · **tipo:** re-check · **status:** ABERTO
- **Por quê:** STATUS: ABERTO. O método indicadores (linhas 280-316) não chama this.audit.registrar em momento algum — é o único método de leitura do service sem trilha (compare com listar:67, fichaClinica:138, prontuarios:269 que auditam). Atenuante real para a severidade: a resposta é só agregada (contagens, taxa de comparecimento, série mensal) — NÃO retorna PII (nem nome, nem CPF, nem prontuário). Por isso o impacto LGPD é baixo (mais consistência de trilha que vazamento). O controller (beneficiarios.controller.ts:33-37) também não audita.
- **Correção:** Por consistência da trilha, adicionar audit.registrar({ userId: user.id, acao: READ, entidade: 'Atendimento', metadados: { contexto: 'medico.indicadores' } }) no fim de indicadores(). Severidade rebaixável a P3 por não expor PII.

### 37. [P3] setTimeout de redirect pos-selo sem cleanup — pode disparar em componente desmontado
- **Arquivo:** `apps/web/app/medico/atendimento/[agendamentoId]/page.tsx:137` · **dimensão:** recheck-p3 · **tipo:** re-check · **status:** MUDOU
- **Por quê:** ABERTO, linha DESLOCADA (auditoria citou :136-137; arquivo reescrito por b64f154). Em selar(), apos encerrar.mutateAsync, ha setTimeout(() => router.push('/medico/agenda'), 1200) sem guardar o id nem limpar no unmount. Se o usuario sair da tela nesse 1.2s, o push ainda dispara (e o avisar() via setTimeout na linha 100 idem). Risco baixo (React tolera, mas pode gerar navegacao/estado inesperado e warning). Nao e bug funcional.
- **Correção:** Guardar o id do setTimeout numa ref e limpar no cleanup do useEffect/no unmount, ou usar uma flag montado. Alternativa simples: redirecionar via router.push no onSuccess da mutation com um pequeno delay controlado por hook que ja faz cleanup.

### 38. [P3] useConversa invalida a lista a cada poll (10s) sem debounce
- **Arquivo:** `apps/web/lib/use-mensagens.ts:100-104` · **dimensão:** recheck-p3 · **tipo:** re-check · **status:** MUDOU
- **Por quê:** ABERTO, arquivo MUDOU. Agora ha um useEffect keyed em [isSuccess, dataUpdatedAt, qc, lado] que chama qc.invalidateQueries(lista) sempre que dataUpdatedAt muda. Como o useQuery da thread tem refetchInterval=10s (INTERVALO_THREAD_MS, linha 62/95), o react-query atualiza dataUpdatedAt a CADA refetch mesmo sem dado novo -> a lista e re-buscada a cada 10s enquanto a thread esta aberta. Continua sendo gasto desnecessario de dados/bateria; nao quebra nada.
- **Correção:** Invalidar a lista so quando ha mudanca real (ex. comparar contagem/ultima mensagem ou disparar a invalidacao apenas quando o badge de nao-lidas zera), ou trocar a chave do efeito para algo que so muda quando chegam mensagens novas, em vez de dataUpdatedAt.

### 39. [P3] Autorizacoes de imagem gravadas FORA da transacao de matricula infantil
- **Arquivo:** `apps/api/src/educacional/turmas-infantis.service.ts:168-187` · **dimensão:** recheck-p3 · **tipo:** re-check · **status:** ABERTO
- **Por quê:** ABERTO. O $transaction de matricular() termina na linha 164; logo abaixo, o for (const item of dto.autorizacoesImagem) chama this.prisma.autorizacaoImagem.upsert (linha 169 — note this.prisma, NAO tx). Se a matricula commitar e o app cair no meio do loop de autorizacoes, a crianca fica matriculada sem o consentimento de imagem que o responsavel declarou no mesmo fluxo -> estado parcial em dado LGPD Art.14 sensivel.
- **Correção:** Mover o upsert das autorizacoes para DENTRO do callback do $transaction, usando tx.autorizacaoImagem.upsert, para que matricula + autorizacoes commitem juntas (tudo-ou-nada).

### 40. [P3] Falta @@index([unidadeId, emitidoEm]) em Certificado + emitidoPor sem FK tipada
- **Arquivo:** `packages/database/schema.prisma:914-928` · **dimensão:** recheck-p3 · **tipo:** re-check · **status:** ABERTO
- **Por quê:** ABERTO. Certificado tem unidadeId (916) e emitidoEm (921), e o service lista por unidade ordenando por emitidoEm desc (turmas.service.ts:592-593), mas o modelo so tem @@map — nenhum @@index([unidadeId, emitidoEm]). Alem disso emitidoPor String? (linha 922) e string crua, sem relation para User -> sem integridade referencial nem join tipado para 'quem emitiu'. Mesma situacao do concedidaPor em Graduacao. So perf + qualidade de modelo.
- **Correção:** Adicionar @@index([unidadeId, emitidoEm]) em Certificado. Opcional (consistente com o resto): tornar emitidoPor uma relation opcional para User (emitidoPor String? + emissor User? @relation(...)) para ganhar FK e join tipado.

### 41. [P3] Falta @@index([unidadeId, concedidaEm]) em Graduacao
- **Arquivo:** `packages/database/schema.prisma:1215-1230` · **dimensão:** recheck-p3 · **tipo:** re-check · **status:** ABERTO
- **Por quê:** ABERTO. Graduacao tem unidadeId (1217) e concedidaEm (1222) mas so declara @@unique([matriculaId, nivel]) (1228) — nenhum @@index([unidadeId, ...]). Listagens/relatorios de graduacoes por unidade ordenadas por data fazem scan. So perf de leitura; volume hoje e baixo. Confirmado que o commit de indices da presidencia (7262a74) nao cobriu este modelo.
- **Correção:** Adicionar @@index([unidadeId, concedidaEm]) em Graduacao (molde do Certificado/listagens por unidade+data).

### 42. [P3] Falta @@index([fichaId]) em ConversaFamilia (parte MensagemFamilia e moot — nao tem fichaId)
- **Arquivo:** `packages/database/schema.prisma:1272-1305` · **dimensão:** recheck-p3 · **tipo:** re-check · **status:** ABERTO
- **Por quê:** ABERTO (parcial). ConversaFamilia (1272-1287) tem fichaId como FK (linha 1276) e relation para FichaCidada, mas so possui @@index([unidadeId]) — falta indice em fichaId, usado para ownership do portal da familia. Verifiquei que o commit 7262a74 (indices) NAO tocou esses modelos. JA a outra metade do achado nao se sustenta: MensagemFamilia (1289-1305) NAO tem campo fichaId (so conversaId/autorId), entao @@index([fichaId]) ali e impossivel/moot.
- **Correção:** Adicionar @@index([fichaId]) em ConversaFamilia. Ignorar a parte de MensagemFamilia (modelo nao tem fichaId; o indice util ali ja existe: @@index([conversaId, criadoEm])).

### 43. [P3] 2 nitpicks menores — nao substanciaveis (doc nao cita arquivo:linha)
- **Arquivo:** `docs/AUDITORIA-PRELANCAMENTO-2026-06-22.md:92` · **dimensão:** recheck-p3 · **tipo:** re-check · **status:** ABERTO
- **Por quê:** NAO VERIFICAVEL. O doc da auditoria registra literalmente apenas '(+2 nitpicks menores)' na linha 92, sem titulo, arquivo ou linha. Pela regra de ouro do projeto (nunca reportar sem ler o codigo real e citar arquivo:linha), nao posso reabrir nem confirmar esses 2 itens — nao ha alvo de codigo para inspecionar. Registro aqui apenas para fechar a contagem dos 12 e sinalizar a lacuna de rastreabilidade.
- **Correção:** Se esses 2 nitpicks importam para o go-live, recuperar o JSON cru de achados do workflow ifp-prelaunch-qa (citado no rodape do doc, linhas 135-136) para obter arquivo:linha e entao re-verificar. Caso contrario, considerar fechados por falta de evidencia.

### 44. [P3] 403 (ForbiddenException) em vez de 404 em assertCriancaDaUnidade — sem vazamento real (Camada 2 confirmou)
- **Arquivo:** `apps/api/src/educacional/criancas.service.ts:33-35` · **dimensão:** recheck-p3 · **tipo:** re-check · **status:** ABERTO
- **Por quê:** Codigo INALTERADO: assertCriancaDaUnidade lanca ForbiddenException quando nao acha matricula ativa na unidade. A diferenca de status (403 aqui vs 404 no endpoint de conversa) seria teoricamente um leak de enumeracao. POReM a Camada 2 da auditoria ja testou ao vivo: crianca-de-outra-unidade (Caio) e id-inexistente respondem AMBOS 403 (doc linhas 170-173) -> respostas identicas -> NAO ha vazamento de existencia. Logo o achado nao se confirma como vulnerabilidade; e so inconsistencia de convencao entre endpoints.
- **Correção:** Opcional/cosmetico: padronizar a convencao (404 uniforme para 'nao seu' e 'nao existe') so para consistencia entre modulos. Sem urgencia de seguranca — o leak nao existe na pratica.

### 45. [P3] Certificados emitidos em loop sequencial dentro da transacao de encerrar turma
- **Arquivo:** `apps/api/src/capacitacao/turmas.service.ts:394-432` · **dimensão:** recheck-p3 · **tipo:** re-check · **status:** MUDOU
- **Por quê:** ABERTO, linhas DESLOCADAS (auditoria citou :354-392; arquivo foi tocado por b64f154 que injetou consentimento de menor). O for (const mat of turma.matriculas) dentro do $transaction de encerrar() faz, por aluno, await tx.certificado.create + await tx.matricula.update sequenciais (linhas 409-431). Em turma grande isso segura a transacao (e o lock FOR UPDATE da linha da turma, linha 363) aberta por muito tempo -> risco de timeout/contensao. So perf/escala; nao afeta correcao.
- **Correção:** Manter dentro da transacao (a atomicidade importa), mas reduzir round-trips: createMany para os certificados e updateMany por status para as matriculas (agrupando CONCLUIDA/EVADIDA/CANCELADA), em vez de N awaits sequenciais. Se precisar do codigoVerificacao de volta, gera-lo no app antes do insert.

### 46. [P3] JWT 8h sem refresh token nem revogacao — token roubado vale 8h
- **Arquivo:** `apps/api/src/auth/auth.module.ts:25` · **dimensão:** recheck-p3 · **tipo:** re-check · **status:** ABERTO
- **Por quê:** INALTERADO. signOptions.expiresIn = JWT_EXPIRES_IN default '8h'. Grep em apps/api/src/auth por refresh/RefreshToken/revogad/blacklist/jti = zero matches: nao ha refresh token, lista de revogacao nem jti. Logout e troca de senha nao invalidam tokens ja emitidos -> um token vazado da equipe (acesso a dado clinico/social) permanece valido por ate 8h.
- **Correção:** Curto prazo: reduzir expiresIn (ex. 1-2h) e documentar. Medio prazo: introduzir refresh token rotativo + denylist (jti em Redis) para permitir revogacao em logout/troca de senha/incidente.

### 47. [P3] AuditService fire-and-forget sem await/serializacao da falha (so console)
- **Arquivo:** `apps/api/src/audit/audit.service.ts:26-40` · **dimensão:** recheck-p3 · **tipo:** re-check · **status:** ABERTO
- **Por quê:** INALTERADO. registrar() dispara prisma.auditLog.create(...).catch(err => logger.error(...)) sem retornar Promise nem await. Se o banco falhar na hora de gravar a trilha LGPD de leitura de PII/dado clinico, a operacao principal segue e a falha so vai pro console — sem metrica, alerta ou re-tentativa. Em auditoria LGPD de familia vulneravel, perder eventos silenciosamente e um risco de compliance, nao so de codigo.
- **Correção:** Manter o nao-bloqueio, mas adicionar observabilidade: contador/metrica de falhas de audit, log estruturado com o evento (acao/entidade/userId) e, idealmente, fila/outbox para re-tentar. No minimo logar o payload do evento perdido para reconstrucao manual.

### 48. [P3] fichaId/slugs nos DTOs novos aceitam string vazia (@IsString sem @IsNotEmpty)
- **Arquivo:** `apps/api/src/servico-social/dto/criar-triagem.dto.ts:5-6` · **dimensão:** silent-failures · **tipo:** novo · **status:** NOVO
- **Por quê:** Vários campos identificadores obrigatórios usam apenas @IsString() sem @IsNotEmpty(): fichaId em criar-triagem.dto.ts:5, fichaId/unidadeOrigemSlug/unidadeDestinoSlug em criar-encaminhamento.dto.ts:6-12, fichaId/unidadeOrigemSlug em criar-sinalizacao.dto.ts:6,12, e fichaId em criar-matricula.dto.ts:5. Uma string vazia '' passa na validação e só é barrada depois pelo findUnique/findFirst (vira 404 NotFound), o que mascara um payload malformado (cliente bugado enviando '') como 'recurso não encontrado' em vez de 400 de validação — diagnóstico mais difícil. Não há corrupção de dados porque o lookup falha, por isso baixa severidade.
- **Correção:** Adicionar @IsNotEmpty() (ou @Length(1, ...) / @IsString({}) + @MinLength(1)) aos campos identificadores obrigatórios para que payload vazio retorne 400 explícito em vez de 404. Consistente com o resto que já usa @MinLength em campos de texto.

### 49. [P3] Classificação de Alerta por substring pode pintar mensagem de erro como sucesso (verde) na matrícula da Capacitação
- **Arquivo:** `apps/web/app/capacitacao/turmas/[turmaId]/page.tsx:178-182 (aviso.includes('Falha') || aviso.includes('não'))` · **dimensão:** web-novas-telas · **tipo:** novo · **status:** NOVO
- **Por quê:** O tipo do <Alerta> é decidido por heurística de texto: só vira 'erro' (vermelho) se a mensagem contiver 'Falha' ou 'não'. Mensagens de erro vindas do backend (ApiError.message) que não tenham essas palavras — ex.: 'Turma lotada', 'CPF inválido', 'Sem vagas' — aparecem em verde/info, dando impressão de sucesso numa operação que falhou. Também a mensagem de cancelamento de matrícula de menor ('...cancelada — falta o consentimento...') não casa nenhuma das duas e sai como info. Pode levar o operador a achar que matriculou quando não matriculou.
- **Correção:** Não inferir o tipo pelo texto. Guardar um estado explícito tipo {tipo:'erro'|'info', msg} ao setar o aviso (no catch -> 'erro'; no sucesso/cancelamento -> conforme o caso), e passar tipo direto ao <Alerta>.

### 50. [P3] Ações de mudança de estado sensíveis sem confirmação: Aceitar encaminhamento e Atender sinalização da Ponte
- **Arquivo:** `apps/web/app/servico-social/encaminhamentos/page.tsx:83-90,129-131 (confirmarAceite) + apps/web/app/servico-social/ponte/page.tsx:55-69 (AcaoAtender)` · **dimensão:** web-novas-telas · **tipo:** novo · **status:** NOVO
- **Por quê:** 'Aceitar' um encaminhamento e 'marcar atendida' uma sinalização são transições de estado de um clique, sem confirmação nem desfazer. Recusar (que é o caminho 'negativo') exige justificativa, mas o aceite/atender — que liberam/encerram um fluxo de uma família — passam direto. Risco de clique acidental que altera o estado de atendimento de um beneficiário. Não é destrutivo de dado, por isso P3, mas em fluxo social convém um passo de confirmação ou toast com 'desfazer'.
- **Correção:** Adicionar um window.confirm leve (como já é feito em capacitacao cancelar matrícula/encerrar turma) ou um estado de confirmação inline antes de aceitar/atender; alternativamente um toast com ação 'desfazer' por alguns segundos.

---

## ❌ Refutado (não é bug)

- **[P3] XSS via texto livre de ficha: verificado e NÃO presente (re-check)** — `apps/web/app/servico-social/fichas/[id]/page.tsx:304 (whitespace-pre-wrap {ficha.observacoes}); demais telas-alvo`
  - O achado afirma que NÃO há XSS, e essa afirmação se confirma no código real. A linha 304 de apps/web/app/servico-social/fichas/[id]/page.tsx renderiza o texto livre como children JSX puro: `<p className="whitespace-pre-wrap text-sm text-foreground">{ficha.observacoes}</p>`. React escapa automaticamente strings interpoladas como children, então qualquer HTML/script digitado por um usuário (ex.: `<img onerror=...>`) é exibido como texto literal, não executado. A classe `whitespace-pre-wrap` é apenas CSS (preserva quebras de linha/espaços) e não influencia em nada a segurança. Grep ampliado em TODO o apps/web por `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval(`, bibliotecas de markdown (ReactMarkdown/marked/remark) e DOMPurify/sanitize retornou ZERO matches — ou seja, não existe nenhum sink que burle o escape do React em nenhuma tela. Portanto não há vetor de XSS armazenado por estas telas. Não é um bug; é um não-finding correto. A recomendação de não introduzir dangerouslySetInnerHTML no futuro (e usar DOMPurify caso um dia precise renderizar markdown) é uma boa diretriz preventiva, mas não constitui pendência para o go-live.

---

## 🛠️ Próximos passos (ordem prática)

1. Tampar o P1 do POST /ponte: derivar a unidade de origem pelo cadastro de Profissional do ator (nao pelo slug do corpo) e exigir profissional ativo; opcionalmente escopar fichaId as fichas com vinculo na unidade do ator. Re-testar que profissional da unidade A nao consegue sinalizar ficha sem vinculo nem estampar origem B.
2. Corrigir o P1 do wizard: mover router.push para dentro do try (so no sucesso) e manter o usuario na tela com o alerta no catch. Validar simulando falha na 2a/3a chamada (membros/socio).
3. Espelhar no backend a regra de motivo obrigatorio ao REPROVAR/SUSPENDER/DESLIGAR elegibilidade (DTO com ValidateIf + IsNotEmpty) e gravar o motivo no audit; aplicar o mesmo guard no CardElegibilidade da tela de detalhe.
4. Fechar os 3 P2 de borda baratos: adicionar /presidencia/:path* ao matcher do middleware; Throttle dedicado no /auth/login; validar callbackUrl antes do replace.
5. Antes do piloto, fechar 2 itens de robustez da fila do Servico Social: tornar criar() de triagem/encaminhamento/ponte idempotente (indice unico parcial WHERE status PENDENTE + tratamento P2002 para 409, espelhando agenda.service) e remover telefone/dataNascimento do include da LISTA de triagem.
6. Em paralelo (nao bloqueia o piloto, mas faca logo): mover o findMany de alergias para dentro da transacao do prescrever (fechar o TOCTOU clinico); proteger /api/docs por NODE_ENV; completar audit READ em agenda do dia/fila/diario do menor; filtrar elegibilidades cross-vertical da prancha medica.
7. Apos o go-live do piloto controlado: tratar a leva de acessibilidade AA das telas novas (foco visivel global, contraste, labels de prescricao, parar de classificar erro por substring) e os P3 de integridade restantes (races da creche/esporte, JWT refresh/revogacao, indices faltantes).

---

*Gerado pela retomada da varredura multi-agente `ifp-golive-retomada` (8 dimensões × verificação adversarial, 35 agentes). Achados crus em JSON no retorno do workflow.*