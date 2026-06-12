import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { SELECT_CONTEXTO_PACIENTE } from "@/lib/medico/prontuario";

/**
 * Regressão do select da timeline clínica (/medico/pacientes/[id]) — DB-real.
 * O bug: a page selecionava `medicamentos: true`, mas o campo do model Cidadao
 * é `medicamentosEmUso`. `tsc` NÃO pega isso (o SelectSubset do Prisma aceita
 * campo inexistente no select); só estoura em runtime como
 * PrismaClientValidationError — então o gate é este teste de integração, que
 * executa EXATAMENTE o select da page (compartilhado via SELECT_CONTEXTO_PACIENTE)
 * contra o Postgres dev. Espelha o setup/limpeza de
 * capacitacao-matricula-concorrencia.test.ts.
 */

const CPF = "90000000050";

async function limpar() {
  await db.cidadao.deleteMany({ where: { cpf: CPF } });
}

describe("timeline clínica — select do contexto do paciente (DB-real)", () => {
  let cidadaoId = "";

  beforeAll(async () => {
    await limpar();
    const erick = await db.user.findUniqueOrThrow({
      where: { email: "erick.ramos@familiaponcio.org.br" },
    });
    const cidadao = await db.cidadao.create({
      data: {
        nomeCompleto: "Teste Timeline Medicamentos",
        cpf: CPF,
        dataNascimento: new Date("1990-01-01"),
        telefonePrincipal: "11999990000",
        unitIdOrigem: "medico",
        createdById: erick.id,
        medicamentosEmUso: "Losartana 50mg 1x/dia",
      },
    });
    cidadaoId = cidadao.id;
  });

  afterAll(async () => {
    await limpar();
  });

  it("executa o select exato da page e devolve medicamentosEmUso (campo real do model)", async () => {
    // Act: mesma chamada da page (findUnique + SELECT_CONTEXTO_PACIENTE)
    const cidadao = await db.cidadao.findUnique({
      where: { id: cidadaoId },
      select: SELECT_CONTEXTO_PACIENTE,
    });

    // Assert: o campo clínico volta do banco — com o select errado
    // (`medicamentos`) esta query rejeitaria com PrismaClientValidationError.
    expect(cidadao).not.toBeNull();
    expect(cidadao?.medicamentosEmUso).toBe("Losartana 50mg 1x/dia");
    expect(cidadao?.nomeCompleto).toBe("Teste Timeline Medicamentos");
  });

  it("regressão: campo inexistente no select (o bug original) → PrismaClientValidationError", async () => {
    // Arrange: reproduz o select bugado — `medicamentos` não existe no model.
    // Variável (não literal) espelha como o SelectSubset deixa isso compilar.
    const selectComCampoErrado = { ...SELECT_CONTEXTO_PACIENTE, medicamentos: true };

    // Act + Assert: o Prisma valida em runtime e rejeita — é o erro que a
    // page produzia em produção e que tsc nunca apontou.
    await expect(
      db.cidadao.findUnique({ where: { id: cidadaoId }, select: selectComCampoErrado }),
    ).rejects.toBeInstanceOf(Prisma.PrismaClientValidationError);
  });
});
