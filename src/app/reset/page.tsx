import Link from "next/link";
import Image from "next/image";
import type { Route } from "next";

/**
 * Recuperação de senha. O self-service por e-mail (SMTP) ainda NÃO está ligado —
 * por ora a redefinição é admin-driven: o administrador gera um link de reset na
 * tela de Usuários. Esta página é honesta sobre isso (não finge enviar e-mail).
 */
export default function ResetPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50">
      <div className="card" style={{ width: "100%", maxWidth: 400 }}>
        <div className="body" style={{ padding: "var(--sp-8)", textAlign: "center" }}>
          <Image src="/logo/ifp-symbol.png" alt="IFP" width={48} height={48} priority />
          <h1 className="t-h2" style={{ marginTop: "var(--sp-3)", color: "var(--text)" }}>
            Recuperar senha
          </h1>
          <p style={{ marginTop: "var(--sp-4)", color: "var(--text-2)", fontSize: 14 }}>
            A recuperação automática por e-mail ainda não está disponível. Fale com o administrador
            do sistema para receber um link de redefinição de senha.
          </p>
          <div style={{ marginTop: "var(--sp-6)" }}>
            <Link href={"/login" as Route} className="micro" style={{ color: "var(--text-3)" }}>
              ← Voltar ao login
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
