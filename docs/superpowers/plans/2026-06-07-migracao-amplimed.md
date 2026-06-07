# Migração Amplimed → IFP Connect — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar (one-shot, idempotente, auditável) pacientes, consultas/prontuários, profissionais, CID-10 e mídia clínica da Amplimed (MariaDB) para o IFP Connect (Postgres/Prisma), Centro Médico.

**Architecture:** ETL local-first em 5 estágios. Dump MariaDB restaurado num container Docker descartável; funções **puras** de mapeamento (TDD, vitest) em `src/lib/migracao-amplimed/`; scripts `tsx` em `scripts/migracao-amplimed/` orquestram Extract→Profile→Transform→Load→Validate via Prisma + MinIO. Idempotência por tabela `MigracaoAmplimedMap`. Espelha o precedente `scripts/import-alunos-dryrun.ts`.

**Tech Stack:** TypeScript + tsx, Prisma 6 (Postgres), `mysql2` (lê a origem MariaDB), `minio` (mídia), `bcryptjs`, `zod`, vitest. Spec: `docs/superpowers/specs/2026-06-07-migracao-amplimed-design.md`.

**Convenções:** rodar tudo DENTRO do WSL (`wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm …"`). Ritual pré-commit: `pnpm format && pnpm typecheck && pnpm lint && pnpm test`. Sem PHI em log/commit.

---

## File Structure

```
prisma/migrations/<ts>_migracao_amplimed/      # MigracaoAmplimedMap + cpf nullable
src/lib/migracao-amplimed/
  tipos.ts          # tipos das linhas de origem (rows mysql2) + tipos mapeados
  datas.ts          # parseDataNascimento
  pessoa.ts         # mapCpf, mapGenero, mapCorRaca, slugEmail
  cidadao.ts        # mapPacienteParaCidadao
  profissional.ts   # mapUsuarioParaProfissional
  cid10.ts          # parseCid10Texto
  consulta.ts       # mapConsultaParaNota, horaSinteticaSlot
  *.test.ts         # vitest por módulo (TDD)
scripts/migracao-amplimed/
  00-restore-mariadb.sh   # sobe MariaDB Docker + restaura o dump
  origem.ts               # conexão mysql2 + queries de leitura
  mapa.ts                 # helper upsertMapa (idempotência)
  10-profile.ts           # Extract+Profile (relatório; nada grava)
  20-migrar.ts            # Transform+Load estruturado (--dry-run | --commit)
  30-midia.ts             # ZIPs → MinIO + refs
  40-validar.ts           # contagens + integridade + spot-check
package.json              # + devDep mysql2 ; + scripts migracao:*
```

Cada módulo de `src/lib/migracao-amplimed/` é **puro** (sem Prisma/IO) e testável isolado. Os scripts são a casca de IO.

---

## Task 1: Schema — `MigracaoAmplimedMap` + `cpf` nullable + `mysql2`

**Files:**

- Modify: `prisma/schema.prisma` (add model; tornar `Cidadao.cpf` nullable)
- Create: `prisma/migrations/<ts>_migracao_amplimed/migration.sql` (gerado)
- Modify: `package.json` (devDep `mysql2` + scripts)

- [ ] **Step 1: Adicionar o model no fim de `prisma/schema.prisma`**

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

- [ ] **Step 2: Tornar `Cidadao.cpf` nullable (§0.A)** — em `prisma/schema.prisma`, na linha do campo `cpf`:

```prisma
  cpf               String?  @unique // 11 dígitos normalizado; nullable p/ paciente sem CPF (migração Amplimed)
```

- [ ] **Step 3: Gerar a migration**

Run: `wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm db:migrate --name migracao_amplimed"`
Expected: cria `prisma/migrations/<ts>_migracao_amplimed/` e aplica no dev. `prisma generate` roda junto.

- [ ] **Step 4: Adicionar `mysql2` como devDep + scripts**

Run: `wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm add -D mysql2"`
Em `package.json` `scripts`, adicionar:

```json
"migracao:profile": "dotenv -e .env.local -- tsx scripts/migracao-amplimed/10-profile.ts",
"migracao:run": "dotenv -e .env.local -- tsx scripts/migracao-amplimed/20-migrar.ts",
"migracao:midia": "dotenv -e .env.local -- tsx scripts/migracao-amplimed/30-midia.ts",
"migracao:validar": "dotenv -e .env.local -- tsx scripts/migracao-amplimed/40-validar.ts"
```

- [ ] **Step 5: Verificar e commitar**

Run: `wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/Administrador/ifp-connect && pnpm typecheck && pnpm build"`
Expected: PASS.

```bash
git add prisma/schema.prisma prisma/migrations package.json pnpm-lock.yaml
git commit -m 'feat(migracao): schema MigracaoAmplimedMap + cpf nullable + mysql2'
```

---

## Task 2: Tipos de origem e mapeado

**Files:**

- Create: `src/lib/migracao-amplimed/tipos.ts`

- [ ] **Step 1: Escrever os tipos** (campos confirmados nos `CREATE TABLE` do dump)

```ts
// Linhas lidas da origem MariaDB (subconjunto usado)
export interface PacienteRow {
  codp: number;
  nome: string;
  dtnasc: string | null; // varchar BR; formato a confirmar no Profile
  genero: string | null;
  email: string | null;
  celular: string | null;
  telf: string | null;
  cpf: string | null;
  rg: string | null;
  nmae: string | null;
  npai: string | null;
  raca: string | null;
  tiposanguineo: string | null;
  alergias: string | null;
  nTemCpf: string | null; // 'true' | 'false'
  cep: string | null;
  endereco: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
}

export interface UsuarioRow {
  codu: number;
  nome: string;
  usuario: string | null;
  conselho: string | null;
  registroprof: string | null;
  registrouf: string | null;
  especialidade: number | null;
  userstatus: string | null;
}

export interface ConsultaRow {
  codcon: number;
  codp: number;
  codu: number;
  dtconsulta: string | null; // 'YYYY-MM-DD'
  queixa: string | null;
  anteceden: string | null;
  descfis: string | null;
  conduta: string | null;
  meds: string | null;
  cid10: string | null;
  peso: number | null;
  altura: number | null;
  pas: number | null;
  pad: number | null;
  freqcar: number | null;
  freqres: number | null;
  tempe: number | null;
}

// Saídas dos mappers (padrão `problemas: string[]` do import-alunos)
export interface CidadaoMapeado {
  codp: number;
  nomeCompleto: string;
  cpf: string | null;
  dataNascimento: Date | null;
  telefonePrincipal: string;
  telefoneSecundario: string | null;
  email: string | null;
  genero: string | null;
  corRaca: string | null;
  nomeMae: string | null;
  nomePai: string | null;
  tipoSanguineo: string | null;
  alergias: string | null;
  endereco: EnderecoMapeado | null;
  problemas: string[];
}

export interface EnderecoMapeado {
  cep: string;
  logradouro: string;
  numero: string | null;
  bairro: string | null;
  cidade: string;
  uf: string;
}

export interface DiagnosticoMapeado {
  codigoCid: string | null;
  descricao: string;
  principal: boolean;
}

export interface NotaMapeada {
  codcon: number;
  texto: string;
  paSistolica: number | null;
  paDiastolica: number | null;
  fcBpm: number | null;
  frIrpm: number | null;
  tempC: number | null;
  pesoKg: number | null;
  alturaCm: number | null;
  diagnosticos: DiagnosticoMapeado[];
}

export interface ProfissionalMapeado {
  codu: number;
  nome: string;
  email: string;
  conselho: string;
  nroConselho: string;
  especialidadeAmplimed: number | null;
  problemas: string[];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/migracao-amplimed/tipos.ts
git commit -m 'feat(migracao): tipos de origem e mapeado'
```

---

## Task 3: `parseDataNascimento` (TDD)

**Files:**

- Create: `src/lib/migracao-amplimed/datas.ts`
- Test: `src/lib/migracao-amplimed/datas.test.ts`

- [ ] **Step 1: Teste que falha**

```ts
import { describe, it, expect } from "vitest";
import { parseDataNascimento } from "./datas";

describe("parseDataNascimento", () => {
  it("aceita ISO YYYY-MM-DD", () => {
    const r = parseDataNascimento("1990-05-21");
    expect(r.data?.toISOString().slice(0, 10)).toBe("1990-05-21");
    expect(r.problema).toBeNull();
  });
  it("aceita BR DD/MM/YYYY", () => {
    const r = parseDataNascimento("21/05/1990");
    expect(r.data?.toISOString().slice(0, 10)).toBe("1990-05-21");
  });
  it("rejeita data impossível", () => {
    const r = parseDataNascimento("32/13/1990");
    expect(r.data).toBeNull();
    expect(r.problema).toMatch(/data/i);
  });
  it("rejeita vazio/null", () => {
    expect(parseDataNascimento(null).data).toBeNull();
    expect(parseDataNascimento("").data).toBeNull();
  });
});
```

- [ ] **Step 2: Roda e falha** — `pnpm test datas` → FAIL (parseDataNascimento não existe).

- [ ] **Step 3: Implementar**

```ts
export interface ResultadoData {
  data: Date | null;
  problema: string | null;
}

/** Aceita 'YYYY-MM-DD' e 'DD/MM/YYYY'. Valida o calendário (UTC, sem hora). */
export function parseDataNascimento(input: string | null): ResultadoData {
  if (!input || !input.trim()) return { data: null, problema: "data ausente" };
  const s = input.trim();
  let ano: number, mes: number, dia: number;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  const br = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
  if (iso) {
    ano = +iso[1];
    mes = +iso[2];
    dia = +iso[3];
  } else if (br) {
    dia = +br[1];
    mes = +br[2];
    ano = +br[3];
  } else {
    return { data: null, problema: `data em formato desconhecido: ${s}` };
  }
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  const valida =
    d.getUTCFullYear() === ano && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
  if (!valida) return { data: null, problema: `data inválida: ${s}` };
  return { data: d, problema: null };
}
```

- [ ] **Step 4: Roda e passa** — `pnpm test datas` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/migracao-amplimed/datas.ts src/lib/migracao-amplimed/datas.test.ts
git commit -m 'feat(migracao): parseDataNascimento com TDD'
```

---

## Task 4: `mapCpf`, `mapGenero`, `mapCorRaca`, `slugEmail` (TDD)

**Files:**

- Create: `src/lib/migracao-amplimed/pessoa.ts`
- Test: `src/lib/migracao-amplimed/pessoa.test.ts`

- [ ] **Step 1: Teste que falha**

```ts
import { describe, it, expect } from "vitest";
import { mapCpf, mapGenero, mapCorRaca, slugEmail } from "./pessoa";

describe("mapCpf", () => {
  it("normaliza e aceita CPF válido", () => {
    expect(mapCpf("529.982.247-25", "false")).toEqual({ cpf: "52998224725", problema: null });
  });
  it("retorna null sem problema quando nTemCpf=true", () => {
    expect(mapCpf("", "true")).toEqual({ cpf: null, problema: null });
  });
  it("retorna null com problema quando CPF inválido", () => {
    const r = mapCpf("111.111.111-11", "false");
    expect(r.cpf).toBeNull();
    expect(r.problema).toMatch(/cpf/i);
  });
});

describe("mapGenero", () => {
  it("mapeia variações", () => {
    expect(mapGenero("Masculino")).toBe("masculino");
    expect(mapGenero("F")).toBe("feminino");
    expect(mapGenero("")).toBeNull();
  });
});

describe("mapCorRaca", () => {
  it("mapeia pro vocabulário IBGE", () => {
    expect(mapCorRaca("Parda")).toBe("parda");
    expect(mapCorRaca("xyz")).toBeNull();
  });
});

describe("slugEmail", () => {
  it("gera e-mail institucional sem acento", () => {
    expect(slugEmail("Dr. João Pôncio")).toBe("joao.poncio@familiaponcio.org.br");
  });
});
```

- [ ] **Step 2: Roda e falha** — `pnpm test pessoa` → FAIL.

- [ ] **Step 3: Implementar**

```ts
import { normalizeCpf, validateCpf } from "../cpf";

export function mapCpf(
  cpf: string | null,
  nTemCpf: string | null,
): { cpf: string | null; problema: string | null } {
  const semCpf = (nTemCpf ?? "").toLowerCase() === "true";
  const digitos = normalizeCpf(cpf ?? "");
  if (!digitos)
    return semCpf ? { cpf: null, problema: null } : { cpf: null, problema: "cpf ausente" };
  if (!validateCpf(digitos)) return { cpf: null, problema: `cpf inválido: ${digitos}` };
  return { cpf: digitos, problema: null };
}

const GENERO: Record<string, string> = {
  m: "masculino",
  masculino: "masculino",
  homem: "masculino",
  f: "feminino",
  feminino: "feminino",
  mulher: "feminino",
};
export function mapGenero(v: string | null): string | null {
  const k = (v ?? "").trim().toLowerCase();
  return GENERO[k] ?? null;
}

const COR_RACA: Record<string, string> = {
  branca: "branca",
  preta: "preta",
  negra: "preta",
  parda: "parda",
  amarela: "amarela",
  indigena: "indigena",
  indígena: "indigena",
};
export function mapCorRaca(v: string | null): string | null {
  const k = (v ?? "").trim().toLowerCase();
  return COR_RACA[k] ?? null;
}

export function slugEmail(nome: string): string {
  const limpo = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(dr|dra|sr|sra)\.?\b/gi, "")
    .trim()
    .toLowerCase();
  const partes = limpo.split(/\s+/).filter(Boolean);
  const slug = partes.length >= 2 ? `${partes[0]}.${partes[partes.length - 1]}` : partes.join("");
  return `${slug}@familiaponcio.org.br`;
}
```

- [ ] **Step 4: Roda e passa** — `pnpm test pessoa` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/migracao-amplimed/pessoa.ts src/lib/migracao-amplimed/pessoa.test.ts
git commit -m 'feat(migracao): mapCpf/mapGenero/mapCorRaca/slugEmail com TDD'
```

---

## Task 5: `mapPacienteParaCidadao` (TDD)

**Files:**

- Create: `src/lib/migracao-amplimed/cidadao.ts`
- Test: `src/lib/migracao-amplimed/cidadao.test.ts`

- [ ] **Step 1: Teste que falha**

```ts
import { describe, it, expect } from "vitest";
import { mapPacienteParaCidadao } from "./cidadao";
import type { PacienteRow } from "./tipos";

const base: PacienteRow = {
  codp: 1,
  nome: "Maria Silva",
  dtnasc: "10/03/1985",
  genero: "F",
  email: "m@x.com",
  celular: "21999990000",
  telf: null,
  cpf: "529.982.247-25",
  rg: "123",
  nmae: "Ana",
  npai: null,
  raca: "Parda",
  tiposanguineo: "O+",
  alergias: "dipirona",
  nTemCpf: "false",
  cep: "25000000",
  endereco: "Rua A",
  numero: "10",
  bairro: "Centro",
  cidade: "Duque de Caxias",
  uf: "RJ",
};

describe("mapPacienteParaCidadao", () => {
  it("mapeia paciente completo sem problemas", () => {
    const c = mapPacienteParaCidadao(base);
    expect(c.problemas).toEqual([]);
    expect(c.cpf).toBe("52998224725");
    expect(c.nomeCompleto).toBe("Maria Silva");
    expect(c.telefonePrincipal).toBe("21999990000");
    expect(c.corRaca).toBe("parda");
    expect(c.endereco?.cidade).toBe("Duque de Caxias");
  });
  it("sem telefone vira problema (telefonePrincipal é obrigatório)", () => {
    const c = mapPacienteParaCidadao({ ...base, celular: null, telf: null });
    expect(c.problemas.some((p) => /telefone/i.test(p))).toBe(true);
  });
  it("paciente sem CPF (nTemCpf) não vira problema, cpf=null", () => {
    const c = mapPacienteParaCidadao({ ...base, cpf: null, nTemCpf: "true" });
    expect(c.cpf).toBeNull();
    expect(c.problemas).toEqual([]);
  });
});
```

- [ ] **Step 2: Roda e falha** — `pnpm test cidadao` → FAIL.

- [ ] **Step 3: Implementar**

```ts
import type { PacienteRow, CidadaoMapeado, EnderecoMapeado } from "./tipos";
import { parseDataNascimento } from "./datas";
import { mapCpf, mapGenero, mapCorRaca } from "./pessoa";
import { normalizeCpf } from "../cpf";

function mapEndereco(row: PacienteRow): EnderecoMapeado | null {
  const cep = (row.cep ?? "").replace(/\D/g, "");
  if (!row.endereco?.trim() || !row.cidade?.trim() || !row.uf?.trim()) return null;
  return {
    cep: cep.length === 8 ? cep : "",
    logradouro: row.endereco.trim(),
    numero: row.numero?.trim() || null,
    bairro: row.bairro?.trim() || null,
    cidade: row.cidade.trim(),
    uf: row.uf.trim().toUpperCase().slice(0, 2),
  };
}

export function mapPacienteParaCidadao(row: PacienteRow): CidadaoMapeado {
  const problemas: string[] = [];
  const { cpf, problema: pCpf } = mapCpf(row.cpf, row.nTemCpf);
  if (pCpf) problemas.push(pCpf);
  const { data, problema: pData } = parseDataNascimento(row.dtnasc);
  if (pData) problemas.push(pData);

  const telefonePrincipal = (row.celular || row.telf || "").trim();
  if (!telefonePrincipal) problemas.push("telefone ausente (telefonePrincipal obrigatório)");
  const nome = row.nome?.trim() || "";
  if (!nome) problemas.push("nome ausente");

  return {
    codp: row.codp,
    nomeCompleto: nome,
    cpf,
    dataNascimento: data,
    telefonePrincipal: telefonePrincipal || "NÃO INFORMADO",
    telefoneSecundario: row.telf && row.telf.trim() !== telefonePrincipal ? row.telf.trim() : null,
    email: row.email?.trim() || null,
    genero: mapGenero(row.genero),
    corRaca: mapCorRaca(row.raca),
    nomeMae: row.nmae?.trim() || null,
    nomePai: row.npai?.trim() || null,
    tipoSanguineo: row.tiposanguineo?.trim() || null,
    alergias: row.alergias?.trim() || null,
    endereco: mapEndereco(row),
    problemas,
  };
}
```

- [ ] **Step 4: Roda e passa** — `pnpm test cidadao` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/migracao-amplimed/cidadao.ts src/lib/migracao-amplimed/cidadao.test.ts
git commit -m 'feat(migracao): mapPacienteParaCidadao com TDD'
```

---

## Task 6: `parseCid10Texto` (TDD)

**Files:**

- Create: `src/lib/migracao-amplimed/cid10.ts`
- Test: `src/lib/migracao-amplimed/cid10.test.ts`

- [ ] **Step 1: Teste que falha**

```ts
import { describe, it, expect } from "vitest";
import { parseCid10Texto } from "./cid10";

describe("parseCid10Texto", () => {
  it("extrai múltiplos códigos, 1º é principal", () => {
    const r = parseCid10Texto("J06.9 - IVAS; I10 Hipertensão");
    expect(r).toEqual([
      { codigoCid: "J06.9", descricao: "IVAS", principal: true },
      { codigoCid: "I10", descricao: "Hipertensão", principal: false },
    ]);
  });
  it("texto livre sem código vira descrição sem codigoCid", () => {
    const r = parseCid10Texto("dor de cabeça");
    expect(r).toEqual([{ codigoCid: null, descricao: "dor de cabeça", principal: true }]);
  });
  it("vazio retorna []", () => {
    expect(parseCid10Texto("")).toEqual([]);
    expect(parseCid10Texto(null)).toEqual([]);
  });
});
```

- [ ] **Step 2: Roda e falha** — `pnpm test cid10` → FAIL.

- [ ] **Step 3: Implementar**

```ts
import type { DiagnosticoMapeado } from "./tipos";

const CODIGO = /([A-TV-Z]\d{2}(?:\.\d{1,2})?)/; // formato CID-10

/** Quebra o texto livre de CID da Amplimed em diagnósticos. 1º = principal. */
export function parseCid10Texto(input: string | null): DiagnosticoMapeado[] {
  if (!input || !input.trim()) return [];
  const partes = input
    .split(/[;\n]/)
    .map((p) => p.trim())
    .filter(Boolean);
  const out: DiagnosticoMapeado[] = [];
  for (const parte of partes) {
    const m = CODIGO.exec(parte);
    const codigoCid = m ? m[1] : null;
    const descricao =
      parte
        .replace(CODIGO, "")
        .replace(/^[\s\-–:]+/, "")
        .trim() ||
      (codigoCid ?? parte);
    out.push({ codigoCid, descricao, principal: out.length === 0 });
  }
  return out;
}
```

- [ ] **Step 4: Roda e passa** — `pnpm test cid10` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/migracao-amplimed/cid10.ts src/lib/migracao-amplimed/cid10.test.ts
git commit -m 'feat(migracao): parseCid10Texto com TDD'
```

---

## Task 7: `mapConsultaParaNota` + `horaSinteticaSlot` (TDD)

**Files:**

- Create: `src/lib/migracao-amplimed/consulta.ts`
- Test: `src/lib/migracao-amplimed/consulta.test.ts`

- [ ] **Step 1: Teste que falha**

```ts
import { describe, it, expect } from "vitest";
import { mapConsultaParaNota, horaSinteticaSlot } from "./consulta";
import type { ConsultaRow } from "./tipos";

const row: ConsultaRow = {
  codcon: 7,
  codp: 1,
  codu: 2,
  dtconsulta: "2024-08-01",
  queixa: "cefaleia",
  anteceden: "HAS",
  descfis: "BEG",
  conduta: "dipirona",
  meds: null,
  cid10: "G43 Enxaqueca",
  peso: 70,
  altura: 170,
  pas: 120,
  pad: 80,
  freqcar: 72,
  freqres: 16,
  tempe: 36.5,
};

describe("mapConsultaParaNota", () => {
  it("mapeia vitais e compõe texto + diagnóstico", () => {
    const n = mapConsultaParaNota(row);
    expect(n.paSistolica).toBe(120);
    expect(n.fcBpm).toBe(72);
    expect(n.pesoKg).toBe(70);
    expect(n.alturaCm).toBe(170);
    expect(n.diagnosticos[0].codigoCid).toBe("G43");
    expect(n.texto).toMatch(/cefaleia/);
    expect(n.texto).toMatch(/conduta/i);
  });
});

describe("horaSinteticaSlot", () => {
  it("ordem 0 = 08:00; cada ordem soma a duração; não colide", () => {
    const dia = new Date(Date.UTC(2024, 7, 1));
    const a = horaSinteticaSlot(dia, 0, 30);
    const b = horaSinteticaSlot(dia, 1, 30);
    expect(a.getUTCHours()).toBe(8);
    expect(a.getUTCMinutes()).toBe(0);
    expect(b.getUTCMinutes()).toBe(30);
    expect(a.getTime()).not.toBe(b.getTime());
  });
});
```

- [ ] **Step 2: Roda e falha** — `pnpm test consulta` → FAIL.

- [ ] **Step 3: Implementar**

```ts
import type { ConsultaRow, NotaMapeada } from "./tipos";
import { parseCid10Texto } from "./cid10";

const HORA_INICIO = 8; // 08:00 base sintética

/** dataHoraInicio determinístico p/ Slot, sem colidir por (prof, dia). ordemNoDia >= 0. */
export function horaSinteticaSlot(dia: Date, ordemNoDia: number, duracaoMin: number): Date {
  const base = Date.UTC(
    dia.getUTCFullYear(),
    dia.getUTCMonth(),
    dia.getUTCDate(),
    HORA_INICIO,
    0,
    0,
  );
  return new Date(base + ordemNoDia * duracaoMin * 60_000);
}

function bloco(titulo: string, corpo: string | null): string {
  return corpo && corpo.trim() ? `${titulo}: ${corpo.trim()}` : "";
}

export function mapConsultaParaNota(row: ConsultaRow): NotaMapeada {
  const texto = [
    bloco("Queixa", row.queixa),
    bloco("Antecedentes", row.anteceden),
    bloco("Exame físico", row.descfis),
    bloco("Conduta", row.conduta),
    bloco("Medicações", row.meds),
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    codcon: row.codcon,
    texto: texto || "(migrado da Amplimed — sem texto)",
    paSistolica: row.pas ?? null,
    paDiastolica: row.pad ?? null,
    fcBpm: row.freqcar ?? null,
    frIrpm: row.freqres ?? null,
    tempC: row.tempe ?? null,
    pesoKg: row.peso ?? null,
    alturaCm: row.altura != null ? Math.round(row.altura) : null,
    diagnosticos: parseCid10Texto(row.cid10),
  };
}
```

- [ ] **Step 4: Roda e passa** — `pnpm test consulta` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/migracao-amplimed/consulta.ts src/lib/migracao-amplimed/consulta.test.ts
git commit -m 'feat(migracao): mapConsultaParaNota + horaSinteticaSlot com TDD'
```

---

## Task 8: `mapUsuarioParaProfissional` (TDD)

**Files:**

- Create: `src/lib/migracao-amplimed/profissional.ts`
- Test: `src/lib/migracao-amplimed/profissional.test.ts`

- [ ] **Step 1: Teste que falha**

```ts
import { describe, it, expect } from "vitest";
import { mapUsuarioParaProfissional } from "./profissional";
import type { UsuarioRow } from "./tipos";

const u: UsuarioRow = {
  codu: 2,
  nome: "João Pôncio",
  usuario: "joaop",
  conselho: "CRM",
  registroprof: "52123",
  registrouf: "RJ",
  especialidade: 4,
  userstatus: "ativo",
};

describe("mapUsuarioParaProfissional", () => {
  it("mapeia conselho e gera e-mail", () => {
    const p = mapUsuarioParaProfissional(u);
    expect(p.email).toBe("joao.poncio@familiaponcio.org.br");
    expect(p.conselho).toBe("CRM");
    expect(p.nroConselho).toBe("52123-RJ");
    expect(p.problemas).toEqual([]);
  });
  it("sem conselho vira problema", () => {
    const p = mapUsuarioParaProfissional({ ...u, conselho: null, registroprof: null });
    expect(p.problemas.some((x) => /conselho/i.test(x))).toBe(true);
  });
});
```

- [ ] **Step 2: Roda e falha** — `pnpm test profissional` → FAIL.

- [ ] **Step 3: Implementar**

```ts
import type { UsuarioRow, ProfissionalMapeado } from "./tipos";
import { slugEmail } from "./pessoa";

export function mapUsuarioParaProfissional(row: UsuarioRow): ProfissionalMapeado {
  const problemas: string[] = [];
  const nome = row.nome?.trim() || "";
  if (!nome) problemas.push("nome ausente");
  const conselho = row.conselho?.trim() || "";
  const registro = row.registroprof?.trim() || "";
  if (!conselho || !registro) problemas.push("conselho/registro profissional ausente");
  const uf = row.registrouf?.trim().toUpperCase() || "";
  return {
    codu: row.codu,
    nome,
    email: slugEmail(nome || `prof${row.codu}`),
    conselho: conselho || "—",
    nroConselho: uf ? `${registro}-${uf}` : registro || "—",
    especialidadeAmplimed: row.especialidade ?? null,
    problemas,
  };
}
```

- [ ] **Step 4: Roda e passa** — `pnpm test profissional` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/migracao-amplimed/profissional.ts src/lib/migracao-amplimed/profissional.test.ts
git commit -m 'feat(migracao): mapUsuarioParaProfissional com TDD'
```

---

## Task 9: Restore MariaDB descartável + camada de origem

**Files:**

- Create: `scripts/migracao-amplimed/00-restore-mariadb.sh`
- Create: `scripts/migracao-amplimed/origem.ts`

- [ ] **Step 1: Script de restore** (`00-restore-mariadb.sh`)

```bash
#!/usr/bin/env bash
set -euo pipefail
ZIP="${1:?uso: 00-restore-mariadb.sh <caminho-do-zip-tables>}"
TMP="$(mktemp -d)"
echo "Extraindo $ZIP em $TMP ..."
unzip -q "$ZIP" -d "$TMP"
docker rm -f amplimed-src 2>/dev/null || true
docker run -d --name amplimed-src -e MARIADB_ROOT_PASSWORD=src -e MARIADB_DATABASE=amplimed -p 3399:3306 mariadb:11
echo "Aguardando MariaDB subir ..."
until docker exec amplimed-src mariadb -usrc -psrc -e "SELECT 1" amplimed >/dev/null 2>&1 \
  || docker exec amplimed-src mariadb -uroot -psrc -e "SELECT 1" >/dev/null 2>&1; do sleep 2; done
echo "Carregando os .sql ..."
for f in "$TMP"/amplimed33643/*.sql; do
  docker exec -i amplimed-src mariadb -uroot -psrc amplimed < "$f"
done
echo "OK. Origem em mysql://root:src@127.0.0.1:3399/amplimed"
```

Run: `bash scripts/migracao-amplimed/00-restore-mariadb.sh "/mnt/c/Dev/ifp-connect/backup-amplimed/6a22ea018b938404430e2312_tables_2026_06_06_03_30_08.zip"`
Expected: termina com "OK. Origem em mysql://...:3399/amplimed".

- [ ] **Step 2: Camada de origem** (`origem.ts`)

```ts
import mysql from "mysql2/promise";
import type { PacienteRow, UsuarioRow, ConsultaRow } from "../../src/lib/migracao-amplimed/tipos";

export async function abrirOrigem() {
  const conn = await mysql.createConnection({
    host: "127.0.0.1",
    port: 3399,
    user: "root",
    password: "src",
    database: "amplimed",
  });
  return {
    async pacientes(): Promise<PacienteRow[]> {
      const [r] = await conn.query("SELECT * FROM pacientes");
      return r as PacienteRow[];
    },
    async usuarios(): Promise<UsuarioRow[]> {
      const [r] = await conn.query("SELECT * FROM usuarios");
      return r as UsuarioRow[];
    },
    async consultas(): Promise<ConsultaRow[]> {
      const [r] = await conn.query("SELECT * FROM consulta");
      return r as ConsultaRow[];
    },
    async contar(tabela: string): Promise<number> {
      const [r] = await conn.query(`SELECT COUNT(*) AS n FROM \`${tabela}\``);
      return (r as { n: number }[])[0].n;
    },
    async fechar() {
      await conn.end();
    },
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add scripts/migracao-amplimed/00-restore-mariadb.sh scripts/migracao-amplimed/origem.ts
git commit -m 'feat(migracao): restore MariaDB descartavel + camada de origem'
```

---

## Task 10: Profile (Extract + relatório, NADA grava)

**Files:**

- Create: `scripts/migracao-amplimed/10-profile.ts`

- [ ] **Step 1: Escrever o profile** (espelha o relatório do `import-alunos-dryrun.ts`)

```ts
import { abrirOrigem } from "./origem";
import { mapPacienteParaCidadao } from "../../src/lib/migracao-amplimed/cidadao";
import { mapUsuarioParaProfissional } from "../../src/lib/migracao-amplimed/profissional";

const origem = await abrirOrigem();
const pacientes = await origem.pacientes();
const usuarios = await origem.usuarios();

const cid = pacientes.map(mapPacienteParaCidadao);
const limpos = cid.filter((c) => c.problemas.length === 0);
const aRevisar = cid.filter((c) => c.problemas.length > 0);

// dedup por CPF (não-null)
const porCpf = new Map<string, number>();
for (const c of cid) if (c.cpf) porCpf.set(c.cpf, (porCpf.get(c.cpf) ?? 0) + 1);
const dupCpf = [...porCpf.entries()].filter(([, n]) => n > 1);
const semCpf = cid.filter((c) => c.cpf === null).length;

const probs = new Map<string, number>();
for (const c of aRevisar)
  for (const p of c.problemas) {
    const k = p.replace(/:.*/, "");
    probs.set(k, (probs.get(k) ?? 0) + 1);
  }

console.log("=== PROFILE Amplimed (NADA é gravado) ===");
console.log(
  `Pacientes: ${pacientes.length} · limpos ${limpos.length} · a revisar ${aRevisar.length}`,
);
console.log(`Sem CPF: ${semCpf} · CPFs duplicados: ${dupCpf.length}`);
console.log(`Usuários (profissionais): ${usuarios.length}`);
console.log("\n-- Tipos de problema (pacientes) --");
for (const [p, n] of [...probs.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${n}\t${p}`);
console.log("\n-- Especialidades (int distintos em usuarios) --");
const esp = new Map<number, number>();
for (const u of usuarios)
  if (u.especialidade != null) esp.set(u.especialidade, (esp.get(u.especialidade) ?? 0) + 1);
for (const [e, n] of [...esp.entries()].sort((a, b) => b[1] - a[1]))
  console.log(`  ${n}\tesp=${e}`);
console.log("\n-- Contagens de tabelas-chave --");
for (const t of ["consulta", "consulta_configuracao", "pacspsicologia", "documentosprescricoes"])
  console.log(`  ${await origem.contar(t)}\t${t}`);

await origem.fechar();
console.log("\nNada foi escrito. Decisões §0.A/§0.B/§0.E se confirmam aqui.");
```

- [ ] **Step 2: Rodar** — `pnpm migracao:profile` → imprime contagens reais; **anota** o mapa de especialidades e a taxa de problemas. **CHECKPOINT humano:** confirmar §0.A (quantos sem CPF/dup), §0.E (mapa de especialidade), e amostrar `consulta_configuracao` (§0.B) antes de seguir.

- [ ] **Step 3: Commit**

```bash
git add scripts/migracao-amplimed/10-profile.ts
git commit -m 'feat(migracao): profile (extract + relatorio, nada grava)'
```

---

## Task 11: Helper de idempotência `upsertMapa`

**Files:**

- Create: `scripts/migracao-amplimed/mapa.ts`

- [ ] **Step 1: Escrever o helper**

```ts
import { PrismaClient } from "@prisma/client";

/** Retorna idDestino existente se (entidade, idOrigem) já migrado; senão null. */
export async function jaMigrado(
  db: PrismaClient,
  entidade: string,
  idOrigem: string | number,
): Promise<string | null> {
  const r = await db.migracaoAmplimedMap.findUnique({
    where: { entidade_idOrigem: { entidade, idOrigem: String(idOrigem) } },
  });
  return r?.idDestino ?? null;
}

/** Registra o vínculo de proveniência. */
export async function registrarMapa(
  db: PrismaClient,
  entidade: string,
  idOrigem: string | number,
  idDestino: string,
): Promise<void> {
  await db.migracaoAmplimedMap.create({
    data: { entidade, idOrigem: String(idOrigem), idDestino },
  });
}
```

- [ ] **Step 2: Verificar typecheck** — `pnpm typecheck` → PASS (confirma o nome do índice composto `entidade_idOrigem`).

- [ ] **Step 3: Commit**

```bash
git add scripts/migracao-amplimed/mapa.ts
git commit -m 'feat(migracao): helper de idempotencia upsertMapa'
```

---

## Task 12: Load — Cid10, Especialidade, User+Profissional

**Files:**

- Create: `scripts/migracao-amplimed/20-migrar.ts` (parte 1: referência + profissionais)

- [ ] **Step 1: Escrever a base do migrar + carga de profissionais**

```ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { abrirOrigem } from "./origem";
import { jaMigrado, registrarMapa } from "./mapa";
import { mapUsuarioParaProfissional } from "../../src/lib/migracao-amplimed/profissional";

const COMMIT = process.argv.includes("--commit");
const db = new PrismaClient();
const origem = await abrirOrigem();
const log = (m: string) => console.log(`${COMMIT ? "[COMMIT]" : "[DRY-RUN]"} ${m}`);

// Mapa especialidade-int -> nome (preencher após o Profile, §0.E)
const ESPECIALIDADE_NOME: Record<number, string> = {
  // ex: 4: "Clínica Médica",  (CONFIRMAR no Profile)
};

async function userMigracao(): Promise<string> {
  const email = "migracao@familiaponcio.org.br";
  const existe = await db.user.findUnique({ where: { email } });
  if (existe) return existe.id;
  if (!COMMIT) return "DRY-USER";
  const u = await db.user.create({
    data: {
      email,
      name: "Migração Amplimed",
      hashedPassword: await bcrypt.hash(cuidAleatorio(), 10),
      mustChangePassword: true,
    },
  });
  return u.id;
}
function cuidAleatorio(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function carregarProfissionais(migradorId: string): Promise<void> {
  const usuarios = await origem.usuarios();
  let ok = 0,
    pulados = 0;
  for (const u of usuarios) {
    if (u.userstatus && u.userstatus !== "ativo") {
      pulados++;
      continue;
    }
    const p = mapUsuarioParaProfissional(u);
    if (p.problemas.length) {
      pulados++;
      continue;
    }
    if (await jaMigrado(db, "profissional", u.codu)) {
      ok++;
      continue;
    }
    if (!COMMIT) {
      ok++;
      continue;
    }
    const nome = ESPECIALIDADE_NOME[p.especialidadeAmplimed ?? -1] ?? "Clínica Médica";
    const esp = await db.especialidade.upsert({
      where: { nome },
      update: {},
      create: { nome, duracaoPadraoMin: 30, corDestaque: "#007571" },
    });
    const user = await db.user.create({
      data: {
        email: p.email,
        name: p.nome,
        hashedPassword: await bcrypt.hash(cuidAleatorio(), 10),
        mustChangePassword: true,
      },
    });
    const prof = await db.profissional.create({
      data: {
        userId: user.id,
        nomeExibicao: p.nome,
        conselho: p.conselho,
        nroConselho: p.nroConselho,
        especialidades: { create: [{ especialidadeId: esp.id }] },
      },
    });
    await registrarMapa(db, "profissional", u.codu, prof.id);
    void migradorId;
    ok++;
  }
  log(`profissionais: ${ok} migrados/ok · ${pulados} pulados`);
}

const migradorId = await userMigracao();
await carregarProfissionais(migradorId);
await origem.fechar();
await db.$disconnect();
```

- [ ] **Step 2: Rodar dry-run** — `pnpm migracao:run` (sem `--commit`) → imprime contagens, nada grava. Verificar números contra o Profile.

- [ ] **Step 3: Commit**

```bash
git add scripts/migracao-amplimed/20-migrar.ts
git commit -m 'feat(migracao): load de profissionais + especialidade (dry-run)'
```

---

## Task 13: Load — Cidadão (+ Endereço)

**Files:**

- Modify: `scripts/migracao-amplimed/20-migrar.ts` (adicionar `carregarCidadaos`)

- [ ] **Step 1: Adicionar a função e chamá-la** (após `carregarProfissionais`)

```ts
import { mapPacienteParaCidadao } from "../../src/lib/migracao-amplimed/cidadao";

async function carregarCidadaos(migradorId: string): Promise<void> {
  const pacientes = await origem.pacientes();
  const vistosCpf = new Set<string>();
  let ok = 0,
    pulados = 0,
    dup = 0;
  for (const row of pacientes) {
    const c = mapPacienteParaCidadao(row);
    if (c.problemas.length) {
      pulados++;
      continue;
    }
    if (c.cpf && vistosCpf.has(c.cpf)) {
      dup++;
      continue;
    }
    if (c.cpf) vistosCpf.add(c.cpf);
    if (await jaMigrado(db, "cidadao", row.codp)) {
      ok++;
      continue;
    }
    if (!COMMIT) {
      ok++;
      continue;
    }
    const cidadao = await db.cidadao.create({
      data: {
        nomeCompleto: c.nomeCompleto,
        cpf: c.cpf,
        dataNascimento: c.dataNascimento ?? new Date(0),
        telefonePrincipal: c.telefonePrincipal,
        telefoneSecundario: c.telefoneSecundario,
        email: c.email,
        genero: c.genero,
        corRaca: c.corRaca,
        nomeMae: c.nomeMae,
        nomePai: c.nomePai,
        tipoSanguineo: c.tipoSanguineo,
        alergias: c.alergias,
        unitIdOrigem: "medico",
        createdById: migradorId,
        statusCadastro: "ativo",
        enderecos: c.endereco
          ? {
              create: [
                {
                  tipo: "residencial",
                  isPrincipal: true,
                  cep: c.endereco.cep,
                  logradouro: c.endereco.logradouro,
                  numero: c.endereco.numero,
                  bairro: c.endereco.bairro,
                  cidade: c.endereco.cidade,
                  uf: c.endereco.uf,
                },
              ],
            }
          : undefined,
      },
    });
    await registrarMapa(db, "cidadao", row.codp, cidadao.id);
    ok++;
  }
  log(`cidadãos: ${ok} migrados/ok · ${pulados} c/ problema · ${dup} duplicados por CPF`);
}
```

Chamar logo após `carregarProfissionais(migradorId)`: `await carregarCidadaos(migradorId);`

> Nota: `dataNascimento` é obrigatório (`@db.Date`). Paciente sem data válida cai em `problemas` (Task 5) → pulado. Se o Profile mostrar muitos sem data, reavaliar (tornar nullable ou data-sentinela documentada).

- [ ] **Step 2: Dry-run** — `pnpm migracao:run` → confere cidadãos ok/pulados/dup vs Profile.

- [ ] **Step 3: Commit**

```bash
git add scripts/migracao-amplimed/20-migrar.ts
git commit -m 'feat(migracao): load de cidadaos + endereco (dry-run)'
```

---

## Task 14: Load — Slot sintético + Consulta + Nota + Diagnóstico

**Files:**

- Modify: `scripts/migracao-amplimed/20-migrar.ts` (adicionar `carregarConsultas`)

- [ ] **Step 1: Adicionar a função**

```ts
import { mapConsultaParaNota, horaSinteticaSlot } from "../../src/lib/migracao-amplimed/consulta";
import { parseDataNascimento } from "../../src/lib/migracao-amplimed/datas";

async function carregarConsultas(migradorId: string): Promise<void> {
  const consultas = (await origem.consultas())
    .filter((c) => c.dtconsulta)
    .sort((a, b) => (a.dtconsulta! < b.dtconsulta! ? -1 : 1) || a.codcon - b.codcon);
  // ordem por (profissional, dia) p/ hora sintética sem colisão
  const ordemPorChave = new Map<string, number>();
  let ok = 0,
    pulados = 0;
  for (const row of consultas) {
    const cidadaoId = await jaMigrado(db, "cidadao", row.codp);
    const profId = await jaMigrado(db, "profissional", row.codu);
    if (!cidadaoId || !profId) {
      pulados++;
      continue;
    }
    if (await jaMigrado(db, "consulta", row.codcon)) {
      ok++;
      continue;
    }
    const { data: dia } = parseDataNascimento(row.dtconsulta); // mesmo parser de data
    if (!dia) {
      pulados++;
      continue;
    }
    const chave = `${row.codu}|${row.dtconsulta}`;
    const ordem = ordemPorChave.get(chave) ?? 0;
    ordemPorChave.set(chave, ordem + 1);
    if (!COMMIT) {
      ok++;
      continue;
    }

    const prof = await db.profissional.findUnique({
      where: { id: profId },
      include: { especialidades: true },
    });
    const especialidadeId = prof!.especialidades[0].especialidadeId;
    const dataHoraInicio = horaSinteticaSlot(dia, ordem, 30);
    const nota = mapConsultaParaNota(row);

    await db.$transaction(async (tx) => {
      const slot = await tx.slot.create({
        data: {
          profissionalId: profId,
          especialidadeId,
          dataHoraInicio,
          duracaoMin: 30,
          status: "realizado",
        },
      });
      const consulta = await tx.consulta.create({
        data: {
          slotId: slot.id,
          cidadaoId,
          profissionalId: profId,
          especialidadeId,
          status: "realizada",
          createdBy: migradorId,
        },
      });
      const notaCriada = await tx.notaEvolucao.create({
        data: {
          consultaId: consulta.id,
          cidadaoId,
          profissionalId: profId,
          texto: nota.texto,
          paSistolica: nota.paSistolica,
          paDiastolica: nota.paDiastolica,
          fcBpm: nota.fcBpm,
          frIrpm: nota.frIrpm,
          tempC: nota.tempC,
          pesoKg: nota.pesoKg,
          alturaCm: nota.alturaCm,
          status: "assinada",
          assinadaEm: dataHoraInicio,
          assinadaPor: prof!.userId,
          diagnosticos: {
            create: nota.diagnosticos.map((d) => ({
              codigoCid: d.codigoCid,
              descricao: d.descricao,
              principal: d.principal,
            })),
          },
        },
      });
      await registrarMapa(tx as unknown as PrismaClient, "consulta", row.codcon, consulta.id);
      await registrarMapa(tx as unknown as PrismaClient, "nota", row.codcon, notaCriada.id);
    });
    ok++;
  }
  log(`consultas/notas: ${ok} migradas/ok · ${pulados} puladas (sem cidadão/prof/data)`);
}
```

Chamar após `carregarCidadaos(migradorId)`: `await carregarConsultas(migradorId);`

- [ ] **Step 2: Dry-run** — `pnpm migracao:run` → confere consultas. **CHECKPOINT:** rodar contra cópia local, validar (Task 16) antes de qualquer `--commit`.

- [ ] **Step 3: Commit**

```bash
git add scripts/migracao-amplimed/20-migrar.ts
git commit -m 'feat(migracao): load de slot sintetico + consulta + nota + diagnostico'
```

---

## Task 15: Mídia → MinIO + refs

**Files:**

- Create: `scripts/migracao-amplimed/30-midia.ts`

- [ ] **Step 1: Escrever o migrador de mídia** (stream dos ZIPs, sem carregar em memória)

```ts
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { Client as Minio } from "minio";
import * as unzipper from "unzipper"; // adicionar devDep se necessário; ou usar yauzl
import { PrismaClient } from "@prisma/client";
import { jaMigrado } from "./mapa";

const COMMIT = process.argv.includes("--commit");
const db = new PrismaClient();
const BUCKET = "ifp-cidadao-anexos";
const minio = new Minio({
  endPoint: process.env.MINIO_ENDPOINT ?? "127.0.0.1",
  port: Number(process.env.MINIO_PORT ?? 9000),
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY!,
  secretKey: process.env.MINIO_SECRET_KEY!,
});

// Convenção de nome dos arquivos no ZIP carrega o codp/codcon — confirmar no Profile da mídia.
// Para cada arquivo: resolver cidadao via jaMigrado('cidadao', codp); subir como AnexoCidadao categoria=saude.
// fotospac -> Cidadao.fotoUrl ; fotospron/filespron -> AnexoCidadao.
// (esqueleto: itera entradas do zip, calcula sha256, sobe pro MinIO, grava ref se COMMIT)
```

> A convenção exata de nome→codp/codcon vem do **Profile da mídia** (listar entradas dos ZIPs, como já fizemos com o de tables). Esta task fica **bloqueada** até esse mini-profile rodar; o esqueleto e os pontos de gravação (`Cidadao.fotoUrl`, `AnexoCidadao`) estão definidos. Subtarefa 15.0: rodar listagem das entradas dos ZIPs de mídia e fixar o regex nome→id.

- [ ] **Step 2: Mini-profile da mídia** — listar entradas dos 4 ZIPs de mídia (PowerShell `ZipFile.OpenRead`, só nomes) → fixar `parseNomeArquivo(nome) → { codp?, codcon? }`. Adicionar teste unit pra esse parser.

- [ ] **Step 3: Commit**

```bash
git add scripts/migracao-amplimed/30-midia.ts
git commit -m 'feat(migracao): esqueleto de migracao de midia para MinIO'
```

---

## Task 16: Validate (contagens + integridade + spot-check)

**Files:**

- Create: `scripts/migracao-amplimed/40-validar.ts`

- [ ] **Step 1: Escrever o validador**

```ts
import { PrismaClient } from "@prisma/client";
import { abrirOrigem } from "./origem";

const db = new PrismaClient();
const origem = await abrirOrigem();

const pacOrigem = await origem.contar("pacientes");
const conOrigem = await origem.contar("consulta");
const cidDestino = await db.cidadao.count({ where: { unitIdOrigem: "medico" } });
const conDestino = await db.consulta.count();
const notaDestino = await db.notaEvolucao.count();
const orfas = await db.consulta.count({ where: { notaEvolucao: null } });
const slotsRealizados = await db.slot.count({ where: { status: "realizado" } });

console.log("=== VALIDAÇÃO ===");
console.log(`Pacientes origem ${pacOrigem} -> cidadãos destino ${cidDestino}`);
console.log(
  `Consultas origem ${conOrigem} -> destino ${conDestino} (slots realizados ${slotsRealizados})`,
);
console.log(`Notas ${notaDestino} · consultas SEM nota: ${orfas}`);
console.log(orfas === 0 && conDestino === slotsRealizados ? "INTEGRIDADE OK" : "⚠️ REVISAR");

await origem.fechar();
await db.$disconnect();
```

- [ ] **Step 2: Rodar local** — após um `--commit` na **cópia local**: `pnpm migracao:validar`. Conferir os deltas (origem − destino == rejeitados logados).

- [ ] **Step 3: Commit**

```bash
git add scripts/migracao-amplimed/40-validar.ts
git commit -m 'feat(migracao): validador de contagens + integridade'
```

---

## Task 17: Cutover na prod (runbook — executar, não codar)

**Files:** nenhum (procedimento operacional)

- [ ] **Step 1: Pré-condições** — hardening restante feito (sudo escopado, banner/demo removidos); disco 250 GB ✅; backup `.age` fresco (`sudo bash /opt/ifp-connect/ops/vm/backup.sh`).
- [ ] **Step 2: Transferir o dump** pra perto da prod OU rodar o ETL apontando o `DATABASE_URL` pra prod (via túnel) — decisão no Cutover. Restaurar MariaDB descartável.
- [ ] **Step 3: `pnpm migracao:profile`** contra a prod-alvo → confere.
- [ ] **Step 4: `pnpm migracao:run --commit`** → `pnpm migracao:midia --commit` → `pnpm migracao:validar`.
- [ ] **Step 5: Spot-check no browser** (Fila/Prontuário/Busca de N pacientes reais) + `docker compose ps` healthy.
- [ ] **Step 6: Derrubar o MariaDB descartável** (`docker rm -f amplimed-src`) e remover extrações temporárias (PHI).
- [ ] **Step 7: Atualizar a ROPA** (`docs/seguranca/2026-06-06-ropa.md`) com a operação de migração concluída + data.

---

## Self-Review (feito)

- **Cobertura do spec:** Cid10(T12) · usuarios→User+Profissional(T8/T12) · pacientes→Cidadao+Endereco(T5/T13) · consulta→Slot+Consulta+Nota+Diagnostico(T7/T14) · mídia→MinIO(T15) · proveniência/idempotência(T1/T11) · cpf nullable(T1) · slot sintético sem colisão(T7/T14) · nota assinada(T14) · Profile/Validate(T10/T16) · LGPD/ROPA(T17). §0.B (`consulta_configuracao`) e §0.E (mapa especialidade) resolvidos no Profile (T10) antes do load — marcado como CHECKPOINT humano, não placeholder.
- **Consistência de tipos:** assinaturas batem entre tasks (`PacienteRow`/`CidadaoMapeado`/`NotaMapeada`/`ProfissionalMapeado` definidos em T2; mappers consomem/retornam eles; `jaMigrado`/`registrarMapa` usados igual em T12/13/14).
- **Dependências externas a adicionar:** `mysql2` (T1); `unzipper`/`yauzl` p/ T15 (decidir na 15.0).
- **Riscos residuais marcados:** muitos pacientes sem data (T13 nota), convenção nome-de-mídia (T15.0), mapa de especialidade (T10).

```

```
