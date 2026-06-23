/**
 * Verificação PÚBLICA de documento médico — destino do QR impresso no
 * atestado/receita/declaração. Sem login: qualquer pessoa valida a
 * autenticidade. Não expõe dado clínico (sem CID, sem conteúdo) — só confirma
 * tipo, paciente, profissional e se o documento está vigente ou revogado.
 */
import { BadgeCheck, FileDown, ShieldAlert, ShieldX } from "lucide-react";

import { API_BASE_URL, type VerificacaoDocumentoMedico } from "@/lib/api";

export const metadata = { title: "Verificação de documento · IFP" };

async function verificar(codigo: string): Promise<VerificacaoDocumentoMedico | null> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/medico/documentos/verificar/${encodeURIComponent(codigo)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    return (await res.json()) as VerificacaoDocumentoMedico;
  } catch {
    return null;
  }
}

export default async function VerificarDocumentoPage({
  params,
}: {
  params: { codigo: string };
}) {
  const doc = await verificar(params.codigo);
  const valido = doc?.valido && !doc.revogado;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-12">
      <p className="text-xs uppercase tracking-widest text-primary">IFP Connect</p>
      <h1 className="mt-1 text-lg font-bold text-foreground">
        Verificação de documento médico
      </h1>

      {doc?.valido && doc.revogado ? (
        // Documento existe mas foi REVOGADO — alerta âmbar (não é fraude, mas inválido).
        <div className="mt-6 w-full rounded-lg border border-warning/50 bg-surface p-6 text-center shadow-casa-sm">
          <ShieldAlert className="mx-auto h-12 w-12 text-warning" />
          <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-warning">
            Documento revogado
          </p>
          <p className="mt-4 text-xl font-bold text-foreground">{doc.paciente}</p>
          <p className="mt-1 text-sm text-muted-foreground">{doc.tipoLabel}</p>
          <p className="mt-3 text-sm text-foreground">
            Este documento foi <strong>revogado</strong> em{" "}
            {doc.revogadoEm ? new Date(doc.revogadoEm).toLocaleDateString("pt-BR") : "—"} e
            não tem mais validade.
          </p>
        </div>
      ) : valido ? (
        <div className="mt-6 w-full rounded-lg border border-success/40 bg-surface p-6 text-center shadow-casa-sm">
          <BadgeCheck className="mx-auto h-12 w-12 text-success" />
          <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-success">
            Documento autêntico
          </p>
          <p className="mt-4 text-xl font-bold text-foreground">{doc!.paciente}</p>
          <p className="mt-1 text-sm text-muted-foreground">{doc!.tipoLabel}</p>
          <p className="mt-3 text-sm text-foreground">
            Emitido por <strong>{doc!.profissional}</strong>
            {doc!.registroConselho ? ` · ${doc!.registroConselho}` : ""}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Emitido em{" "}
            {doc!.emitidoEm
              ? new Date(doc!.emitidoEm).toLocaleDateString("pt-BR")
              : "—"}{" "}
            pelo Instituto Família Poncio
          </p>
          <a
            href={`${API_BASE_URL}/medico/documentos/verificar/${encodeURIComponent(params.codigo)}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-ifp-sm transition hover:bg-primary-hover"
          >
            <FileDown className="h-4 w-4" /> Baixar documento (PDF)
          </a>
        </div>
      ) : (
        <div className="mt-6 w-full rounded-lg border border-danger/40 bg-surface p-6 text-center shadow-ifp-sm">
          <ShieldX className="mx-auto h-12 w-12 text-danger" />
          <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-danger">
            Documento não encontrado
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            O código <code className="rounded bg-muted px-1">{params.codigo}</code> não
            corresponde a nenhum documento emitido pelo IFP. Verifique se o QR/código foi
            lido corretamente.
          </p>
        </div>
      )}

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Dúvidas? Entre em contato com o Instituto Família Poncio — Duque de Caxias/RJ.
      </p>
    </main>
  );
}
