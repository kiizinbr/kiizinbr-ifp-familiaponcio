"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { Route } from "next";
import type { UnidadeConfig } from "@/lib/unidades";
import styles from "./unidade-login-shell.module.css";

interface Props {
  unidade: UnidadeConfig;
  loginAction: (formData: FormData) => Promise<{ error?: string } | void>;
}

/**
 * Login da unidade — layout Split (foto-herói + painel claro), no Design Kit.
 * `data-unit`/`data-unit-accent` no root fazem o acento (eyebrow, botão) e o
 * véu seguirem a cor da unidade. Hero usa a foto institucional (ou o gradiente
 * fallback quando a unidade ainda não tem foto).
 */
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

  const heroBg = unidade.fotoFundoLogin
    ? `url(${unidade.fotoFundoLogin})`
    : unidade.gradienteFallback;

  return (
    <main className={`ifp-kit ${styles.split}`} data-unit={unidade.slug} data-unit-accent="">
      <div className={styles.hero}>
        <div
          className={styles.heroPhoto}
          style={{ background: heroBg, backgroundSize: "cover", backgroundPosition: "center 40%" }}
          aria-hidden
        />
        <div className={styles.heroTint} aria-hidden />
        <div className={styles.heroShade} aria-hidden />
        <div className={styles.wordmark}>
          <div className={styles.k}>{unidade.nome}</div>
          {unidade.tagline ? <h2>{unidade.tagline}</h2> : null}
        </div>
      </div>

      <div className={styles.panel}>
        <div className={styles.card}>
          <span className={styles.brand}>
            <Image src="/logo/ifp-symbol.png" alt="IFP" width={38} height={38} priority />
          </span>
          <div className={styles.eyebrow}>Acesso restrito</div>
          <h1 className={styles.title}>{unidade.nome}</h1>
          <p className={styles.sub}>Instituto Família Pôncio</p>

          <form action={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <label className="field-group">
              <span className="label">E-mail</span>
              <input
                className="input"
                required
                name="email"
                type="email"
                autoComplete="email"
                placeholder="voce@familiaponcio.org.br"
              />
            </label>
            <label className="field-group">
              <span className="label">Senha</span>
              <input
                className="input"
                required
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </label>

            {error ? (
              <p role="alert" className="field-error" style={{ margin: "2px 0 10px" }}>
                {error}
              </p>
            ) : null}

            <button type="submit" disabled={pending} className="btn btn-primary btn-block">
              {pending ? "Entrando…" : "Entrar"}
            </button>
          </form>

          <div className={styles.foot}>
            <Link href={"/reset" as Route}>Esqueci a senha</Link>
            <Link href={"/" as Route}>← Voltar</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
