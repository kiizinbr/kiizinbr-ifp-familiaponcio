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

  // Decisão 2026-06-07 (checkpoint Erick): migrar TODOS os pacientes relaxando
  // constraints. Telefone histórico ausente é comum → vira null e NÃO bloqueia.
  it("sem telefone: telefonePrincipal null, não vira problema", () => {
    const c = mapPacienteParaCidadao({ ...base, celular: null, telf: null });
    expect(c.telefonePrincipal).toBeNull();
    expect(c.problemas.some((p) => /telefone/i.test(p))).toBe(false);
    expect(c.problemas).toEqual([]);
  });

  it("paciente sem CPF (nTemCpf) não vira problema, cpf=null", () => {
    const c = mapPacienteParaCidadao({ ...base, cpf: null, nTemCpf: "true" });
    expect(c.cpf).toBeNull();
    expect(c.problemas).toEqual([]);
  });

  // 30 pacientes sem nome → placeholder, mas sinalizado p/ revisão futura.
  it("sem nome: aplica placeholder e sinaliza p/ revisão", () => {
    const c = mapPacienteParaCidadao({ ...base, nome: "" });
    expect(c.nomeCompleto).toBe("(nome não informado)");
    expect(c.problemas.some((p) => /nome/i.test(p))).toBe(true);
  });

  // Data inválida não bloqueia: dataNascimento vira null, mas fica sinalizada.
  it("data inválida: dataNascimento null, sinalizada p/ revisão", () => {
    const c = mapPacienteParaCidadao({ ...base, dtnasc: "32/13/1990" });
    expect(c.dataNascimento).toBeNull();
    expect(c.problemas.some((p) => /data/i.test(p))).toBe(true);
  });
});
