"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

/**
 * Toggle de tema claro/escuro do kit (`.toggle-pill`). Dark é SECUNDÁRIO: o app
 * sempre inicia no claro e NÃO persiste a escolha — o toggle muda `data-theme`
 * no <html> só na sessão atual (vale entre navegações in-app; recarregar volta
 * pro claro). Lê o tema vigente no mount pra refletir o estado real.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const cur = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    setTheme(cur);
  }, []);

  function toggle() {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset.theme = next;
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="toggle-pill"
      aria-label="Alternar tema claro/escuro"
    >
      <span className="dot" />
      {theme === "light" ? "Tema claro" : "Tema escuro"}
    </button>
  );
}
