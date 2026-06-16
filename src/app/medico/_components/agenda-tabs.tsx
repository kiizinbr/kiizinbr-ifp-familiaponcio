"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

/**
 * #17 — Barra de abas compartilhada das três visões de agenda do Centro Médico
 * (Hoje / Semana / Fila do dia). Componente PURO de navegação: nenhum fetch,
 * nenhuma action, nenhuma lógica de domínio. Reusa o `.segmented` do kit
 * (ifp-components.css) como visual — sem cor inventada (tudo via tokens).
 *
 * Só é renderizada pelas três pages de agenda, então a barra nunca aparece em
 * /medico/consultas/* nem em qualquer outra rota.
 *
 * A aba ativa é decidida pela rota atual com a MESMA regra do `sidebar-nav`
 * (`usePathname()` + `startsWith`), com um override opcional via prop `active`
 * para o caso em que a page já sabe qual aba é a sua (evita depender do timing
 * do pathname no primeiro paint do RSC).
 */

type AbaId = "hoje" | "semana" | "fila";

interface Aba {
  id: AbaId;
  label: string;
  href: Route;
}

const ABAS: readonly Aba[] = [
  { id: "fila", label: "Fila do dia", href: "/medico" },
  { id: "hoje", label: "Agenda do dia", href: "/medico/agenda-dia" },
  { id: "semana", label: "Agenda semanal", href: "/medico/agenda" },
] as const;

/**
 * Mesma intenção do `isActive` do sidebar-nav: rota exata OU prefixo. A ordem em
 * `ABAS` coloca `/medico/agenda-dia` antes de `/medico/agenda` por clareza, mas
 * a checagem é por href exato (`/medico` nunca "vaza" pra `/medico/agenda`
 * porque comparamos com `===` e o prefixo `${href}/`, não um `startsWith` solto).
 */
function abaAtiva(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AgendaTabs({
  active,
  meusHref,
}: {
  /** Override opcional da aba ativa (a page conhece a sua). */
  active?: AbaId;
  /** Quando presente, renderiza o atalho "Só os meus" → ?profissionalId=<id>. */
  meusHref?: Route;
}) {
  const pathname = usePathname() ?? "";

  return (
    <nav
      aria-label="Visões da agenda"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        marginBottom: 20,
      }}
    >
      {/* Navegação entre ROTAS (não abas in-page): cada item é um <Link> e a ativa
          é marcada com aria-current="page". Sem role="tablist"/"tab"/aria-selected
          — esses implicariam tabpanels que não existem e mentiriam pro leitor de
          tela. A navegação por Tab entre os links já funciona nativamente. O visual
          continua o do kit (.segmented + .on). */}
      <div className="segmented">
        {ABAS.map((aba) => {
          const on = active ? active === aba.id : abaAtiva(pathname, aba.href);
          return (
            <Link
              key={aba.id}
              href={aba.href}
              aria-current={on ? "page" : undefined}
              className={clsx(on && "on")}
              style={{ textDecoration: "none" }}
            >
              {aba.label}
            </Link>
          );
        })}
      </div>

      {meusHref ? (
        <Link href={meusHref} className="nav-item" style={{ padding: "6px 10px" }}>
          Só os meus
        </Link>
      ) : null}
    </nav>
  );
}
