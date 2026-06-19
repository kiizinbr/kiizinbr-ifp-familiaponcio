"use client";

/**
 * Beneficiários do Centro Médico: lista dos pacientes elegíveis (aprovados pelo
 * Serviço Social) com busca; abre a ficha clínica de cada um.
 */
import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, Search, Users } from "lucide-react";

import { useBeneficiarios } from "@/lib/use-medico";
import { PageHeader } from "@/components/casa";
import { Alerta, Input, Spinner } from "@/components/ui";
import { idade } from "@/lib/idade";

export default function BeneficiariosPage() {
  const [q, setQ] = useState("");
  const { data, isLoading, error } = useBeneficiarios(q);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <PageHeader titulo="Beneficiários" descricao="Pacientes elegíveis no Centro Médico." />

      <div className="relative mt-2">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar paciente por nome..."
        />
      </div>

      {isLoading ? <Spinner label="Carregando beneficiários..." /> : null}
      {error ? <div className="mt-4"><Alerta>{(error as Error).message}</Alerta></div> : null}

      <ul className="mt-4 space-y-2">
        {data?.items.map((b) => (
          <li key={b.id}>
            <Link
              href={`/medico/beneficiarios/${b.id}`}
              className="group flex items-center gap-4 rounded-lg border border-border bg-surface p-3 transition hover:border-primary/50"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-foreground group-hover:text-primary">
                  {b.nomeCompleto}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {idade(b.dataNascimento)} anos
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">{b.protocolo}</div>
              </div>
              {b.alergiasAtivas > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-danger/40 bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">
                  <AlertTriangle className="h-3 w-3" /> {b.alergiasAtivas} alergia(s)
                </span>
              ) : null}
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
            </Link>
          </li>
        ))}
        {data && data.items.length === 0 ? (
          <li className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nenhum beneficiário encontrado.
          </li>
        ) : null}
      </ul>
    </main>
  );
}
