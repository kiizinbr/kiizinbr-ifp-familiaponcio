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
      className="w-full rounded bg-[rgb(var(--ifp-laranja))] py-2 text-white transition disabled:opacity-60"
    >
      {pending ? "Entrando..." : "Entrar"}
    </button>
  );
}

export function LoginForm({ error }: { error?: string }) {
  return (
    <form action={signInAction} className="w-full max-w-sm rounded-xl bg-white p-8 shadow">
      <div className="mb-6 flex flex-col items-center">
        <Image
          src="/logo/ifp-lockup.png"
          alt="Instituto Família Pôncio"
          width={160}
          height={180}
          priority
        />
        <div className="mt-4 flex h-1 w-20 overflow-hidden rounded">
          <span className="flex-1 bg-[rgb(var(--ifp-medico))]" />
          <span className="flex-1 bg-[rgb(var(--ifp-capacitacao))]" />
          <span className="flex-1 bg-[rgb(var(--ifp-esportivo))]" />
          <span className="flex-1 bg-[rgb(var(--ifp-recreativo))]" />
        </div>
        <p className="mt-3 text-xs tracking-widest text-[rgb(var(--ifp-muted))] uppercase">
          IFP Connect
        </p>
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
          className="w-full rounded border px-3 py-2 focus:border-[rgb(var(--ifp-laranja))] focus:outline-none"
        />
      </label>
      <label className="mb-6 block">
        <span className="mb-1 block text-sm">Senha</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded border px-3 py-2 focus:border-[rgb(var(--ifp-laranja))] focus:outline-none"
        />
      </label>

      <SubmitButton />
    </form>
  );
}
