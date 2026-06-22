import {
  alergiaCasaMedicamento,
  temConflitoAlergia,
  verificarConflitoAlergia,
  type AlergiaAtiva,
} from "./alergia-check";

const alergia = (
  descricao: string,
  gravidade: AlergiaAtiva["gravidade"] = null,
  id = descricao,
): AlergiaAtiva => ({ id, descricao, gravidade });

describe("alergiaCasaMedicamento", () => {
  it("casa nome exato, sem ligar para caixa", () => {
    expect(alergiaCasaMedicamento("Dipirona", "dipirona")).toBe(true);
    expect(alergiaCasaMedicamento("PENICILINA", "Penicilina")).toBe(true);
  });

  it("ignora acentos e pontuação", () => {
    expect(alergiaCasaMedicamento("Ácido", "acido folico")).toBe(true);
    expect(alergiaCasaMedicamento("Dipirona,", "Dipirona.")).toBe(true);
  });

  it("casa o medicamento com dose/sufixo (raiz dentro do token)", () => {
    expect(alergiaCasaMedicamento("Dipirona", "Dipirona Sódica 500mg")).toBe(true);
    expect(alergiaCasaMedicamento("Sulfa", "Sulfametoxazol + Trimetoprima")).toBe(true);
  });

  it("token curto (<5 letras) exige match exato de palavra", () => {
    expect(alergiaCasaMedicamento("AAS", "AAS 100mg")).toBe(true);
    expect(alergiaCasaMedicamento("AAS", "Salbutamol")).toBe(false);
  });

  it("não dá falso positivo entre nomes diferentes", () => {
    expect(alergiaCasaMedicamento("Ibuprofeno", "Paracetamol")).toBe(false);
    // LIMITAÇÃO CONHECIDA (classe): por NOME, penicilina não casa amoxicilina
    expect(alergiaCasaMedicamento("Penicilina", "Amoxicilina")).toBe(false);
  });

  it("descrição vazia ou só espaços não casa", () => {
    expect(alergiaCasaMedicamento("", "Dipirona")).toBe(false);
    expect(alergiaCasaMedicamento("   ", "Dipirona")).toBe(false);
  });
});

describe("verificarConflitoAlergia", () => {
  const alergias = [alergia("Dipirona", "GRAVE", "a1"), alergia("Sulfa", "MODERADA", "a2")];

  it("aponta o conflito com alergia e gravidade certas", () => {
    const conflitos = verificarConflitoAlergia([{ medicamento: "Dipirona 500mg" }], alergias);
    expect(conflitos).toHaveLength(1);
    expect(conflitos[0]).toMatchObject({
      alergiaId: "a1",
      alergiaDescricao: "Dipirona",
      gravidade: "GRAVE",
    });
  });

  it("sem alergias ativas, nunca há conflito", () => {
    expect(verificarConflitoAlergia([{ medicamento: "Dipirona 500mg" }], [])).toEqual([]);
  });

  it("medicamento seguro não gera conflito", () => {
    expect(verificarConflitoAlergia([{ medicamento: "Paracetamol 750mg" }], alergias)).toEqual([]);
  });

  it("detecta múltiplos conflitos (vários itens × várias alergias)", () => {
    const conflitos = verificarConflitoAlergia(
      [
        { medicamento: "Dipirona Sódica" },
        { medicamento: "Bactrim (Sulfametoxazol)" },
        { medicamento: "Amoxicilina" },
      ],
      alergias,
    );
    expect(conflitos).toHaveLength(2);
    expect(conflitos.map((c) => c.alergiaId).sort()).toEqual(["a1", "a2"]);
  });

  it("temConflitoAlergia é o atalho booleano usado pela porta do bloqueio", () => {
    expect(temConflitoAlergia([{ medicamento: "Dipirona" }], alergias)).toBe(true);
    expect(temConflitoAlergia([{ medicamento: "Losartana" }], alergias)).toBe(false);
  });
});
