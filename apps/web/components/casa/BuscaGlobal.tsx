"use client";

/**
 * Busca global da topbar (CASA). Campo real que consulta /busca conforme o
 * RBAC do usuário (fichas e/ou usuários) e mostra um dropdown de resultados
 * clicáveis. Substitui o antigo <span> "Em breve".
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Search, UserRound } from "lucide-react";

import { useBuscaGlobal, type ResultadoBusca } from "@/lib/use-conta";

const ICONE: Record<ResultadoBusca["tipo"], typeof FileText> = {
  ficha: FileText,
  usuario: UserRound,
};

export function BuscaGlobal() {
  const router = useRouter();
  const [termo, setTermo] = useState("");
  const [aberto, setAberto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, isFetching } = useBuscaGlobal(termo);
  const resultados = data?.resultados ?? [];
  const buscando = termo.trim().length >= 2;

  // Fecha o dropdown ao clicar fora.
  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, []);

  function irPara(href: string) {
    setAberto(false);
    setTermo("");
    router.push(href);
  }

  return (
    <div ref={containerRef} className="relative max-w-[420px] flex-1">
      <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-muted-foreground focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
        <Search className="h-4 w-4" aria-hidden="true" />
        <input
          type="search"
          value={termo}
          onChange={(e) => {
            setTermo(e.target.value);
            setAberto(true);
          }}
          onFocus={() => setAberto(true)}
          placeholder="Buscar família, protocolo, beneficiário…"
          aria-label="Busca global"
          className="w-full bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        {isFetching && buscando ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
        ) : null}
      </div>

      {aberto && buscando ? (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-[60vh] overflow-y-auto rounded-xl border border-border bg-background py-1.5 shadow-[var(--ifp-shadow-casa)]"
        >
          {resultados.length === 0 ? (
            <p className="px-4 py-3 text-[12.5px] text-muted-foreground">
              {isFetching ? "Buscando…" : "Nenhum resultado encontrado."}
            </p>
          ) : (
            resultados.map((r) => {
              const Icone = ICONE[r.tipo];
              return (
                <button
                  key={`${r.tipo}-${r.id}`}
                  type="button"
                  role="option"
                  aria-selected="false"
                  onClick={() => irPara(r.href)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-[var(--unidade-suave)]"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--unidade-suave)] text-[var(--unidade-escuro)]">
                    <Icone className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-foreground">
                      {r.titulo}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {r.subtitulo}
                    </span>
                  </span>
                  <span className="ml-auto rounded-full bg-[var(--unidade-suave)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--unidade-escuro)]">
                    {r.tipo === "ficha" ? "Ficha" : "Usuário"}
                  </span>
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
