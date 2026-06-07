# Design — Migração Amplimed → IFP Connect (Centro Médico)

**Data:** 2026-06-07 · **Autor:** brainstorming Erick + Claude · **Status:** design (aprovação pendente) · **Tipo:** migração de dados one-shot (PHI)

## Contexto

O Instituto Família Pôncio está **saindo da Amplimed** (prontuário eletrônico SaaS) e o **IFP Connect assume** o Centro Médico. O Erick recebeu o backup completo da conta `amplimed33643` em `C:\Dev\ifp-connect\backup-amplimed` (~32 GB):

| Arquivo | Conteúdo |
| --- | --- |
| `..._tables_...zip` (91 MB) | dump **MariaDB** (`mariadb-dump`, utf8mb4, InnoDB), 118 tabelas, 1 `.sql` por tabela |
| `amplimedfotospron_...part1-3` (~30 GB) | imagens de prontuário (exames/documentos escaneados) |
| `amplimedfotospac_...part1` (2,3 GB) | fotos de paciente (perfil) |
| `amplimedfilespron_...part1` (6,6 MB) | documentos de prontuário (PDFs) |

Migração **one-shot** (não sync contínuo). Fonte = MariaDB; destino = Postgres (schema Prisma do IFP). Não é um restore — é **ETL com transformação de schema**.

## §0 — Decisões

### Fechadas
- **§0.1 Escopo = "core clínico".** Migrar: pacientes, consultas + prontuários por especialidade (`pacs*`), CID-10, profissionais (`usuarios`), e a **mídia clínica** (fotos de paciente + imagens/docs de prontuário). `cidade`/`uf` da Amplimed entram **inline** no `Endereco` (sem tabela de geografia separada). **`convenio` da Amplimed não tem modelo-alvo** (IFP é clínica gratuita) → descartado. **Fora:** faturamento/financeiro, chat, pesquisa de satisfação, feature_flags, tarefas, agenda recorrente (templates).
- **§0.2 Unidade.** Todos os cidadãos e consultas migrados pertencem ao **Centro Médico** (`unitIdOrigem = 'medico'`).
- **§0.3 Topologia/ingresso.** Endurecer a VM `IFP-APP` in-place como prod; manter URL Funnel `ifp-app.taile04c66.ts.net`. (Disco já redimensionado 40→250 GB em 2026-06-07.)
- **§0.4 Abordagem ETL.** Restaurar o dump num **MariaDB Docker descartável** (local, na máquina de dev) → script `tsx` lê via `mysql2` → **funções puras de mapeamento** (testadas, TDD) → grava via **Prisma**. Espelha o precedente `scripts/import-alunos-dryrun.ts` (dry-run primeiro). Mídia: stream dos ZIPs → **MinIO** (bucket `ifp-cidadao-anexos`), reescrevendo as referências.
- **§0.5 Senhas NÃO migram.** Profissionais ganham conta IFP nova (`hashedPassword` aleatório + `mustChangePassword=true`); o hash da Amplimed é descartado.
- **§0.6 Notas históricas entram `assinada`.** Cada consulta finalizada vira `NotaEvolucao` com `status=assinada`, `assinadaEm`=data da consulta, `assinadaPor`=profissional. Imutável (correções via `AddendoNota`, padrão do app).
- **§0.7 Idempotência por tabela de mapeamento.** Nova tabela `MigracaoAmplimedMap` guarda `(entidade, idOrigem) → idDestino`. Todo upsert é keyed nela → re-rodar a migração não duplica.

### Abertas (recomendação minha; confirmar antes de implementar)
- **§0.A CPF nulo/duplicado.** `Cidadao.cpf` hoje é `@unique` **e obrigatório**, mas a Amplimed tem pacientes `nTemCpf='true'` (sem CPF) e CPFs duplicados (artefato de import anterior — colunas `fimImportacao`/`flag_migracao`). Paciente com histórico clínico **precisa** ser `Cidadao` (só `Cidadao` tem `consultas`; `Familiar` não). **Recomendo: tornar `Cidadao.cpf` nullable mantendo `@unique`** (Postgres permite múltiplos NULL num índice único) — reflete a realidade (criança/idoso sem CPF, que o schema já reconhece) e é menos hacky que CPF sintético. Exige migration + ajustar os poucos pontos do app que assumem CPF presente (cadastro força CPF; busca por CPF). Dedup: mesmo CPF → mantém 1, loga os demais no Profile. *Alternativa rejeitada:* CPF sintético de 11 dígitos (suja o dado, engana validação).
- **§0.B `consulta_configuracao` (773 MB).** É `codcon → configuracao` (JSON longtext, ~100k linhas) — provável **render-config do formulário dinâmico** da consulta, não necessariamente conteúdo clínico novo (a narrativa já está na tabela `consulta`). **Recomendo: amostrar no Profile** e só extrair se contiver texto clínico ausente da `consulta`; senão, **descartar** (evita 773 MB de config de UI que não tem par no IFP).
- **§0.C Receita/Atestado.** Para a v1, **dobrar** prescrição/documentos no `texto` da `NotaEvolucao` (não reconstruir `Receita`/`ReceitaItem`/`Atestado` estruturados — são documentos impressos, valor histórico baixo). Estruturar depois se necessário.
- **§0.D E-mail do profissional.** `User.email` é `@unique` obrigatório; a Amplimed guarda `usuario` (login), nem sempre e-mail. **Recomendo** sintetizar `<slug-do-nome>@familiaponcio.org.br` quando faltar, e o Erick revisa a lista (são poucos profissionais).
- **§0.E Mapa especialidade-int → `Especialidade`.** `usuarios.especialidade` é um int; o Profile extrai os valores distintos e a gente faz um **mapa manual** int→nome (poucas especialidades), criando `Especialidade` com `corDestaque` do brandbook + `duracaoPadraoMin` default.

## Objetivo e critérios de sucesso

Carregar na prod do IFP Connect, de forma **idempotente e auditável**, o cadastro de pacientes, o histórico de consultas/prontuários e a mídia clínica da Amplimed, com base legal LGPD = **tutela da saúde** (Art. 11, II, "f" — migração intra-controlador, mesma finalidade, sem novo consentimento). Sucesso =
1. Contagens batem (pacientes/consultas/notas/anexos importados == origem, menos os rejeitados logados).
2. Amostras conferem (spot-check de N pacientes: dados + nota + anexos corretos).
3. Integridade referencial OK (toda consulta tem cidadão+profissional+especialidade+slot; toda nota tem consulta).
4. App funciona com o dado real (Fila/Prontuário/Busca renderizam).
5. Re-rodar a migração não cria duplicata.

## Arquitetura do pipeline (5 estágios)

```
[ZIP tables] --restore--> [MariaDB Docker descartável]
                                   |
                          (1) EXTRACT  (mysql2 lê origem)
                                   |
                          (2) PROFILE  (contagens, dedup, qualidade — relatório, nada escrito)
                                   |
                          (3) TRANSFORM (funções puras TDD: map* + normalizações)
                                   |
                          (4) LOAD     (Prisma upsert keyed em MigracaoAmplimedMap)
                                   |               \--- mídia: ZIPs --stream--> MinIO
                                   |
                          (5) VALIDATE (contagens + integridade + spot-check)
                                   |
                          ===> CUTOVER (rodar contra a prod, após hardening, com backup antes)
```

- **Local-first:** estágios 1–4 rodam contra uma **cópia local** do schema IFP (Postgres dev) primeiro. Só depois de Validate verde o mesmo script roda contra a prod (Cutover).
- **Dry-run:** modo `--dry-run` (default) faz Extract+Profile+Transform e **relata sem gravar** (igual `import-alunos-dryrun.ts`). `--commit` grava.
- **Ordem de carga (respeita FKs):** (a) `Cid10` (ref) → (b) `Especialidade` → (c) `User`+`Profissional` → (d) `Cidadao` (+`Endereco`) → (e) `Slot` sintético + `Consulta` → (f) `NotaEvolucao` (+`DiagnosticoNota`) → (g) mídia (`Cidadao.fotoUrl` + `AnexoCidadao`).

## Mapeamento de dados

### `cid10_*` → `Cid10` (ref) — 🎁 resolve o T6 pendente do Prontuário
`cid10_categorias.descricao` + `.cat` (código) → `Cid10 { codigo, descricao, capitulo }`. Read-only, idempotente por `codigo` (PK). Substitui a dependência do CSV DATASUS.

### `usuarios` → `User` + `Profissional`
| Amplimed | IFP |
| --- | --- |
| `nome` | `User.name`, `Profissional.nomeExibicao` |
| `usuario`/sintetizado (§0.D) | `User.email` |
| (aleatório) | `User.hashedPassword` + `mustChangePassword=true` (§0.5) |
| `conselho` | `Profissional.conselho` |
| `registroprof`+`registrouf` | `Profissional.nroConselho` |
| `especialidade` (int) | `ProfissionalEspecialidade` via mapa §0.E |
| `permissao`/`nivelAcesso` | `UserRole` (profissional/recepcao por unidade `medico`) |

Migrar profissionais referenciados por consultas (`codu`) + ativos (`userstatus='ativo'`).

### `pacientes` → `Cidadao` (+ `Endereco`, + `Familiar`)
| Amplimed | IFP `Cidadao` |
| --- | --- |
| `nome` | `nomeCompleto` |
| `cpf` (normalizado via `src/lib/cpf.ts`; §0.A se nulo) | `cpf` |
| `dtnasc` (varchar → `parseDataNascimento`) | `dataNascimento` |
| `celular`/`telf` | `telefonePrincipal` / `telefoneSecundario` |
| `genero` | `genero` (normalizado) |
| `raca` | `corRaca` (mapa IBGE) |
| `email` | `email` |
| `nmae`/`npai` | `nomeMae`/`nomePai` |
| `tiposanguineo`/`alergias` | `tipoSanguineo`/`alergias` |
| `obito`/`dataObito` | (futuro: flag; v1 ignora) |
| `cep`/`endereco`/`numero`/`bairro`/`cidade`/`uf` | → `Endereco` (1 residencial, `isPrincipal=true`) |
| (sistema) | `unitIdOrigem='medico'`, `createdById`=user migração, `statusCadastro=ativo` |

`fotopac` → resolve na fase de mídia (`Cidadao.fotoUrl`).

### `consulta` (+ `pacs*` por codcon) → `Slot` + `Consulta` + `NotaEvolucao` (+ `DiagnosticoNota`)
- **`Slot` sintético** (`status=realizado`): `profissionalId` (de `codu`), `especialidadeId`, `dataHoraInicio` = `dtconsulta` + **hora sintética determinística** (§ desafio 2), `duracaoMin` (default da especialidade).
- **`Consulta`** (`status=realizada`): liga slot+cidadão(`codp`)+profissional+especialidade; `createdBy`=user migração.
- **`NotaEvolucao`** (`status=assinada`, `assinadaEm`=`dtconsulta`, `assinadaPor`=userId do profissional):
  - `texto` = composição de `queixa`, `anteceden`/`antecedenfamilia`, hábitos (`fuman`/`etili`/`droga`...), `descfis` (exame físico), `conduta`, `meds`, `plantrat`, + `dados` JSON dos `pacs*` do mesmo `codcon`.
  - sinais vitais 1:1: `pas`→`paSistolica`, `pad`→`paDiastolica`, `freqcar`→`fcBpm`, `freqres`→`frIrpm`, `tempe`→`tempC`, `peso`→`pesoKg`, `altura`→`alturaCm`.
  - `cid10` (texto, pode ter N códigos) → `parseCid10Texto` → `DiagnosticoNota[]` (`codigoCid` + `descricao` via lookup `Cid10`; 1º = `principal`).
  - prescrição/documentos → dobrados no `texto` (§0.C).

### Mídia → MinIO + refs
- `amplimedfotospac` → `Cidadao.fotoUrl` (key MinIO, naming SHA-256, mapeado por `codp`).
- `amplimedfotospron` + `amplimedfilespron` → `AnexoCidadao` (`categoria=saude`), ligado ao `cidadao` (e `consulta` quando o nome do arquivo carregar `codcon`). Bucket `ifp-cidadao-anexos`, `hashSha256`, `storageKey={cidadaoId}/{hash}.{ext}`. Stream (nunca carregar 30 GB em memória).

## Mudança de schema (Prisma migration)

```prisma
/// Rastro de proveniência da migração Amplimed (idempotência + auditoria LGPD).
model MigracaoAmplimedMap {
  id        String   @id @default(cuid())
  entidade  String   // 'cidadao' | 'profissional' | 'consulta' | 'nota' | 'especialidade' | 'anexo'
  idOrigem  String   // codp/codcon/codu (string)
  idDestino String   // cuid IFP
  createdAt DateTime @default(now())

  @@unique([entidade, idOrigem])
  @@index([idDestino])
}
```
+ (§0.A, se aprovado) `Cidadao.cpf String?` nullable mantendo `@unique`.

## Os 5 desafios — decisão

1. **CPF (§0.A):** cpf nullable + dedup por CPF no Profile.
2. **`Consulta` exige `Slot` único:** `Slot` tem `@@unique([profissionalId, dataHoraInicio])` e `dtconsulta` é **só data** (sem hora) → N consultas/dia/profissional colidiriam. **Solução:** ordenar consultas por `codcon` dentro de `(profissional, dia)` e atribuir hora sintética incremental (08:00, 08:00+`duracao`, ...). Hora é fictícia mesmo (Amplimed não guardou), o dia é preservado.
3. **Profissional/Especialidade antes (FKs):** ordem de carga (a→g) garante.
4. **Proveniência:** `MigracaoAmplimedMap` (idempotência via upsert keyed).
5. **Nota assinada:** §0.6 — entra finalizada, imutável, atribuída ao profissional + data original.

## LGPD / PHI / segurança
- **Base legal:** tutela da saúde (Art. 11, II, "f"). Migração intra-controlador, mesma finalidade → sem novo consentimento dos titulares.
- **Em trânsito/repouso:** o backup (~32 GB PHI) fica **local** na máquina de dev, **fora do git** (já em `C:\Dev\...`, não no repo). MariaDB descartável é local e derrubado pós-migração. Carga na prod só via TLS (Funnel) + Postgres/MinIO isolados (sem porta no host).
- **Nada de PHI em log/conversa:** Profile e dry-run reportam **contagens e padrões**, nunca nome/CPF/conteúdo clínico.
- **Auditoria:** todos os registros migrados atribuídos a um `User` de migração (`migracao@familiaponcio.org.br`); `AuditLog` de migração (1 evento por entidade-raiz).
- **Retenção:** prontuário = retenção legal ~20 anos (CFM 1.821/2007) — **não anonimizar**. Atualizar a ROPA (`docs/seguranca/2026-06-06-ropa.md`) com a operação de migração.

## Testes (TDD)
Funções puras em `src/lib/migracao-amplimed/` (vitest, padrão `import-alunos`):
- `normalizarCpf` (reusa `src/lib/cpf.ts`) · `parseDataNascimento` (varchar BR → Date, formatos parciais/ inválidos) · `mapGenero`/`mapCorRaca` · `mapPacienteParaCidadao` · `parseCid10Texto` · `mapConsultaParaNota` (vitais + texto) · `horaSinteticaSlot` (determinística, sem colisão) · `slugEmail`.
Casos: CPF nulo/inválido/duplicado, dtnasc inválida, cid10 multi-código, consulta sem profissional mapeado, colisão de slot. Meta de cobertura ≥ 80% nos mappers. Integração: fixture pequeno (10 pacientes sintéticos) → load → asserts. Validate é parte do pipeline, não só teste.

## Sequenciamento (cruza com o hardening)
1. ✅ **Resize disco** (feito 2026-06-07: 250 GB).
2. **Migration de schema** (`MigracaoAmplimedMap` + §0.A cpf nullable) — dev.
3. **Construir ETL local** (MariaDB Docker + mappers TDD + dry-run) → **Profile** → ajustar mapeamentos.
4. **Validate local** (cópia da prod) verde.
5. **Hardening restante** (escopar sudo, remover banner/demo) — antes do PHI real.
6. **Cutover prod** (backup antes → `--commit` → validate → spot-check no browser).

## Fora de escopo
Faturamento/financeiro · chat · pesquisa de satisfação · feature_flags · tarefas · módulos de especialidade não usados · migração de senha · sync contínuo · `Receita`/`Atestado` estruturados (v1 dobra no texto) · processo jurídico LGPD (DPO/termos — trilha paralela).

## Riscos e mitigações
| Risco | Mitigação |
| --- | --- |
| `dtnasc` varchar inválida/parcial | `parseDataNascimento` tolerante + loga rejeições no Profile |
| cpf nullable afeta o app inteiro | mapear pontos que assumem CPF antes da migration; testes |
| `especialidade` int sem mapa | Profile extrai distintos → mapa manual revisado pelo Erick |
| 32 GB mídia (tempo/espaço) | disco já 250 GB; upload em stream + retomável (idempotente por hash) |
| `consulta_configuracao` 773 MB | §0.B: amostrar antes; descartar se for só config de UI |
| Colisão de slot sintético | hora determinística incremental por (prof, dia) |
| Encoding | dump é utf8mb4; validar acentuação no Profile |

## Estrutura de arquivos
```
prisma/migrations/<ts>_add_migracao_amplimed_map/   # + cpf nullable (§0.A)
src/lib/migracao-amplimed/
  mappers.ts            # funções puras (map*/parse*/normaliza*)
  mappers.test.ts       # vitest TDD
  tipos.ts              # tipos das linhas de origem (mysql2)
scripts/migracao-amplimed/
  00-restore-mariadb.sh # sobe MariaDB Docker + restaura o dump
  10-profile.ts         # Extract+Profile (relatório, nada grava)
  20-migrar.ts          # Transform+Load (--dry-run | --commit)
  30-migrar-midia.ts    # ZIPs → MinIO + refs
  40-validar.ts         # contagens + integridade + spot-check
package.json            # + scripts migracao:* ; + devDep mysql2
```
```

## Pendências pós-spec
- `mysql2` (devDep) a adicionar.
- Mapa `especialidade` int→nome (Profile).
- Lista de profissionais + e-mails sintetizados (revisão Erick).
- ROPA: adicionar a operação de migração.
