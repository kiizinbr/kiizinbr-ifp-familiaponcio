import { describe, it, expect } from "vitest";
import {
  ehUrlMidiaReal,
  basenameMidia,
  stemDeBasename,
  mimePorBasename,
} from "../../src/lib/migracao-amplimed/midia";

const URL_REAL =
  "https://amplimedfotospac.s3.sa-east-1.amazonaws.com/33643/ff32a861608a5202a7c2d586550058d3.png";
const URL_PLACEHOLDER = "https://s3-sa-east-1.amazonaws.com/amplimedimggerais/default_profile.png";

describe("ehUrlMidiaReal", () => {
  it("distingue real, placeholder e vazio", () => {
    expect(ehUrlMidiaReal(URL_REAL)).toBe(true);
    expect(ehUrlMidiaReal(URL_PLACEHOLDER)).toBe(false);
    expect(ehUrlMidiaReal("")).toBe(false);
    expect(ehUrlMidiaReal(null)).toBe(false);
  });
});

describe("basenameMidia", () => {
  it("extrai o último segmento (com e sem query)", () => {
    expect(basenameMidia(URL_REAL)).toBe("ff32a861608a5202a7c2d586550058d3.png");
    expect(basenameMidia("https://x/y/z/g7qplx8cka02.jpg?sig=abc")).toBe("g7qplx8cka02.jpg");
    expect(basenameMidia(null)).toBeNull();
    expect(basenameMidia("   ")).toBeNull();
  });
});

describe("stemDeBasename", () => {
  it("remove a extensão (casa jpg↔jpeg)", () => {
    expect(stemDeBasename("abc.png")).toBe("abc");
    expect(stemDeBasename("abc")).toBe("abc");
    expect(stemDeBasename(null)).toBeNull();
  });
});

describe("mimePorBasename", () => {
  it("mapeia só extensões aceitas (PDF/JPG/PNG)", () => {
    expect(mimePorBasename("x.png")).toBe("image/png");
    expect(mimePorBasename("x.jpg")).toBe("image/jpeg");
    expect(mimePorBasename("x.jpeg")).toBe("image/jpeg");
    expect(mimePorBasename("x.PDF")).toBe("application/pdf");
    expect(mimePorBasename("x.gif")).toBeNull();
    expect(mimePorBasename(null)).toBeNull();
  });
});
