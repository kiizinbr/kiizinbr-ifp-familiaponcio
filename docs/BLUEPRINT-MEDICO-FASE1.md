> Gerado por workflow multi-agente em 2026-06-10 (4 leitores + 1 arquiteto). Ordem de trabalho da Fase 1.
> Plano-mae: PLANO-UNIR-CONNECT.md

# BLUEPRINT DE IMPLEMENTAÇÃO — FASE 1: VERTICAL DO CENTRO MÉDICO

Repo: `C:\Users\Erick\Documents\GitHub\kiizinbr-ifp-familiaponcio` (monorepo pnpm/turbo: `apps/api` NestJS, `apps/web` Next.js 14, `packages/database` Prisma/Postgres).

Escopo da vertical: login real com perfil PROFISSIONAL → agenda do dia → abrir atendimento (prancha SOAP + vitais) → salvar/encerrar prontuário via API. Fora do escopo (fase 2): Ponte da Corte, ditado por voz, catálogo de medicamentos/prescrição estruturada, fluxo de enfermagem/recepção, RLS.

---

## 1) MODELOS PRISMA

Arquivo: `C:\Users\Erick\Documents\GitHub\kiizinbr-ifp-familiaponcio\packages\database\schema.prisma`

### 1.1 Enums novos (após `StatusElegibilidade`)

```prisma
enum StatusAgendamento {
  AGENDADO
  CONFIRMADO
  EM_ATENDIMENTO
  CONCLUIDO
  FALTOU
  CANCELADO
}

enum GravidadeAlergia {
  LEVE
  MODERADA
  GRAVE
}
```

### 1.2 Modelos novos (seção "Centro Médico" no fim do schema)

```prisma
// ─── Centro Médico ────────────────────────────────────────────────

model Profissional {
  id               String   @id @default(cuid())
  userId           String   @unique
  unidadeId        String
  registroConselho String                 // CRM/COREN
  ufConselho       String   @default("RJ")
  especialidade    String?
  ativo            Boolean  @default(true)
  criadoEm         DateTime @default(now())
  atualizadoEm     DateTime @updatedAt

  user         User          @relation(fields: [userId], references: [id])
  unidade      Unidade       @relation(fields: [unidadeId], references: [id])
  agendamentos Agendamento[]
  atendimentos Atendimento[]

  @@map("profissionais")
}

model Agendamento {
  id             String            @id @default(cuid())
  unidadeId      String                              // tenant obrigatório (multi-tenant lógico)
  fichaId        String
  membroId       String?                             // dependente atendido (filho etc.)
  profissionalId String
  inicioEm       DateTime
  fimEm          DateTime
  status         StatusAgendamento @default(AGENDADO)
  motivo         String?
  criadoPor      String?                             // userId de quem agendou (padrão do schema: string sem FK)
  criadoEm       DateTime          @default(now())
  atualizadoEm   DateTime          @updatedAt

  unidade      Unidade         @relation(fields: [unidadeId], references: [id])
  ficha        FichaCidada     @relation(fields: [fichaId], references: [id], onDelete: Cascade)
  membro       MembroFamiliar? @relation(fields: [membroId], references: [id], onDelete: SetNull)
  profissional Profissional    @relation(fields: [profissionalId], references: [id])
  atendimento  Atendimento?

  @@index([unidadeId, inicioEm])
  @@index([profissionalId, inicioEm])
  @@map("agendamentos")
}

model Atendimento {
  id             String    @id @default(cuid())
  unidadeId      String
  fichaId        String
  membroId       String?
  profissionalId String
  agendamentoId  String?   @unique
  subjetivo      String?                  // S — queixa
  objetivo       String?                  // O — exame físico (Fase 1: texto; toggles serializados)
  avaliacao      String?                  // A — hipótese diagnóstica
  plano          String?                  // P — conduta, atestado, retorno
  cid10          String?
  iniciadoEm     DateTime  @default(now())
  encerradoEm    DateTime?                // "selo" — imutável após preenchido
  criadoEm       DateTime  @default(now())
  atualizadoEm   DateTime  @updatedAt

  unidade      Unidade         @relation(fields: [unidadeId], references: [id])
  ficha        FichaCidada     @relation(fields: [fichaId], references: [id], onDelete: Cascade)
  membro       MembroFamiliar? @relation(fields: [membroId], references: [id], onDelete: SetNull)
  profissional Profissional    @relation(fields: [profissionalId], references: [id])
  agendamento  Agendamento?    @relation(fields: [agendamentoId], references: [id])
  vitais       SinaisVitais?

  @@index([fichaId])
  @@index([unidadeId, iniciadoEm])
  @@map("atendimentos")
}

model SinaisVitais {
  id                     String   @id @default(cuid())
  unidadeId              String
  atendimentoId          String   @unique          // 1-1 com o atendimento
  registradosPor         String                    // userId (padrão Entrevista.realizadaPor)
  pressaoSistolica       Int?
  pressaoDiastolica      Int?
  frequenciaCardiaca     Int?
  frequenciaRespiratoria Int?
  temperaturaC           Decimal? @db.Decimal(4, 1)
  saturacaoO2            Int?
  pesoKg                 Decimal? @db.Decimal(5, 2)
  alturaCm               Decimal? @db.Decimal(5, 1)
  glicemia               Int?
  queixaPrincipal        String?
  registradosEm          DateTime @default(now())
  atualizadoEm           DateTime @updatedAt

  atendimento Atendimento @relation(fields: [atendimentoId], references: [id], onDelete: Cascade)

  @@map("sinais_vitais")
}

// Histórico clínico do CIDADÃO — pendurado na ficha (atravessa unidades, mesmo racional da ficha global)

model Alergia {
  id            String            @id @default(cuid())
  fichaId       String
  membroId      String?
  descricao     String                              // ex.: "Dipirona"
  gravidade     GravidadeAlergia?
  registradaPor String?                             // userId
  ativa         Boolean           @default(true)
  criadoEm      DateTime          @default(now())
  atualizadoEm  DateTime          @updatedAt

  ficha  FichaCidada     @relation(fields: [fichaId], references: [id], onDelete: Cascade)
  membro MembroFamiliar? @relation(fields: [membroId], references: [id], onDelete: SetNull)

  @@index([fichaId])
  @@map("alergias")
}

model CondicaoCronica {
  id              String    @id @default(cuid())
  fichaId         String
  membroId        String?
  descricao       String                            // ex.: "Asma"
  cid10           String?
  diagnosticadaEm DateTime?
  observacoes     String?
  ativa           Boolean   @default(true)
  criadoEm        DateTime  @default(now())
  atualizadoEm    DateTime  @updatedAt

  ficha  FichaCidada     @relation(fields: [fichaId], references: [id], onDelete: Cascade)
  membro MembroFamiliar? @relation(fields: [membroId], references: [id], onDelete: SetNull)

  @@index([fichaId])
  @@map("condicoes_cronicas")
}
```

### 1.3 Back-relations a ADICIONAR nos modelos existentes (obrigatório, senão `prisma validate` falha)

- `User` (linha ~70): `profissional Profissional?`
- `Unidade` (linha ~38): `profissionais Profissional[]`, `agendamentos Agendamento[]`, `atendimentos Atendimento[]`
- `FichaCidada` (linha ~146): `agendamentos Agendamento[]`, `atendimentos Atendimento[]`, `alergias Alergia[]`, `condicoesCronicas CondicaoCronica[]`
- `MembroFamiliar` (linha ~209): `agendamentos Agendamento[]`, `atendimentos Atendimento[]`, `alergias Alergia[]`, `condicoesCronicas CondicaoCronica[]`

Decisão de design embutida (vs. padrão atual do schema): autoria clínica (`profissionalId`) usa **FK real para Profissional** — prontuário exige integridade; campos administrativos (`criadoPor`, `registradosPor`, `registradaPor`) seguem o padrão existente de `String` sem FK.

### 1.4 Nota de migration

```powershell
cd C:\Users\Erick\Documents\GitHub\kiizinbr-ifp-familiaponcio
pnpm --filter @ifp/database validate
pnpm --filter @ifp/database migrate -- --name centro-medico
pnpm --filter @ifp/database generate
```

- Migrations vivem em `packages/database/migrations/` (hoje só existe `20260530205929_init`). A nova migration é puramente aditiva — sem risco para dados existentes.
- O client é re-exportado por `packages/database/src/index.ts` (`@ifp/database`); após `generate`, os enums `StatusAgendamento`/`GravidadeAlergia` ficam importáveis na API.

---

## 2) MÓDULO API — `medico`

Um módulo, dois pares controller/service (agenda e atendimentos), imitando a anatomia de `fichas-cidadas`.

### 2.1 Arquivos a criar

```
apps/api/src/medico/
├── medico.module.ts
├── agenda.controller.ts
├── agenda.service.ts
├── atendimentos.controller.ts
├── atendimentos.service.ts
└── dto/
    ├── list-agenda.query.ts
    ├── update-soap.dto.ts
    └── upsert-vitais.dto.ts
```

Alteração: registrar `MedicoModule` em `apps/api/src/app.module.ts` (imports). Não importar Prisma/Audit no module (ambos `@Global()`).

`medico.module.ts`:
```ts
@Module({
  controllers: [AgendaController, AtendimentosController],
  providers: [AgendaService, AtendimentosService],
  exports: [AtendimentosService],
})
export class MedicoModule {}
```

### 2.2 Endpoints (prefixo global `api/v1` já aplicado no main.ts)

Guards em nível de classe nos dois controllers:
```ts
@ApiTags("medico")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PerfisGuard)
@Perfis(Perfil.SUPER_ADMIN, Perfil.PROFISSIONAL)
```

| Método/Rota | DTO | O que faz | Auditoria |
|---|---|---|---|
| `GET /api/v1/medico/agenda?data=YYYY-MM-DD` | `ListAgendaQuery` (`@IsOptional @IsDateString`, default = hoje) | Agendamentos do dia do profissional logado (resolve `Profissional` por `user.id`), ordenados por `inicioEm`, com `include`: ficha (nome, dataNascimento, cpf), membro, vitais do atendimento, status | — (listagem não audita, padrão fichas) |
| `GET /api/v1/medico/agenda/:agendamentoId` | — | Payload completo da prancha: agendamento + ficha + membro + `alergias`/`condicoesCronicas` ativas + elegibilidade da unidade MEDICO + atendimento existente (draft) com vitais | `READ`, entidade `"Atendimento"` (dado sensível — LGPD) |
| `POST /api/v1/medico/agendamentos/:id/iniciar` | — | Cria `Atendimento` ligado ao agendamento (se já existe, retorna o existente — idempotente) e seta agendamento `EM_ATENDIMENTO`. Copia `unidadeId/fichaId/membroId/profissionalId` do agendamento | `CREATE`, entidade `"Atendimento"` |
| `PATCH /api/v1/medico/atendimentos/:id` | `UpdateSoapDto` (subjetivo/objetivo/avaliacao/plano `@IsOptional @IsString @MaxLength(10000)`, cid10 `@MaxLength(10)`) | Salva rascunho SOAP. `ConflictException("Atendimento já encerrado — prontuário é imutável")` se `encerradoEm != null` | `UPDATE`, `metadados: { campos: Object.keys(dto) }` |
| `PUT /api/v1/medico/atendimentos/:id/vitais` + `@HttpCode(HttpStatus.OK)` | `UpsertVitaisDto` (Ints com `@IsInt @Min @Max`; temperatura/peso/altura `@IsNumber` → service converte `new Prisma.Decimal(...)`) | `upsert` de `SinaisVitais` por `atendimentoId` (padrão dados-socio 1-1); `registradosPor = user.id` | `UPDATE`, entidade `"Atendimento.vitais"` |
| `POST /api/v1/medico/atendimentos/:id/encerrar` | — | Valida mínimo (`subjetivo` e `plano` preenchidos, senão `BadRequestException` PT-BR), seta `encerradoEm = now()`, agendamento → `CONCLUIDO` (em `$transaction`) | `UPDATE`, `metadados: { acao: "encerramento" }` |

### 2.3 Regras de service (ambos)

- Helper `private async resolverProfissional(userId)`: `prisma.profissional.findUnique({ where: { userId } })`; ausente → `ForbiddenException("Usuário não possui cadastro de Profissional")`. SUPER_ADMIN sem cadastro: na Fase 1, mesmo o admin precisa de registro Profissional para ver agenda (simples e seguro; ver Decisões).
- Ownership: toda operação em atendimento confere `atendimento.profissionalId === profissional.id` (exceto perfil SUPER_ADMIN) → senão `ForbiddenException`.
- `include` compartilhado no topo do service com `satisfies Prisma.AgendamentoInclude` / `Prisma.AtendimentoInclude` (padrão `fichaInclude`).
- Exceções Nest com mensagem PT-BR; `audit.registrar()` sempre sem `await`, após o Prisma bem-sucedido.
- Janela do dia: `data` (string ISO) → `gte: new Date(data + "T00:00:00")`, `lt: +1 dia` sobre `inicioEm`.

---

## 3) WEB — `apps/web/app/medico/`

### 3.1 Rotas/páginas novas

```
apps/web/app/medico/
├── layout.tsx                              # Server: guard + header + data-theme="medico"
├── page.tsx                                # Server: dashboard com card-atalho "Agenda do dia"
├── agenda/
│   └── page.tsx                            # Client: lista de agendamentos do dia
└── atendimento/
    └── [agendamentoId]/
        └── page.tsx                        # Client: a PRANCHA (resumo, SOAP, vitais, selar)
```

`layout.tsx`: cópia de `apps/web/app/servico-social/layout.tsx` com `PERFIS_PERMITIDOS = ["SUPER_ADMIN", "PROFISSIONAL"]`, rótulo "Centro Médico", redirect `/login?callbackUrl=/medico` e — diferente do serviço social — wrapper `<div data-theme="medico">` envolvendo header+children, com classes semânticas `text-primary`/`bg-primary` em vez de `ifp-orange` (tokens já prontos em `packages/design-tokens/tokens.css:122-126` — teal `#10C2BB`).

### 3.2 Hooks de dados

`apps/web/lib/use-medico.ts` (espelho de `use-fichas.ts`, usando `useAuthFetch`):
- `useAgendaDoDia(data?)` → `["medico","agenda",data]`, GET `/medico/agenda?data=...`, `enabled: authenticated`, `placeholderData: prev`
- `useAgendamento(agendamentoId)` → GET `/medico/agenda/:id` (payload da prancha)
- `useIniciarAtendimento()` → POST `.../iniciar`, `invalidateQueries(["medico"])`
- `useSalvarSoap()` → PATCH atendimento
- `useSalvarVitais()` → PUT vitais
- `useEncerrarAtendimento()` → POST encerrar, invalida agenda

Alteração em `apps/web/lib/api.ts`: tipos TS `StatusAgendamento`, payloads `AgendamentoResumo`/`PranchaPayload`/`SinaisVitais`, e `STATUS_AGENDAMENTO_LABEL` PT-BR (Agendado, Confirmado, Em atendimento, Concluído, Faltou, Cancelado).

### 3.3 Mapa protótipo → componente React

Fonte: `C:\Users\Erick\Desktop\IFP-Connect-Novo-Design\flagship-atendimento-medico.html`. Componentes em `apps/web/components/medico/`:

| Protótipo | Componente React | Notas de port |
|---|---|---|
| SVG defs (`#ogival`, ícones) | `svg-defs.tsx` (montado 1x no layout) | Opcional na Fase 1 — lucide-react cobre os ícones; ogival é polish |
| CrestAvatar (330-334) | `crest-avatar.tsx` | Iniciais do paciente; `clip-path:url(#ogival)` se SvgDefs entrar |
| CoroaSeal "Liberado p/ Médico" (336-340) | `selo-elegibilidade.tsx` | Lê `ElegibilidadePorUnidade.status` real; verde só se `APROVADO` |
| Chips alergia/crônico/med/neutro (341-345) | `chip-clinico.tsx` (prop `tipo`) | Dados reais de `alergias`/`condicoesCronicas` da API |
| Stepper PranchaFlow (355-361) | `prancha-stepper.tsx` | Estado controlado (`useState<number>`), `data-state=done\|current\|todo` → CSS; clique livre |
| Passo 1 Resumo (368-378) | seção `PassoResumo` na page | Motivo = `agendamento.motivo`; chips de vitais = `SinaisVitais` |
| Passo 2 Queixa + textarea (381-395) | `PassoQueixa` | `Textarea` de ui.tsx → campo `subjetivo`; atalhos appendam texto; ditado de voz FICA DE FORA |
| Passo 3 Exame: toggle-chips + vitais (398-412) | `toggle-chip.tsx` (`aria-pressed` dirigindo estilo) + `form-vitais.tsx` | Toggles serializados em texto no campo `objetivo` (Fase 1); vitais EDITÁVEIS aqui (sem fluxo de enfermagem ainda) via PUT vitais |
| Passo 4 Conduta (415-433) | `PassoConduta` | **GAP do protótipo corrigido**: adicionar bloco "Avaliação / CID-10" (campos `avaliacao`+`cid10`) antes do plano; plano = `Textarea` livre (atestado/retorno como texto); catálogo de medicamentos FICA DE FORA |
| Passo 5 Selo (436-447) | `PassoSelo` | Recap derivado do ESTADO REAL dos passos; botão Selar → `useEncerrarAtendimento` |
| Toast (488) | `toast.tsx` simples (ou reusar `Alerta` fixo no rodapé) | auto-hide ~3,5s |
| Ponte da Corte (467-485) | — | FASE 2 (não há endpoint de sinalização) |
| Demo bar / troca de salão | — | descartar; tema vem do `data-theme="medico"` fixo do layout |

Estado da prancha: tudo em React state (nada no DOM como no protótipo). Form com `useState` controlado (padrão CardElegibilidade) ou RHF — prancha tem poucos campos, `useState` basta. Botão "Salvar rascunho" visível em todos os passos (PATCH); ao abrir a página, se `agendamento.atendimento == null`, chamar `iniciar` automaticamente e hidratar o form com o draft retornado. Atendimento com `encerradoEm` → prancha em modo somente leitura.

Bloqueio de alergia (mock do protótipo): Fase 1 client-side simples — se o texto do plano contém o nome de uma alergia ativa, mostrar `Alerta` de aviso (não bloqueante). Motor real é fase 2.

### 3.4 Login real

Já existe: NextAuth Credentials → `POST /auth/login` do Nest → `accessToken` + `perfis` no JWT (`apps/web/lib/auth.ts`). Nada a criar além do usuário seed com perfil `PROFISSIONAL`; o guard do `layout.tsx` faz o resto. Fluxo: `/login?callbackUrl=/medico`.

---

## 4) SEED DEV

Arquivo: `C:\Users\Erick\Documents\GitHub\kiizinbr-ifp-familiaponcio\packages\database\prisma\seed.ts` — rodar com `pnpm --filter @ifp/database seed`.

**Atenção: o seed atual NÃO cria fichas cidadãs** (só 4 unidades + super admin). Logo o bloco novo precisa criar as fichas-alvo também. Adicionar após o bloco do super admin, tudo idempotente:

1. **Usuário médico**: `prisma.user.upsert` por email `medico@ifp.local`, senha de `SEED_MEDICO_PASSWORD` (mesmo padrão do admin — pular com warning se não definida), nome "Dra. Ana Souza".
2. **Perfil + vínculo**: `usuarioPerfil.upsert` (`Perfil.PROFISSIONAL`) + `usuarioUnidade.upsert` (chave `userId_unidadeId`) na unidade `slug: "medico"` (já seedada).
3. **Profissional**: `profissional.upsert` por `userId` — `registroConselho: "52-12345-0"`, `ufConselho: "RJ"`, `especialidade: "Clínica Geral"`.
4. **3 fichas de exemplo** (`ficha.upsert` por `cpf` fake válido em formato, ex. `11111111111`...): protocolos `IFP-2026-900001..3`, nomes "João da Silva", "Maria Oliveira", "Pedro Santos" + para cada uma `elegibilidadePorUnidade.upsert` (chave `fichaId_unidadeId`) com `status: APROVADO` na unidade MEDICO. Para a ficha 1, criar 1 `alergia` ("Dipirona", GRAVE) e 1 `condicaoCronica` ("Asma") — alimenta os chips da prancha.
5. **3 agendamentos de HOJE** (09:00, 10:30, 14:00; duração 30 min) apontando `fichaId` das 3 fichas + `profissionalId` + `unidadeId` MEDICO, status `CONFIRMADO`. Agendamento não tem unique natural: usar `deleteMany({ profissionalId, inicioEm: { gte: hoje00h, lt: amanha00h } })` antes do `createMany` — aceitável porque é seed dev. Gerar datas com `const hoje = new Date(); hoje.setHours(9, 0, 0, 0)` etc., para o seed sempre produzir agenda "de hoje".

Adicionar `SEED_MEDICO_PASSWORD` ao `.env.example` (sem valor real, regra de não expor segredos).

---

## 5) ORDEM DE CONSTRUÇÃO (commits pequenos, em PT, um por passo)

1. **Schema + migration** — adicionar enums/modelos/back-relations no `schema.prisma`; rodar `validate`, `migrate -- --name centro-medico`, `generate`.
   COMO VALIDAR: migration aplica sem erro; `pnpm --filter @ifp/database studio` mostra `profissionais`, `agendamentos`, `atendimentos`, `sinais_vitais`, `alergias`, `condicoes_cronicas`.
2. **Seed dev** — bloco médico no `seed.ts` + `SEED_MEDICO_PASSWORD` no `.env`/`.env.example`; rodar seed.
   COMO VALIDAR: Studio mostra 1 profissional, 3 fichas APROVADAS no médico, 3 agendamentos de hoje; `POST /api/v1/auth/login` (curl) com `medico@ifp.local` retorna token cujo payload tem `PROFISSIONAL`.
3. **API: GET agenda** — `medico.module` + `agenda.controller/service` + `list-agenda.query`; registrar no `app.module.ts`.
   COMO VALIDAR: em `/api/docs`, autorizar com o token do médico → `GET /medico/agenda` retorna 3 itens ordenados; com token do super admin SEM cadastro Profissional → 403 com mensagem PT; sem token → 401.
4. **API: GET prancha (detalhe)** — `GET /medico/agenda/:id` com ficha+alergias+condições+elegibilidade+draft; audit READ.
   COMO VALIDAR: curl retorna alergia "Dipirona" e condição "Asma" da ficha 1; tabela `audit_logs` ganha linha `READ/Atendimento`.
5. **API: iniciar + SOAP** — `POST .../iniciar` (idempotente) e `PATCH /medico/atendimentos/:id`.
   COMO VALIDAR: 1º POST cria atendimento e agendamento vira `EM_ATENDIMENTO`; 2º POST retorna o MESMO id; PATCH persiste `subjetivo` (conferir no Studio); audit CREATE/UPDATE gravados.
6. **API: vitais + encerrar** — `PUT .../vitais` (upsert) e `POST .../encerrar` (validação mínima + `$transaction`).
   COMO VALIDAR: PUT 2x atualiza a mesma linha de `sinais_vitais`; encerrar sem `plano` → 400 PT; encerrar válido seta `encerradoEm` e agendamento `CONCLUIDO`; PATCH após encerrar → 409.
7. **Web: layout + tema + dashboard** — `app/medico/layout.tsx` (guard PROFISSIONAL + `data-theme="medico"`) e `page.tsx`.
   COMO VALIDAR: login médico → `/medico` renderiza em teal; login de usuário só SERVICO_SOCIAL → tela "Acesso restrito"; sem sessão → redirect ao login com callback.
8. **Web: agenda do dia** — `lib/use-medico.ts` (queries) + `agenda/page.tsx` (cards com hora, paciente, status `BadgeStatus`-like, link para a prancha).
   COMO VALIDAR: browser lista os 3 agendamentos do seed com horas corretas; estados Spinner/erro/vazio funcionam (testar com API desligada).
9. **Web: prancha — resumo + queixa + exame** — página `[agendamentoId]`, stepper, auto-iniciar atendimento, chips clínicos reais, textarea S, toggles O, botão "Salvar rascunho".
   COMO VALIDAR: digitar queixa → salvar → F5 → texto volta da API; chip de alergia da ficha 1 aparece em vermelho.
10. **Web: vitais + conduta/avaliação** — form de vitais (PUT) e passo Conduta com bloco Avaliação/CID-10 + plano.
    COMO VALIDAR: preencher temperatura 37,8 e SatO₂ 97 → salvar → valores reaparecem no passo Resumo; `avaliacao`/`cid10` persistem.
11. **Web: selar + somente leitura** — passo Selo com recap real, botão Selar → encerrar → toast → volta à agenda.
    COMO VALIDAR (fluxo e2e completo): login → agenda → abrir paciente → preencher S/O/A/P + vitais → selar → agenda mostra "Concluído" → reabrir prancha exibe tudo em modo leitura → `audit_logs` tem a trilha READ/CREATE/UPDATE do atendimento.

---

## 6) RISCOS / DECISÕES EM ABERTO (para o Erick)

1. **FK real `profissionalId` vs padrão `String` solto do schema** — o blueprint adota FK real nos modelos clínicos (integridade de prontuário), divergindo do padrão `enviadoPor/realizadaPor`. Confirmar antes da migration.
2. **Onde entra o "A" do SOAP na UI** — o protótipo não tem campo de diagnóstico/CID (gap apontado no relatório 4). Proposta: bloco "Avaliação/CID-10" dentro do passo Conduta (mantém 5 passos). Alternativa: stepper de 6 passos.
3. **Quem registra vitais** — protótipo assume enfermagem pré-consulta; Fase 1 o próprio médico edita na prancha. Quando nascer o fluxo de recepção/triagem, decidir se `SinaisVitais` migra para vínculo com Agendamento (pré-consulta) em vez de Atendimento.
4. **Exame físico estruturado** — toggles por sistema serializados em texto no `objetivo` (Fase 1). Estruturar como JSON/tabela depois implica migração de dados; aceitável?
5. **Imutabilidade pós-selo** — bloqueio é só de aplicação (409). Adendos/retificações (exigência médico-legal) ficam para fase 2 (registro de adendo, nunca edição).
6. **SUPER_ADMIN sem cadastro Profissional** — no desenho atual, leva 403 na agenda (não tem agenda própria). Alternativa: rota admin que lista agenda por profissional. Fase 1: deixar o 403.
7. **`Botao` primary hardcoded `bg-ifp-orange`** (`ui.tsx:110`) — na área médica ficaria laranja. Trocar para `bg-primary` muda também o serviço social (que hoje nem usa data-theme, então continuaria laranja pelo default). Recomendo trocar global — mas validar visualmente o serviço social depois.
8. **RLS por `unidadeId` ainda não existe** — multi-tenant garantido só na aplicação (where por unidade/profissional). OK para Fase 1; registrar como pendência de segurança antes de produção.
9. **Nomenclatura de tema** — protótipo (`styles.css`) usa chave `recreativo` e salão `corte`; tokens do app usam `educacional` e não têm `corte`. Padronizar pelos tokens do app (`medico` etc.) e ignorar o mapa do protótipo.
10. **Fora de escopo confirmado da Fase 1** (validar): Ponte da Corte, ditado por voz, catálogo/prescrição estruturada (`Prescricao` como modelo fica para fase 2 — Fase 1 é texto no `plano`), motor alergia×medicamento, assinatura digital real (o "selo" é `encerradoEm` + auditoria).

Arquivos-âncora para a implementação: `apps/api/src/fichas-cidadas/*` (padrão backend), `apps/web/app/servico-social/layout.tsx` + `apps/web/lib/use-fichas.ts` (padrão web), `packages/database/schema.prisma` + `packages/database/prisma/seed.ts` (dados), `C:\Users\Erick\Desktop\IFP-Connect-Novo-Design\flagship-atendimento-medico.html` (referência visual da prancha).