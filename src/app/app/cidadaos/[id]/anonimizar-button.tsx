"use client";

import { anonimizarCidadaoAction } from "./anonimizar-actions";

const CONFIRMACAO =
  "Anonimizar esta ficha é IRREVERSÍVEL: apaga nome, CPF, contatos, saúde, " +
  "socioeconômico e remove os anexos. Continuar?";

/** Botão de anonimização LGPD com confirmação (gate de UX; a action revalida o RBAC). */
export function AnonimizarButton({ cidadaoId }: { cidadaoId: string }) {
  return (
    <form
      action={anonimizarCidadaoAction}
      onSubmit={(e) => {
        if (!window.confirm(CONFIRMACAO)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={cidadaoId} />
      <button
        type="submit"
        className="btn"
        style={{
          background: "var(--danger-soft)",
          color: "var(--danger)",
          border: "1px solid var(--danger)",
        }}
      >
        Anonimizar ficha (LGPD)
      </button>
    </form>
  );
}
