import Link from "next/link";

const unidades = [
  {
    nome: "Centro Médico",
    descricao: "Atendimento médico filantrópico em diversas especialidades.",
    theme: "medico",
    cor: "bg-ifp-teal-bright",
  },
  {
    nome: "Centro de Capacitação",
    descricao: "Cursos gratuitos para inserção no mercado de trabalho.",
    theme: "capacitacao",
    cor: "bg-ifp-orange",
  },
  {
    nome: "Centro Esportivo",
    descricao: "Modalidades esportivas, hoje com foco em Jiu-Jitsu.",
    theme: "esportivo",
    cor: "bg-ifp-orange-deep",
  },
  {
    nome: "Centro Recreativo",
    descricao: "Atividades e cuidados para a primeira infância.",
    theme: "educacional",
    cor: "bg-ifp-teal-deep",
  },
] as const;

export default function HomePage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <header className="mb-12 text-center">
        <p className="text-sm uppercase tracking-widest text-ifp-orange">Instituto Família Poncio</p>
        <h1 className="mt-3 text-4xl font-bold text-foreground md:text-5xl">IFP Connect</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Plataforma unificada de saúde, capacitação, esporte e educação infantil.
        </p>
      </header>

      <section aria-label="Unidades" className="grid gap-6 md:grid-cols-2">
        {unidades.map((unidade) => (
          <article
            key={unidade.theme}
            className="rounded-lg border border-border bg-surface p-6 shadow-ifp-sm"
          >
            <div className={`mb-4 h-2 w-12 rounded-full ${unidade.cor}`} aria-hidden />
            <h2 className="text-xl font-semibold text-foreground">{unidade.nome}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{unidade.descricao}</p>
          </article>
        ))}
      </section>

      <footer className="mt-16 text-center text-xs text-muted-foreground">
        <p>
          Em construção — Fase 0 (Fundação).{" "}
          <Link className="underline hover:text-ifp-orange" href="/servico-social">
            Acesso Serviço Social
          </Link>
        </p>
      </footer>
    </main>
  );
}
