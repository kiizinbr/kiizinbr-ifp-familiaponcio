import { describe, it, expect } from "vitest";
import { mapUsuarioParaProfissional } from "../../src/lib/migracao-amplimed/profissional";
import type { UsuarioRow } from "../../src/lib/migracao-amplimed/tipos";

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
