import { auth } from "@/lib/auth";
import { signOutAction } from "./actions";

export default async function AppHome() {
  const session = await auth();
  const displayName = session?.user?.name ?? session?.user?.email ?? "Usuário";

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold">IFP Connect</span>
            <div className="flex h-1 w-12 overflow-hidden rounded">
              <span className="flex-1 bg-[rgb(var(--ifp-social))]" />
              <span className="flex-1 bg-[rgb(var(--ifp-medico))]" />
              <span className="flex-1 bg-[rgb(var(--ifp-capacitacao))]" />
              <span className="flex-1 bg-[rgb(var(--ifp-educacional))]" />
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-600">{displayName}</span>
            <form action={signOutAction}>
              <button
                type="submit"
                className="rounded border border-slate-300 px-3 py-1 text-slate-700 transition hover:bg-slate-100"
              >
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
        <h1 className="text-3xl font-semibold">Olá, {displayName}</h1>
        <p className="mt-2 text-slate-600">
          Bem-vindo ao Núcleo Transversal do IFP Connect. O dashboard será adicionado nos próximos
          planos (RBAC, Ficha Cidadã, Triagem).
        </p>

        <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <PlaceholderCard color="medico" title="Centro Médico" />
          <PlaceholderCard color="capacitacao" title="Capacitação" />
          <PlaceholderCard color="esportivo" title="Esportivo" />
          <PlaceholderCard color="educacional" title="Recreativo / Educacional" />
        </section>
      </main>

      <footer className="border-t bg-white py-4 text-center text-xs text-slate-500">
        Instituto Família Pôncio · Uso interno
      </footer>
    </div>
  );
}

function PlaceholderCard({
  color,
  title,
}: {
  color: "medico" | "capacitacao" | "esportivo" | "educacional";
  title: string;
}) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className={`h-1 w-8 rounded bg-[rgb(var(--ifp-${color}))]`} />
      <h2 className="mt-3 text-sm font-medium text-slate-900">{title}</h2>
      <p className="mt-1 text-xs text-slate-500">Em breve</p>
    </div>
  );
}
