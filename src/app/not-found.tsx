import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-1 w-16 overflow-hidden rounded">
          <span className="flex-1 bg-[rgb(var(--ifp-medico))]" />
          <span className="flex-1 bg-[rgb(var(--ifp-capacitacao))]" />
          <span className="flex-1 bg-[rgb(var(--ifp-esportivo))]" />
          <span className="flex-1 bg-[rgb(var(--ifp-recreativo))]" />
        </div>
        <h1 className="text-4xl font-semibold text-slate-900">404</h1>
        <p className="mt-2 text-slate-600">A página que você procurou não existe ou foi movida.</p>
        <Link
          href="/app"
          className="mt-6 inline-block rounded bg-[rgb(var(--ifp-laranja))] px-4 py-2 text-sm text-white transition hover:opacity-90"
        >
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}
