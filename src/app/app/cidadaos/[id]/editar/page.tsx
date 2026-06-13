import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { getCidadaoView } from "@/lib/cidadao";
import { can } from "@/lib/rbac";
import type { UnitScope } from "@/lib/rbac-types";
import { limparTextoClinico } from "@/lib/texto-clinico";
import { NovoCidadaoForm } from "../../novo/form";

export default async function EditarCidadaoPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  // getCidadaoView redige saúde/socio: o form de edição não pré-preenche (nem vaza
  // no HTML) campos que o caller não pode ver — e a action descarta a escrita deles.
  const cidadao = await getCidadaoView(id, session);
  if (!cidadao) notFound();

  const unit = cidadao.unitIdOrigem as UnitScope;
  if (!can(session, "edit", "ficha_cidada", { unitScope: unit })) notFound();

  // Monta os valores iniciais do form (campos escalares; endereços têm fluxo próprio).
  const initialValues = {
    nomeCompleto: cidadao.nomeCompleto,
    cpf: cidadao.cpf ?? "",
    dataNascimento: cidadao.dataNascimento ? cidadao.dataNascimento.toISOString().slice(0, 10) : "",
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
    telefonePrincipal: cidadao.telefonePrincipal ?? "",
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
    // limparTextoClinico no defaultValue: o legado Amplimed traz HTML cru
    // (`<br>` literal) — o próximo save persiste o texto limpo (higiene
    // gradual da fonte; Cidadao é editável, não fere imutabilidade de nota).
    alergias: limparTextoClinico(cidadao.alergias),
    medicamentosEmUso: limparTextoClinico(cidadao.medicamentosEmUso),
    condicoesCronicas: limparTextoClinico(cidadao.condicoesCronicas),
    unitIdOrigem: unit,
  };

  return (
    <AppShell session={session}>
      <header className="mb-6">
        <Link
          href={`/app/cidadaos/${cidadao.id}` as Route}
          className="text-xs text-[var(--text-3)] hover:text-[var(--accent)]"
        >
          ← Voltar para a Ficha
        </Link>
        <h1 className="t-h2 mt-4 text-[var(--text)]">Editar ficha</h1>
        <p className="mt-1 text-sm text-[var(--text-3)]">
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
