"use client";

/** Tela 3 (índice): escolhe a criança — com 1 só, vai direto pra ficha. */
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Baby, ChevronRight } from "lucide-react";

import { Alerta, Spinner } from "@/components/ui";
import { idade } from "@/lib/idade";
import { useMinhasCriancas } from "@/lib/use-educacional";

export default function MinhaCriancaIndice() {
  const { data, isLoading } = useMinhasCriancas();
  const router = useRouter();

  const items = data?.items ?? [];

  useEffect(() => {
    if (!isLoading && items.length === 1) {
      router.replace(`/familia/crianca/${items[0]!.crianca.id}`);
    }
  }, [isLoading, items, router]);

  if (isLoading) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <Spinner label="Carregando..." />
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <Alerta tipo="info">Nenhuma criança matriculada encontrada.</Alerta>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-lg font-bold text-foreground">Minhas crianças</h1>
      <ul className="mt-4 space-y-2">
        {items.map((m) => (
          <li key={m.id}>
            <Link
              href={`/familia/crianca/${m.crianca.id}`}
              className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 transition hover:border-primary/50"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Baby className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {m.crianca.nomeCompleto}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {idade(m.crianca.dataNascimento)} anos · {m.turma.nome}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
