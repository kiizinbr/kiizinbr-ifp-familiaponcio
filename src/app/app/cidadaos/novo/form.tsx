"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TABS, type TabId } from "@/lib/cidadao-schema";
import type { UnitScope } from "@/lib/rbac-types";
import { fetchAddressFromCep } from "@/lib/cep";
import { createCidadaoAction } from "./actions";

type FieldErrors = Record<string, string[]>;

interface FormState {
  // Identificação
  nomeCompleto: string;
  cpf: string;
  dataNascimento: string;
  nomeSocial: string;
  rg: string;
  documentoAlternativo: string;
  genero: string;
  corRaca: string;
  estadoCivil: string;
  nacionalidade: string;
  naturalidade: string;
  nomeMae: string;
  nomePai: string;
  escolaAtual: string;
  // Contato
  telefonePrincipal: string;
  telefoneSecundario: string;
  email: string;
  whatsappConsente: boolean;
  // Endereço
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  pontoReferencia: string;
  // Socioeconômico
  rendaFamiliar: string;
  pessoasNaCasa: string;
  beneficioSocial: string;
  escolaridade: string;
  trabalha: string; // 'true' | 'false' | ''
  trabalhoDescricao: string;
  // Saúde
  tipoSanguineo: string;
  alergias: string;
  medicamentosEmUso: string;
  condicoesCronicas: string;
  // Sistema
  unitIdOrigem: UnitScope;
}

const INITIAL_STATE: FormState = {
  nomeCompleto: "",
  cpf: "",
  dataNascimento: "",
  nomeSocial: "",
  rg: "",
  documentoAlternativo: "",
  genero: "",
  corRaca: "",
  estadoCivil: "",
  nacionalidade: "",
  naturalidade: "",
  nomeMae: "",
  nomePai: "",
  escolaAtual: "",
  telefonePrincipal: "",
  telefoneSecundario: "",
  email: "",
  whatsappConsente: false,
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  pontoReferencia: "",
  rendaFamiliar: "",
  pessoasNaCasa: "",
  beneficioSocial: "",
  escolaridade: "",
  trabalha: "",
  trabalhoDescricao: "",
  tipoSanguineo: "",
  alergias: "",
  medicamentosEmUso: "",
  condicoesCronicas: "",
  unitIdOrigem: "medico",
};

export function NovoCidadaoForm({
  defaultUnit,
  canChooseUnit,
}: {
  defaultUnit: UnitScope;
  canChooseUnit: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("identificacao");
  const [state, setState] = useState<FormState>({ ...INITIAL_STATE, unitIdOrigem: defaultUnit });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [cepLoading, setCepLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((s) => ({ ...s, [key]: value }));
    setErrors((e) => {
      if (!e[key]) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
  }

  async function onCepBlur() {
    const cleaned = state.cep.replace(/\D/g, "");
    if (cleaned.length !== 8) return;
    setCepLoading(true);
    try {
      const data = await fetchAddressFromCep(cleaned);
      if (data) {
        setState((s) => ({
          ...s,
          logradouro: data.logradouro || s.logradouro,
          bairro: data.bairro || s.bairro,
          cidade: data.cidade || s.cidade,
          uf: data.uf || s.uf,
        }));
      }
    } finally {
      setCepLoading(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGlobalError(null);

    const enderecos =
      state.cep.replace(/\D/g, "").length === 8
        ? [
            {
              tipo: "residencial" as const,
              cep: state.cep,
              logradouro: state.logradouro,
              numero: state.numero,
              complemento: state.complemento,
              bairro: state.bairro,
              cidade: state.cidade,
              uf: state.uf,
              pontoReferencia: state.pontoReferencia,
              isPrincipal: true,
            },
          ]
        : [];

    const payload = {
      nomeCompleto: state.nomeCompleto,
      cpf: state.cpf,
      dataNascimento: state.dataNascimento,
      telefonePrincipal: state.telefonePrincipal,
      nomeSocial: state.nomeSocial,
      rg: state.rg,
      documentoAlternativo: state.documentoAlternativo,
      genero: state.genero || undefined,
      corRaca: state.corRaca || undefined,
      estadoCivil: state.estadoCivil,
      nacionalidade: state.nacionalidade,
      naturalidade: state.naturalidade,
      nomeMae: state.nomeMae,
      nomePai: state.nomePai,
      escolaAtual: state.escolaAtual,
      telefoneSecundario: state.telefoneSecundario,
      email: state.email,
      whatsappConsente: state.whatsappConsente,
      rendaFamiliar: state.rendaFamiliar,
      pessoasNaCasa: state.pessoasNaCasa,
      beneficioSocial: state.beneficioSocial || undefined,
      escolaridade: state.escolaridade,
      trabalha: state.trabalha === "" ? undefined : state.trabalha === "true",
      trabalhoDescricao: state.trabalhoDescricao,
      tipoSanguineo: state.tipoSanguineo || undefined,
      alergias: state.alergias,
      medicamentosEmUso: state.medicamentosEmUso,
      condicoesCronicas: state.condicoesCronicas,
      unitIdOrigem: state.unitIdOrigem,
      enderecos,
    };

    startTransition(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await createCidadaoAction(payload as any);
      if (result.ok) {
        router.push(`/app/cidadaos/${result.id}`);
      } else {
        setErrors(result.errors);
        if (result.message) setGlobalError(result.message);
        // Pula pra primeira tab com erro
        const firstErrorKey = Object.keys(result.errors)[0];
        if (firstErrorKey) {
          const tabForField = findTabForField(firstErrorKey);
          if (tabForField) setTab(tabForField);
        }
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Tab navigation */}
      <nav className="flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((t) => {
          const hasError = Object.keys(errors).some((k) => findTabForField(k) === t.id);
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`relative px-4 py-2 text-sm font-medium transition ${
                isActive
                  ? "border-b-2 border-[rgb(var(--ifp-laranja))] text-[rgb(var(--ifp-laranja))]"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {t.label}
              {t.required && <span className="ml-1 text-[rgb(var(--ifp-laranja))]">*</span>}
              {hasError && (
                <span className="absolute top-1 right-1 inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
              )}
            </button>
          );
        })}
      </nav>

      {globalError && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {globalError}
        </div>
      )}

      {/* Tab panels */}
      {tab === "identificacao" && (
        <Panel title="Identificação" hint="Campos marcados com * são obrigatórios">
          <Input
            label="Nome completo *"
            value={state.nomeCompleto}
            onChange={(v) => update("nomeCompleto", v)}
            error={errors.nomeCompleto}
            colSpan={2}
          />
          <Input
            label="CPF *"
            value={state.cpf}
            onChange={(v) => update("cpf", v)}
            placeholder="000.000.000-00"
            error={errors.cpf}
          />
          <Input
            label="Data de nascimento *"
            type="date"
            value={state.dataNascimento}
            onChange={(v) => update("dataNascimento", v)}
            error={errors.dataNascimento}
          />
          <Input
            label="Nome social"
            value={state.nomeSocial}
            onChange={(v) => update("nomeSocial", v)}
          />
          <Input label="RG" value={state.rg} onChange={(v) => update("rg", v)} />
          <Input
            label="Documento alternativo (CNH, passaporte)"
            value={state.documentoAlternativo}
            onChange={(v) => update("documentoAlternativo", v)}
          />
          <Select
            label="Gênero"
            value={state.genero}
            onChange={(v) => update("genero", v)}
            options={[
              { value: "feminino", label: "Feminino" },
              { value: "masculino", label: "Masculino" },
              { value: "nao_binario", label: "Não binário" },
              { value: "nao_informar", label: "Não informado" },
            ]}
          />
          <Select
            label="Cor / raça (IBGE)"
            value={state.corRaca}
            onChange={(v) => update("corRaca", v)}
            options={[
              { value: "branca", label: "Branca" },
              { value: "preta", label: "Preta" },
              { value: "parda", label: "Parda" },
              { value: "amarela", label: "Amarela" },
              { value: "indigena", label: "Indígena" },
            ]}
          />
          <Input
            label="Estado civil"
            value={state.estadoCivil}
            onChange={(v) => update("estadoCivil", v)}
          />
          <Input
            label="Nacionalidade"
            value={state.nacionalidade}
            onChange={(v) => update("nacionalidade", v)}
          />
          <Input
            label="Naturalidade"
            value={state.naturalidade}
            onChange={(v) => update("naturalidade", v)}
            placeholder="ex: Duque de Caxias / RJ"
          />
          <Input label="Nome da mãe" value={state.nomeMae} onChange={(v) => update("nomeMae", v)} />
          <Input label="Nome do pai" value={state.nomePai} onChange={(v) => update("nomePai", v)} />
          <Input
            label="Escola atual (criança/adolescente)"
            value={state.escolaAtual}
            onChange={(v) => update("escolaAtual", v)}
            colSpan={2}
          />
          {canChooseUnit && (
            <Select
              label="Unidade de origem *"
              value={state.unitIdOrigem}
              onChange={(v) => update("unitIdOrigem", v as UnitScope)}
              options={[
                { value: "medico", label: "Centro Médico" },
                { value: "capacitacao", label: "Centro de Capacitação" },
                { value: "esportivo", label: "Centro Esportivo" },
                { value: "recreativo", label: "Centro Recreativo" },
              ]}
            />
          )}
        </Panel>
      )}

      {tab === "contato" && (
        <Panel title="Contato">
          <Input
            label="Telefone principal *"
            value={state.telefonePrincipal}
            onChange={(v) => update("telefonePrincipal", v)}
            placeholder="(21) 99999-9999"
            error={errors.telefonePrincipal}
          />
          <Input
            label="Telefone secundário"
            value={state.telefoneSecundario}
            onChange={(v) => update("telefoneSecundario", v)}
          />
          <Input
            label="E-mail"
            type="email"
            value={state.email}
            onChange={(v) => update("email", v)}
            error={errors.email}
          />
          <div className="flex items-center gap-2 sm:col-span-2">
            <input
              id="whatsapp"
              type="checkbox"
              checked={state.whatsappConsente}
              onChange={(e) => update("whatsappConsente", e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            <label htmlFor="whatsapp" className="text-sm text-slate-700">
              Consente contato via WhatsApp (LGPD)
            </label>
          </div>
        </Panel>
      )}

      {tab === "endereco" && (
        <Panel
          title="Endereço residencial"
          hint="Digite o CEP — preenchemos logradouro, bairro, cidade e UF automaticamente."
        >
          <Input
            label="CEP"
            value={state.cep}
            onChange={(v) => update("cep", v)}
            onBlur={onCepBlur}
            placeholder="00000-000"
          />
          <div className="text-xs text-slate-500 sm:col-span-1 sm:flex sm:items-end">
            {cepLoading && <span>Buscando endereço…</span>}
          </div>
          <Input
            label="Logradouro"
            value={state.logradouro}
            onChange={(v) => update("logradouro", v)}
            colSpan={2}
          />
          <Input label="Número" value={state.numero} onChange={(v) => update("numero", v)} />
          <Input
            label="Complemento"
            value={state.complemento}
            onChange={(v) => update("complemento", v)}
          />
          <Input label="Bairro" value={state.bairro} onChange={(v) => update("bairro", v)} />
          <Input label="Cidade" value={state.cidade} onChange={(v) => update("cidade", v)} />
          <Input
            label="UF"
            value={state.uf}
            onChange={(v) => update("uf", v.toUpperCase())}
            placeholder="RJ"
          />
          <Input
            label="Ponto de referência"
            value={state.pontoReferencia}
            onChange={(v) => update("pontoReferencia", v)}
            colSpan={2}
          />
        </Panel>
      )}

      {tab === "socio" && (
        <Panel
          title="Socioeconômico"
          hint="Dados socioeconômicos — visíveis apenas para Serviço Social e Coordenação."
        >
          <Input
            label="Renda familiar (R$)"
            type="number"
            value={state.rendaFamiliar}
            onChange={(v) => update("rendaFamiliar", v)}
            placeholder="0,00"
          />
          <Input
            label="Pessoas na casa"
            type="number"
            value={state.pessoasNaCasa}
            onChange={(v) => update("pessoasNaCasa", v)}
          />
          <Select
            label="Benefício social"
            value={state.beneficioSocial}
            onChange={(v) => update("beneficioSocial", v)}
            options={[
              { value: "bolsa_familia", label: "Bolsa Família" },
              { value: "bpc", label: "BPC" },
              { value: "nenhum", label: "Nenhum" },
              { value: "outro", label: "Outro" },
            ]}
          />
          <Input
            label="Escolaridade"
            value={state.escolaridade}
            onChange={(v) => update("escolaridade", v)}
          />
          <Select
            label="Trabalha"
            value={state.trabalha}
            onChange={(v) => update("trabalha", v)}
            options={[
              { value: "true", label: "Sim" },
              { value: "false", label: "Não" },
            ]}
          />
          {state.trabalha === "true" && (
            <Input
              label="Descrição do trabalho"
              value={state.trabalhoDescricao}
              onChange={(v) => update("trabalhoDescricao", v)}
              colSpan={2}
            />
          )}
        </Panel>
      )}

      {tab === "saude" && (
        <Panel
          title="Saúde"
          hint="Dados clínicos — visíveis apenas para profissionais do Centro Médico (CFM 1.821)."
        >
          <Select
            label="Tipo sanguíneo"
            value={state.tipoSanguineo}
            onChange={(v) => update("tipoSanguineo", v)}
            options={[
              { value: "A+", label: "A+" },
              { value: "A-", label: "A-" },
              { value: "B+", label: "B+" },
              { value: "B-", label: "B-" },
              { value: "AB+", label: "AB+" },
              { value: "AB-", label: "AB-" },
              { value: "O+", label: "O+" },
              { value: "O-", label: "O-" },
            ]}
          />
          <Textarea
            label="Alergias"
            value={state.alergias}
            onChange={(v) => update("alergias", v)}
            colSpan={2}
          />
          <Textarea
            label="Medicamentos em uso"
            value={state.medicamentosEmUso}
            onChange={(v) => update("medicamentosEmUso", v)}
            colSpan={2}
          />
          <Textarea
            label="Condições crônicas"
            value={state.condicoesCronicas}
            onChange={(v) => update("condicoesCronicas", v)}
            colSpan={2}
          />
        </Panel>
      )}

      {tab === "anexos" && (
        <Panel title="Anexos">
          <p className="text-sm text-slate-500 sm:col-span-2">
            Upload de PDF/JPG/PNG (max 10MB) ficará disponível após o cadastro inicial. Salve a
            Ficha primeiro e use a página de detalhe para anexar documentos.
          </p>
        </Panel>
      )}

      {tab === "familia" && (
        <Panel title="Família">
          <p className="text-sm text-slate-500 sm:col-span-2">
            Vincular a uma família existente ou criar nova família ficará disponível em breve. Por
            ora, salve a Ficha individualmente — a edição posterior permite vincular.
          </p>
        </Panel>
      )}

      {/* Submit bar */}
      <div className="flex items-center justify-between border-t border-slate-200 pt-6">
        <div className="text-xs text-slate-500">
          <span className="text-[rgb(var(--ifp-laranja))]">*</span> Campos obrigatórios em
          Identificação e Contato.
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/app/cidadaos")}
            className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="rounded bg-[rgb(var(--ifp-laranja))] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {isPending ? "Salvando…" : "Salvar Ficha"}
          </button>
        </div>
      </div>
    </form>
  );
}

function findTabForField(field: string): TabId | null {
  if (
    [
      "nomeCompleto",
      "cpf",
      "dataNascimento",
      "nomeSocial",
      "rg",
      "documentoAlternativo",
      "genero",
      "corRaca",
      "estadoCivil",
      "nacionalidade",
      "naturalidade",
      "nomeMae",
      "nomePai",
      "escolaAtual",
      "unitIdOrigem",
    ].includes(field)
  )
    return "identificacao";
  if (["telefonePrincipal", "telefoneSecundario", "email", "whatsappConsente"].includes(field))
    return "contato";
  if (field.startsWith("enderecos") || ["cep", "logradouro", "cidade", "uf"].includes(field))
    return "endereco";
  if (
    [
      "rendaFamiliar",
      "pessoasNaCasa",
      "beneficioSocial",
      "escolaridade",
      "trabalha",
      "trabalhoDescricao",
    ].includes(field)
  )
    return "socio";
  if (["tipoSanguineo", "alergias", "medicamentosEmUso", "condicoesCronicas"].includes(field))
    return "saude";
  return null;
}

function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-white p-6 shadow-sm">
      <header className="mb-4">
        <h2 className="text-sm font-medium tracking-wide text-slate-700 uppercase">{title}</h2>
        {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      </header>
      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Input({
  label,
  type = "text",
  value,
  onChange,
  onBlur,
  placeholder,
  error,
  colSpan = 1,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  error?: string[];
  colSpan?: 1 | 2;
}) {
  return (
    <div className={colSpan === 2 ? "sm:col-span-2" : ""}>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className={`w-full rounded border px-3 py-2 text-sm focus:outline-none ${
          error
            ? "border-red-300 focus:border-red-500"
            : "border-slate-300 focus:border-[rgb(var(--ifp-laranja))]"
        }`}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error[0]}</p>}
    </div>
  );
}

function Textarea({
  label,
  value,
  onChange,
  colSpan = 1,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  colSpan?: 1 | 2;
}) {
  return (
    <div className={colSpan === 2 ? "sm:col-span-2" : ""}>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-[rgb(var(--ifp-laranja))] focus:outline-none"
      />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-[rgb(var(--ifp-laranja))] focus:outline-none"
      >
        <option value="">— Selecione —</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
