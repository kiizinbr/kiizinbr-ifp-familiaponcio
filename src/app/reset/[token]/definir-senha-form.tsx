"use client";

import { useActionState } from "react";
import { definirNovaSenhaAction, type DefinirSenhaResult } from "./actions";

/** Form de nova senha — a action recebe o token via .bind (não vai no DOM). */
export function DefinirSenhaForm({ token }: { token: string }) {
  const bound = definirNovaSenhaAction.bind(null, token);
  const [state, action, pending] = useActionState<DefinirSenhaResult | null, FormData>(bound, null);

  return (
    <form action={action} style={{ display: "grid", gap: "var(--sp-3)" }}>
      {state && !state.ok && (
        <div
          role="alert"
          className="badge badge-danger"
          style={{ display: "block", padding: "8px 12px" }}
        >
          {state.error}
        </div>
      )}
      <div className="field-group">
        <label className="label" htmlFor="r-pass">
          Nova senha
        </label>
        <input
          id="r-pass"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="input"
        />
      </div>
      <div className="field-group">
        <label className="label" htmlFor="r-confirm">
          Confirmar senha
        </label>
        <input
          id="r-confirm"
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="input"
        />
      </div>
      <button type="submit" disabled={pending} className="btn btn-primary btn-block">
        {pending ? "Salvando..." : "Salvar senha"}
      </button>
    </form>
  );
}
