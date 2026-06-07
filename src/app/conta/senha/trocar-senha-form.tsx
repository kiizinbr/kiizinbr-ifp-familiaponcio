"use client";

import { useActionState } from "react";
import { trocarMinhaSenhaAction, type TrocarSenhaResult } from "./actions";

/** Form de troca da própria senha (1º acesso ou voluntária). */
export function TrocarSenhaForm({ forcado }: { forcado: boolean }) {
  const [state, action, pending] = useActionState<TrocarSenhaResult | null, FormData>(
    trocarMinhaSenhaAction,
    null,
  );

  return (
    <form action={action} style={{ display: "grid", gap: "var(--sp-3)" }}>
      {state && !state.ok && state.error ? (
        <div
          role="alert"
          className="badge badge-danger"
          style={{ display: "block", padding: "8px 12px" }}
        >
          {state.error}
        </div>
      ) : null}
      {!forcado ? (
        <div className="field-group">
          <label className="label" htmlFor="c-current">
            Senha atual
          </label>
          <input
            id="c-current"
            name="currentPassword"
            type="password"
            required
            autoComplete="current-password"
            className="input"
          />
        </div>
      ) : null}
      <div className="field-group">
        <label className="label" htmlFor="c-pass">
          Nova senha
        </label>
        <input
          id="c-pass"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="input"
        />
      </div>
      <div className="field-group">
        <label className="label" htmlFor="c-confirm">
          Confirmar senha
        </label>
        <input
          id="c-confirm"
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="input"
        />
      </div>
      <button type="submit" disabled={pending} className="btn btn-primary btn-block">
        {pending ? "Salvando..." : "Salvar nova senha"}
      </button>
    </form>
  );
}
