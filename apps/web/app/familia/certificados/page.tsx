"use client";

/**
 * Portal da família — galeria de conquistas.
 * Certificados (capacitação) e graduações (esporte) das crianças/titular.
 * Cada certificado abre o PDF oficial (com QR de verificação); cada item
 * traz o link de verificação pública. Só conquistas da própria família.
 */
import { Award, Download, ExternalLink, Sparkles } from "lucide-react";

import { Alerta, Botao, Spinner } from "@/components/ui";
import {
  useBaixarCertificadoPdf,
  useCertificadosFamilia,
  type CertificadoFamilia,
  type GraduacaoFamilia,
} from "@/lib/use-familia";

function dataLegivel(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function urlVerificacaoCert(codigo: string) {
  return `/verificar/${codigo}`;
}

export default function CertificadosFamiliaPage() {
  const { data, isLoading, isError } = useCertificadosFamilia();
  const baixar = useBaixarCertificadoPdf();

  if (isLoading) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <Spinner label="Buscando as conquistas da sua família..." />
      </main>
    );
  }

  if (isError || !data) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <Alerta tipo="erro">
          Não foi possível carregar as conquistas agora. Tente novamente em instantes.
        </Alerta>
      </main>
    );
  }

  const { certificados, graduacoes } = data;
  const vazio = certificados.length === 0 && graduacoes.length === 0;

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <header className="mb-5">
        <h1 className="text-xl font-bold text-foreground">Conquistas e certificados</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Certificados de cursos e graduações esportivas da sua família.
        </p>
      </header>

      {baixar.isError && (
        <div className="mb-4">
          <Alerta tipo="erro">
            {baixar.error instanceof Error
              ? baixar.error.message
              : "Não foi possível abrir o certificado."}
          </Alerta>
        </div>
      )}

      {vazio ? (
        <Alerta tipo="info">
          Ainda não há certificados ou graduações. Eles aparecem aqui assim que um
          curso é concluído ou uma graduação é concedida.
        </Alerta>
      ) : (
        <div className="space-y-6">
          {certificados.length > 0 && (
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                <Award className="h-4 w-4" />
                Certificados de cursos
              </h2>
              <ul className="space-y-3">
                {certificados.map((c) => (
                  <CartaoCertificado
                    key={c.id}
                    cert={c}
                    onBaixar={() => baixar.mutate(c.codigoVerificacao)}
                    baixando={baixar.isPending && baixar.variables === c.codigoVerificacao}
                  />
                ))}
              </ul>
            </section>
          )}

          {graduacoes.length > 0 && (
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                <Sparkles className="h-4 w-4" />
                Graduações esportivas
              </h2>
              <ul className="space-y-3">
                {graduacoes.map((g) => (
                  <CartaoGraduacao key={g.id} grad={g} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </main>
  );
}

function CartaoCertificado({
  cert,
  onBaixar,
  baixando,
}: {
  cert: CertificadoFamilia;
  onBaixar: () => void;
  baixando: boolean;
}) {
  return (
    <li className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Award className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">{cert.curso}</p>
          <p className="text-sm text-muted-foreground">{cert.beneficiario}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Turma {cert.turma} · {cert.cargaHorariaCumprida}h ·{" "}
            {cert.presencaPct.toFixed(0)}% de presença
          </p>
          <p className="text-xs text-muted-foreground">
            Emitido em {dataLegivel(cert.emitidoEm)}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Botao type="button" onClick={onBaixar} disabled={baixando}>
          <Download className="mr-1.5 inline h-4 w-4" />
          {baixando ? "Abrindo..." : "Baixar PDF"}
        </Botao>
        <a
          href={urlVerificacaoCert(cert.codigoVerificacao)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Verificar autenticidade
        </a>
      </div>
    </li>
  );
}

function CartaoGraduacao({ grad }: { grad: GraduacaoFamilia }) {
  return (
    <li className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">{grad.nivel}</p>
          <p className="text-sm text-muted-foreground">
            {grad.modalidade} · {grad.beneficiario}
          </p>
          {grad.observacao && (
            <p className="mt-1 text-xs text-muted-foreground">{grad.observacao}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Concedida em {dataLegivel(grad.concedidaEm)}
          </p>
        </div>
      </div>
    </li>
  );
}
