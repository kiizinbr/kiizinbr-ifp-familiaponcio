import Link from "next/link";
import { getServerSession } from "next-auth";
import { CalendarClock, ClipboardList, FilePlus2 } from "lucide-react";

import { authOptions } from "@/lib/auth";
import { PageHeader, SecTitle } from "@/components/casa";
import { PainelInicioSocial } from "./_components/painel-inicio";

export const metadata = { title: "Serviço Social" };

// O guard de sessão/perfil fica no layout.tsx; aqui só montamos o painel.
const atalhos = [
  {
    href: "/servico-social/fichas/nova",
    titulo: "Nova Ficha Cidadã",
    descricao: "Iniciar o cadastro de uma nova família atendida.",
    Icone: FilePlus2,
  },
  {
    href: "/servico-social/fichas",
    titulo: "Todas as fichas",
    descricao: "Buscar, filtrar e abrir fichas já cadastradas.",
    Icone: ClipboardList,
  },
  {
    href: "/servico-social/fichas?status=PENDENTE",
    titulo: "Pendentes de triagem",
    descricao: "Fichas com elegibilidade aguardando avaliação.",
    Icone: CalendarClock,
  },
];

export default async function ServicoSocialDashboard() {
  const session = await getServerSession(authOptions);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <PageHeader
        titulo={`Olá, ${session?.user?.name ?? session?.user?.email}`}
        descricao="Gerencie as Fichas Cidadãs e a elegibilidade das famílias nas 4 unidades."
      />
      <div className="mb-8" />

      <PainelInicioSocial />

      <SecTitle>Atalhos rápidos</SecTitle>
      <section className="grid gap-4 md:grid-cols-3">
        {atalhos.map(({ href, titulo, descricao, Icone }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-[18px] border border-border bg-surface p-5 shadow-[var(--ifp-shadow-casa-sm)] transition hover:border-ifp-orange hover:shadow-[var(--ifp-shadow-casa)]"
          >
            <Icone className="h-6 w-6 text-ifp-orange" />
            <h2 className="mt-3 text-lg font-semibold text-foreground">{titulo}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
