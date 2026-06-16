import { describe, expect, it } from "vitest";
import { parseSoap, serializeSoap, type SecoesSoap } from "@/lib/medico/soap";

// #18 — núcleo PURO do SOAP (sem DB), molde de medico-prontuario-puro.test.ts.
// Blinda o FORMATO do campo `texto`: round-trip serialize(parse(x)), nota legada
// intacta no modo livre, preâmbulo→Subjetivo, seção vazia não emite cabeçalho,
// aliases de leitura (Conduta→Plano, acento). A fonte de verdade continua sendo
// UM `texto`; o servidor nunca inspeciona o conteúdo.

describe("parseSoap — detecção de modo", () => {
  it("nota legada sem marcador → modo livre, texto intacto", () => {
    const legado = "Paciente refere cefaleia há 2 dias.\nNega febre.\n<br>HAS prévia";
    const r = parseSoap(legado);
    expect(r.modo).toBe("livre");
    expect(r.livre).toBe(legado);
    expect(r.s).toBe("");
    expect(r.o).toBe("");
    expect(r.a).toBe("");
    expect(r.p).toBe("");
  });

  it("string vazia/null/undefined → modo livre vazio", () => {
    expect(parseSoap("").modo).toBe("livre");
    expect(parseSoap(null).livre).toBe("");
    expect(parseSoap(undefined).livre).toBe("");
  });

  it("≥1 marcador reconhecido → modo soap", () => {
    const r = parseSoap("## Subjetivo\nDor de cabeça");
    expect(r.modo).toBe("soap");
    expect(r.s).toBe("Dor de cabeça");
  });

  it("separa as 4 seções canônicas", () => {
    const texto = [
      "## Subjetivo",
      "queixa",
      "## Objetivo",
      "PA 120x80",
      "## Avaliação",
      "cefaleia tensional",
      "## Plano",
      "dipirona",
    ].join("\n");
    const r = parseSoap(texto);
    expect(r.modo).toBe("soap");
    expect(r.s).toBe("queixa");
    expect(r.o).toBe("PA 120x80");
    expect(r.a).toBe("cefaleia tensional");
    expect(r.p).toBe("dipirona");
  });

  it("preâmbulo antes do 1º marcador → anexado ao Subjetivo (nunca se perde)", () => {
    // ≥2 marcadores → SOAP pela heurística endurecida; o preâmbulo antes do 1º
    // cabeçalho vai pro Subjetivo e nunca se perde.
    const texto = [
      "Anotação solta no topo",
      "## Objetivo",
      "exame normal",
      "## Plano",
      "repouso",
    ].join("\n");
    const r = parseSoap(texto);
    expect(r.modo).toBe("soap");
    expect(r.s).toBe("Anotação solta no topo");
    expect(r.o).toBe("exame normal");
    expect(r.p).toBe("repouso");
  });

  it("preserva quebras de linha internas de cada seção", () => {
    const texto = ["## Subjetivo", "linha 1", "", "linha 3"].join("\n");
    const r = parseSoap(texto);
    expect(r.s).toBe("linha 1\n\nlinha 3");
  });
});

describe("parseSoap — aliases e acentos (só LEITURA)", () => {
  it("Conduta é lida como Plano", () => {
    const r = parseSoap("## Conduta\nretorno em 7 dias");
    expect(r.p).toBe("retorno em 7 dias");
    expect(r.a).toBe("");
  });

  it("marcador sem acento (Avaliacao) casa Avaliação", () => {
    const r = parseSoap("## Avaliacao\nHAS controlada");
    expect(r.a).toBe("HAS controlada");
  });

  it("tolera espaçamento (##Subjetivo, ##  Plano  )", () => {
    const r = parseSoap("##Subjetivo\nx\n##  Plano  \ny");
    expect(r.s).toBe("x");
    expect(r.p).toBe("y");
  });

  it("case-insensitive nos rótulos (## subjetivo)", () => {
    const r = parseSoap("## subjetivo\nminúsculo");
    expect(r.s).toBe("minúsculo");
  });
});

describe("serializeSoap", () => {
  it("emite só seções não-vazias, ordem canônica S→O→A→P", () => {
    const out = serializeSoap({ s: "queixa", o: "", a: "dx", p: "" });
    expect(out).toBe("## Subjetivo\nqueixa\n\n## Avaliação\ndx");
  });

  it("tudo vazio → string vazia (action converte em null)", () => {
    expect(serializeSoap({ s: "", o: "", a: "", p: "" })).toBe("");
    expect(serializeSoap({ s: "   ", o: "\n", a: "", p: " " })).toBe("");
  });

  it("escrita é sempre canônica com acento (## Avaliação)", () => {
    const out = serializeSoap({ s: "", o: "", a: "x", p: "" });
    expect(out).toContain("## Avaliação");
  });

  it("blocos separados por linha em branco", () => {
    const out = serializeSoap({ s: "a", o: "b", a: "c", p: "d" });
    expect(out).toBe("## Subjetivo\na\n\n## Objetivo\nb\n\n## Avaliação\nc\n\n## Plano\nd");
  });
});

describe("round-trip serialize(parse(x))", () => {
  const casos: SecoesSoap[] = [
    { s: "queixa", o: "exame", a: "dx", p: "conduta" },
    { s: "só subjetivo", o: "", a: "", p: "" },
    { s: "", o: "", a: "avaliação isolada", p: "" },
    { s: "linha 1\nlinha 2", o: "obj", a: "", p: "plano\ncom quebra" },
  ];
  for (const c of casos) {
    it(`estável p/ ${JSON.stringify(c).slice(0, 40)}`, () => {
      const serial = serializeSoap(c);
      const parsed = parseSoap(serial);
      expect(parsed.modo).toBe("soap");
      const reserial = serializeSoap(parsed);
      expect(reserial).toBe(serial);
    });
  }

  it("nota livre round-trip: parse → não-soap → texto cru preservado", () => {
    const legado = "Texto livre sem marcadores.\nSegunda linha.";
    const parsed = parseSoap(legado);
    expect(parsed.modo).toBe("livre");
    // No modo livre o editor usa `livre` (passthrough de 1 caixa) — o `texto`
    // submetido continua sendo exatamente o original.
    expect(parsed.livre).toBe(legado);
  });
});

describe("heurística endurecida — nota legada com 1 marcador no MEIO ≠ SOAP", () => {
  it("nota legada com um único '## Subjetivo' fora da 1ª linha → modo livre intacto", () => {
    // Caso raríssimo: nota legada que por acaso contém UMA linha "## Subjetivo"
    // no meio do texto. Antes era mislabelada como SOAP (e podia reordenar/rotular
    // visualmente). Agora exige ≥2 marcadores distintos OU marcador na 1ª linha —
    // este não satisfaz nenhum → fica como nota livre, texto cru preservado.
    const legado = ["Evolução do paciente.", "## Subjetivo", "segue estável"].join("\n");
    const r = parseSoap(legado);
    expect(r.modo).toBe("livre");
    expect(r.livre).toBe(legado); // nenhum byte descartado
    expect(r.s).toBe("");
  });

  it("marcador logo na 1ª linha → SOAP (é o que o editor sempre gera)", () => {
    // serializeSoap emite o 1º cabeçalho na linha 0, então toda nota do editor
    // cai aqui mesmo com uma só seção preenchida — zero regressão.
    const r = parseSoap("## Subjetivo\nDor de cabeça");
    expect(r.modo).toBe("soap");
    expect(r.s).toBe("Dor de cabeça");
  });

  it("≥2 marcadores canônicos distintos no meio → SOAP", () => {
    const texto = ["Preâmbulo legado", "## Objetivo", "PA 120x80", "## Plano", "dipirona"].join(
      "\n",
    );
    const r = parseSoap(texto);
    expect(r.modo).toBe("soap");
    expect(r.s).toBe("Preâmbulo legado"); // preâmbulo preservado no Subjetivo
    expect(r.o).toBe("PA 120x80");
    expect(r.p).toBe("dipirona");
  });

  it("mesmo marcador repetido (não distinto) fora da 1ª linha NÃO basta → livre", () => {
    // Dois "## Subjetivo" são o MESMO canônico (set tem tamanho 1) e nenhum está
    // na 1ª linha → continua nota livre.
    const legado = ["nota antiga", "## Subjetivo", "a", "## Subjetivo", "b"].join("\n");
    const r = parseSoap(legado);
    expect(r.modo).toBe("livre");
    expect(r.livre).toBe(legado);
  });
});
