"use client";

import Image from "next/image";
import Link from "next/link";
import clsx from "clsx";
import { useFormStatus } from "react-dom";
import { signInAction } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={clsx("btn btn-primary btn-block", pending && "is-loading")}
    >
      {pending ? "Entrando..." : "Entrar"}
    </button>
  );
}

interface UnidadeLogin {
  slug: string;
  nome: string;
}

export function LoginForm({ error, unidade }: { error?: string; unidade?: UnidadeLogin }) {
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
            {unidade ? (
              // Tematizado (veio de /acesso): barra sólida na cor do salão
              <span style={{ flex: 1, background: "var(--unidade)" }} />
            ) : (
              <>
                <span style={{ flex: 1, background: "var(--u-medico)" }} />
                <span style={{ flex: 1, background: "var(--u-capacitacao)" }} />
                <span style={{ flex: 1, background: "var(--u-esportivo)" }} />
                <span style={{ flex: 1, background: "var(--u-recreativo)" }} />
              </>
            )}
          </div>
          <p className="micro" style={{ marginTop: "var(--sp-3)" }}>
            IFP Connect
          </p>
          {unidade && (
            <h1
              style={{
                marginTop: "var(--sp-2)",
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                color: "var(--unidade)",
              }}
            >
              {unidade.nome}
            </h1>
          )}
        </div>

        {(error === "invalid" || error === "rate_limited") && (
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
            {error === "rate_limited"
              ? "Muitas tentativas de login. Aguarde alguns minutos e tente novamente."
              : "E-mail ou senha incorretos."}
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

        {/* Campo aditivo: hoje o signInAction ignora; quando o redirect pós-login
            for revisitado, dá pra ler formData.get("unidade") e mandar pro salão. */}
        {unidade && <input type="hidden" name="unidade" value={unidade.slug} />}

        <SubmitButton />

        {unidade && (
          <p style={{ marginTop: "var(--sp-4)", textAlign: "center" }}>
            <Link href="/acesso" className="micro" style={{ textDecoration: "none" }}>
              ← Trocar de unidade
            </Link>
          </p>
        )}
      </div>
    </form>
  );
}
