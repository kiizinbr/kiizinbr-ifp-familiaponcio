import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { calcularIdade, getCidadaoView } from "@/lib/cidadao";
import { formatCpf } from "@/lib/cpf";
import { formatCep } from "@/lib/cep";
import {
  hasAnyRole,
  podeVerSaudeCidadao,
  podeVerSocioCidadao,
  podeGerirConsentimento,
} from "@/lib/rbac";
import { db } from "@/lib/db";
import type { UnitScope } from "@/lib/rbac-types";
import { statusDisplay, type StatusTone } from "@/lib/cidadao-status";
import { limparTextoClinico } from "@/lib/texto-clinico";
import { normalizeTipoSanguineo } from "@/lib/tipo-sanguineo";
import { AnexoUploader } from "./anexo-uploader";
import { AnonimizarButton } from "./anonimizar-button";
import { ConsentimentoSection } from "./consentimento-section";

const TONE_BADGE: Record<StatusTone, string> = {
  red: "badge badge-danger",
  amber: "badge badge-warning",
  emerald: "badge badge-success",
  slate: "badge badge-default",
};

const UNIT_LABELS: Record<UnitScope, string> = {
  medico: "Centro Médico",
  capacitacao: "Centro de Capacitação",
  esportivo: "Centro Esportivo",
  recreativo: "Centro Recreativo",
};

// Cor de texto sobre o badge de unidade — mesmo critério da lista (page.tsx):
// branco onde passa AA (medico, esportivo); --ifp-ink nos tons claros (capacitacao, recreativo).
const UNIT_FG: Record<UnitScope, string> = {
  medico: "#fff",
  esportivo: "#fff",
  capacitacao: "rgb(var(--ifp-ink))",
  recreativo: "rgb(var(--ifp-ink))",
};

const GENERO_LABELS: Record<string, string> = {
  feminino: "Feminino",
  masculino: "Masculino",
  nao_binario: "Não binário",
  nao_informar: "Não informado",
};

const BENEFICIO_LABELS: Record<string, string> = {
  bolsa_familia: "Bolsa Família",
  bpc: "BPC",
  nenhum: "Nenhum",
  outro: "Outro",
};

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatCurrency(value: number | string | null): string {
  if (value === null) return "—";
  const num = typeof value === "string" ? Number(value) : value;
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function CidadaoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  // getCidadaoView redige PHI/socio na camada de dados conforme a capability.
  const cidadao = await getCidadaoView(id, session);
  if (!cidadao) notFound();

  const unit = cidadao.unitIdOrigem as UnitScope;
  const idade = calcularIdade(cidadao.dataNascimento);
  const status = statusDisplay(cidadao);

  // RBAC pra seções sensíveis (mesmos predicados que o getCidadaoView usou p/ redigir)
  const podeVerSocio = podeVerSocioCidadao(session);
  const podeVerSaude = podeVerSaudeCidadao(session);
  const podeEditar = hasAnyRole(
    session,
    "super_admin",
    "gestor_unidade",
    "profissional",
    "recepcao",
  );
  const podeTriagem = hasAnyRole(session, "super_admin", "social");
  const podeGerirConsent = podeGerirConsentimento(session);
  const consentimentos = podeGerirConsent
    ? await db.consentimento.findMany({
        where: { cidadaoId: id },
        select: {
          tipo: true,
          versao: true,
          imagemInterno: true,
          imagemRedes: true,
          imagemImprensa: true,
          revogadoEm: true,
        },
      })
    : [];

  return (
    <AppShell session={session}>
      <header className="mb-6">
        <Link
          href={"/app/cidadaos" as Route}
          className="text-xs text-[var(--text-3)] hover:text-[var(--accent)]"
        >
          ← Voltar para Cidadãos
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="t-h2 text-[var(--text)]">{cidadao.nomeCompleto}</h1>
              <span className={TONE_BADGE[status.tone]}>{status.label}</span>
            </div>
            {cidadao.nomeSocial && (
              <p className="mt-1 text-sm text-[var(--text-3)]">
                Nome social: <span className="font-medium">{cidadao.nomeSocial}</span>
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-[var(--text-3)]">
              <span>{idade ?? "—"} anos</span>
              <span>•</span>
              <span className="mono">{formatCpf(cidadao.cpf)}</span>
              <span>•</span>
              <span
                className="rounded-[var(--r-sm)] px-2 py-0.5 text-xs font-medium"
                style={{ color: UNIT_FG[unit], background: `rgb(var(--ifp-filter-${unit}))` }}
              >
                {UNIT_LABELS[unit]}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {podeEditar && (
              <Link
                href={`/app/cidadaos/${cidadao.id}/editar` as Route}
                className="btn btn-secondary btn-sm"
              >
                Editar
              </Link>
            )}
            {hasAnyRole(session, "super_admin") && !cidadao.anonimizadoEm && (
              <AnonimizarButton cidadaoId={cidadao.id} />
            )}
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Identificação */}
          <Section title="Identificação">
            <Field label="Nome completo" value={cidadao.nomeCompleto} />
            <Field label="Nome social" value={cidadao.nomeSocial} />
            <Field label="CPF" value={formatCpf(cidadao.cpf)} />
            <Field label="RG" value={cidadao.rg} />
            <Field label="Documento alternativo" value={cidadao.documentoAlternativo} />
            <Field label="Data de nascimento" value={formatDate(cidadao.dataNascimento)} />
            <Field label="Gênero" value={cidadao.genero ? GENERO_LABELS[cidadao.genero] : null} />
            <Field label="Cor / raça" value={cidadao.corRaca} />
            <Field label="Estado civil" value={cidadao.estadoCivil} />
            <Field label="Nacionalidade" value={cidadao.nacionalidade} />
            <Field label="Naturalidade" value={cidadao.naturalidade} />
            <Field label="Nome da mãe" value={cidadao.nomeMae} />
            <Field label="Nome do pai" value={cidadao.nomePai} />
            <Field label="Escola atual" value={cidadao.escolaAtual} />
          </Section>

          {/* Contato */}
          <Section title="Contato">
            <Field label="Telefone principal" value={cidadao.telefonePrincipal} />
            <Field label="Telefone secundário" value={cidadao.telefoneSecundario} />
            <Field label="E-mail" value={cidadao.email} />
            <Field
              label="Consente contato via WhatsApp"
              value={cidadao.whatsappConsente ? "Sim (LGPD ✓)" : "Não"}
            />
          </Section>

          {/* Endereços */}
          <Section title={`Endereços (${cidadao.enderecos.length})`}>
            {cidadao.enderecos.length === 0 ? (
              <p className="text-sm text-[var(--text-3)]">Nenhum endereço cadastrado.</p>
            ) : (
              <div className="space-y-4">
                {cidadao.enderecos.map((end) => (
                  <div
                    key={end.id}
                    className="rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface-2)] p-4 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="chip capitalize">{end.tipo}</span>
                      {end.isPrincipal && <span className="chip chip-accent">Principal</span>}
                    </div>
                    <p className="mt-2 font-medium text-[var(--text)]">
                      {end.logradouro}, {end.numero ?? "s/n"}
                      {end.complemento && ` — ${end.complemento}`}
                    </p>
                    <p className="text-[var(--text-3)]">
                      {end.bairro && `${end.bairro}, `}
                      {end.cidade} — {end.uf} • CEP {formatCep(end.cep)}
                    </p>
                    {end.pontoReferencia && (
                      <p className="mt-1 text-xs text-[var(--text-3)]">
                        Ref: {end.pontoReferencia}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Socioeconômico (RBAC) */}
          {podeVerSocio && (
            <Section
              title="Socioeconômico"
              hint="Visível para Serviço Social, Coordenação geral e Presidência"
            >
              <Field
                label="Renda familiar"
                value={formatCurrency(cidadao.rendaFamiliar as unknown as number | null)}
              />
              <Field label="Pessoas na casa" value={cidadao.pessoasNaCasa?.toString() ?? null} />
              <Field
                label="Benefício social"
                value={cidadao.beneficioSocial ? BENEFICIO_LABELS[cidadao.beneficioSocial] : null}
              />
              <Field label="Escolaridade" value={cidadao.escolaridade} />
              <Field
                label="Trabalha"
                value={
                  cidadao.trabalha === null
                    ? null
                    : cidadao.trabalha
                      ? `Sim${cidadao.trabalhoDescricao ? ` — ${cidadao.trabalhoDescricao}` : ""}`
                      : "Não"
                }
              />
            </Section>
          )}

          {/* Saúde (RBAC) */}
          {podeVerSaude && (
            <Section
              title="Saúde"
              hint="Visível para profissionais do Centro Médico e Coordenação geral (CFM 1.821)"
            >
              <Field
                label="Tipo sanguíneo"
                value={normalizeTipoSanguineo(cidadao.tipoSanguineo) ?? cidadao.tipoSanguineo}
              />
              {/* limparTextoClinico: dado migrado da Amplimed traz HTML cru
                  (`<br>` literal) — limpeza só na exibição, fonte intacta. */}
              <Field label="Alergias" value={limparTextoClinico(cidadao.alergias)} multiline />
              <Field
                label="Medicamentos em uso"
                value={limparTextoClinico(cidadao.medicamentosEmUso)}
                multiline
              />
              <Field
                label="Condições crônicas"
                value={limparTextoClinico(cidadao.condicoesCronicas)}
                multiline
              />
            </Section>
          )}

          {podeGerirConsent ? (
            <ConsentimentoSection cidadaoId={cidadao.id} consentimentos={consentimentos} />
          ) : null}

          {/* Anexos */}
          <Section title={`Anexos (${cidadao.anexos.length})`}>
            <div className="sm:col-span-2">
              <AnexoUploader
                cidadaoId={cidadao.id}
                podeEditar={podeEditar}
                anexos={cidadao.anexos.map((a) => ({
                  id: a.id,
                  fileName: a.fileName,
                  mimeType: a.mimeType,
                  sizeBytes: a.sizeBytes,
                  descricao: a.descricao,
                  categoria: a.categoria,
                  createdAt: a.createdAt,
                }))}
              />
            </div>
          </Section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          {cidadao.familia && (
            <Section title="Família">
              <p className="text-sm font-medium text-[var(--text)]">
                {cidadao.familia.nomeReferencia}
              </p>
              {cidadao.familia.observacoes && (
                <p className="mt-2 text-xs text-[var(--text-3)]">{cidadao.familia.observacoes}</p>
              )}
            </Section>
          )}

          <Section title="Sistema">
            <Field label="Unidade de origem" value={UNIT_LABELS[unit]} />
            <Field
              label="Cadastrado por"
              value={cidadao.createdBy.name ?? cidadao.createdBy.email}
            />
            <Field label="Cadastrado em" value={formatDate(cidadao.createdAt)} />
            <Field label="Última atualização" value={formatDate(cidadao.updatedAt)} />
          </Section>

          {podeTriagem && (
            <Section title="Triagem social" hint="Entrevista e elegibilidade por unidade">
              <Link
                href={`/app/cidadaos/${cidadao.id}/triagem` as Route}
                className="text-sm font-medium text-[var(--accent)] hover:underline"
              >
                Abrir / ver triagem →
              </Link>
            </Section>
          )}

          <Section title="Histórico" hint="Eventos de criação, edição e anexos desta ficha">
            <Link
              href={`/app/cidadaos/${cidadao.id}/historico` as Route}
              className="text-sm font-medium text-[var(--accent)] hover:underline"
            >
              Ver histórico completo →
            </Link>
          </Section>
        </aside>
      </div>
    </AppShell>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-6">
      <div className="mb-4">
        <h2 className="text-sm font-medium tracking-wide text-[var(--text-2)] uppercase">
          {title}
        </h2>
        {hint && <p className="mt-1 text-xs text-[var(--text-3)]">{hint}</p>}
      </div>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

function Field({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string | null | undefined;
  multiline?: boolean;
}) {
  return (
    <div className={multiline ? "sm:col-span-2" : ""}>
      <dt className="text-xs tracking-wide text-[var(--text-3)] uppercase">{label}</dt>
      <dd
        className={`mt-0.5 text-sm ${
          value ? "text-[var(--text)]" : "text-[var(--text-3)]"
        } ${multiline ? "whitespace-pre-wrap" : ""}`}
      >
        {value || "—"}
      </dd>
    </div>
  );
}
