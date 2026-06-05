import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { DefinirSenhaForm } from "./definir-senha-form";

/** Página pública de redefinição de senha via token (admin-driven). */
export default async function ResetTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
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
              Definir nova senha
            </h1>
          </div>

          <DefinirSenhaForm token={token} />

          <div style={{ marginTop: "var(--sp-6)", textAlign: "center" }}>
            <Link href={"/login" as Route} className="micro" style={{ color: "var(--text-3)" }}>
              ← Ir para o login
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
