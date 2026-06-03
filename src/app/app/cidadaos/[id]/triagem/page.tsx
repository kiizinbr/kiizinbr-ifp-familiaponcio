import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { db } from "@/lib/db";
import { getCidadao } from "@/lib/cidadao";
import { podeFazerTriagem } from "@/lib/triagem";
import { AbrirTriagemButton, TriagemForm, type TriagemData } from "./triagem-form";

export default async function TriagemPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const cidadao = await getCidadao(id, session);
  if (!cidadao) notFound();

  // Triagem é conduzida pela assistente social / coordenação.
  if (!podeFazerTriagem(session)) notFound();

  const triagemRow = await db.triagem.findFirst({
    where: { cidadaoId: id },
    include: { elegibilidades: true },
    orderBy: { createdAt: "desc" },
  });

  const triagem: TriagemData | null = triagemRow
    ? {
        id: triagemRow.id,
        status: triagemRow.status as "aberta" | "concluida",
        dataEntrevista: triagemRow.dataEntrevista?.toISOString().slice(0, 10) ?? "",
        parecer: triagemRow.parecer ?? "",
        observacoes: triagemRow.observacoes ?? "",
        elegibilidades: triagemRow.elegibilidades.map((e) => ({
          unidade: e.unidade,
          status: e.status as string,
          motivo: e.motivo ?? "",
        })),
      }
    : null;

  return (
    <AppShell session={session}>
      <header className="mb-6">
        <Link
          href={`/app/cidadaos/${cidadao.id}` as Route}
          className="text-xs text-[var(--text-3)] hover:text-[var(--accent)]"
        >
          ← Voltar para a Ficha
        </Link>
        <h1 className="t-h1 mt-4 text-[var(--text)]">Triagem social</h1>
        <p className="mt-1 text-sm text-[var(--text-3)]">
          Entrevista e elegibilidade de{" "}
          <span className="font-medium text-[var(--text-2)]">{cidadao.nomeCompleto}</span>.
        </p>
      </header>

      {triagem ? (
        <TriagemForm triagem={triagem} />
      ) : (
        <section className="card p-6">
          <p className="mb-4 text-sm text-[var(--text-3)]">
            Nenhuma triagem para este cidadão ainda. Abra uma para registrar a entrevista.
          </p>
          <AbrirTriagemButton cidadaoId={cidadao.id} />
        </section>
      )}
    </AppShell>
  );
}
