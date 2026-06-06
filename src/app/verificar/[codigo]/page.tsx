import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { db } from "@/lib/db";
import { normalizarCodigo } from "@/lib/capacitacao/certificado";
import { Badge } from "@/components/ui/badge";

const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

/**
 * Verificação pública de certificado (alvo do QR). Sem login — fora do matcher do
 * proxy. Mostra os dados snapshot do certificado se o código existir, ou aviso de
 * não encontrado. Expõe só nome/curso/carga/frequência (o que o próprio diploma mostra).
 */
export default async function VerificarCertificadoPage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;
  const cert = await db.certificado.findUnique({ where: { codigo: normalizarCodigo(codigo) } });

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50">
      <div className="card" style={{ width: "100%", maxWidth: 460 }}>
        <div className="body" style={{ padding: "var(--sp-8)" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginBottom: "var(--sp-5)",
              textAlign: "center",
            }}
          >
            <Image src="/logo/ifp-symbol.png" alt="IFP" width={48} height={48} priority />
            <p className="micro" style={{ marginTop: "var(--sp-2)", color: "var(--text-3)" }}>
              Instituto Família Pôncio · Verificação de certificado
            </p>
          </div>

          {cert ? (
            <>
              <Badge variant="success">
                <span className="dot" /> Certificado válido
              </Badge>
              <h1 className="t-h2" style={{ color: "var(--text)", margin: "var(--sp-3) 0" }}>
                {cert.nomeAluno}
              </h1>
              <p style={{ color: "var(--text)", lineHeight: 1.6 }}>
                concluiu o curso <b>{cert.nomeCurso}</b> ({cert.cargaHoraria}h) com frequência de{" "}
                <b>{cert.percentualFrequencia}%</b>.
              </p>
              <div style={{ marginTop: "var(--sp-4)", color: "var(--text-3)", fontSize: 13 }}>
                <div>Emitido em {fmt.format(cert.emitidoEm)}</div>
                <div className="mono">Código {cert.codigo}</div>
              </div>
              <div style={{ marginTop: "var(--sp-5)" }}>
                <a href={`/verificar/${cert.codigo}/pdf`} className="btn btn-primary">
                  Baixar certificado (PDF)
                </a>
              </div>
            </>
          ) : (
            <>
              <Badge variant="danger">Certificado não encontrado</Badge>
              <p style={{ color: "var(--text-3)", marginTop: "var(--sp-3)" }}>
                O código informado não corresponde a nenhum certificado emitido pelo Instituto.
              </p>
            </>
          )}

          <div style={{ marginTop: "var(--sp-6)", textAlign: "center" }}>
            <Link href={"/" as Route} className="micro" style={{ color: "var(--text-3)" }}>
              ← Início
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
