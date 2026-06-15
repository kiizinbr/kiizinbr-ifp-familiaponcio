"use client";

import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { useFormStatus } from "react-dom";
import { signOutAction } from "@/app/app/actions";

/**
 * Confirmação de signout em pt-BR no estilo do kit (card `.empty`, espelhando
 * `medico/error.tsx`). Substitui a tela default do NextAuth (em inglês) que o
 * GET /api/auth/signout caía — wired via `pages.signOut` em `src/lib/auth.ts`.
 *
 * O signout normal do app continua programático (`signOutAction` disparado pelos
 * botões "Sair" do shell/mobile-nav) e NÃO passa por esta página; ela cobre só o
 * acesso direto/edge a /api/auth/signout. O submit usa `signOutAction`, que faz
 * `signOut({ redirectTo: "/login" })`.
 */
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={pending ? "btn btn-primary is-loading" : "btn btn-primary"}
    >
      {pending ? "Saindo..." : "Sair"}
    </button>
  );
}

export default function LogoutPage() {
  return (
    <div
      className="ifp-kit"
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "var(--bg)",
      }}
    >
      <div className="empty">
        <Image src="/logo/ifp-symbol.png" alt="" width={96} height={96} />
        <div className="e-title">Sair do sistema?</div>
        <p className="e-msg">Você vai precisar entrar de novo para continuar.</p>
        <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "center" }}>
          <form action={signOutAction}>
            <SubmitButton />
          </form>
          <Link href={"/inicio" as Route} className="btn btn-secondary">
            Cancelar
          </Link>
        </div>
      </div>
    </div>
  );
}
