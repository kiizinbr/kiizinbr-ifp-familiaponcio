"use client";

/** Rail lateral do Shell interno — destaca o item ativo via rota e marca
 *  como "em breve" o que ainda não existe (rotas fora de `habilitadas`). */
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";
import { NAV, type ModuloCasa } from "./nav";

export function Rail({ modulo, habilitadas }: { modulo: ModuloCasa; habilitadas?: string[] }) {
  const pathname = usePathname();
  return (
    <nav className="sticky top-[70px] flex h-[calc(100vh-70px)] w-[86px] flex-col items-center gap-1.5 border-r border-border bg-background py-4">
      {NAV[modulo].map((item) => {
        const Icon = item.icon;
        const ativo = pathname === item.href || pathname.startsWith(item.href + "/");
        const habilitado = !habilitadas || habilitadas.includes(item.href);
        const classe = cn(
          "flex h-[54px] w-[58px] flex-col items-center justify-center gap-1 rounded-2xl transition",
          ativo
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-surface hover:text-[var(--unidade-escuro)]",
        );
        const conteudo = (
          <>
            <Icon className="h-[21px] w-[21px]" />
            <span className="text-[8.5px] font-semibold uppercase tracking-[0.04em]">{item.label}</span>
          </>
        );
        if (!habilitado) {
          return (
            <span key={item.href} title="Em breve" className={cn(classe, "cursor-default opacity-40")}>
              {conteudo}
            </span>
          );
        }
        return (
          <Link key={item.href} href={item.href} className={classe}>
            {conteudo}
          </Link>
        );
      })}
    </nav>
  );
}
