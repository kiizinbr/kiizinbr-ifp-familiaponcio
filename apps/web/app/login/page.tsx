"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

import { unidadePorSlug } from "@/lib/unidades";

/**
 * Login com contexto de unidade (fluxo: vitrine → /acesso → cá).
 * ?unidade=<slug> aplica o data-theme do salão e define o destino pós-login;
 * sem unidade, o login é neutro e cai no hub (/) que resolve por perfil.
 */
export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const unidade = unidadePorSlug(params.get("unidade"));
  const callbackUrl = params.get("callbackUrl") ?? unidade?.destino ?? "/";

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    const result = await signIn("credentials", {
      email,
      senha,
      redirect: false,
    });

    setCarregando(false);

    if (!result || result.error) {
      setErro("E-mail ou senha inválidos.");
      return;
    }

    router.replace(callbackUrl);
  }

  return (
    <div data-theme={unidade?.tema}>
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <form
          onSubmit={onSubmit}
          className="w-full max-w-sm rounded-lg border border-border bg-surface p-8 shadow-ifp-md"
        >
          <div className="mb-6 text-center">
            <p className="text-xs uppercase tracking-widest text-primary">IFP Connect</p>
            <h1 className="mt-1 text-2xl font-bold text-foreground">
              {unidade?.nome ?? "Acesso interno"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {unidade
                ? "Entre para acessar o seu salão."
                : "Plataforma do Instituto Família Poncio."}
            </p>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-foreground">E-mail</span>
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-foreground">Senha</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>

            {erro ? (
              <p role="alert" className="text-sm text-danger">
                {erro}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={carregando}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-ifp-sm transition hover:bg-primary-hover disabled:opacity-60"
            >
              {carregando ? "Entrando..." : "Entrar"}
            </button>
          </div>

          {unidade ? (
            <p className="mt-4 text-center text-xs">
              <Link href="/acesso" className="text-primary hover:underline">
                ← Trocar de unidade
              </Link>
            </p>
          ) : null}

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Esqueceu a senha? Fale com o Serviço Social.
          </p>
        </form>
      </main>
    </div>
  );
}
