import { describe, expect, it } from "vitest";
import { validarTrocaSenhaVoluntaria } from "@/lib/senha";

describe("validarTrocaSenhaVoluntaria — exige senha atual fora do 1º acesso", () => {
  it("voluntária com senha atual ERRADA → 'Senha atual incorreta.' (mata takeover por sessão roubada)", () => {
    expect(
      validarTrocaSenhaVoluntaria({
        forcado: false,
        senhaAtualConfere: false,
        novaSenha: "novaSenha9",
        confirma: "novaSenha9",
      }),
    ).toBe("Senha atual incorreta.");
  });

  it("voluntária com senha atual certa + nova válida → null", () => {
    expect(
      validarTrocaSenhaVoluntaria({
        forcado: false,
        senhaAtualConfere: true,
        novaSenha: "novaSenha9",
        confirma: "novaSenha9",
      }),
    ).toBeNull();
  });

  it("forçado (1º acesso) NÃO exige senha atual → valida só a nova", () => {
    expect(
      validarTrocaSenhaVoluntaria({
        forcado: true,
        senhaAtualConfere: false,
        novaSenha: "novaSenha9",
        confirma: "novaSenha9",
      }),
    ).toBeNull();
  });

  it("delega as regras da nova senha (confirmação não bate)", () => {
    expect(
      validarTrocaSenhaVoluntaria({
        forcado: false,
        senhaAtualConfere: true,
        novaSenha: "novaSenha9",
        confirma: "outra",
      }),
    ).toBe("As senhas não conferem.");
  });
});
