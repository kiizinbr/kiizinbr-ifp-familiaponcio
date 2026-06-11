"use client";

/** Tela 2 do portal: comunicados — os críticos pedem confirmação de leitura. */
import { BellRing, CheckCheck } from "lucide-react";

import { Alerta, Botao, Spinner } from "@/components/ui";
import { useComunicadosFamilia, useConfirmarLeitura } from "@/lib/use-educacional";

export default function ComunicadosFamiliaPage() {
  const { data, isLoading, error } = useComunicadosFamilia();
  const confirmar = useConfirmarLeitura();

  if (isLoading) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <Spinner label="Carregando comunicados..." />
      </main>
    );
  }
  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <Alerta tipo="erro">{(error as Error).message}</Alerta>
      </main>
    );
  }

  const items = data?.items ?? [];

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-lg font-bold text-foreground">Comunicados</h1>

      <ul className="mt-4 space-y-3">
        {items.map((c) => (
          <li
            key={c.id}
            className={`rounded-xl border p-4 ${
              c.critico && !c.lidoEm
                ? "border-warning/70 bg-warning/10"
                : "border-border bg-surface"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                {c.critico && (
                  <p className="mb-1 inline-flex items-center gap-1 rounded-full bg-warning/20 px-2 py-0.5 text-[11px] font-bold uppercase text-warning">
                    <BellRing className="h-3 w-3" /> Importante
                  </p>
                )}
                <p className="text-sm font-semibold text-foreground">{c.titulo}</p>
                <p className="mt-1 text-sm text-muted-foreground">{c.corpo}</p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {new Date(c.criadoEm).toLocaleDateString("pt-BR")}
                </p>
              </div>
            </div>

            {c.critico && !c.lidoEm ? (
              <Botao
                className="mt-3 w-full"
                carregando={confirmar.isPending}
                onClick={() => confirmar.mutate(c.id)}
              >
                <CheckCheck className="mr-1 h-4 w-4" /> Li e estou ciente
              </Botao>
            ) : c.lidoEm ? (
              <p className="mt-3 flex items-center gap-1 text-xs font-semibold text-success">
                <CheckCheck className="h-3.5 w-3.5" /> Leitura confirmada em{" "}
                {new Date(c.lidoEm).toLocaleDateString("pt-BR")}
              </p>
            ) : null}
          </li>
        ))}
        {items.length === 0 && (
          <li className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhum comunicado por enquanto.
          </li>
        )}
      </ul>
    </main>
  );
}
