import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { getCidadao } from "@/lib/cidadao";
import { can } from "@/lib/rbac";
import type { UnitScope } from "@/lib/rbac-types";
import { NovoCidadaoForm } from "../../novo/form";

export default async function EditarCidadaoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const cidadao = await getCidadao(id, session);
  if (!cidadao) notFound();

  const unit = cidadao.unitIdOrigem as UnitScope;
  if (!can(session, "edit", "ficha_cidada", { unitScope: unit })) notFound();

  // Monta os valores iniciais do form (campos escalares; endereços têm fluxo próprio).
  const initialValues = {
    nomeCompleto: cidadao.nomeCompleto,
    cpf: cidadao.cpf,
    dataNascimento: cidadao.dataNascimento.toISOString().slice(0, 10),
    nomeSocial: cidadao.nomeSocial ?? "",
    rg: cidadao.rg ?? "",
    documentoAlternativo: cidadao.documentoAlternativo ?? "",
    genero: cidadao.genero ?? "",
    corRaca: cidadao.corRaca ?? "",
    estadoCivil: cidadao.estadoCivil ?? "",
    nacionalidade: cidadao.nacionalidade ?? "",
    naturalidade: cidadao.naturalidade ?? "",
    nomeMae: cidadao.nomeMae ?? "",
    nomePai: cidadao.nomePai ?? "",
    escolaAtual: cidadao.escolaAtual ?? "",
    telefonePrincipal: cidadao.telefonePrincipal,
    telefoneSecundario: cidadao.telefoneSecundario ?? "",
    email: cidadao.email ?? "",
    whatsappConsente: cidadao.whatsappConsente,
    rendaFamiliar: cidadao.rendaFamiliar?.toString() ?? "",
    pessoasNaCasa: cidadao.pessoasNaCasa?.toString() ?? "",
    beneficioSocial: cidadao.beneficioSocial ?? "",
    escolaridade: cidadao.escolaridade ?? "",
    trabalha: cidadao.trabalha === null ? "" : String(cidadao.trabalha),
    trabalhoDescricao: cidadao.trabalhoDescricao ?? "",
    tipoSanguineo: cidadao.tipoSanguineo ?? "",
    alergias: cidadao.alergias ?? "",
    medicamentosEmUso: cidadao.medicamentosEmUso ?? "",
    condicoesCronicas: cidadao.condicoesCronicas ?? "",
    unitIdOrigem: unit,
  };

  return (
    <AppShell session={session}>
      <header className="mb-6">
        <Link
          href={`/app/cidadaos/${cidadao.id}` as Route}
          className="text-xs text-slate-500 hover:text-[rgb(var(--ifp-laranja))]"
        >
          ← Voltar para a Ficha
        </Link>
        <h1 className="mt-4 text-3xl font-semibold text-slate-900">Editar ficha</h1>
        <p className="mt-1 text-sm text-slate-600">
          {cidadao.nomeCompleto} · o CPF não pode ser alterado. Endereços têm edição própria (em
          breve).
        </p>
      </header>

      <NovoCidadaoForm
        mode="edit"
        cidadaoId={cidadao.id}
        defaultUnit={unit}
        canChooseUnit={false}
        initialValues={initialValues}
      />
    </AppShell>
  );
}
