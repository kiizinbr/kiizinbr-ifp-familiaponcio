"use client";

/**
 * Sino da topbar (CASA) — Central de Avisos REAL. Consome GET /notificacoes
 * (agregação read-only de sinais reais por perfil) e mostra: o contador real
 * de pendências num badge e um dropdown com os avisos mais recentes, cada um
 * linkando para a tela correspondente. Substitui o antigo <span> "Em breve".
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Loader2 } from "lucide-react";

import { formatDataHora } from "@/lib/format";
import { useNotificacoes } from "@/lib/use-notificacoes";

export function SinoNotificacoes() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError } = useNotificacoes();
  const total = data?.total ?? 0;
  const itens = data?.itens ?? [];

  // Fecha o dropdown ao clicar fora (mesmo padrão da BuscaGlobal).
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
    router.push(href);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-label={total > 0 ? `Avisos (${total} pendente(s))` : "Avisos"}
        aria-haspopup="true"
        aria-expanded={aberto}
        className="relative flex h-[38px] w-[38px] items-center justify-center rounded-xl border border-border bg-surface text-muted-foreground transition hover:bg-[var(--unidade-suave)] hover:text-[var(--unidade-escuro)]"
      >
        <Bell className="h-[18px] w-[18px]" />
        {total > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-ifp-white">
            {total > 99 ? "99+" : total}
          </span>
        ) : null}
      </button>

      {aberto ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-30 max-h-[70vh] w-[340px] overflow-y-auto rounded-xl border border-border bg-background py-1.5 shadow-[var(--ifp-shadow-casa)]"
        >
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-foreground">
              Avisos
            </span>
            {total > 0 ? (
              <span className="rounded-full bg-[var(--unidade-suave)] px-2 py-0.5 text-[10px] font-semibold text-[var(--unidade-escuro)]">
                {total} pendente{total > 1 ? "s" : ""}
              </span>
            ) : null}
          </div>

          {isLoading ? (
            <p className="flex items-center gap-2 px-4 py-4 text-[12.5px] text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Carregando avisos…
            </p>
          ) : isError ? (
            <p className="px-4 py-4 text-[12.5px] text-danger">
              Não foi possível carregar os avisos.
            </p>
          ) : itens.length === 0 ? (
            <p className="px-4 py-4 text-[12.5px] text-muted-foreground">Nenhum aviso.</p>
          ) : (
            itens.map((n) => (
              <button
                key={n.id}
                type="button"
                role="menuitem"
                onClick={() => irPara(n.href)}
                className="flex w-full flex-col gap-0.5 px-4 py-2.5 text-left transition hover:bg-[var(--unidade-suave)]"
              >
                <span className="truncate text-[13px] font-medium text-foreground">
                  {n.titulo}
                </span>
                {n.descricao ? (
                  <span className="truncate text-[11px] text-muted-foreground">{n.descricao}</span>
                ) : null}
                {n.em ? (
                  <span className="text-[10px] text-muted-foreground">{formatDataHora(n.em)}</span>
                ) : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
