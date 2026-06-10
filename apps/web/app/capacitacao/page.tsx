import Link from "next/link";
import { GraduationCap } from "lucide-react";

export const metadata = { title: "Centro de Capacitação" };

export default function CapacitacaoHome() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-bold text-foreground">Centro de Capacitação</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Cursos profissionalizantes, turmas, chamada e certificados verificáveis.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/capacitacao/turmas"
          className="group rounded-lg border border-border bg-surface p-5 shadow-ifp-sm transition hover:shadow-casa-sm"
        >
          <GraduationCap className="h-6 w-6 text-primary" />
          <h2 className="mt-3 font-semibold text-foreground group-hover:text-primary">
            Minhas turmas
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Alunos, presença por aula e emissão de certificados ao encerrar.
          </p>
        </Link>
      </div>
    </main>
  );
}
