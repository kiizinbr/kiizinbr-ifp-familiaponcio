> Gerado por workflow multi-agente (4 leitores + 1 arquiteto) e **reconciliado com a pesquisa
> de SaaS de referência feita a pedido da diretoria** (pesquisa de 2026-05-28; reconciliação em 2026-06-10).
> Plano-mãe: `docs/PLANO-UNIR-CONNECT.md` · Gabarito de código: `docs/BLUEPRINT-MEDICO-FASE1.md` + `apps/api/src/medico/`

# BLUEPRINT — FASE 3: CENTRO EDUCACIONAL/CRECHE + ESPORTE RECREATIVO (tema verde-petróleo `educacional`)

> **Correção de premissa do workflow:** o relatório original assumiu que o módulo médico não
> existia no checkout. **Ele existe e está entregue** — API em `apps/api/src/medico/` e front
> em `apps/web/app/medico/` (agenda + prancha 5 passos, `data-theme="medico"`). A anatomia real
> está na seção 3 do `docs/BLUEPRINT-CAPACITACAO-FASE3.md` (resumo abaixo no §3) e é o padrão
> obrigatório deste blueprint.

---

## 1. Vertical MVP: "Um dia da criança — do check-in ao diário no celular do responsável"

Fluxo: educadora faz check-in da manhã (quem entregou) → lançamentos rápidos do dia (refeição,
sono, atividade, ocorrência) → check-out **validando pessoa autorizada com foto** (bloqueio de
não-autorizado) → fechamento do diário → responsável vê o diário no portal da família, atrás
de login.

**Por quê:** prova o coração da unidade em um único caminho: **segurança física na entrega da
criança** (o dado mais crítico do instituto — disputa de guarda, restrição judicial) +
**transparência ao responsável** (o valor percebido pela família). O protótipo está ~5% pronto
aqui (só tema CSS + fragmentos), então o vertical deve ser o MENOR possível e máximo
reaproveitamento: criança = `MembroFamiliar`, responsável = titular da `FichaCidada`, alergias =
modelo `Alergia` existente. **Esporte (modalidades, graduações, frequência esportiva) fica 100%
para a Fase 2** — reusará Turma/Presença da Capacitação como base conceitual.

## 2. REFERÊNCIAS DE MERCADO (pesquisa da diretoria, 2026-05-28)

Fonte: `IFP - Research SaaS References por Vertical.md` (vault) — vertical
"Recreativo/Creche/Educacional Infantil" (+ "Esportivo" para a Fase 2). Os SaaS que informam
esta unidade:

| SaaS | O que aproveitar aqui |
|---|---|
| **Brightwheel** (líder EUA, 150k+ programas) | App família + console educador separados; **captura de momento em 5–10s**; check-in/out com carimbo de horário e registro de quem retirou. |
| **Famly** (UK/DK) | Observações de desenvolvimento; atenção à **literacia baixa** (tradução ao vivo → aqui: linguagem simples, áudio na Fase 2). |
| **ClassDojo** (50M+ alunos) | **Painel do professor é sóbrio**; mascote só aparece para aluno/responsável — molde exato para o leão IFP. |
| **ClassApp BR** (600+ escolas) | Mensagem 1:1 família↔instituição dentro do app; **"protege o número de telefone do staff" — exatamente o problema da Danielle**. |

**Padrões de UX a adotar:**

- **Mobile-first no check-in/out e nos lançamentos** — tablet/celular do educador; painel
  operacional da gestora pode ser web com **densidade média-alta**.
- **Lançamento de rotina em 5–10s** (Brightwheel): tipo + tags rápidas + nota curta. Se passar
  disso, a educadora abandona o app.
- **App do responsável radicalmente simples**: **máximo 3 telas** (feed/diário, mensagens/
  comunicados, ficha da criança), ícones grandes + texto curto. **Fallback via WhatsApp Business
  oficial do IFP** para quem não instalar (decisão transversal da pesquisa). Botão de áudio
  nativo na Fase 2 (literacia baixa).
- **"Instituto sério que cuida com afeto"**: painel da equipe = profissional/robusto (ClassDojo
  professor); o lado da família pode ter acento quente e ilustrações geométricas. **Mascote do
  leão IFP: opcional, só no lado família/criança e em momentos cerimoniais — nunca no painel
  operacional.**
- **Privacidade de imagem é não-negociável**: autorização **granular por finalidade**
  (uso interno OK / redes do IFP não / imprensa não), **revogável**, assinada digitalmente,
  default **negado**. Watermark invisível com ID do post quando fotos entrarem (Fase 2).
- **Tipografia**: sans-serif legível padrão do design system — **sem Quicksand/Comic**
  ("fonte fofa" infantiliza o painel e mina a confiança).

**O que a pesquisa manda NÃO copiar:**

- Mascote/gamificação no console do educador ou da gestora (ClassDojo só usa no lado do aluno).
- Feed estilo rede social aberto — aqui o diário é **privado, por criança, atrás de login**.
- Excesso de features de engajamento (stickers, pontos) — o produto é cuidado, não retenção.
- Fontes arredondadas "amigáveis" e cor saturada de fundo (cross-vertical).

**Ajustes que a pesquisa causou neste blueprint** (em relação à versão do workflow):

1. **Consentimento de imagem granular virou modelo transversal** `AutorizacaoImagem` (escopos
   `USO_INTERNO`/`REDES_IFP`/`IMPRENSA`, revogável, versionado, default negado) no lugar dos
   2 booleans na matrícula — a pesquisa pede granularidade por finalidade + revogação com
   trilha, e a decisão transversal nº 6 manda **reutilizar o mesmo módulo no Esportivo**
   (também atende menores). `consentimentoLgpdEm` (Art. 14) permanece na matrícula.
2. **Mensagem 1:1 família↔instituto promovida a item nº 1 da Fase 2** (era um "fora do MVP"
   genérico): é a killer feature da vertical (ClassApp) e resolve o problema real da Danielle
   (número pessoal do staff). No MVP, o canal interino é o **WhatsApp Business oficial do IFP**.
3. **Portal da família limitado a 3 telas** com navegação por ícones grandes (antes era só
   "diário + comunicados"); a 3ª tela é a **ficha da criança** (autorizados + alergias visíveis
   ao responsável).
4. **Lançamentos de rotina redesenhados para a meta de 5–10s**: botões grandes por tipo + tags
   de 1 toque ("aceitou bem", "dormiu 1h30") preenchendo a `descricao`, texto livre opcional.
5. **Tom dos dois lados separado explicitamente**: console educador/gestora sóbrio; portal
   família com calor (accent `--unidade` quente, sem mascote operacional).

## 3. GABARITO: anatomia real do módulo médico (resumo — detalhes no blueprint da Capacitação)

`apps/api/src/medico/` = `medico.module.ts` + `agenda.controller.ts`/`agenda.service.ts` +
`atendimentos.controller.ts`/`atendimentos.service.ts` + `profissionais.service.ts` + `dto/`.
Padrões a replicar no módulo `educacional`:

- `@UseGuards(JwtAuthGuard, PerfisGuard)` + `@Perfis(...)` no nível da classe (override por
  handler); `ThrottlerGuard` é o único guard global.
- **Perfis reais** (enum `Perfil`): educadora = `PROFISSIONAL` lotada na unidade EDUCACIONAL;
  gestora = `GESTOR_UNIDADE` (vínculo via `UsuarioUnidade`); responsável =
  `RESPONSAVEL_FAMILIAR`. **Não existem perfis "EDUCADOR" nem "RESPONSÁVEL"** no RBAC.
- **Ownership do responsável**: `User.fichaCidadaId` (já existe no schema, `@unique`) é o elo —
  o portal da família filtra **sempre** por `user.fichaCidadaId`; nunca aceita `fichaId` do client.
- `ProfissionaisService.resolverPorUser` + `assertOwnership` (extrair para módulo compartilhado
  — ver blueprint Capacitação §8).
- `AuditService.registrar` fire-and-forget; leitura de dado sensível registra `READ`.
- Selo de imutabilidade (`encerradoEm` → 409) = padrão para `DiarioDia.fechadoEm`.
- Front: páginas direto em `apps/web/app/educacional/` e `apps/web/app/familia/`
  (**não existe grupo `(unidades)`**), `layout.tsx` com `getServerSession` +
  `PERFIS_PERMITIDOS` + `data-theme="educacional"` — o tema **já existe** em
  `packages/design-tokens/tokens.css` (`--unidade: var(--ifp-teal-deep)` ≈ #007571).

## 4. Modelos Prisma essenciais

```prisma
// ── Educacional / Creche ─────────────────────────────────────

enum StatusDiario {
  ABERTO
  FECHADO
}

enum TipoRegistroRotina {
  ALIMENTACAO
  SONO
  HIGIENE
  ATIVIDADE
  OCORRENCIA
}

enum SentidoCheck {
  ENTRADA
  SAIDA
}

// Pesquisa (decisão transversal nº 6): autorização de imagem granular,
// POR CRIANÇA e POR FINALIDADE, revogável, default NEGADO.
// Transversal: será reutilizada pelo Esportivo (Fase 2) e pelo Banco de
// Modelos da Capacitação. Espelha o padrão do modelo Consentimento existente.
enum EscopoImagem {
  USO_INTERNO   // identificação interna (ficha, chamada)
  REDES_IFP     // divulgação nas redes do instituto
  IMPRENSA      // cessão para imprensa/parceiros
}

model AutorizacaoImagem {
  id           String         @id @default(cuid())
  fichaId      String
  ficha        FichaCidada    @relation(fields: [fichaId], references: [id])
  membroId     String         // o menor — autorização é POR CRIANÇA
  membro       MembroFamiliar @relation(fields: [membroId], references: [id])
  escopo       EscopoImagem
  concedido    Boolean        @default(false) // default: NÃO
  versaoTermo  String
  registradoEm DateTime       @default(now())
  revogadoEm   DateTime?      // revogação = efeito imediato; nunca deletar (trilha)
  revogadoPor  String?        // userId
  criadoPor    String?

  @@unique([membroId, escopo, versaoTermo])
  @@index([membroId])
  @@map("autorizacoes_imagem")
}

model TurmaInfantil {
  id             String              @id @default(cuid())
  unidadeId      String
  unidade        Unidade             @relation(fields: [unidadeId], references: [id])
  nome           String              // "Jardim A"
  faixaEtariaMin Int                 // em meses
  faixaEtariaMax Int
  capacidade     Int
  profissionalId String              // educador(a) referência
  educador       Profissional        @relation(fields: [profissionalId], references: [id])
  ativa          Boolean             @default(true)
  criadoEm       DateTime            @default(now())
  atualizadoEm   DateTime            @updatedAt
  matriculas     MatriculaInfantil[]

  @@index([unidadeId])
  @@map("turmas_infantis")
}

model MatriculaInfantil {
  id                  String         @id @default(cuid())
  unidadeId           String
  unidade             Unidade        @relation(fields: [unidadeId], references: [id])
  turmaId             String
  turma               TurmaInfantil  @relation(fields: [turmaId], references: [id])
  fichaId             String
  ficha               FichaCidada    @relation(fields: [fichaId], references: [id])
  membroId            String         // a criança — SEMPRE um MembroFamiliar (não-opcional aqui)
  crianca             MembroFamiliar @relation(fields: [membroId], references: [id])
  consentimentoLgpdEm DateTime       // Art. 14: consentimento específico e destacado do responsável legal
  ativa               Boolean        @default(true)
  criadoPor           String?
  criadoEm            DateTime       @default(now())
  atualizadoEm        DateTime       @updatedAt

  @@unique([turmaId, membroId])
  @@index([unidadeId])
  @@map("matriculas_infantis")
}

model ResponsavelAutorizado {
  id                String         @id @default(cuid())
  fichaId           String
  ficha             FichaCidada    @relation(fields: [fichaId], references: [id])
  membroId          String         // autorização é POR CRIANÇA, não por família
  crianca           MembroFamiliar @relation(fields: [membroId], references: [id])
  nome              String
  documento         String         // doc conferido no ato
  parentesco        String         // "avó", "tio", "van escolar"
  fotoUrl           String?        // identificação visual no check-out
  restricaoJudicial Boolean        @default(false) // destaque vermelho: NUNCA liberar
  vigenteAte        DateTime?
  revogadoEm        DateTime?      // revogação = efeito imediato; nunca deletar (trilha)
  revogadoPor       String?        // userId
  criadoPor         String?
  criadoEm          DateTime       @default(now())
  atualizadoEm      DateTime       @updatedAt
  checks            CheckInOut[]

  @@index([membroId])
  @@map("responsaveis_autorizados")
}

model CheckInOut {
  id             String                @id @default(cuid())
  unidadeId      String
  unidade        Unidade               @relation(fields: [unidadeId], references: [id])
  membroId       String
  crianca        MembroFamiliar        @relation(fields: [membroId], references: [id])
  sentido        SentidoCheck
  ocorridoEm     DateTime              @default(now())
  autorizadoId   String                // quem entregou (ENTRADA) ou retirou (SAIDA)
  autorizado     ResponsavelAutorizado @relation(fields: [autorizadoId], references: [id])
  profissionalId String                // educador que registrou — FK forte (segurança física = autoria de prontuário)
  registradoPor  Profissional          @relation(fields: [profissionalId], references: [id])

  @@index([unidadeId, ocorridoEm])
  @@index([membroId, ocorridoEm])
  @@map("checkins_saidas")
}

model DiarioDia {
  id             String           @id @default(cuid())
  unidadeId      String
  unidade        Unidade          @relation(fields: [unidadeId], references: [id])
  membroId       String
  crianca        MembroFamiliar   @relation(fields: [membroId], references: [id])
  data           DateTime         @db.Date
  status         StatusDiario     @default(ABERTO)
  fechadoEm      DateTime?        // selo: só visível à família após fechar (padrão Atendimento.encerradoEm)
  profissionalId String?          // educador que fechou
  fechadoPor     Profissional?    @relation(fields: [profissionalId], references: [id])
  criadoEm       DateTime         @default(now())
  atualizadoEm   DateTime         @updatedAt
  registros      RegistroRotina[]

  @@unique([membroId, data])
  @@map("diarios_dia")
}

model RegistroRotina {
  id             String             @id @default(cuid())
  diarioId       String
  diario         DiarioDia          @relation(fields: [diarioId], references: [id])
  tipo           TipoRegistroRotina
  descricao      String             // "Almoço: aceitou bem" / "Sono 12h30–14h" (alimentada por tags de 1 toque — meta 5–10s)
  ocorridoEm     DateTime           @default(now())
  profissionalId String
  registradoPor  Profissional       @relation(fields: [profissionalId], references: [id])

  @@index([diarioId])
  @@map("registros_rotina")
}

model Comunicado {
  id         String              @id @default(cuid())
  unidadeId  String
  unidade    Unidade             @relation(fields: [unidadeId], references: [id])
  turmaId    String?             // null = geral da unidade
  titulo     String
  corpo      String
  critico    Boolean             @default(false) // crítico exige confirmação de leitura
  enviadoPor String?             // userId administrativo
  criadoEm   DateTime            @default(now())
  leituras   ComunicadoLeitura[]

  @@index([unidadeId])
  @@map("comunicados")
}

model ComunicadoLeitura {
  id           String      @id @default(cuid())
  comunicadoId String
  comunicado   Comunicado  @relation(fields: [comunicadoId], references: [id])
  fichaId      String
  ficha        FichaCidada @relation(fields: [fichaId], references: [id])
  lidoEm       DateTime    @default(now())

  @@unique([comunicadoId, fichaId])
  @@map("comunicados_leituras")
}
```

Reuso deliberado:

- Alergias/restrições alimentares usam o modelo **`Alergia` existente**, pendurado na
  `FichaCidada`. **Verificado no schema em 2026-06-10: `Alergia.membroId String?` JÁ EXISTE**
  (assim como em `CondicaoCronica`) — o risco apontado pelo workflow está resolvido, **sem
  migração extra**: a alergia já pode ser da criança.
- Sem modelo `Crianca` novo: criança = `MembroFamiliar` (mesmo padrão do médico, que usa
  `Agendamento.membroId`).
- `FichaSaudeCrianca` do roadmap (laudos, medicação autorizada) fica para a Fase 2.
- A migração exige os **arrays de relação inversa** em `Unidade`, `FichaCidada`,
  `MembroFamiliar` e `Profissional`.

## 5. Endpoints do módulo `apps/api/src/educacional/`

Classe: `@UseGuards(JwtAuthGuard, PerfisGuard)` + `@Perfis(...)` + `@Controller("educacional")`
(portal da família em controller próprio `@Controller("familia/educacional")` restrito a
`RESPONSAVEL_FAMILIAR`).

| Método/Rota | Perfis (`@Perfis`) | Observação |
|---|---|---|
| `GET/POST /educacional/turmas` | SUPER_ADMIN, GESTOR_UNIDADE | |
| `POST /educacional/turmas/:id/matriculas` | SUPER_ADMIN, GESTOR_UNIDADE | exige elegibilidade APROVADO + `consentimentoLgpdEm` (Art. 14); colhe `AutorizacaoImagem` por escopo no mesmo fluxo (default negado) |
| `GET /educacional/criancas/:membroId/autorizados` | SUPER_ADMIN, GESTOR_UNIDADE, PROFISSIONAL | `restricaoJudicial` em destaque no DTO |
| `POST /educacional/criancas/:membroId/autorizados` | SUPER_ADMIN, GESTOR_UNIDADE | `AuditLog` obrigatório |
| `PATCH /educacional/autorizados/:id/revogar` | SUPER_ADMIN, GESTOR_UNIDADE | efeito imediato; nunca delete; `AuditLog` |
| `PATCH /educacional/criancas/:membroId/autorizacoes-imagem/:escopo` | SUPER_ADMIN, GESTOR_UNIDADE | concede/revoga por escopo; `AuditLog`; nunca delete |
| `POST /educacional/checkins` | PROFISSIONAL | valida autorizado vigente/não-revogado/sem restrição |
| `POST /educacional/checkouts` | PROFISSIONAL | **regra central**: bloqueia se autorização revogada/vencida/restrição judicial (403 + `AuditLog` da TENTATIVA); bloqueia checkout sem check-in no dia (409) |
| `GET /educacional/turmas/:id/presentes` | SUPER_ADMIN, GESTOR_UNIDADE, PROFISSIONAL | lista do dia (só quem tem check-in) com alergias em destaque |
| `POST /educacional/diarios/:membroId/registros` | PROFISSIONAL | cria `DiarioDia` do dia se não existir; rejeita se `FECHADO` (409) |
| `PATCH /educacional/diarios/:id/fechar` | PROFISSIONAL | selo; só então visível à família |
| `POST /educacional/comunicados` | SUPER_ADMIN, GESTOR_UNIDADE | |
| `GET /familia/educacional/diario?data=` | RESPONSAVEL_FAMILIAR | **ownership por `user.fichaCidadaId`** (elo já existente no schema): só crianças da própria ficha; só diário FECHADO; **nunca rota pública**; leitura registra `READ` no `AuditLog` (rotina de menor = dado sensível) |
| `GET /familia/educacional/ficha/:membroId` | RESPONSAVEL_FAMILIAR | ficha da criança (3ª tela do portal — pesquisa): autorizados + alergias |
| `POST /familia/educacional/comunicados/:id/leitura` | RESPONSAVEL_FAMILIAR | confirmação de leitura |

Tenant: educadora resolve unidade via `Profissional.unidadeId` (padrão do médico); gestora via
`UsuarioUnidade`. Responsável nunca enxerga conceito de unidade — só as próprias crianças.

## 6. Telas web mínimas (`data-theme="educacional"` → verde-petróleo, já nos tokens)

Console da equipe (`apps/web/app/educacional/`, layout copiado do médico com
`PERFIS_PERMITIDOS = ["SUPER_ADMIN", "GESTOR_UNIDADE", "PROFISSIONAL"]`, **visual sóbrio** —
ClassDojo professor):

- `apps/web/app/educacional/layout.tsx` — guard + tema + header "Centro Educacional"
- `apps/web/app/educacional/page.tsx` — painel: presentes hoje × matriculados, diários
  abertos/fechados, comunicados críticos sem leitura (densidade média-alta — pesquisa)
- `apps/web/app/educacional/turmas/[id]/page.tsx` — turma: lista de crianças, status do dia
  (sem check-in / presente / saiu)
- `apps/web/app/educacional/turmas/[id]/checkin/page.tsx` — **mobile/tablet educador**:
  check-in/out com seleção do autorizado **mostrando foto + parentesco**; revogado/restrição =
  card vermelho bloqueado (espelha o padrão da chamada da Capacitação)
- `apps/web/app/educacional/turmas/[id]/rotina/page.tsx` — lançamentos rápidos **meta 5–10s**:
  botões grandes por tipo + tags de 1 toque + nota opcional + "Fechar diário do dia"
- `apps/web/app/educacional/criancas/[membroId]/page.tsx` — perfil: alergias em destaque,
  autorizados, autorizações de imagem por escopo, histórico de check-in/out

Portal da família (`apps/web/app/familia/`, layout próprio com
`PERFIS_PERMITIDOS = ["RESPONSAVEL_FAMILIAR"]`, mesmo tema com **acento quente e toque de
calor** — pesquisa; **máximo 3 telas**):

- `apps/web/app/familia/layout.tsx` — guard + navegação por **3 ícones grandes**:
  Diário · Comunicados · Minha criança
- `apps/web/app/familia/diario/page.tsx` — diário fechado do dia (evolui o card estático da
  Sandra no protótipo)
- `apps/web/app/familia/comunicados/page.tsx` — lista + confirmação de leitura dos críticos
- `apps/web/app/familia/crianca/[membroId]/page.tsx` — ficha: autorizados, alergias,
  autorizações de imagem (visão de leitura)

Fallback de canal (pesquisa, decisão transversal nº 5): família sem o app é alcançada pelo
**WhatsApp Business oficial do IFP** — no MVP isso é processo operacional (gestora reenvia
comunicado crítico), não integração; a integração entra na Fase 2.

## 7. Seed dev mínimo

```
1 Unidade tipo EDUCACIONAL (slug "educacional")
1 User+Profissional educadora "Prof. Carla" (unidade educacional) — perfil PROFISSIONAL
1 FichaCidada "Sandra Silva" (titular/responsável) com User RESPONSAVEL_FAMILIAR
   ligado via User.fichaCidadaId
1 MembroFamiliar "Ana Silva", 5 anos, com 1 Alergia (amendoim, membroId = Ana) p/ testar destaque
ElegibilidadePorUnidade APROVADO (ficha Sandra × educacional)
1 TurmaInfantil "Jardim A" (48–72 meses, cap. 15)
1 MatriculaInfantil (Ana → Jardim A) com consentimentoLgpdEm
3 AutorizacaoImagem da Ana: USO_INTERNO concedido, REDES_IFP negado, IMPRENSA negado
3 ResponsavelAutorizado: Sandra (mãe), avó (com fotoUrl), 1 REVOGADO (testa bloqueio)
1 dia completo: check-in pela Sandra, 3 RegistroRotina, DiarioDia FECHADO
1 Comunicado critico=true sem leitura (testa pendência no painel)
```

## 8. Riscos / decisões — LGPD de MENORES (Art. 14) é o eixo

- **Base legal**: melhor interesse da criança + **consentimento específico e em destaque de ao
  menos um responsável legal, colhido na matrícula, por finalidade** — por isso
  `consentimentoLgpdEm` na matrícula e `AutorizacaoImagem` granular por escopo estão NO MODELO,
  não em texto livre. Default de qualquer publicação de imagem: **NÃO** (pesquisa: privacidade
  de imagem é não-negociável; revogação com trilha, nunca delete).
- **`AutorizacaoImagem` é transversal por design** (decisão nº 6 da pesquisa): nasce aqui, será
  reutilizada pelo Esportivo (menores) e pelo Banco de Modelos da Capacitação (Fase 2 de ambos).
  Watermark invisível com ID do post entra junto com fotos no diário (Fase 2).
- **Check-out é dado de segurança física**, não só LGPD: toda alteração de
  `ResponsavelAutorizado` e TODO check-out (inclusive tentativas bloqueadas) vão para
  `AuditLog`. Atenção: o `AuditService` real é **fire-and-forget** (nunca bloqueia) — para a
  auditoria da **tentativa bloqueada de check-out**, avaliar `await` explícito do write (desvio
  pontual e documentado do padrão) ou, no mínimo, log estruturado adicional; decidir no passo 4.
  Revogação nunca apaga registro (`revogadoEm`), para trilha em disputa de guarda;
  `restricaoJudicial` aparece em vermelho e o sistema **bloqueia** — exceção só via incidente
  assinado pela coordenação (Fase 2).
- **Diário expõe rotina/localização da criança**: só visível após `FECHADO`, só atrás de login
  do responsável (ownership por `user.fichaCidadaId`), **jamais link público** — o feed
  Brightwheel-style é privado, não rede social. Sessão curta nos tablets compartilhados dos
  educadores; sem cache local de dados.
- **Dados de saúde por papel**: educador/cozinha veem a restrição ("alergia a amendoim"), não o
  laudo. Laudos/medicação ficam para a Fase 2 (`FichaSaudeCrianca` + autorização escrita).
- **Retenção**: check-in/out retém por prazo longo (responsabilidade civil); diário de bordo
  pode ter expurgo mais curto — definir política com a diretoria antes do go-live.
- **`Profissional.registroConselho`**: a educadora também não tem conselho de classe — depende
  da migração `registroConselho String?` já prevista no blueprint da Capacitação (fazer 1×).
- **Fora do MVP (Fase 2, em ordem de prioridade revisada pela pesquisa)**:
  1. **Mensagem 1:1 família↔instituto** (killer feature ClassApp — protege o número da equipe;
     interino: WhatsApp Business oficial);
  2. Fotos do dia no diário (exige `AutorizacaoImagem` checada no post + watermark);
  3. Todo o esporte (Modalidade, TurmaEsportiva, Graduação, FrequenciaEsportiva — reaproveitar
     o trio Turma/Matrícula/Presença da Capacitação como molde; safeguarding estilo Heja:
     dados do menor separados do responsável, foto opt-in, nunca lista pública de menores);
  4. Botão de áudio no portal família (literacia baixa — Famly);
  5. Medicação, escalonamento telefônico de comunicado crítico, certificado de participação.
- **Risco de produto**: protótipo ~5% → não há UI validada. A pesquisa **reduz** esse risco
  (Brightwheel/ClassApp dão o gabarito de fluxo), mas mantém-se 1 rodada curta de validação das
  3 telas do educador com a equipe da unidade antes de codar o front.

## 9. Ordem de construção

1. **Migração Prisma** (modelos do §4 + relações inversas; `Alergia` já está pronta) →
   validar: `prisma migrate dev` + studio.
2. **Seed** → validar: idempotente; Ana com alergia, 3 autorizados (1 revogado),
   3 autorizações de imagem (2 negadas), 1 dia fechado.
3. **Turma/Matrícula + autorizados + autorizações de imagem (CRUD com AuditLog)** → validar:
   revogar autorizado gera registro em `audit_logs` com quem/quando; conceder/revogar escopo de
   imagem idem.
4. **Check-in/Check-out com validação** (o coração) → validar via e2e: autorizado revogado →
   403 **e** linha de auditoria da tentativa (decidir aqui o `await` do audit); checkout sem
   check-in → 409; `restricaoJudicial` → 403.
5. **Diário + registros + fechamento** → validar: registro após `FECHADO` → 409;
   `GET /familia/...` de diário ABERTO → vazio/404.
6. **Portal família (ownership)** → validar: token da Sandra vê o diário da Ana; token de outra
   família → 403; leitura do diário gera `READ` no audit.
7. **Telas do educador (mobile/tablet) + portal família (3 telas)** → validar: fluxo do dia
   inteiro manual — check-in com foto, 3 lançamentos em <10s cada, checkout bloqueado do
   revogado, fechar diário, abrir como Sandra no viewport de celular.
8. **Comunicado com confirmação de leitura** → validar: crítico sem leitura aparece como
   pendência no painel da gestora.

---

## 10. RECOMENDAÇÃO: qual atacar primeiro — **CAPACITAÇÃO** (revisada à luz da pesquisa)

A recomendação original do workflow **se mantém e sai reforçada** pela pesquisa:

1. **Maturidade do protótipo** — Capacitação é o módulo mais completo do Connect depois do
   médico (7 telas desktop + 3 tablet + 4 interações de estado reais): a especificação de
   UI/fluxo está praticamente pronta, é "só" portar para Next.js. Educacional está ~5%
   (tema CSS + strings soltas). **A pesquisa atenua mas não elimina esse gap**: Brightwheel/
   ClassApp/ClassDojo dão o gabarito de fluxo do Educacional (check-in, diário 5–10s, portal
   de 3 telas), encurtando a rodada de design — mas ainda é preciso validar com a equipe da
   unidade, e isso pode rodar **em paralelo** enquanto a Capacitação é construída.
2. **Esforço × risco técnico** — o roadmap do próprio `schema.prisma` (linhas 548-558) já
   prescreve `Curso/Turma/Matricula/Presenca/Certificado`, e tudo se pendura em padrões
   existentes (`Agendamento.fichaId/membroId`, `ElegibilidadePorUnidade`, agora confirmados no
   módulo médico **real** em `apps/api/src/medico/`). Único ajuste estrutural:
   `registroConselho` opcional. Já o Educacional carrega o maior risco do sistema inteiro —
   **dados de menores (Art. 14 LGPD) + segurança física no check-out** — e a pesquisa ainda
   **adicionou** requisitos a esse lado (autorização de imagem granular transversal, portal de
   3 telas, fallback WhatsApp): ele merece chegar quando o time já tiver auditoria, ownership e
   portal da família rodados.
3. **Valor para o instituto** — 540 vagas/12 cursos com certificado verificável (documento de
   empregabilidade, anti-fraude) é entrega visível e mensurável para a presidência, e a
   pesquisa eleva o peso emocional/institucional do certificado (entrega cerimonial, QR,
   share WhatsApp — possivelmente o primeiro certificado da vida do aluno). O flag de evasão
   alimenta a Ponte da Corte do Serviço Social — integração cross-módulo que o protótipo já provou.
4. **Sequência virtuosa** — o trio Turma/Matrícula/Presença construído na Capacitação vira o
   molde direto da Fase 2 do Educacional (turmas infantis e, depois, turmas esportivas com
   graduação), e o módulo transversal `AutorizacaoImagem`, nascido no Educacional, volta para a
   Capacitação na Fase 2 (Banco de Modelos) e cobre o Esportivo — cada vertical paga uma peça
   que a próxima reutiliza.

**Ordem final: Médico (entregue) → Capacitação (vertical do certificado) → Educacional/Creche
(vertical do check-in→diário) → Fase 2 de ambos (Banco de Modelos; mensagem 1:1; Esporte/graduações).**
Pré-requisito que o workflow apontava — "confirmar o caminho real do módulo médico" — **está
resolvido neste documento**: `apps/api/src/medico/` + `apps/web/app/medico/`, anatomia no §3.
