import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TEMAS_CASA, ehTemaCasa, temaCasaDoSlug } from "@/lib/tema-casa";
import { UNIDADE_SLUGS } from "@/lib/unidades";

describe("tema CASA — helper de tematização por unidade", () => {
  it("os temas CASA são exatamente os slugs canônicos das unidades (estratégia A)", () => {
    expect(TEMAS_CASA).toEqual(UNIDADE_SLUGS);
  });

  it("aceita todo slug canônico", () => {
    for (const slug of UNIDADE_SLUGS) {
      expect(ehTemaCasa(slug)).toBe(true);
      expect(temaCasaDoSlug(slug)).toBe(slug);
    }
  });

  it("rejeita slug inválido/ausente sem inventar tema (cai no default Corte)", () => {
    expect(ehTemaCasa("educacional")).toBe(false); // nome do protótipo CASA, não da main
    expect(ehTemaCasa("xpto")).toBe(false);
    expect(ehTemaCasa("")).toBe(false);
    expect(temaCasaDoSlug(null)).toBeNull();
    expect(temaCasaDoSlug(undefined)).toBeNull();
    expect(temaCasaDoSlug("light")).toBeNull(); // valor do data-theme do <html>, não é unidade
  });
});

describe("casa-tokens.css — contrato do data-unit por unidade", () => {
  const css = readFileSync(join(process.cwd(), "src/styles/casa-tokens.css"), "utf8");

  it("toda unidade canônica tem bloco [data-unit] próprio", () => {
    for (const slug of UNIDADE_SLUGS) {
      expect(css).toContain(`[data-unit="${slug}"]`);
    }
  });

  it("fix crítico: aliases re-resolvidos no elemento que carrega o tema", () => {
    // Sem isto o data-unit num <div> não tem efeito (alias congela no :root).
    const blocoCombinado = css.match(/\[data-unit="medico"\],[\s\S]*?\}/);
    expect(blocoCombinado).not.toBeNull();
    expect(blocoCombinado![0]).toContain("--casa-primary: var(--unidade)");
    expect(blocoCombinado![0]).toContain("--casa-primary-hover: var(--unidade-escuro)");
    expect(blocoCombinado![0]).toContain("--accent: var(--unidade)");
  });

  it("camada CASA está importada no globals.css", () => {
    const globals = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(globals).toContain('@import "../styles/casa-tokens.css"');
    expect(globals).toContain("@theme inline");
  });
});
