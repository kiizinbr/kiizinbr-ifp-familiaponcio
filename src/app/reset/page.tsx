"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Route } from "next";

// TODO Plano 8: integrar provedor SMTP + criar /reset/[token]/page.tsx
export default function ResetPage() {
  const [sent, setSent] = useState(false);

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-sm">
        <div className="flex flex-col items-center">
          <Image src="/logo/ifp-symbol.png" alt="IFP" width={56} height={56} priority />
          <h1 className="mt-4 text-lg font-semibold text-stone-900">Recuperar senha</h1>
        </div>

        {sent ? (
          <p className="mt-8 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.
          </p>
        ) : (
          <form
            className="mt-8 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setSent(true);
            }}
          >
            <label className="block">
              <span className="text-xs text-stone-600">E-mail</span>
              <input
                required
                type="email"
                name="email"
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-stone-900 focus:outline-none"
              />
            </label>
            <button
              type="submit"
              className="w-full rounded-lg bg-stone-900 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              Enviar link
            </button>
          </form>
        )}

        <div className="mt-6 text-center text-xs text-stone-500">
          <Link href={"/" as Route} className="hover:text-stone-900">
            ← Voltar
          </Link>
        </div>
      </div>
    </main>
  );
}
