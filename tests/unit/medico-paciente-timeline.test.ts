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

// Datas-sentinela dos slots de teste (ordenação por data clínica — F2).
// Fixas e antigas o bastante pra não colidir com dado real; a limpeza de slots
// filtra por elas + consulta órfã, então nunca toca slot real em uso.
const DATA_CLINICA_ANTIGA = new Date("2003-03-03T11:00:00.000Z");
const DATA_CLINICA_NOVA = new Date("2003-03-04T11:00:00.000Z");

async function limpar() {
  // Ordem respeita os onDelete: Restrict (nota → consulta → slot → cidadão).
  await db.notaEvolucao.deleteMany({ where: { cidadao: { cpf: CPF } } });
  await db.consulta.deleteMany({ where: { cidadao: { cpf: CPF } } });
  await db.slot.deleteMany({
    where: {
      dataHoraInicio: { in: [DATA_CLINICA_ANTIGA, DATA_CLINICA_NOVA] },
      consulta: { is: null },
    },
  });
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

  it("ordena a timeline pela data CLÍNICA (slot.dataHoraInicio), não por createdAt da nota", async () => {
    // Arrange: 2 notas assinadas com createdAt INVERTIDO em relação à data
    // clínica — o cenário real das ~94k notas migradas da Amplimed, onde
    // createdAt é a data em que a migração RODOU, não a data do atendimento.
    const erick = await db.user.findUniqueOrThrow({
      where: { email: "erick.ramos@familiaponcio.org.br" },
    });
    const profissional = await db.profissional.findFirstOrThrow();
    const especialidade = await db.especialidade.findFirstOrThrow();

    const casos = [
      // atendimento mais ANTIGO chegou por último na migração (createdAt maior)
      { dataClinica: DATA_CLINICA_ANTIGA, createdAt: new Date("2026-06-02T00:00:00.000Z") },
      // atendimento mais NOVO chegou primeiro na migração (createdAt menor)
      { dataClinica: DATA_CLINICA_NOVA, createdAt: new Date("2026-06-01T00:00:00.000Z") },
    ];
    for (const caso of casos) {
      const slot = await db.slot.create({
        data: {
          profissionalId: profissional.id,
          especialidadeId: especialidade.id,
          dataHoraInicio: caso.dataClinica,
          duracaoMin: 30,
          status: "realizado",
        },
      });
      const consulta = await db.consulta.create({
        data: {
          slotId: slot.id,
          cidadaoId,
          profissionalId: profissional.id,
          especialidadeId: especialidade.id,
          status: "realizada",
          createdBy: erick.id,
        },
      });
      await db.notaEvolucao.create({
        data: {
          consultaId: consulta.id,
          cidadaoId,
          profissionalId: profissional.id,
          texto: `Atendimento de ${caso.dataClinica.toISOString().slice(0, 10)}`,
          status: "assinada",
          assinadaEm: caso.dataClinica,
          assinadaPor: erick.id,
          createdAt: caso.createdAt,
        },
      });
    }

    // Act: a query exata da page /medico/pacientes/[id] (include + orderBy
    // aninhado to-one). tsc não valida orderBy aninhado em runtime — este
    // teste é o gate de que o Prisma/PG aceita e ordena de fato.
    const notas = await db.notaEvolucao.findMany({
      where: { cidadaoId, status: "assinada" },
      include: {
        consulta: {
          include: {
            especialidade: { select: { nome: true } },
            slot: { select: { dataHoraInicio: true } },
          },
        },
        profissional: { select: { nomeExibicao: true } },
        diagnosticos: true,
      },
      orderBy: { consulta: { slot: { dataHoraInicio: "desc" } } },
    });

    // Assert: data clínica desc — a nota do atendimento mais novo vem primeiro…
    expect(notas).toHaveLength(2);
    expect(notas[0]?.consulta.slot.dataHoraInicio.toISOString()).toBe(
      DATA_CLINICA_NOVA.toISOString(),
    );
    expect(notas[1]?.consulta.slot.dataHoraInicio.toISOString()).toBe(
      DATA_CLINICA_ANTIGA.toISOString(),
    );
    // …e a regressão: por createdAt desc a ordem seria a INVERSA.
    expect(notas[0]!.createdAt.getTime()).toBeLessThan(notas[1]!.createdAt.getTime());
  });
});
