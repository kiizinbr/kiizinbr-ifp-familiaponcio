import { describe, it, expect } from "vitest";
import { mapPacienteParaCidadao } from "../../src/lib/migracao-amplimed/cidadao";
import type { PacienteRow } from "../../src/lib/migracao-amplimed/tipos";

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
