import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { calcularIdade, getCidadao } from "@/lib/cidadao";
import { formatCpf } from "@/lib/cpf";
import { formatCep } from "@/lib/cep";
import { hasAnyRole } from "@/lib/rbac";
import type { UnitScope } from "@/lib/rbac-types";
import { statusDisplay, type StatusTone } from "@/lib/cidadao-status";
import { AnexoUploader } from "./anexo-uploader";

const TONE_BADGE: Record<StatusTone, string> = {
  red: "bg-red-100 text-red-700",
  amber: "bg-amber-100 text-amber-700",
  emerald: "bg-emerald-100 text-emerald-700",
  slate: "bg-slate-100 text-slate-600",
};

const UNIT_LABELS: Record<UnitScope, string> = {
  medico: "Centro Médico",
  capacitacao: "Centro de Capacitação",
  esportivo: "Centro Esportivo",
  recreativo: "Centro Recreativo",
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

function formatDate(date: Date): string {
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
  const cidadao = await getCidadao(id, session);
  if (!cidadao) notFound();

  const unit = cidadao.unitIdOrigem as UnitScope;
  const idade = calcularIdade(cidadao.dataNascimento);
  const status = statusDisplay(cidadao);

  // RBAC pra seções sensíveis
  const podeVerSocio = hasAnyRole(session, "super_admin", "gestor_geral", "presidencia", "social");
  const podeVerSaude = hasAnyRole(session, "super_admin", "gestor_geral", "profissional");
  const podeEditar = hasAnyRole(
    session,
    "super_admin",
    "gestor_geral",
    "gestor_unidade",
    "profissional",
    "recepcao",
  );
  const podeTriagem = hasAnyRole(session, "super_admin", "gestor_geral", "social");

  return (
    <AppShell session={session}>
      <header className="mb-6">
        <Link
          href={"/app/cidadaos" as Route}
          className="text-xs text-slate-500 hover:text-[rgb(var(--ifp-laranja))]"
        >
          ← Voltar para Cidadãos
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-semibold text-slate-900">{cidadao.nomeCompleto}</h1>
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium ${TONE_BADGE[status.tone]}`}
              >
                {status.label}
              </span>
            </div>
            {cidadao.nomeSocial && (
              <p className="mt-1 text-sm text-slate-600">
                Nome social: <span className="font-medium">{cidadao.nomeSocial}</span>
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
              <span>{idade} anos</span>
              <span>•</span>
              <span className="font-mono">{formatCpf(cidadao.cpf)}</span>
              <span>•</span>
              <span
                className="rounded px-2 py-0.5 text-xs font-medium text-white"
                style={{ background: `rgb(var(--ifp-${unit}))` }}
              >
                {UNIT_LABELS[unit]}
              </span>
            </div>
          </div>

          {podeEditar && (
            <button
              disabled
              title="Edição em desenvolvimento (Plano 3 Task 6)"
              className="cursor-not-allowed rounded border border-slate-300 px-4 py-2 text-sm text-slate-400"
            >
              Editar (em breve)
            </button>
          )}
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
              <p className="text-sm text-slate-500">Nenhum endereço cadastrado.</p>
            ) : (
              <div className="space-y-4">
                {cidadao.enderecos.map((end) => (
                  <div
                    key={end.id}
                    className="rounded border border-slate-200 bg-slate-50 p-4 text-sm"
                  >
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="rounded bg-white px-2 py-0.5 capitalize">{end.tipo}</span>
                      {end.isPrincipal && (
                        <span className="rounded bg-[rgb(var(--ifp-laranja))]/10 px-2 py-0.5 text-[rgb(var(--ifp-laranja))]">
                          Principal
                        </span>
                      )}
                    </div>
                    <p className="mt-2 font-medium text-slate-900">
                      {end.logradouro}, {end.numero ?? "s/n"}
                      {end.complemento && ` — ${end.complemento}`}
                    </p>
                    <p className="text-slate-600">
                      {end.bairro && `${end.bairro}, `}
                      {end.cidade} — {end.uf} • CEP {formatCep(end.cep)}
                    </p>
                    {end.pontoReferencia && (
                      <p className="mt-1 text-xs text-slate-500">Ref: {end.pontoReferencia}</p>
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
              <Field label="Tipo sanguíneo" value={cidadao.tipoSanguineo} />
              <Field label="Alergias" value={cidadao.alergias} multiline />
              <Field label="Medicamentos em uso" value={cidadao.medicamentosEmUso} multiline />
              <Field label="Condições crônicas" value={cidadao.condicoesCronicas} multiline />
            </Section>
          )}

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
              <p className="text-sm font-medium text-slate-900">{cidadao.familia.nomeReferencia}</p>
              {cidadao.familia.observacoes && (
                <p className="mt-2 text-xs text-slate-600">{cidadao.familia.observacoes}</p>
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
                className="text-sm font-medium text-[rgb(var(--ifp-laranja))] hover:underline"
              >
                Abrir / ver triagem →
              </Link>
            </Section>
          )}

          <Section title="Histórico" hint="Eventos de criação, edição e anexos desta ficha">
            <Link
              href={`/app/cidadaos/${cidadao.id}/historico` as Route}
              className="text-sm font-medium text-[rgb(var(--ifp-laranja))] hover:underline"
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
    <section className="rounded-lg border bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-sm font-medium tracking-wide text-slate-700 uppercase">{title}</h2>
        {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
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
      <dt className="text-xs tracking-wide text-slate-500 uppercase">{label}</dt>
      <dd
        className={`mt-0.5 text-sm ${
          value ? "text-slate-900" : "text-slate-400"
        } ${multiline ? "whitespace-pre-wrap" : ""}`}
      >
        {value || "—"}
      </dd>
    </div>
  );
}
