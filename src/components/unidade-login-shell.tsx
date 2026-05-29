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
          opacity: "var(--ifp-filter-opacity)",
        }}
        aria-hidden
      />

      <div
        className="relative z-10 w-full max-w-sm bg-white/95 p-8 backdrop-blur"
        style={{
          borderRadius: "var(--ifp-radius-xl)",
          boxShadow: "var(--ifp-shadow-xl)",
        }}
      >
        <div className="flex flex-col items-center">
          <Image src="/logo/ifp-symbol.png" alt="IFP" width={56} height={56} priority />
          <h1 className="mt-4 text-lg font-bold" style={{ color: "rgb(var(--ifp-orange-900))" }}>
            {unidade.nome}
          </h1>
          <p
            className="mt-1 text-xs tracking-wider uppercase"
            style={{ color: "rgb(var(--ifp-muted))" }}
          >
            Instituto Família Pôncio
          </p>
        </div>

        <form action={onSubmit} className="mt-8 space-y-4">
          <label className="block">
            <span className="text-xs" style={{ color: "rgb(var(--ifp-muted))" }}>
              E-mail
            </span>
            <input
              required
              name="email"
              type="email"
              autoComplete="email"
              className="mt-1 w-full px-3 py-2 text-sm focus:outline-none"
              style={{
                backgroundColor: "rgb(var(--ifp-canvas))",
                border: "1px solid rgb(var(--ifp-surface-200))",
                borderRadius: "var(--ifp-radius-sm)",
                color: "rgb(var(--ifp-ink))",
              }}
            />
          </label>
          <label className="block">
            <span className="text-xs" style={{ color: "rgb(var(--ifp-muted))" }}>
              Senha
            </span>
            <input
              required
              name="password"
              type="password"
              autoComplete="current-password"
              className="mt-1 w-full px-3 py-2 text-sm focus:outline-none"
              style={{
                backgroundColor: "rgb(var(--ifp-canvas))",
                border: "1px solid rgb(var(--ifp-surface-200))",
                borderRadius: "var(--ifp-radius-sm)",
                color: "rgb(var(--ifp-ink))",
              }}
            />
          </label>

          {error && (
            <p
              role="alert"
              className="px-3 py-2 text-sm"
              style={{
                backgroundColor: "rgb(var(--ifp-danger) / 0.08)",
                color: "rgb(var(--ifp-danger))",
                borderRadius: "var(--ifp-radius-sm)",
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{
              backgroundColor: "rgb(var(--ifp-orange-500))",
              borderRadius: "var(--ifp-radius-md)",
            }}
          >
            {pending ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <div
          className="mt-6 flex items-center justify-between text-xs"
          style={{ color: "rgb(var(--ifp-muted))" }}
        >
          <Link
            href={"/reset" as Route}
            className="hover:opacity-70"
            style={{ transition: "opacity var(--ifp-transition-fast)" }}
          >
            Esqueci a senha
          </Link>
          <Link
            href={"/" as Route}
            className="hover:opacity-70"
            style={{ transition: "opacity var(--ifp-transition-fast)" }}
          >
            ← Voltar
          </Link>
        </div>
      </div>
    </main>
  );
}
