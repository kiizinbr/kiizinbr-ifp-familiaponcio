"use client";

/**
 * Seletor de UNIDADE pós-login (CASA). Para quem tem acesso a mais de uma
 * unidade, troca o "salão" ativo sem deslogar: lista as unidades do próprio
 * usuário (de /auth/me), valida a escolha no backend (POST /auth/unidade-ativa
 * — 404 se não for sua) e navega ao destino daquela unidade, recarregando o
 * contexto/tema do Shell. Quem tem 0 ou 1 unidade não vê controle nenhum.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronDown, Loader2 } from "lucide-react";

import { destinoPorSlug } from "@/lib/unidades";
import { useEscolherUnidade, useMinhaConta } from "@/lib/use-conta";

/** Slug da unidade do salão atual (vem do módulo do Shell), para marcar a ativa. */
export function SeletorUnidade({ slugAtivo }: { slugAtivo?: string }) {
  const router = useRouter();
  const { data: conta } = useMinhaConta();
  const escolher = useEscolherUnidade();
  const [aberto, setAberto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const unidades = conta?.unidades ?? [];

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

  // Só faz sentido trocar quando há 2+ unidades; senão não renderiza nada.
  const ativaOuVazia = unidades.find((u) => u.slug === slugAtivo) ?? unidades[0];
  if (unidades.length < 2 || !ativaOuVazia) return null;
  const ativa = ativaOuVazia; // já garantido não-nulo (TS perde a narrowing no closure)

  function trocar(unidadeId: string, slug: string) {
    setAberto(false);
    if (slug === ativa.slug) return;
    escolher.mutate(unidadeId, {
      onSuccess: (u) => router.push(destinoPorSlug(u.slug)),
    });
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        disabled={escolher.isPending}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        title="Trocar de unidade"
        className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-left transition hover:bg-[var(--unidade-suave)] disabled:opacity-60"
      >
        {escolher.isPending ? (
          <Loader2 className="h-[18px] w-[18px] animate-spin text-[var(--unidade-escuro)]" aria-hidden="true" />
        ) : (
          <Building2 className="h-[18px] w-[18px] text-[var(--unidade-escuro)]" aria-hidden="true" />
        )}
        <span className="hidden leading-tight sm:block">
          <span className="block text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Unidade
          </span>
          <span className="block max-w-[150px] truncate text-[12.5px] font-semibold text-foreground">
            {ativa.nome}
          </span>
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      </button>

      {aberto ? (
        <div
          role="listbox"
          aria-label="Suas unidades"
          className="absolute right-0 top-[calc(100%+6px)] z-30 w-[240px] overflow-hidden rounded-xl border border-border bg-background py-1.5 shadow-[var(--ifp-shadow-casa)]"
        >
          <p className="px-4 py-1.5 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Trocar de unidade
          </p>
          {unidades.map((u) => {
            const selecionada = u.slug === ativa.slug;
            return (
              <button
                key={u.id}
                type="button"
                role="option"
                aria-selected={selecionada}
                onClick={() => trocar(u.id, u.slug)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-[var(--unidade-suave)]"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--unidade-suave)] text-[var(--unidade-escuro)]">
                  <Building2 className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-foreground">
                    {u.nome}
                  </span>
                </span>
                {selecionada ? (
                  <Check className="h-4 w-4 shrink-0 text-[var(--unidade-escuro)]" aria-hidden="true" />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
