import Link from "next/link";
import { getServerSession } from "next-auth";
import {
  ArrowRight,
  Baby,
  Crown,
  GraduationCap,
  HeartHandshake,
  Home,
  Medal,
  Stethoscope,
} from "lucide-react";

import { authOptions } from "@/lib/auth";
import { UNIDADES_ACESSO } from "@/lib/unidades";
import SiteShell from "./(site)/_components/SiteShell";

/** Áreas de trabalho por perfil — o hub de quem está logado. */
const AREAS: {
  href: string;
  nome: string;
  descricao: string;
  perfis: string[];
  icone: React.ReactNode;
}[] = [
  {
    href: "/presidencia",
    nome: "Sala de Comando",
    descricao: "Painel da Presidência: impacto, famílias, unidades e jornada.",
    perfis: ["SUPER_ADMIN", "PRESIDENCIA"],
    icone: <Crown className="h-6 w-6" />,
  },
  {
    href: "/servico-social",
    nome: "Serviço Social",
    descricao: "Fichas Cidadãs, elegibilidade e acompanhamento das famílias.",
    perfis: ["SUPER_ADMIN", "SERVICO_SOCIAL", "PRESIDENCIA"],
    icone: <HeartHandshake className="h-6 w-6" />,
  },
  {
    href: "/medico",
    nome: "Centro Médico",
    descricao: "Agenda do dia, prancha de atendimento e prontuário.",
    perfis: ["SUPER_ADMIN", "PROFISSIONAL", "GESTOR_UNIDADE", "RECEPCAO"],
    icone: <Stethoscope className="h-6 w-6" />,
  },
  {
    href: "/capacitacao",
    nome: "Centro de Capacitação",
    descricao: "Turmas, chamada e certificados verificáveis.",
    perfis: ["SUPER_ADMIN", "PROFISSIONAL", "GESTOR_UNIDADE"],
    icone: <GraduationCap className="h-6 w-6" />,
  },
  {
    href: "/educacional",
    nome: "Centro Educacional",
    descricao: "Turmas infantis, check-in/out, diário e comunicados.",
    perfis: ["SUPER_ADMIN", "PROFISSIONAL", "GESTOR_UNIDADE"],
    icone: <Baby className="h-6 w-6" />,
  },
  {
    href: "/esportivo",
    nome: "Centro Esportivo",
    descricao: "Modalidades, turmas e graduações verificáveis.",
    perfis: ["SUPER_ADMIN", "PROFISSIONAL", "GESTOR_UNIDADE"],
    icone: <Medal className="h-6 w-6" />,
  },
  {
    href: "/familia",
    nome: "Portal da Família",
    descricao: "Diário do dia, comunicados e ficha da criança.",
    perfis: ["RESPONSAVEL_FAMILIAR"],
    icone: <Home className="h-6 w-6" />,
  },
];

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  // Anônimo: a "/" é a landing pública institucional (porta de entrada calorosa,
  // tom energético, sem doação/parcerias). O hub abaixo é só para quem já entrou.
  if (!session) {
    return <SiteShell />;
  }

  const minhasAreas = AREAS.filter((a) => session.perfis?.some((p) => a.perfis.includes(p)));

  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <header className="mb-12 text-center">
        <p className="text-sm uppercase tracking-widest text-ifp-orange">
          Instituto Família Poncio
        </p>
        <h1 className="mt-3 text-4xl font-bold text-foreground md:text-5xl">IFP Connect</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Plataforma unificada de saúde, capacitação, esporte e educação infantil.
        </p>
      </header>

      <section aria-label="Suas áreas" className="mb-16">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Olá, {session.user?.name ?? session.user?.email} — suas áreas de trabalho
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {minhasAreas.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="group rounded-lg border border-border bg-surface p-5 shadow-ifp-sm transition hover:shadow-casa-sm"
            >
              <span className="text-primary">{a.icone}</span>
              <h3 className="mt-3 flex items-center gap-1 font-semibold text-foreground group-hover:text-primary">
                {a.nome}
                <ArrowRight className="h-4 w-4 opacity-0 transition group-hover:opacity-100" />
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">{a.descricao}</p>
            </Link>
          ))}
          {minhasAreas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Seu usuário ainda não tem áreas atribuídas — fale com o administrador.
            </p>
          ) : null}
        </div>
      </section>

      {/* Vitrine: cada unidade leva ao login já com o tema do salão. */}
      <section aria-label="Unidades" className="grid gap-6 md:grid-cols-2">
        {UNIDADES_ACESSO.filter((u) => u.atendimento).map((u) => (
          <div key={u.slug} data-theme={u.tema}>
            <Link
              href={`/login?unidade=${u.slug}`}
              className="group block rounded-lg border border-border bg-surface p-6 shadow-ifp-sm transition hover:border-primary/60 hover:shadow-casa-sm"
            >
              <div className={`mb-4 h-2 w-12 rounded-full ${u.cor}`} aria-hidden />
              <h2 className="flex items-center gap-1 text-xl font-semibold text-foreground group-hover:text-primary">
                {u.nome}
                <ArrowRight className="h-4 w-4 opacity-0 transition group-hover:opacity-100" />
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">{u.descricao}</p>
            </Link>
          </div>
        ))}
      </section>
    </main>
  );
}
