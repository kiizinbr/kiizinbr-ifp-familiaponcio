import { describe, expect, it } from "vitest";
import {
  buildHistoryTimeline,
  type AuditRowInput,
  type CidadaoAnchorInput,
  type ViewerCaps,
} from "@/lib/cidadao-history";

const cidadao: CidadaoAnchorInput = {
  id: "cid-1",
  createdAt: new Date("2026-05-20T10:00:00Z"),
  createdBy: { name: "Maria Recepção", email: "maria@familiaponcio.org.br" },
};

const fullCaps: ViewerCaps = { verSaude: true, verSocio: true };

function row(
  partial: Partial<AuditRowInput> & Pick<AuditRowInput, "id" | "action">,
): AuditRowInput {
  return {
    createdAt: new Date("2026-05-21T12:00:00Z"),
    meta: null,
    user: { name: "Operador", email: "op@familiaponcio.org.br" },
    ...partial,
  };
}

describe("buildHistoryTimeline — âncora sintética", () => {
  it("injeta evento 'Ficha criada' derivado do registro quando o audit log está vazio", () => {
    const tl = buildHistoryTimeline([], cidadao, fullCaps);

    expect(tl).toHaveLength(1);
    expect(tl[0]).toMatchObject({
      action: "ficha_created",
      derivado: true,
      autor: "Maria Recepção",
      data: cidadao.createdAt,
    });
  });

  it("NÃO duplica: havendo ficha_created real no log, não injeta a âncora sintética", () => {
    const real = row({
      id: "a1",
      action: "ficha_created",
      createdAt: new Date("2026-05-20T10:00:00Z"),
      meta: { nomeCompleto: "Fulano" },
      user: { name: "João", email: "joao@familiaponcio.org.br" },
    });

    const tl = buildHistoryTimeline([real], cidadao, fullCaps);
    const criados = tl.filter((e) => e.action === "ficha_created");

    expect(criados).toHaveLength(1);
    expect(criados[0]).toMatchObject({ id: "a1", derivado: false });
  });
});

describe("buildHistoryTimeline — ordenação e mapeamento", () => {
  it("ordena eventos do mais recente pro mais antigo", () => {
    const antigo = row({
      id: "a1",
      action: "ficha_created",
      createdAt: new Date("2026-05-20T10:00:00Z"),
    });
    const recente = row({
      id: "a2",
      action: "anexo_uploaded",
      createdAt: new Date("2026-05-22T09:00:00Z"),
      meta: { fileName: "rg.pdf", cidadaoId: "cid-1" },
    });

    const tl = buildHistoryTimeline([antigo, recente], cidadao, fullCaps);

    expect(tl.map((e) => e.id)).toEqual(["a2", "a1"]);
  });

  it("mapeia anexo_uploaded e anexo_removed com o nome do arquivo no detalhe", () => {
    const up = row({
      id: "a1",
      action: "anexo_uploaded",
      meta: { fileName: "comprovante.pdf", cidadaoId: "cid-1" },
    });
    const rm = row({
      id: "a2",
      action: "anexo_removed",
      meta: { fileName: "rg-antigo.pdf", removed: true },
    });

    const tl = buildHistoryTimeline([up, rm], cidadao, fullCaps);

    expect(tl.find((e) => e.id === "a1")).toMatchObject({ action: "anexo_uploaded" });
    expect(tl.find((e) => e.id === "a1")!.detalhe).toContain("comprovante.pdf");
    expect(tl.find((e) => e.id === "a2")).toMatchObject({ action: "anexo_removed" });
    expect(tl.find((e) => e.id === "a2")!.detalhe).toContain("rg-antigo.pdf");
  });

  it("resolve autor: name → email → 'Sistema'", () => {
    const rows = [
      row({
        id: "a1",
        action: "anexo_uploaded",
        createdAt: new Date("2026-05-23T10:00:00Z"),
        meta: { fileName: "a.pdf" },
        user: { name: "Ana", email: "ana@x.org" },
      }),
      row({
        id: "a2",
        action: "anexo_uploaded",
        createdAt: new Date("2026-05-23T11:00:00Z"),
        meta: { fileName: "b.pdf" },
        user: { name: null, email: "bruno@x.org" },
      }),
      row({
        id: "a3",
        action: "anexo_removed",
        createdAt: new Date("2026-05-23T12:00:00Z"),
        meta: { fileName: "c.pdf" },
        user: null,
      }),
    ];

    const tl = buildHistoryTimeline(rows, cidadao, fullCaps);

    expect(tl.find((e) => e.id === "a1")!.autor).toBe("Ana");
    expect(tl.find((e) => e.id === "a2")!.autor).toBe("bruno@x.org");
    expect(tl.find((e) => e.id === "a3")!.autor).toBe("Sistema");
  });
});

describe("buildHistoryTimeline — redação de campos sensíveis (Refinement B)", () => {
  const updated = (changedFields: string[]) =>
    row({
      id: "u1",
      action: "ficha_updated",
      createdAt: new Date("2026-05-23T10:00:00Z"),
      meta: { changedFields },
      user: { name: "Dr. Ricardo", email: "ricardo@x.org" },
    });

  it("oculta nome de campo de Saúde para quem não pode ver Saúde", () => {
    const tl = buildHistoryTimeline([updated(["telefonePrincipal", "alergias"])], cidadao, {
      verSaude: false,
      verSocio: true,
    });
    const e = tl.find((x) => x.id === "u1")!;

    expect(e.detalhe!.toLowerCase()).toContain("telefone");
    expect(e.detalhe!.toLowerCase()).not.toContain("alergia");
  });

  it("mostra campo de Saúde para quem pode ver Saúde", () => {
    const tl = buildHistoryTimeline([updated(["alergias"])], cidadao, {
      verSaude: true,
      verSocio: true,
    });

    expect(tl.find((x) => x.id === "u1")!.detalhe!.toLowerCase()).toContain("alergia");
  });

  it("oculta campo Socioeconômico para quem não pode ver Socio", () => {
    const tl = buildHistoryTimeline([updated(["rendaFamiliar"])], cidadao, {
      verSaude: true,
      verSocio: false,
    });

    expect(tl.find((x) => x.id === "u1")!.detalhe!.toLowerCase()).not.toContain("renda");
  });
});

describe("buildHistoryTimeline — eventos de triagem (Plano 4)", () => {
  it("mapeia triagem_aberta e triagem_concluida como ações conhecidas", () => {
    const rows = [
      row({ id: "t1", action: "triagem_aberta", createdAt: new Date("2026-05-25T09:00:00Z") }),
      row({ id: "t2", action: "triagem_concluida", createdAt: new Date("2026-05-25T10:00:00Z") }),
    ];

    const tl = buildHistoryTimeline(rows, cidadao, fullCaps);

    expect(tl.find((e) => e.id === "t1")!.action).toBe("triagem_aberta");
    expect(tl.find((e) => e.id === "t2")!.action).toBe("triagem_concluida");
  });

  it("elegibilidade_decidida mostra unidade e status no detalhe", () => {
    const tl = buildHistoryTimeline(
      [
        row({
          id: "e1",
          action: "elegibilidade_decidida",
          meta: { unidade: "medico", status: "aprovado" },
        }),
      ],
      cidadao,
      fullCaps,
    );

    const e = tl.find((x) => x.id === "e1")!;
    expect(e.action).toBe("elegibilidade_decidida");
    expect(e.detalhe!.toLowerCase()).toContain("aprovado");
  });
});
