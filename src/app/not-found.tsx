import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-1 w-16 overflow-hidden rounded">
          <span className="flex-1 bg-[rgb(var(--ifp-filter-medico))]" />
          <span className="flex-1 bg-[rgb(var(--ifp-filter-capacitacao))]" />
          <span className="flex-1 bg-[rgb(var(--ifp-filter-esportivo))]" />
          <span className="flex-1 bg-[rgb(var(--ifp-filter-recreativo))]" />
        </div>
        <h1 className="text-4xl font-semibold text-[rgb(var(--ifp-ink))]">404</h1>
        <p className="mt-2 text-[rgb(var(--ifp-muted))]">
          A página que você procurou não existe ou foi movida.
        </p>
        <Link
          href="/app"
          className="mt-6 inline-block rounded bg-[rgb(var(--ifp-orange-500))] px-4 py-2 text-sm text-white transition hover:opacity-90"
        >
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}
