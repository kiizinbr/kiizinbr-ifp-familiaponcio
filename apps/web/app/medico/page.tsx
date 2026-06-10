import Link from "next/link";
import { CalendarDays } from "lucide-react";

export const metadata = { title: "Centro Médico" };

export default function MedicoHome() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-bold text-foreground">Centro Médico</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Agenda, atendimentos e prontuário do dia a dia da unidade.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/medico/agenda"
          className="group rounded-lg border border-border bg-surface p-5 shadow-ifp-sm transition hover:shadow-casa-sm"
        >
          <CalendarDays className="h-6 w-6 text-primary" />
          <h2 className="mt-3 font-semibold text-foreground group-hover:text-primary">
            Agenda do dia
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pacientes de hoje, status de cada atendimento e acesso à prancha.
          </p>
        </Link>
      </div>
    </main>
  );
}
