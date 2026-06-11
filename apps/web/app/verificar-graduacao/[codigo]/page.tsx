/**
 * Verificação PÚBLICA de graduação esportiva — molde da verificação de
 * certificado. Sem login: qualquer federação/escola valida a autenticidade.
 */
import { BadgeCheck, ShieldX } from "lucide-react";

import { API_BASE_URL } from "@/lib/api";

export const metadata = { title: "Verificação de graduação · IFP" };

interface VerificacaoGraduacao {
  valido: boolean;
  atleta: string;
  modalidade: string;
  turma: string;
  nivel: string;
  concedidaEm: string;
}

async function verificar(codigo: string): Promise<VerificacaoGraduacao | null> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/esportivo/graduacoes/verificar/${encodeURIComponent(codigo)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    return (await res.json()) as VerificacaoGraduacao;
  } catch {
    return null;
  }
}

export default async function VerificarGraduacaoPage({
  params,
}: {
  params: { codigo: string };
}) {
  const grad = await verificar(params.codigo);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-12">
      <p className="text-xs uppercase tracking-widest text-primary">IFP Connect</p>
      <h1 className="mt-1 text-lg font-bold text-foreground">
        Verificação de graduação
      </h1>

      {grad?.valido ? (
        <div className="mt-6 w-full rounded-lg border border-success/40 bg-surface p-6 text-center shadow-casa-sm">
          <BadgeCheck className="mx-auto h-12 w-12 text-success" />
          <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-success">
            Graduação autêntica
          </p>
          <p className="mt-4 text-xl font-bold text-foreground">{grad.atleta}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {grad.modalidade} · turma {grad.turma}
          </p>
          <p className="mt-3 text-lg font-semibold text-foreground">{grad.nivel}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Concedida em{" "}
            {grad.concedidaEm
              ? new Date(grad.concedidaEm).toLocaleDateString("pt-BR")
              : "—"}{" "}
            pelo Instituto Família Poncio
          </p>
        </div>
      ) : (
        <div className="mt-6 w-full rounded-lg border border-danger/40 bg-surface p-6 text-center shadow-ifp-sm">
          <ShieldX className="mx-auto h-12 w-12 text-danger" />
          <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-danger">
            Graduação não encontrada
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            O código <code className="rounded bg-muted px-1">{params.codigo}</code> não
            corresponde a nenhuma graduação concedida pelo IFP. Verifique se o código
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
