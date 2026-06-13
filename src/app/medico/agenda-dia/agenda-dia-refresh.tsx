"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Refresh passivo do board: re-renderiza o RSC a cada 30s reusando a própria
 * query da lib (sem endpoint REST novo, sem dependência nova). O board é
 * operado pela recepção/gestão, então 30s basta — não é o painel-TV de 2s.
 * Pausa quando a aba está oculta pra não bater no banco à toa.
 */
export function AgendaDiaRefresh({ intervaloMs = 30_000 }: { intervaloMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    let id: ReturnType<typeof setInterval> | undefined;

    const start = () => {
      if (id) return;
      id = setInterval(() => router.refresh(), intervaloMs);
    };
    const stop = () => {
      if (id) {
        clearInterval(id);
        id = undefined;
      }
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, intervaloMs]);

  return null;
}
