/**
 * Núcleo do SELO do diário da creche — lógica PURA (não toca banco).
 * Espelha `autorizado.ts`: decisão isolada e testável; o I/O (tx, FOR UPDATE,
 * updateMany condicional, auditoria) fica no serviço (`rotina.ts`).
 *
 * Invariantes preservadas do `main` (`rotina.service.ts` / `familia.service.ts`):
 *   - FECHADO = imutável (nenhum registro novo) E visível à família;
 *   - ABERTO / inexistente = mutável, mas INVISÍVEL à família;
 *   - fechar exige ABERTO + ≥1 registro (não se sela diário vazio).
 */

/** Status do diário do dia (espelha o enum Prisma `StatusDiario`). */
export type StatusDiario = "ABERTO" | "FECHADO";

/** Resultado de uma validação pura: ok, ou bloqueado com motivo legível. */
export interface ResultadoValidacao {
  ok: boolean;
  motivo?: string;
}

/**
 * Pode lançar um novo registro de rotina? Só se o diário NÃO estiver selado.
 * FECHADO → bloqueia (imutável). É o coração da imutabilidade do Slice 3.
 */
export function podeRegistrar(status: StatusDiario): ResultadoValidacao {
  if (status === "FECHADO") {
    return { ok: false, motivo: "diário fechado — registros são imutáveis após o selo" };
  }
  return { ok: true };
}

/**
 * Pode fechar (selar) o diário? Exige ABERTO + ao menos 1 registro.
 *   - já FECHADO → bloqueia (idempotência: não se refecha);
 *   - sem registro → bloqueia (não se sela diário vazio).
 */
export function podeFechar(status: StatusDiario, qtdRegistros: number): ResultadoValidacao {
  if (status === "FECHADO") {
    return { ok: false, motivo: "diário já fechado" };
  }
  if (qtdRegistros < 1) {
    return {
      ok: false,
      motivo: "lance ao menos um registro antes de fechar o diário do dia",
    };
  }
  return { ok: true };
}

/**
 * O diário é visível à família? Só quando SELADO (FECHADO). Diário ABERTO ou
 * inexistente (null) → invisível: a família nunca vê o dia em andamento.
 * Aceita só o campo `status` (estrutural) — o serviço passa a linha do banco.
 */
export function diarioVisivelParaFamilia(diario: { status: StatusDiario } | null): boolean {
  return diario?.status === "FECHADO";
}
