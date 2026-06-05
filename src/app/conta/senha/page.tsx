import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { TrocarSenhaForm } from "./trocar-senha-form";

/**
 * Troca de senha do usuário logado. É o destino do enforce de 1º acesso (proxy.ts):
 * fica FORA do matcher, então não entra em loop de redirect. Faz a própria checagem
 * de sessão. Usuário forçado não recebe link de escape; voluntário recebe "voltar".
 */
export default async function ContaSenhaPage() {
  const session = await auth();
  if (!session) redirect("/login" as Route);
  const forcado = session.user.mustChangePassword;

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50">
      <div className="card" style={{ width: "100%", maxWidth: 380 }}>
        <div className="body" style={{ padding: "var(--sp-8)" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginBottom: "var(--sp-6)",
            }}
          >
            <Image src="/logo/ifp-symbol.png" alt="IFP" width={48} height={48} priority />
            <h1 className="t-h2" style={{ marginTop: "var(--sp-3)", color: "var(--text)" }}>
              {forcado ? "Defina sua senha" : "Trocar senha"}
            </h1>
            {forcado ? (
              <p
                className="micro"
                style={{ marginTop: "var(--sp-2)", textAlign: "center", color: "var(--text-3)" }}
              >
                Por segurança, defina uma senha própria antes de continuar.
              </p>
            ) : null}
          </div>

          <TrocarSenhaForm />

          {!forcado ? (
            <div style={{ marginTop: "var(--sp-6)", textAlign: "center" }}>
              <Link href={"/" as Route} className="micro" style={{ color: "var(--text-3)" }}>
                ← Voltar
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
