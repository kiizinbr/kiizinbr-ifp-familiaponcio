"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

/**
 * Toggle de tema claro/escuro do kit (`.toggle-pill`). Seta `data-theme` no
 * <html> e persiste em localStorage. Lê o tema atual no mount (que o script
 * inline do layout já aplicou) pra não piscar.
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
    try {
      localStorage.setItem("ifp-theme", next);
    } catch {
      // localStorage indisponível (modo privado) — toggle vale só na sessão
    }
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
