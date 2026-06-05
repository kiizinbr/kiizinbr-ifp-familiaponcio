import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { matricular } from "@/lib/capacitacao/matricula";

/**
 * D2 — race de overbooking da matrícula (DB-real). 5 matrículas paralelas na
 * última vaga: com o SELECT ... FOR UPDATE na Turma, exatamente 1 vira `inscrito`
 * e o resto cai em `lista_espera`. Sem o lock, mais de 1 leria capacidade livre e
 * fura a vaga. Espelha o race-test de reservarSlot (medico-agenda.test.ts).
 */

const CPFS = ["90000000001", "90000000002", "90000000003", "90000000004", "90000000005"];
const CURSO_NOME = "ZZ-TEST-CONCORRENCIA";
const TURMA_CODIGO = "ZZ-TEST-CONC-T1";

async function limpar() {
  await db.matricula.deleteMany({ where: { cidadao: { cpf: { in: CPFS } } } });
  const turma = await db.turma.findUnique({ where: { codigo: TURMA_CODIGO } });
  if (turma) {
    await db.matricula.deleteMany({ where: { turmaId: turma.id } });
    await db.turma.delete({ where: { id: turma.id } });
  }
  await db.curso.deleteMany({ where: { nome: CURSO_NOME } });
  await db.cidadao.deleteMany({ where: { cpf: { in: CPFS } } });
}

describe("matricular (concorrência DB-real)", () => {
  let turmaId = "";
  let erickId = "";
  const cidadaoIds: string[] = [];

  beforeAll(async () => {
    await limpar();
    const erick = await db.user.findUniqueOrThrow({
      where: { email: "erick.ramos@familiaponcio.org.br" },
    });
    erickId = erick.id;

    const curso = await db.curso.create({
      data: { nome: CURSO_NOME, area: "teste", cargaHorariaTotal: 10, createdById: erickId },
    });
    const turma = await db.turma.create({
      data: {
        cursoId: curso.id,
        codigo: TURMA_CODIGO,
        dataInicio: new Date("2026-07-01"),
        dataFim: new Date("2026-07-31"),
        capacidade: 1,
        status: "inscricoes_abertas",
      },
    });
    turmaId = turma.id;

    for (let i = 0; i < CPFS.length; i++) {
      const c = await db.cidadao.create({
        data: {
          nomeCompleto: `Teste Concorrência ${i}`,
          cpf: CPFS[i]!,
          dataNascimento: new Date("2000-01-01"),
          telefonePrincipal: "11999990000",
          unitIdOrigem: "capacitacao",
          createdById: erickId,
        },
      });
      cidadaoIds.push(c.id);
    }
  });

  afterAll(async () => {
    await limpar();
  });

  it("5 matrículas paralelas na última vaga → exatamente 1 inscrito, 4 lista_espera", async () => {
    const results = await Promise.all(
      cidadaoIds.map((cidadaoId) => matricular({ turmaId, cidadaoId, createdBy: erickId })),
    );
    const inscritos = results.filter((m) => m.status === "inscrito");
    const espera = results.filter((m) => m.status === "lista_espera");
    expect(inscritos).toHaveLength(1);
    expect(espera).toHaveLength(4);
  });
});
