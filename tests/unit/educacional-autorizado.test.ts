import { describe, expect, it } from "vitest";
import {
  validarAutorizado,
  proximoCheckPermitido,
  type AutorizadoCheck,
} from "@/lib/educacional/autorizado";

/**
 * Slice 2 — o CORAÇÃO de segurança do check-in/out (TDD-first).
 * `validarAutorizado` é PURA: recebe o registro (ou null) + sentido + agora.
 * Os 4 bloqueios são intransponíveis e seguem a ORDEM EXATA do `main`
 * (rotina.service.ts:44–81): inexistente → restrição judicial → revogado → vencido.
 */

const AGORA = new Date("2026-06-16T12:00:00Z");

function autorizadoBase(over: Partial<AutorizadoCheck> = {}): AutorizadoCheck {
  return {
    restricaoJudicial: false,
    vigenteAte: null,
    revogadoEm: null,
    ...over,
  };
}

describe("validarAutorizado — os 4 bloqueios (ordem do main)", () => {
  it("(a) autorizado inexistente (null) → bloqueado 'não está na lista'", () => {
    const r = validarAutorizado(null, "ENTRADA", AGORA);
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/não está na lista/i);
  });

  it("(b) restrição judicial vigente → bloqueado", () => {
    const r = validarAutorizado(autorizadoBase({ restricaoJudicial: true }), "SAIDA", AGORA);
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/restrição judicial/i);
  });

  it("(c) autorização revogada (revogadoEm != null) → bloqueado", () => {
    const r = validarAutorizado(
      autorizadoBase({ revogadoEm: new Date("2026-05-01T12:00:00Z") }),
      "SAIDA",
      AGORA,
    );
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/revogad/i);
  });

  it("(d) autorização vencida (vigenteAte < agora) → bloqueado", () => {
    const r = validarAutorizado(
      autorizadoBase({ vigenteAte: new Date("2026-06-15T12:00:00Z") }),
      "ENTRADA",
      AGORA,
    );
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/vencid/i);
  });

  it("autorizado válido, sem restrição/revogação/vencimento → ok", () => {
    const r = validarAutorizado(autorizadoBase(), "ENTRADA", AGORA);
    expect(r.ok).toBe(true);
    expect(r.motivo).toBeUndefined();
  });

  it("vigenteAte no futuro → ok (não vencido)", () => {
    const r = validarAutorizado(
      autorizadoBase({ vigenteAte: new Date("2026-12-31T23:59:59Z") }),
      "SAIDA",
      AGORA,
    );
    expect(r.ok).toBe(true);
  });

  // Ordem intransponível: revogado E vencido → ganha o PRIMEIRO da ordem (revogado).
  it("revogado + vencido juntos → motivo é o de revogação (ordem do main)", () => {
    const r = validarAutorizado(
      autorizadoBase({
        revogadoEm: new Date("2026-05-01T12:00:00Z"),
        vigenteAte: new Date("2026-06-15T12:00:00Z"),
      }),
      "SAIDA",
      AGORA,
    );
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/revogad/i);
  });

  // Restrição judicial é mais forte que revogação: vem ANTES na ordem.
  it("restrição judicial + revogado juntos → motivo é o de restrição judicial", () => {
    const r = validarAutorizado(
      autorizadoBase({ restricaoJudicial: true, revogadoEm: new Date("2026-05-01T12:00:00Z") }),
      "SAIDA",
      AGORA,
    );
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/restrição judicial/i);
  });
});

describe("TESTE DE OURO — ex-padrasto revogado tentando RETIRAR a criança", () => {
  it("validarAutorizado(<registro revogado>, 'SAIDA', agora) → bloqueado com motivo de revogação", () => {
    // Espelha o seed real: Marcos Tavares, ex-padrasto, revogado em 2026-05-01.
    const marcosRevogado = autorizadoBase({
      revogadoEm: new Date("2026-05-01T12:00:00Z"),
    });
    const r = validarAutorizado(marcosRevogado, "SAIDA", AGORA);
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/revogad/i);
  });
});

describe("proximoCheckPermitido — estado-do-dia (puro)", () => {
  it("primeiro check do dia ENTRADA (último = null) → ok", () => {
    expect(proximoCheckPermitido(null, "ENTRADA").ok).toBe(true);
  });

  it("duplo check-in (último = ENTRADA, novo = ENTRADA) → bloqueado 'já presente'", () => {
    const r = proximoCheckPermitido("ENTRADA", "ENTRADA");
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/já está presente|já presente/i);
  });

  it("check-out após entrada (último = ENTRADA, novo = SAIDA) → ok", () => {
    expect(proximoCheckPermitido("ENTRADA", "SAIDA").ok).toBe(true);
  });

  it("check-out sem entrada aberta (último = null, novo = SAIDA) → bloqueado", () => {
    const r = proximoCheckPermitido(null, "SAIDA");
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/não há check-in|sem check-in|check-in aberto/i);
  });

  it("check-out depois de uma saída (último = SAIDA, novo = SAIDA) → bloqueado", () => {
    const r = proximoCheckPermitido("SAIDA", "SAIDA");
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/não há check-in|sem check-in|check-in aberto/i);
  });

  it("nova entrada após saída (último = SAIDA, novo = ENTRADA) → ok (re-entrada no mesmo dia)", () => {
    expect(proximoCheckPermitido("SAIDA", "ENTRADA").ok).toBe(true);
  });
});
