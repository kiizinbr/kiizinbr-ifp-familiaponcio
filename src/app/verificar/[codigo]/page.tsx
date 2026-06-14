import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import type { Route } from "next";
import { db } from "@/lib/db";
import { normalizarCodigo } from "@/lib/capacitacao/certificado";
import { qrDataUrl } from "@/lib/pdf/qr";
import { Badge } from "@/components/ui/badge";
import { TemaUnidade } from "@/components/tema-unidade";
import { CertificadoCartao } from "@/app/capacitacao/turmas/[id]/certificado-cartao";
import styles from "@/app/capacitacao/turmas/[id]/certificado.module.css";

const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

/**
 * Verificação pública de certificado (alvo do QR). Sem login — fora do matcher do
 * proxy. Mostra o cartão cerimonial (mesmo `.cert` da celebração) com os dados snapshot
 * se o código existir, ou aviso de não encontrado. Expõe só nome/curso/carga/frequência
 * (o que o próprio diploma mostra). `TemaUnidade tema="capacitacao"` resolve `--unit`
 * (laranja) nesta rota que vive fora do AppShell.
 */
export default async function VerificarCertificadoPage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;
  const cert = await db.certificado.findUnique({ where: { codigo: normalizarCodigo(codigo) } });
  // QR precisa de URL ABSOLUTA — uma câmera de celular lê o texto verbatim; só o
  // path (/verificar/CODIGO) não abre nada. Mesmo alvo da rota do PDF, aqui o
  // origin vem dos headers do request (Server Component fora do AppShell).
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const qr = cert && host ? await qrDataUrl(`${proto}://${host}/verificar/${cert.codigo}`) : null;

  return (
    <TemaUnidade tema="capacitacao">
      <main className={styles.verifyStage}>
        {cert ? (
          <div className={styles.verifyCol} style={{ maxWidth: 760 }}>
            <div className={styles.verifyBadgeRow}>
              <Badge variant="success">
                <span className="dot" /> Certificado válido
              </Badge>
            </div>

            <CertificadoCartao cert={cert} qr={qr ?? undefined} />

            <div className={styles.verifyMeta}>
              <div>Emitido em {fmt.format(cert.emitidoEm)}</div>
              <div className="mono">Código {cert.codigo}</div>
            </div>

            <div className={styles.verifyActions}>
              <a href={`/verificar/${cert.codigo}/pdf`} className="btn btn-secondary btn-lg">
                Baixar certificado (PDF)
              </a>
            </div>

            <Link href={"/" as Route} className="micro" style={{ color: "var(--text-3)" }}>
              ← Início
            </Link>
          </div>
        ) : (
          <div className={styles.notFound}>
            <Image
              src="/logo/ifp-symbol.png"
              alt="IFP"
              width={48}
              height={48}
              priority
              style={{ margin: "0 auto" }}
            />
            <p className="micro" style={{ marginTop: "var(--sp-2)", color: "var(--text-3)" }}>
              Instituto Família Pôncio · Verificação de certificado
            </p>
            <div style={{ marginTop: "var(--sp-4)" }}>
              <Badge variant="danger">Certificado não encontrado</Badge>
            </div>
            <p style={{ color: "var(--text-3)", marginTop: "var(--sp-3)" }}>
              O código informado não corresponde a nenhum certificado emitido pelo Instituto.
            </p>
            <div style={{ marginTop: "var(--sp-5)" }}>
              <Link href={"/" as Route} className="micro" style={{ color: "var(--text-3)" }}>
                ← Início
              </Link>
            </div>
          </div>
        )}
      </main>
    </TemaUnidade>
  );
}
