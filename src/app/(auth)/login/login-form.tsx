"use client";

import { useFormStatus } from "react-dom";
import { signInAction } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded bg-[rgb(var(--ifp-social))] py-2 text-white transition disabled:opacity-60"
    >
      {pending ? "Entrando..." : "Entrar"}
    </button>
  );
}

export function LoginForm({ error }: { error?: string }) {
  return (
    <form action={signInAction} className="w-full max-w-sm rounded-xl bg-white p-8 shadow">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">IFP Connect</h1>
        <div className="mt-2 flex h-1 w-16 overflow-hidden rounded">
          <span className="flex-1 bg-[rgb(var(--ifp-social))]" />
          <span className="flex-1 bg-[rgb(var(--ifp-medico))]" />
          <span className="flex-1 bg-[rgb(var(--ifp-capacitacao))]" />
          <span className="flex-1 bg-[rgb(var(--ifp-educacional))]" />
        </div>
      </div>

      {error === "invalid" && (
        <div
          role="alert"
          className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          E-mail ou senha incorretos.
        </div>
      )}

      <label className="mb-3 block">
        <span className="mb-1 block text-sm">E-mail</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded border px-3 py-2 focus:border-[rgb(var(--ifp-social))] focus:outline-none"
        />
      </label>
      <label className="mb-6 block">
        <span className="mb-1 block text-sm">Senha</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded border px-3 py-2 focus:border-[rgb(var(--ifp-social))] focus:outline-none"
        />
      </label>

      <SubmitButton />
    </form>
  );
}
