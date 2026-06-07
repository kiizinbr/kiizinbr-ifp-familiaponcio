import { describe, expect, it } from "vitest";
import { loginParaPathDeslogado } from "@/lib/login-redirect";

describe("loginParaPathDeslogado — para onde mandar um visitante SEM sessão", () => {
  it("BUG do painel: /painel/<unidade> vai pro login DA UNIDADE, não pra homepage", () => {
    expect(loginParaPathDeslogado("/painel/medico")).toBe("/medico/login");
    expect(loginParaPathDeslogado("/painel/capacitacao")).toBe("/capacitacao/login");
  });

  it("rota de unidade vai pro login da unidade (comportamento atual preservado)", () => {
    expect(loginParaPathDeslogado("/medico")).toBe("/medico/login");
    expect(loginParaPathDeslogado("/medico/agenda")).toBe("/medico/login");
    expect(loginParaPathDeslogado("/poncio")).toBe("/poncio/login");
  });

  it("rotas SEM unidade (/app, /admin) vão pro login canônico — NUNCA pra landing pública", () => {
    expect(loginParaPathDeslogado("/app/cidadaos")).toBe("/login");
    expect(loginParaPathDeslogado("/admin/users")).toBe("/login");
  });

  it("painel com unidade inexistente cai no login canônico (não inventa rota)", () => {
    expect(loginParaPathDeslogado("/painel/xpto")).toBe("/login");
  });
});
