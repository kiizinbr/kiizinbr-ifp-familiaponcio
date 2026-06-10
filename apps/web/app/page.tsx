import Link from "next/link";
import { getServerSession } from "next-auth";
import { ArrowRight, GraduationCap, HeartHandshake, Stethoscope } from "lucide-react";

import { authOptions } from "@/lib/auth";

const vitrine = [
  { nome: "Centro Médico", descricao: "Atendimento médico filantrópico em diversas especialidades.", cor: "bg-ifp-teal-bright" },
  { nome: "Centro de Capacitação", descricao: "Cursos gratuitos para inserção no mercado de trabalho.", cor: "bg-ifp-orange" },
  { nome: "Centro Esportivo", descricao: "Modalidades esportivas, hoje com foco em Jiu-Jitsu.", cor: "bg-ifp-orange-deep" },
  { nome: "Centro Recreativo", descricao: "Atividades e cuidados para a primeira infância.", cor: "bg-ifp-teal-deep" },
] as const;

/** Áreas de trabalho por perfil — o hub de quem está logado. */
const AREAS: {
  href: string;
  nome: string;
  descricao: string;
  perfis: string[];
  icone: React.ReactNode;
}[] = [
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
];

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  const minhasAreas = session
    ? AREAS.filter((a) => session.perfis?.some((p) => a.perfis.includes(p)))
    : [];

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

      {session ? (
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
      ) : (
        <div className="mb-16 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-ifp-sm transition hover:bg-primary-hover"
          >
            Entrar no sistema <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      <section aria-label="Unidades" className="grid gap-6 md:grid-cols-2">
        {vitrine.map((u) => (
          <article
            key={u.nome}
            className="rounded-lg border border-border bg-surface p-6 shadow-ifp-sm"
          >
            <div className={`mb-4 h-2 w-12 rounded-full ${u.cor}`} aria-hidden />
            <h2 className="text-xl font-semibold text-foreground">{u.nome}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{u.descricao}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
