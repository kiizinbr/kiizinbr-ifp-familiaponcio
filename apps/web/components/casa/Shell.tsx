/**
 * Shell CASA — o "esqueleto" das telas, em 2 modos:
 *  - ShellInterno: topbar + rail lateral (gestão/operação), recolore por unidade.
 *    Vai no layout.tsx do módulo; as páginas mantêm seu próprio conteúdo/<main>.
 *  - ShellMobile: moldura de celular + navegação inferior (portal família).
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { Bell, BookOpen, User } from "lucide-react";

import { SairButton } from "@/components/sair-button";
import { Brandmark } from "./Brandmark";
import { BuscaGlobal } from "./BuscaGlobal";
import { CrestAvatar } from "./CrestAvatar";
import { Rail } from "./Rail";
import { SeletorUnidade } from "./SeletorUnidade";
import { SinoNotificacoes } from "./SinoNotificacoes";
import { NOME_UNIDADE, type ModuloCasa } from "./nav";

function Topbar({ modulo, user, cargo, iniciais }: { modulo: ModuloCasa; user: string; cargo: string; iniciais: string }) {
  return (
    <header className="sticky top-0 z-20 col-span-2 flex h-[70px] items-center gap-4 border-b border-border bg-background px-5">
      <div className="flex items-center gap-3">
        <span className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-background text-primary shadow-[inset_0_0_0_1.5px_var(--ifp-dourado)]">
          <Brandmark size={30} title="IFP Connect" />
        </span>
        <div className="leading-tight">
          <div className="text-[13px] font-semibold uppercase tracking-[0.13em] text-foreground">IFP Connect</div>
          <div className="mt-0.5 text-[9.5px] font-semibold uppercase tracking-[0.22em] text-[var(--unidade-escuro)]">
            {NOME_UNIDADE[modulo]}
          </div>
        </div>
      </div>
      <BuscaGlobal />
      <div className="ml-auto flex items-center gap-3.5">
        <SeletorUnidade slugAtivo={modulo} />
        <SinoNotificacoes />
        <Link
          href="/conta"
          title="Minha conta"
          className="flex items-center gap-2 rounded-xl px-1.5 py-1 transition hover:bg-[var(--unidade-suave)]"
        >
          <CrestAvatar iniciais={iniciais} size={34} />
          <span className="leading-tight">
            <span className="block text-[12.5px] font-semibold text-foreground">{user}</span>
            <span className="block text-[10px] text-muted-foreground">{cargo}</span>
          </span>
        </Link>
        <SairButton />
      </div>
    </header>
  );
}

export function ShellInterno({
  modulo,
  theme,
  user = "Erick Ramos",
  cargo = "Presidência",
  iniciais = "ER",
  habilitadas,
  children,
}: {
  modulo: ModuloCasa;
  /** sobrescreve o data-theme; default segue o módulo */
  theme?: string;
  user?: string;
  cargo?: string;
  iniciais?: string;
  /** rotas do rail que já existem; as demais aparecem como "em breve" */
  habilitadas?: string[];
  children: ReactNode;
}) {
  return (
    <div
      data-theme={theme ?? modulo}
      className="grid min-h-screen grid-cols-[86px_1fr] grid-rows-[70px_1fr] bg-background"
    >
      <Topbar modulo={modulo} user={user} cargo={cargo} iniciais={iniciais} />
      <Rail modulo={modulo} habilitadas={habilitadas} />
      <div className="col-start-2 row-start-2 overflow-y-auto">{children}</div>
    </div>
  );
}

export function ShellMobile({
  user = "Sandra",
  sub = "Mãe da Ana",
  children,
}: {
  user?: string;
  sub?: string;
  children: ReactNode;
}) {
  const nav = [
    { label: "Diário", icon: BookOpen },
    { label: "Avisos", icon: Bell },
    { label: "Criança", icon: User },
  ];
  return (
    <div
      data-theme="educacional"
      className="flex min-h-screen items-center justify-center bg-[repeating-linear-gradient(45deg,#f1e7df,#f1e7df_12px,#efe4db_12px,#efe4db_24px)] p-6"
    >
      <div className="relative flex h-[780px] w-[390px] max-w-full flex-col overflow-hidden rounded-[42px] border-[9px] border-[#2a1c12] bg-background shadow-[var(--ifp-shadow-casa)]">
        <div className="flex items-center gap-2.5 bg-primary px-5 py-3.5 text-white">
          <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-white/15 text-white shadow-[inset_0_0_0_1.5px_rgba(255,255,255,0.6)]">
            <Brandmark size={23} title="IFP" />
          </span>
          <div>
            <div className="text-[13px] font-semibold">{user}</div>
            <div className="text-[10px] opacity-85">{sub}</div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-[90px] pt-4">{children}</div>
        <div className="absolute inset-x-0 bottom-0 flex h-[72px] items-center justify-around border-t border-border bg-surface pb-1.5">
          {nav.map((n, i) => {
            const Icon = n.icon;
            return (
              <span key={n.label} className={i === 0 ? "flex flex-col items-center gap-0.5 text-[9.5px] font-semibold text-primary" : "flex flex-col items-center gap-0.5 text-[9.5px] font-semibold text-muted-foreground"}>
                <Icon className="h-[22px] w-[22px]" />
                {n.label}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
