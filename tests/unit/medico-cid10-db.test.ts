import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { buildCid10Filter } from "@/lib/medico/cid10";

/**
 * Busca CID-10 contra o Postgres dev (molde: medico-paciente-timeline.test.ts).
 * Executa o `where` EXATO de buscarCid10Action (buildCid10Filter + select +
 * orderBy codigo asc + take 12) — o tsc não valida shape de where/select do
 * Prisma; o gate de runtime é este teste.
 *
 * Fixtures: códigos V98.x/V99.x — no DATASUS, V98 e V99 são categorias SEM
 * subdivisão, então os códigos com ponto nunca colidem com o seed real.
 * beforeAll rastreia quais códigos NÃO existiam; afterAll remove SÓ esses.
 */

const TOKEN = "cid10teste-f1";

const FIXTURES = [
  ...Array.from({ length: 9 }, (_, i) => ({
    codigo: `V98.${i + 1}`,
    descricao: `${TOKEN} acidente simulado ${i + 1}`,
  })),
  { codigo: "V99.1", descricao: `${TOKEN} infecção simulada um` },
  { codigo: "V99.2", descricao: `${TOKEN} infecção simulada dois` },
  { codigo: "V99.3", descricao: `${TOKEN} caso simulado três` },
  { codigo: "V99.4", descricao: `${TOKEN} caso simulado quatro` },
  { codigo: "V99.5", descricao: `${TOKEN} caso simulado cinco` },
];

/** Mesma query da action (sem o guard de sessão, que não se aplica em teste). */
function buscarComoAAction(q: string) {
  return db.cid10.findMany({
    where: buildCid10Filter(q),
    select: { codigo: true, descricao: true },
    orderBy: { codigo: "asc" },
    take: 12,
  });
}

describe("busca CID-10 — query exata da action (DB-real)", () => {
  let criados: string[] = [];

  beforeAll(async () => {
    const codigos = FIXTURES.map((f) => f.codigo);
    // Restos de execução anterior abortada: remove só linhas com o nosso token.
    await db.cid10.deleteMany({
      where: { codigo: { in: codigos }, descricao: { contains: TOKEN } },
    });
    const existentes = await db.cid10.findMany({
      where: { codigo: { in: codigos } },
      select: { codigo: true },
    });
    const jaExistiam = new Set(existentes.map((e) => e.codigo));
    const novos = FIXTURES.filter((f) => !jaExistiam.has(f.codigo));
    criados = novos.map((f) => f.codigo);
    await db.cid10.createMany({ data: novos, skipDuplicates: true });
  });

  afterAll(async () => {
    await db.cid10.deleteMany({ where: { codigo: { in: criados } } });
  });

  it("setup íntegro: as 14 fixtures foram criadas por este teste", () => {
    expect(criados).toHaveLength(FIXTURES.length);
  });

  it("termo código-like minúsculo acha por prefixo de código (v98. → V98.x)", async () => {
    const r = await buscarComoAAction("v98.");
    const codigos = r.map((x) => x.codigo);
    expect(codigos).toContain("V98.1");
    expect(codigos).toContain("V98.9");
    expect(codigos.every((c) => c.startsWith("V98."))).toBe(true);
  });

  it("termo textual acha por descrição case-insensitive (infecç com acento)", async () => {
    const r = await buscarComoAAction(`${TOKEN.toUpperCase()} INFECÇ`);
    expect(r.map((x) => x.codigo).sort()).toEqual(["V99.1", "V99.2"]);
  });

  it("ordena por código ascendente", async () => {
    const r = await buscarComoAAction("v98.");
    const codigos = r.map((x) => x.codigo);
    expect(codigos).toEqual([...codigos].sort());
  });

  it("aplica take 12 (14 fixtures com o token → só 12 voltam, as menores por código)", async () => {
    const r = await buscarComoAAction(TOKEN);
    expect(r).toHaveLength(12);
    expect(r[0]?.codigo).toBe("V98.1");
    expect(r.every((x) => x.descricao.includes(TOKEN))).toBe(true);
  });

  it("shape do select: só codigo e descricao", async () => {
    const r = await buscarComoAAction("v99.1");
    expect(r[0]).toEqual({ codigo: "V99.1", descricao: `${TOKEN} infecção simulada um` });
  });
});
