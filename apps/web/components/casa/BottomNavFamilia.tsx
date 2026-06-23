"use client";

/** Navegação inferior do portal da família (mobile) — destaca o ativo via rota. */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Award, CalendarDays, Baby, BellRing, BookOpen, MessagesSquare } from "lucide-react";

import { cn } from "@/lib/cn";

const ITENS = [
  { href: "/familia/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/familia/diario", label: "Diário", icon: BookOpen },
  { href: "/familia/comunicados", label: "Avisos", icon: BellRing },
  { href: "/familia/recebido", label: "Recebido", icon: Award },
  { href: "/familia/mensagens", label: "Mensagens", icon: MessagesSquare },
  { href: "/familia/crianca", label: "Criança", icon: Baby },
];

export function BottomNavFamilia() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface">
      <div className="mx-auto grid max-w-2xl grid-cols-6">
        {ITENS.map((it) => {
          const Icon = it.icon;
          const ativo = pathname === it.href || pathname.startsWith(it.href + "/");
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "flex flex-col items-center gap-1 py-3 text-xs font-semibold transition",
                ativo ? "text-primary" : "text-muted-foreground hover:text-primary",
              )}
            >
              <Icon className="h-6 w-6" />
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
