"use client";

import { useActionState, useState } from "react";
import { criarUsuarioAction, type CriarUsuarioResult } from "./actions";
import {
  ROLE_NAMES,
  UNIT_SCOPES,
  ROLE_DESCRIPTIONS,
  GLOBAL_ROLES,
  type RoleName,
} from "@/lib/rbac-types";

const UNIT_LABELS: Record<string, string> = {
  medico: "Médico",
  capacitacao: "Capacitação",
  esportivo: "Esportivo",
  recreativo: "Recreativo",
};

const FEEDBACK_STYLE = {
  display: "block",
  marginBottom: "var(--sp-3)",
  padding: "8px 12px",
} as const;

/** Provisionamento de conta pela UI (super_admin). Unidade some para papel global. */
export function CriarUsuarioForm() {
  const [state, action, pending] = useActionState<CriarUsuarioResult | null, FormData>(
    criarUsuarioAction,
    null,
  );
  const [roleName, setRoleName] = useState<RoleName>("recepcao");
  const ehGlobal = GLOBAL_ROLES.includes(roleName);

  return (
    <form action={action} className="card" style={{ marginBottom: "var(--sp-6)", maxWidth: 640 }}>
      <div className="body" style={{ padding: "var(--sp-5)" }}>
        <h2 className="t-h2" style={{ color: "var(--text)", marginBottom: "var(--sp-4)" }}>
          Novo usuário
        </h2>

        {state && !state.ok && (
          <div role="alert" className="badge badge-danger" style={FEEDBACK_STYLE}>
            {state.error}
          </div>
        )}
        {state?.ok && (
          <div role="status" className="badge badge-success" style={FEEDBACK_STYLE}>
            Conta de {state.email} criada. Comunique a senha inicial à pessoa.
          </div>
        )}

        <div style={{ display: "grid", gap: "var(--sp-3)" }}>
          <div className="field-group">
            <label className="label" htmlFor="u-name">
              Nome
            </label>
            <input id="u-name" name="name" required className="input" />
          </div>
          <div className="field-group">
            <label className="label" htmlFor="u-email">
              E-mail
            </label>
            <input
              id="u-email"
              name="email"
              type="email"
              required
              autoComplete="off"
              className="input"
            />
          </div>
          <div className="field-group">
            <label className="label" htmlFor="u-password">
              Senha inicial
            </label>
            <input
              id="u-password"
              name="password"
              type="text"
              required
              minLength={8}
              autoComplete="off"
              className="input"
            />
          </div>
          <div className="field-group">
            <label className="label" htmlFor="u-role">
              Papel
            </label>
            <select
              id="u-role"
              name="roleName"
              className="input"
              value={roleName}
              onChange={(e) => setRoleName(e.target.value as RoleName)}
            >
              {ROLE_NAMES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_DESCRIPTIONS[r]}
                </option>
              ))}
            </select>
          </div>
          <div className="field-group">
            <label className="label" htmlFor="u-unit">
              Unidade
            </label>
            <select
              id="u-unit"
              name="unitScope"
              className="input"
              disabled={ehGlobal}
              defaultValue=""
            >
              <option value="">
                {ehGlobal ? "— (papel global, sem unidade)" : "Selecione a unidade"}
              </option>
              {UNIT_SCOPES.map((u) => (
                <option key={u} value={u}>
                  {UNIT_LABELS[u]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary"
          style={{ marginTop: "var(--sp-4)" }}
        >
          {pending ? "Criando..." : "Criar usuário"}
        </button>
      </div>
    </form>
  );
}
