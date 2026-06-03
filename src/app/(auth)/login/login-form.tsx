"use client";

import Image from "next/image";
import { useFormStatus } from "react-dom";
import { signInAction } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`btn btn-primary btn-block${pending ? "is-loading" : ""}`}
    >
      {pending ? "Entrando..." : "Entrar"}
    </button>
  );
}

export function LoginForm({ error }: { error?: string }) {
  return (
    <form action={signInAction} className="card" style={{ width: "100%", maxWidth: 380 }}>
      <div className="body" style={{ padding: "var(--sp-8)" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: "var(--sp-6)",
          }}
        >
          <span
            style={{
              display: "grid",
              placeItems: "center",
              padding: 12,
              borderRadius: "var(--r-lg)",
              background: "var(--logo-bg)",
              border: "1px solid var(--logo-ring)",
            }}
          >
            <Image
              src="/logo/ifp-lockup.png"
              alt="Instituto Família Pôncio"
              width={140}
              height={158}
              priority
            />
          </span>
          <div
            style={{
              marginTop: "var(--sp-4)",
              display: "flex",
              height: 4,
              width: 80,
              overflow: "hidden",
              borderRadius: "var(--r-full)",
            }}
          >
            <span style={{ flex: 1, background: "var(--u-medico)" }} />
            <span style={{ flex: 1, background: "var(--u-capacitacao)" }} />
            <span style={{ flex: 1, background: "var(--u-esportivo)" }} />
            <span style={{ flex: 1, background: "var(--u-recreativo)" }} />
          </div>
          <p className="micro" style={{ marginTop: "var(--sp-3)" }}>
            IFP Connect
          </p>
        </div>

        {error === "invalid" && (
          <div
            role="alert"
            className="badge badge-danger"
            style={{
              display: "flex",
              width: "100%",
              justifyContent: "center",
              marginBottom: "var(--sp-4)",
              padding: "10px 12px",
              borderRadius: "var(--r-md)",
            }}
          >
            E-mail ou senha incorretos.
          </div>
        )}

        <div className="field-group">
          <label className="label" htmlFor="login-email">
            E-mail
          </label>
          <input
            id="login-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="input"
          />
        </div>
        <div className="field-group">
          <label className="label" htmlFor="login-password">
            Senha
          </label>
          <input
            id="login-password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="input"
          />
        </div>

        <SubmitButton />
      </div>
    </form>
  );
}
