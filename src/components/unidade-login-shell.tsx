"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { Route } from "next";
import type { UnidadeConfig } from "@/lib/unidades";

interface Props {
  unidade: UnidadeConfig;
  loginAction: (formData: FormData) => Promise<{ error?: string } | void>;
}

export function UnidadeLoginShell({ unidade, loginAction }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await loginAction(formData);
      if (result && "error" in result && result.error) {
        setError(result.error);
      }
    });
  }

  const background = unidade.fotoFundoLogin
    ? `url(${unidade.fotoFundoLogin})`
    : unidade.gradienteFallback;

  return (
    <main className="relative flex min-h-screen items-center justify-center">
      <div
        className="absolute inset-0"
        style={{
          background,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
        aria-hidden
      />
      <div
        className="absolute inset-0"
        style={{
          background: unidade.corFiltroLogin,
          opacity: 0.55,
        }}
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-sm rounded-3xl bg-white/95 p-8 shadow-xl backdrop-blur">
        <div className="flex flex-col items-center">
          <Image src="/logo/ifp-symbol.png" alt="IFP" width={56} height={56} priority />
          <h1 className="mt-4 text-lg font-semibold text-stone-900">{unidade.nome}</h1>
          <p className="mt-1 text-xs tracking-wider text-stone-500 uppercase">
            Instituto Família Pôncio
          </p>
        </div>

        <form action={onSubmit} className="mt-8 space-y-4">
          <label className="block">
            <span className="text-xs text-stone-600">E-mail</span>
            <input
              required
              name="email"
              type="email"
              autoComplete="email"
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-900 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs text-stone-600">Senha</span>
            <input
              required
              name="password"
              type="password"
              autoComplete="current-password"
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-900 focus:outline-none"
            />
          </label>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-900">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-stone-900 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between text-xs text-stone-500">
          <Link href={"/reset" as Route} className="hover:text-stone-900">
            Esqueci a senha
          </Link>
          <Link href={"/" as Route} className="hover:text-stone-900">
            ← Voltar
          </Link>
        </div>
      </div>
    </main>
  );
}
