/**
 * Verificação PÚBLICA de certificado — destino do QR code impresso.
 * Sem login: qualquer empregador valida a autenticidade aqui.
 */
import { BadgeCheck, FileDown, ShieldX } from "lucide-react";

import { API_BASE_URL, type VerificacaoCertificado } from "@/lib/api";

export const metadata = { title: "Verificação de certificado · IFP" };

async function verificar(codigo: string): Promise<VerificacaoCertificado | null> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/capacitacao/certificados/verificar/${encodeURIComponent(codigo)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    return (await res.json()) as VerificacaoCertificado;
  } catch {
    return null;
  }
}

export default async function VerificarPage({
  params,
}: {
  params: { codigo: string };
}) {
  const cert = await verificar(params.codigo);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-12">
      <p className="text-xs uppercase tracking-widest text-primary">IFP Connect</p>
      <h1 className="mt-1 text-lg font-bold text-foreground">
        Verificação de certificado
      </h1>

      {cert?.valido ? (
        <div className="mt-6 w-full rounded-lg border border-success/40 bg-surface p-6 text-center shadow-casa-sm">
          <BadgeCheck className="mx-auto h-12 w-12 text-success" />
          <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-success">
            Certificado autêntico
          </p>
          <p className="mt-4 text-xl font-bold text-foreground">{cert.aluno}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {cert.curso} · turma {cert.turma}
          </p>
          <p className="mt-3 text-sm text-foreground">
            <strong>{cert.cargaHorariaCumprida}h</strong> de carga horária cumprida ·{" "}
            {cert.presencaPct}% de presença
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Emitido em{" "}
            {cert.emitidoEm
              ? new Date(cert.emitidoEm).toLocaleDateString("pt-BR")
              : "—"}{" "}
            pelo Instituto Família Poncio
          </p>
          <a
            href={`${API_BASE_URL}/capacitacao/certificados/verificar/${encodeURIComponent(params.codigo)}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-ifp-sm transition hover:bg-primary-hover"
          >
            <FileDown className="h-4 w-4" /> Baixar certificado (PDF)
          </a>
        </div>
      ) : (
        <div className="mt-6 w-full rounded-lg border border-danger/40 bg-surface p-6 text-center shadow-ifp-sm">
          <ShieldX className="mx-auto h-12 w-12 text-danger" />
          <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-danger">
            Certificado não encontrado
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            O código <code className="rounded bg-muted px-1">{params.codigo}</code> não
            corresponde a nenhum certificado emitido pelo IFP. Verifique se o QR/código
            foi digitado corretamente.
          </p>
        </div>
      )}

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Dúvidas? Entre em contato com o Instituto Família Poncio — Duque de Caxias/RJ.
      </p>
    </main>
  );
}
