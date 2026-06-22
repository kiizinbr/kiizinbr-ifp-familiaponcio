# Plano — Prescrição estruturada + bloqueio REAL de alergia (🔴 clínico)

> **Status:** COMEÇADO na madrugada de 2026-06-22 por loop autônomo. ⚠️ **NÃO mesclar/deployar
> sem revisão humana** (segurança do paciente). O que já está pronto é a **lógica de segurança
> + teste**; o resto (schema aplicado, endpoint, UI) está especificado aqui para revisão.

## Por que faseado assim
A checagem de alergia é uma barreira de **segurança do paciente** — precisa ser correta e
testada. Nesta sessão o app **não pôde subir o banco** (Docker/WSL2), então em vez de aplicar
migração e plugar um endpoint sem teste de integração (arriscado às cegas), entreguei a **parte
verificável agora**: a lógica pura + teste unitário. A parte que depende de banco está
especificada abaixo para revisar e aplicar com o ambiente de pé.

## ✅ Pronto nesta sessão (verificável sem banco)
- `apps/api/src/medico/alergia-check.ts` — função PURA `verificarConflitoAlergia()` /
  `temConflitoAlergia()` / `alergiaCasaMedicamento()`. Cruza medicamentos prescritos × alergias
  ATIVAS, com normalização (acento/caixa/pontuação) e casamento conservador (prioriza alertar).
- `apps/api/src/medico/alergia-check.spec.ts` — teste unitário (exato, acento, dose/sufixo,
  token curto, falso positivo, múltiplos conflitos).
- `apps/api/jest.config.js` — **monta o teste unitário da API** (antes só existia e2e). Roda com
  `pnpm --filter @ifp/api test`, sem banco.

## ⏭️ Próximos passos (precisam do banco de pé — revisar primeiro)

### 1. Schema (PROPOSTA — ainda NÃO aplicada para não deixar o schema em meio-termo na branch compartilhada)
Adicionar a `packages/database/schema.prisma` (+ back-relations em `Atendimento`, `FichaCidada`,
`Profissional`, `Unidade`, `MembroFamiliar`):

```prisma
model Prescricao {
  id             String   @id @default(cuid())
  unidadeId      String
  atendimentoId  String
  fichaId        String
  membroId       String?
  profissionalId String
  observacoes    String?
  // Trilha de segurança: se prescreveu apesar de conflito de alergia,
  // o override CONSCIENTE fica registrado (quem, por quê).
  alergiaOverride       Boolean  @default(false)
  alergiaOverrideMotivo String?
  emitidaEm      DateTime @default(now())
  criadoEm       DateTime @default(now())
  atualizadoEm   DateTime @updatedAt

  unidade      Unidade         @relation(fields: [unidadeId], references: [id])
  atendimento  Atendimento     @relation(fields: [atendimentoId], references: [id], onDelete: Cascade)
  ficha        FichaCidada     @relation(fields: [fichaId], references: [id], onDelete: Cascade)
  membro       MembroFamiliar? @relation(fields: [membroId], references: [id], onDelete: SetNull)
  profissional Profissional    @relation(fields: [profissionalId], references: [id])
  itens        PrescricaoItem[]

  @@index([atendimentoId])
  @@index([fichaId])
  @@map("prescricoes")
}

model PrescricaoItem {
  id              String   @id @default(cuid())
  prescricaoId    String
  medicamento     String   // nome livre (v1) — futuro: ref. a dicionário de princípio ativo
  posologia       String   // ex.: "1 comp 8/8h por 5 dias"
  conflitoAlergia Boolean  @default(false) // snapshot do alerta no momento (auditoria)
  criadoEm        DateTime @default(now())

  prescricao Prescricao @relation(fields: [prescricaoId], references: [id], onDelete: Cascade)

  @@index([prescricaoId])
  @@map("prescricao_itens")
}
```
Aplicar: `set -a; source .env; set +a` → `pnpm --filter @ifp/database exec prisma validate` →
`prisma migrate dev --name prescricao` → `prisma generate`.

### 2. Endpoint (NestJS, módulo médico — segue o gabarito de `beneficiarios.service.ts`)
`POST /medico/atendimentos/:atendimentoId/prescricoes` com:
- tenant via `profissionais.resolverPorUser(user, TipoUnidade.MEDICO)` + `assertElegivel`;
- **atendimento do próprio profissional e NÃO selado** (`encerradoEm = null`) — ato clínico
  pessoal, sem bypass de admin (regra do README);
- carrega `alergias { where: { ativa: true } }` da ficha (e do membro, se houver) e roda
  `verificarConflitoAlergia(itens, alergiasAtivas)` **no servidor** (fonte da verdade);
- **bloqueio:** se há conflito e o corpo não traz `override: { motivo }` → `409 Conflict` com a
  lista de conflitos (o front mostra o alerta vermelho e exige justificativa);
- com `override.motivo` → grava `alergiaOverride=true` + motivo + marca os itens em conflito;
- `AuditService.registrar` CREATE (e um evento específico quando houver override de alergia);
- selo: prescrição emitida é imutável (sem update de item após `emitidaEm`).

### 3. Web (prancha do atendimento) — `apps/web/app/medico/atendimento/[agendamentoId]`
Bloco "Prescrição": adicionar itens (medicamento + posologia); ao tentar emitir, se o servidor
responder 409, mostrar os conflitos em vermelho (com a gravidade da alergia) e um campo
"Justificar e prescrir mesmo assim" que reenvia com `override.motivo`. Usar os blocos CASA.

### 4. Regressão (com a API no ar)
`scripts/valida-prescricao.mjs` no padrão dos outros: prescrição limpa (201), prescrição com
medicamento da alergia SEM override (409), com override (201 + flag), anti-tenant (404),
atendimento selado (rejeita).

## Limitações conscientes (decisão de design, ver no código)
- Casa por **nome**, não por princípio ativo/classe → não pega reatividade cruzada
  (penicilina × amoxicilina) nem sinônimos (AAS × ácido acetilsalicílico). É **uma** barreira,
  não a única; evolução = dicionário de princípios ativos/sinônimos. A heurística erra para o
  lado de **alertar** (o médico decide com override justificado).
