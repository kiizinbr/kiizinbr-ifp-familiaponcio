import { describe, expect, it } from "vitest";
import {
  novoPacienteSchema,
  novoPacienteParaCidadaoInput,
} from "@/lib/medico/novo-paciente-schema";

// Fatia 2 — "Novo paciente" no passo 1 do wizard. Form mínimo (nome, CPF,
// data nascimento, telefone) → vira CidadaoCreateInput com unitIdOrigem=medico,
// reaproveitando o cidadaoCreateSchema/createCidadaoAction (sem duplicar).

const valido = {
  nomeCompleto: "Maria da Silva",
  cpf: "123.456.789-09",
  dataNascimento: "1990-05-20",
  telefonePrincipal: "11999998888",
};

describe("novoPacienteSchema", () => {
  it("aceita payload mínimo válido e normaliza o CPF (só dígitos)", () => {
    const parsed = novoPacienteSchema.safeParse(valido);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.cpf).toBe("12345678909");
      expect(parsed.data.nomeCompleto).toBe("Maria da Silva");
    }
  });

  it("rejeita nome vazio", () => {
    const parsed = novoPacienteSchema.safeParse({ ...valido, nomeCompleto: "   " });
    expect(parsed.success).toBe(false);
  });

  it("rejeita CPF com dígito verificador inválido", () => {
    const parsed = novoPacienteSchema.safeParse({ ...valido, cpf: "111.111.111-11" });
    expect(parsed.success).toBe(false);
  });

  it("rejeita data de nascimento em formato inválido", () => {
    const parsed = novoPacienteSchema.safeParse({ ...valido, dataNascimento: "20/05/1990" });
    expect(parsed.success).toBe(false);
  });

  it("rejeita telefone vazio", () => {
    const parsed = novoPacienteSchema.safeParse({ ...valido, telefonePrincipal: "" });
    expect(parsed.success).toBe(false);
  });
});

describe("novoPacienteParaCidadaoInput", () => {
  it("monta CidadaoCreateInput com unitIdOrigem=medico e sem endereços", () => {
    const parsed = novoPacienteSchema.parse(valido);
    const input = novoPacienteParaCidadaoInput(parsed);
    expect(input).toEqual({
      nomeCompleto: "Maria da Silva",
      cpf: "12345678909",
      dataNascimento: "1990-05-20",
      telefonePrincipal: "11999998888",
      rendaFamiliar: "",
      pessoasNaCasa: "",
      unitIdOrigem: "medico",
      enderecos: [],
    });
  });

  it("a saída do mapper passa no cidadaoCreateSchema (reuso real, não duplicação)", async () => {
    const { cidadaoCreateSchema } = await import("@/lib/cidadao-schema");
    const parsed = novoPacienteSchema.parse(valido);
    const input = novoPacienteParaCidadaoInput(parsed);
    expect(cidadaoCreateSchema.safeParse(input).success).toBe(true);
  });
});
