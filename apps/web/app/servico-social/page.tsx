import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";

export const metadata = { title: "Serviço Social" };

const PERFIS_PERMITIDOS = ["SUPER_ADMIN", "SERVICO_SOCIAL"];

export default async function ServicoSocialDashboard() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login?callbackUrl=/servico-social");
  }

  const autorizado = session.perfis?.some((p) => PERFIS_PERMITIDOS.includes(p));
  if (!autorizado) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-foreground">Acesso restrito</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Esta área é exclusiva da equipe de Serviço Social. Se você acha que isso é um engano,
          fale com o administrador.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-10">
        <p className="text-xs uppercase tracking-widest text-ifp-orange">Serviço Social</p>
        <h1 className="mt-1 text-3xl font-bold text-foreground">
          Olá, {session.user.name ?? session.user.email}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Perfis: {session.perfis.join(", ")}
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-lg border border-border bg-surface p-6 shadow-ifp-sm">
          <h2 className="text-lg font-semibold text-foreground">Nova Ficha Cidadã</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Iniciar atendimento de uma nova família. <em>(wizard pendente)</em>
          </p>
        </article>
        <article className="rounded-lg border border-border bg-surface p-6 shadow-ifp-sm">
          <h2 className="text-lg font-semibold text-foreground">Fichas pendentes</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Avaliações de elegibilidade aguardando triagem. <em>(listagem pendente)</em>
          </p>
        </article>
        <article className="rounded-lg border border-border bg-surface p-6 shadow-ifp-sm">
          <h2 className="text-lg font-semibold text-foreground">Reavaliações</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Famílias com reavaliação agendada para os próximos 30 dias.
          </p>
        </article>
      </section>
    </main>
  );
}
