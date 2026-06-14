import { beforeEach, describe, expect, it, vi } from "vitest";

// emitirReceitaAction (orquestração) via mock. O foco: N itens do hidden
// `itensJson` viram um único receita.create com itens:{create:[...N...]}; e o
// fallback legado (itensJson ausente) grava 1 item dos campos planos. RBAC/auth e
// snapshot estão cobertos pelo gate + medico-rbac.test.ts; aqui mockamos auth pra
// chegar no create. Molde: medico-prontuario-mock.test.ts (vi.hoisted + vi.mock).

const { dbMock, redirectMock, logEventMock } = vi.hoisted(() => {
  const f = () => vi.fn();
  const db = {
    consulta: { findUniqueOrThrow: f() },
    receita: { create: f() },
  };
  // redirect() do Next lança internamente pra interromper a action; replicamos
  // isso lançando um erro tagueado pra distinguir o destino sem rodar o create.
  const redirect = vi.fn((url: string) => {
    throw new Error(`__redirect__:${url}`);
  });
  const logEvent = vi.fn().mockResolvedValue(undefined);
  return { dbMock: db, redirectMock: redirect, logEventMock: logEvent };
});

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: "user-X", roles: [{ name: "profissional", unitScope: "medico" }] },
    expires: "2099-01-01",
  }),
}));
vi.mock("@/lib/rbac", () => ({
  canAccessUnidade: vi.fn().mockReturnValue(true),
}));
vi.mock("@/lib/medico/rbac", () => ({
  podeEmitirDocumento: vi.fn().mockReturnValue(true),
}));
vi.mock("@/lib/audit", () => ({ logEvent: logEventMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import { emitirReceitaAction } from "@/app/medico/consultas/[id]/documento-actions";

const CONSULTA = {
  id: "c1",
  consultaId: "c1",
  cidadaoId: "cid1",
  profissionalId: "prof1",
  cidadao: { nomeCompleto: "Maria Silva", nomeSocial: null },
  profissional: {
    id: "prof1",
    userId: "user-X",
    nomeExibicao: "Dr. House",
    conselho: "CRM-RJ",
    nroConselho: "12345",
  },
};

function reset() {
  dbMock.consulta.findUniqueOrThrow.mockReset();
  dbMock.receita.create.mockReset();
  redirectMock.mockClear();
  logEventMock.mockClear();
  dbMock.consulta.findUniqueOrThrow.mockResolvedValue(CONSULTA);
  dbMock.receita.create.mockResolvedValue({ id: "rec1" });
}

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

describe("emitirReceitaAction — itensJson multi-item", () => {
  beforeEach(reset);

  it("N itens viram itens:{create:[...N...]} num único receita.create", async () => {
    const itens = [
      { medicamento: "Amoxicilina", posologia: "1 comp 8/8h", quantidade: "1 cx", via: "Oral" },
      { medicamento: "Dipirona", posologia: "1 comp se dor" },
      { medicamento: "Omeprazol", posologia: "1 comp em jejum" },
    ];
    // redirect(?doc=ok) é o último passo e lança — ok, já fez o create antes.
    await expect(
      emitirReceitaAction(fd({ consultaId: "c1", itensJson: JSON.stringify(itens) })),
    ).rejects.toThrow("__redirect__:/medico/consultas/c1?doc=ok");

    expect(dbMock.receita.create).toHaveBeenCalledTimes(1);
    const arg = dbMock.receita.create.mock.calls[0]?.[0] as {
      data: {
        nomePaciente: string;
        itens: { create: { medicamento: string; quantidade: string | null; via: string | null }[] };
      };
    };
    expect(arg.data.itens.create).toHaveLength(3);
    expect(arg.data.itens.create.map((i) => i.medicamento)).toEqual([
      "Amoxicilina",
      "Dipirona",
      "Omeprazol",
    ]);
    // quantidade/via vazios normalizados para null.
    expect(arg.data.itens.create[1]?.quantidade).toBeNull();
    expect(arg.data.itens.create[1]?.via).toBeNull();
    // snapshot congelado do paciente/profissional.
    expect(arg.data.nomePaciente).toBe("Maria Silva");
  });

  it("itensJson vazio ([]) → erro_receita, sem create", async () => {
    await expect(emitirReceitaAction(fd({ consultaId: "c1", itensJson: "[]" }))).rejects.toThrow(
      "__redirect__:/medico/consultas/c1?doc=erro_receita",
    );
    expect(dbMock.receita.create).not.toHaveBeenCalled();
  });

  it("itensJson malformado (JSON inválido) → erro_receita, sem create (nunca 500)", async () => {
    await expect(
      emitirReceitaAction(fd({ consultaId: "c1", itensJson: "{nao eh json" })),
    ).rejects.toThrow("__redirect__:/medico/consultas/c1?doc=erro_receita");
    expect(dbMock.receita.create).not.toHaveBeenCalled();
  });

  it("item sem posologia → erro_receita, sem create", async () => {
    const itens = [{ medicamento: "Amoxicilina", posologia: "" }];
    await expect(
      emitirReceitaAction(fd({ consultaId: "c1", itensJson: JSON.stringify(itens) })),
    ).rejects.toThrow("__redirect__:/medico/consultas/c1?doc=erro_receita");
    expect(dbMock.receita.create).not.toHaveBeenCalled();
  });
});

describe("emitirReceitaAction — fallback legado (itensJson ausente)", () => {
  beforeEach(reset);

  it("campos planos → grava 1 item", async () => {
    await expect(
      emitirReceitaAction(
        fd({
          consultaId: "c1",
          medicamento: "Paracetamol",
          posologia: "1 comp 6/6h",
          quantidade: "1 cx",
          via: "Oral",
        }),
      ),
    ).rejects.toThrow("__redirect__:/medico/consultas/c1?doc=ok");

    expect(dbMock.receita.create).toHaveBeenCalledTimes(1);
    const arg = dbMock.receita.create.mock.calls[0]?.[0] as {
      data: { itens: { create: { medicamento: string }[] } };
    };
    expect(arg.data.itens.create).toHaveLength(1);
    expect(arg.data.itens.create[0]?.medicamento).toBe("Paracetamol");
  });

  it("fallback sem medicamento/posologia → erro_receita, sem create", async () => {
    await expect(emitirReceitaAction(fd({ consultaId: "c1", medicamento: "  " }))).rejects.toThrow(
      "__redirect__:/medico/consultas/c1?doc=erro_receita",
    );
    expect(dbMock.receita.create).not.toHaveBeenCalled();
  });
});
