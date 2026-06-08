import { describe, it, expect } from "vitest";
import { buttonClassName } from "@/lib/ui/button";

describe("buttonClassName", () => {
  it("compõe base + variante", () => {
    expect(buttonClassName({ variant: "primary" })).toBe("btn btn-primary");
  });

  it("usa primary como variante padrão", () => {
    expect(buttonClassName({})).toBe("btn btn-primary");
  });

  it("adiciona classe de tamanho quando não é md", () => {
    expect(buttonClassName({ variant: "danger", size: "lg" })).toBe("btn btn-danger btn-lg");
  });

  it("omite classe de tamanho no md (padrão)", () => {
    expect(buttonClassName({ variant: "secondary", size: "md" })).toBe("btn btn-secondary");
  });

  it("marca is-loading quando loading", () => {
    const classes = buttonClassName({ variant: "ghost", loading: true }).split(" ");
    expect(classes).toEqual(expect.arrayContaining(["btn", "btn-ghost", "is-loading"]));
  });

  it("não marca is-loading quando não está carregando", () => {
    expect(buttonClassName({ variant: "ghost", loading: false })).not.toContain("is-loading");
  });

  it("anexa className extra preservando as classes do kit", () => {
    const cls = buttonClassName({ variant: "primary", className: "btn-block" });
    expect(cls).toContain("btn-primary");
    expect(cls).toContain("btn-block");
  });
});
