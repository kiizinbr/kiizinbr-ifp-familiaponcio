import { describe, it, expect } from "vitest";
import {
  parseLinhaAluno,
  normalizeNome,
  normalizeTelefone,
  mapStatusMatricula,
  normalizarAluno,
} from "@/lib/capacitacao/import-alunos";

/**
 * Importador da planilha legada de alunas (dry-run, sem banco). Núcleo puro.
 */

describe("parseLinhaAluno", () => {
  it("parseia uma linha normal de 8 colunas", () => {
    const r = parseLinhaAluno(
      "JULIANE HELENA ,,989605951,PISTOIA LT17 QD 76,Corte e Costura,Jardim Gramacho,Tarde,Cursando",
    );
    expect(r).not.toBeNull();
    expect(r!.nome).toBe("JULIANE HELENA");
    expect(r!.telefone).toBe("989605951");
    expect(r!.endereco).toBe("PISTOIA LT17 QD 76");
    expect(r!.curso).toBe("Corte e Costura");
    expect(r!.turno).toBe("Tarde");
    expect(r!.status).toBe("Cursando");
  });

  it("recupera o endereço quando ele tem vírgula (linha de 9 colunas)", () => {
    const r = parseLinhaAluno("MARIA ,,9999,RUA X, 123,Manicure,Centro,Manhã,Cursando");
    expect(r!.endereco).toBe("RUA X, 123");
    expect(r!.curso).toBe("Manicure");
    expect(r!.status).toBe("Cursando");
  });

  it("retorna null para linha curta ou nome vazio", () => {
    expect(parseLinhaAluno("a,b,c")).toBeNull();
    expect(parseLinhaAluno(",,9999,end,Curso,Bairro,Manhã,Cursando")).toBeNull();
  });
});

describe("normalizeTelefone", () => {
  it("prefixa DDD 21 quando vem sem DDD (8-9 dígitos)", () => {
    expect(normalizeTelefone("989605951")).toBe("21989605951");
    expect(normalizeTelefone("99062091")).toBe("2199062091");
  });
  it("mantém quando já tem DDD (10-11 dígitos)", () => {
    expect(normalizeTelefone("21989605951")).toBe("21989605951");
  });
  it("null para inválido", () => {
    expect(normalizeTelefone("")).toBeNull();
    expect(normalizeTelefone("123")).toBeNull();
  });
});

describe("normalizeNome", () => {
  it("trim + colapsa espaços", () => {
    expect(normalizeNome("  MARIA   DA  SILVA ")).toBe("MARIA DA SILVA");
  });
});

describe("mapStatusMatricula", () => {
  it("mapeia Cursando/Concluído/Formado/Desistente", () => {
    expect(mapStatusMatricula("Cursando")).toBe("cursando");
    expect(mapStatusMatricula("Concluído")).toBe("concluido");
    expect(mapStatusMatricula("Formado")).toBe("concluido");
    expect(mapStatusMatricula("Formada")).toBe("concluido");
    expect(mapStatusMatricula("Desistente")).toBe("desistente");
  });
  it("null para desconhecido", () => {
    expect(mapStatusMatricula("???")).toBeNull();
  });
});

describe("normalizarAluno", () => {
  it("coleta problemas (telefone inválido, curso ausente, status desconhecido)", () => {
    const n = normalizarAluno({
      nome: "X ",
      email: "",
      telefone: "abc",
      endereco: "e",
      curso: "",
      bairro: "b",
      turno: "t",
      status: "???",
    });
    expect(n.problemas).toContain("telefone inválido ou ausente");
    expect(n.problemas).toContain("curso ausente");
    expect(n.problemas.some((p) => p.includes("status não reconhecido"))).toBe(true);
  });

  it("telefone sem DDD (9 dígitos) → marca DDD inferido, mas normaliza o valor (B9)", () => {
    const n = normalizarAluno({
      nome: "Maria",
      email: "",
      telefone: "989605951",
      endereco: "Rua X",
      curso: "Manicure",
      bairro: "Centro",
      turno: "Manhã",
      status: "Cursando",
    });
    // valor gravado segue idêntico (não muda o dry-run), só ganha visibilidade
    expect(n.telefone).toBe("21989605951");
    expect(n.status).toBe("cursando");
    expect(n.problemas.some((p) => p.includes("DDD inferido"))).toBe(true);
    // não acusa telefone inválido nem curso ausente
    expect(n.problemas).not.toContain("telefone inválido ou ausente");
    expect(n.problemas).not.toContain("curso ausente");
  });

  it("telefone com DDD (11 dígitos) → sem problema de DDD inferido (B9)", () => {
    const n = normalizarAluno({
      nome: "Maria",
      email: "",
      telefone: "21989605951",
      endereco: "Rua X",
      curso: "Manicure",
      bairro: "Centro",
      turno: "Manhã",
      status: "Cursando",
    });
    expect(n.problemas).toHaveLength(0);
    expect(n.telefone).toBe("21989605951");
    expect(n.status).toBe("cursando");
  });
});
