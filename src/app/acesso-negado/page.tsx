import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { getLandingPath } from "@/lib/rbac";

/**
 * 403 — acesso negado, COM feedback (mata D4: o middleware deixava de despejar
 * silenciosamente na landing pública e passa a mandar pra cá). Mostra a mensagem
 * e um caminho de volta pra HOME do próprio papel (getLandingPath), nunca um
 * beco sem saída. Decisão 2026-06-08, doc docs/ux-navegacao-ia-2026-06-08.md.
 */
export default async function AcessoNegadoPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const home = getLandingPath(session);

  return (
    <main
      className="ifp-kit"
      style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24 }}
    >
      <div className="card" style={{ maxWidth: 440, width: "100%" }}>
        <div className="empty">
          <Image src="/logo/ifp-symbol.png" alt="" width={96} height={96} priority />
          <div className="e-title">Acesso restrito</div>
          <p className="e-msg">
            Você não tem permissão para acessar essa área. Se acha que é um engano, fale com a
            coordenação da sua unidade.
          </p>
          <Link href={home as Route} className="btn btn-primary" style={{ marginTop: 12 }}>
            Voltar ao início
          </Link>
        </div>
      </div>
    </main>
  );
}
