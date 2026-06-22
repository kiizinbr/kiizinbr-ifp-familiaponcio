"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useFieldArray, useForm } from "react-hook-form";
import { ArrowLeft, Check, Plus, Trash2 } from "lucide-react";

import {
  asOptions,
  ESCOLARIDADE_LABEL,
  ESTADO_CIVIL_LABEL,
  PARENTESCO_LABEL,
  SITUACAO_MORADIA_LABEL,
  type Escolaridade,
  type EstadoCivil,
  type Parentesco,
  type SituacaoMoradia,
} from "@/lib/api";
import {
  useCriarFicha,
  useReplaceMembros,
  useUpsertDadosSocio,
  type CriarFichaPayload,
  type DadosSocioPayload,
  type MembroPayload,
} from "@/lib/use-fichas";
import { cn } from "@/lib/cn";
import { Alerta, Botao, Campo, Checkbox, Input, Select, Textarea } from "@/components/ui";

const ETAPAS = [
  "Titular",
  "Contato e endereço",
  "Composição familiar",
  "Socioeconômico",
  "Revisão",
];

interface MembroForm {
  nomeCompleto: string;
  cpf: string;
  dataNascimento: string;
  parentesco: Parentesco | "";
  ocupacao: string;
  escolaridade: Escolaridade | "";
  rendaMensal: string;
  observacoes: string;
}

interface WizardForm {
  // Etapa 1 — titular
  nomeCompleto: string;
  cpf: string;
  rg: string;
  dataNascimento: string;
  estadoCivil: EstadoCivil | "";
  escolaridade: Escolaridade | "";
  // Etapa 2 — contato e endereço
  telefone: string;
  telefoneAlt: string;
  email: string;
  whatsappOptIn: boolean;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  observacoes: string;
  // Etapa 3 — membros
  membros: MembroForm[];
  // Etapa 4 — socioeconômico (opcional; gatilho = rendaFamiliarTotal)
  rendaFamiliarTotal: string;
  rendaPerCapita: string;
  situacaoMoradia: SituacaoMoradia | "";
  numeroPessoasMoradia: string;
  numeroComodos: string;
  recebeBolsaFamilia: boolean;
  recebeBPC: boolean;
  recebeAuxilioGas: boolean;
  outrosBeneficios: string;
  temAguaEncanada: boolean;
  temEsgoto: boolean;
  temEnergiaEletrica: boolean;
  vulnerabilidades: string;
}

const valoresIniciais: WizardForm = {
  nomeCompleto: "",
  cpf: "",
  rg: "",
  dataNascimento: "",
  estadoCivil: "",
  escolaridade: "",
  telefone: "",
  telefoneAlt: "",
  email: "",
  whatsappOptIn: false,
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "Duque de Caxias",
  uf: "RJ",
  observacoes: "",
  membros: [],
  rendaFamiliarTotal: "",
  rendaPerCapita: "",
  situacaoMoradia: "",
  numeroPessoasMoradia: "",
  numeroComodos: "",
  recebeBolsaFamilia: false,
  recebeBPC: false,
  recebeAuxilioGas: false,
  outrosBeneficios: "",
  temAguaEncanada: true,
  temEsgoto: true,
  temEnergiaEletrica: true,
  vulnerabilidades: "",
};

const soDigitos = (s: string) => s.replace(/\D/g, "");

/** Remove chaves vazias para não enviar campos opcionais em branco. */
function semVazios<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === "" || v === undefined || v === null) continue;
    out[k as keyof T] = v as T[keyof T];
  }
  return out;
}

const estadoCivilOpts = asOptions(ESTADO_CIVIL_LABEL);
const escolaridadeOpts = asOptions(ESCOLARIDADE_LABEL);
const parentescoOpts = asOptions(PARENTESCO_LABEL);
const moradiaOpts = asOptions(SITUACAO_MORADIA_LABEL);

export default function NovaFichaPage() {
  const router = useRouter();
  const [etapa, setEtapa] = useState(0);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);

  const criarFicha = useCriarFicha();
  const replaceMembros = useReplaceMembros();
  const upsertSocio = useUpsertDadosSocio();
  const enviando =
    criarFicha.isPending || replaceMembros.isPending || upsertSocio.isPending;

  const {
    register,
    control,
    handleSubmit,
    trigger,
    watch,
    getValues,
    formState: { errors },
  } = useForm<WizardForm>({ defaultValues: valoresIniciais, mode: "onTouched" });

  const { fields, append, remove } = useFieldArray({ control, name: "membros" });

  // Campos validados ao tentar avançar cada etapa.
  const camposPorEtapa: (keyof WizardForm | `membros.${number}.${string}`)[][] = [
    ["nomeCompleto", "cpf", "dataNascimento"],
    ["telefone", "email"],
    [], // membros: validados via trigger("membros") abaixo
    ["rendaFamiliarTotal", "rendaPerCapita", "situacaoMoradia", "numeroPessoasMoradia"],
  ];

  async function avancar() {
    setErroEnvio(null);
    const campos = camposPorEtapa[etapa];
    const ok =
      etapa === 2
        ? await trigger("membros")
        : campos && campos.length
          ? await trigger(campos as (keyof WizardForm)[])
          : true;
    if (ok) setEtapa((e) => Math.min(ETAPAS.length - 1, e + 1));
  }

  function voltar() {
    setErroEnvio(null);
    setEtapa((e) => Math.max(0, e - 1));
  }

  async function finalizar(v: WizardForm) {
    setErroEnvio(null);

    // 1) Cria a ficha (titular + contato + endereço)
    const fichaPayload: CriarFichaPayload = {
      nomeCompleto: v.nomeCompleto.trim(),
      cpf: soDigitos(v.cpf),
      dataNascimento: v.dataNascimento,
      telefone: soDigitos(v.telefone),
      whatsappOptIn: v.whatsappOptIn,
      ...semVazios({
        rg: v.rg.trim(),
        estadoCivil: v.estadoCivil || undefined,
        escolaridade: v.escolaridade || undefined,
        telefoneAlt: v.telefoneAlt ? soDigitos(v.telefoneAlt) : undefined,
        email: v.email.trim(),
        cep: v.cep ? soDigitos(v.cep) : undefined,
        logradouro: v.logradouro.trim(),
        numero: v.numero.trim(),
        complemento: v.complemento.trim(),
        bairro: v.bairro.trim(),
        cidade: v.cidade.trim(),
        uf: v.uf.trim().toUpperCase(),
        observacoes: v.observacoes.trim(),
      }),
    };

    let fichaId: string;
    try {
      const ficha = await criarFicha.mutateAsync(fichaPayload);
      fichaId = ficha.id;
    } catch (e) {
      setErroEnvio((e as Error).message);
      return; // a ficha não foi criada — fica tudo na tela para corrigir
    }

    // 2) Membros (opcional) e 3) dados socio (opcional). Se algo aqui falhar,
    // a ficha JÁ existe — então levamos o usuário ao detalhe para completar.
    try {
      if (v.membros.length) {
        const membros: MembroPayload[] = v.membros.map((m) => ({
          nomeCompleto: m.nomeCompleto.trim(),
          dataNascimento: m.dataNascimento,
          parentesco: m.parentesco as Parentesco,
          ...semVazios({
            cpf: m.cpf ? soDigitos(m.cpf) : undefined,
            ocupacao: m.ocupacao.trim(),
            escolaridade: m.escolaridade || undefined,
            rendaMensal: m.rendaMensal ? Number(m.rendaMensal) : undefined,
            observacoes: m.observacoes.trim(),
          }),
        }));
        await replaceMembros.mutateAsync({ id: fichaId, membros });
      }

      if (v.rendaFamiliarTotal) {
        const dados: DadosSocioPayload = {
          rendaFamiliarTotal: Number(v.rendaFamiliarTotal),
          rendaPerCapita: Number(v.rendaPerCapita),
          situacaoMoradia: v.situacaoMoradia as SituacaoMoradia,
          numeroPessoasMoradia: Number(v.numeroPessoasMoradia),
          recebeBolsaFamilia: v.recebeBolsaFamilia,
          recebeBPC: v.recebeBPC,
          recebeAuxilioGas: v.recebeAuxilioGas,
          temAguaEncanada: v.temAguaEncanada,
          temEsgoto: v.temEsgoto,
          temEnergiaEletrica: v.temEnergiaEletrica,
          ...semVazios({
            numeroComodos: v.numeroComodos ? Number(v.numeroComodos) : undefined,
            outrosBeneficios: v.outrosBeneficios.trim(),
            vulnerabilidades: v.vulnerabilidades.trim(),
          }),
        };
        await upsertSocio.mutateAsync({ id: fichaId, dados });
      }

      // Só navega quando TUDO deu certo — senão o operador sairia da tela sem ver
      // que membros/dados socioeconômicos (renda/vulnerabilidades) não salvaram.
      router.push(`/servico-social/fichas/${fichaId}`);
    } catch (e) {
      // Ficha criada, mas um complemento falhou: mantém o operador AQUI, com o
      // aviso, para a perda parcial não passar como sucesso silencioso.
      setErroEnvio(
        `A ficha foi criada, mas houve um erro ao salvar membros/dados: ${(e as Error).message}. Complete pelo detalhe ou tente de novo.`,
      );
    }
  }

  const temSocio = !!watch("rendaFamiliarTotal");

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href="/servico-social/fichas"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para a listagem
      </Link>

      <h1 className="text-2xl font-bold text-foreground">Nova Ficha Cidadã</h1>

      {/* Stepper */}
      <ol className="mt-5 flex flex-wrap gap-2">
        {ETAPAS.map((nome, i) => (
          <li
            key={nome}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs",
              i === etapa
                ? "border-ifp-orange bg-ifp-orange/10 font-semibold text-ifp-orange"
                : i < etapa
                  ? "border-success text-success"
                  : "border-border text-muted-foreground",
            )}
          >
            {i < etapa ? <Check className="h-3 w-3" /> : <span>{i + 1}.</span>}
            {nome}
          </li>
        ))}
      </ol>

      <form onSubmit={handleSubmit(finalizar)} className="mt-6 space-y-6">
        {/* ---------------- Etapa 1: Titular ---------------- */}
        {etapa === 0 && (
          <section className="space-y-4 rounded-lg border border-border bg-surface p-6">
            <Campo label="Nome completo" htmlFor="nomeCompleto" obrigatorio erro={errors.nomeCompleto?.message}>
              <Input
                id="nomeCompleto"
                {...register("nomeCompleto", {
                  required: "Informe o nome completo",
                  maxLength: { value: 120, message: "Máximo de 120 caracteres" },
                })}
              />
            </Campo>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="CPF" htmlFor="cpf" obrigatorio dica="Apenas números" erro={errors.cpf?.message}>
                <Input
                  id="cpf"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  {...register("cpf", {
                    required: "Informe o CPF",
                    validate: (v) => soDigitos(v).length === 11 || "CPF deve ter 11 dígitos",
                  })}
                />
              </Campo>
              <Campo label="RG" htmlFor="rg" erro={errors.rg?.message}>
                <Input id="rg" {...register("rg")} />
              </Campo>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Campo label="Data de nascimento" htmlFor="dataNascimento" obrigatorio erro={errors.dataNascimento?.message}>
                <Input
                  id="dataNascimento"
                  type="date"
                  {...register("dataNascimento", { required: "Informe a data de nascimento" })}
                />
              </Campo>
              <Campo label="Estado civil" htmlFor="estadoCivil">
                <Select id="estadoCivil" {...register("estadoCivil")}>
                  <option value="">—</option>
                  {estadoCivilOpts.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </Campo>
              <Campo label="Escolaridade" htmlFor="escolaridade">
                <Select id="escolaridade" {...register("escolaridade")}>
                  <option value="">—</option>
                  {escolaridadeOpts.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </Campo>
            </div>
          </section>
        )}

        {/* ---------------- Etapa 2: Contato e endereço ---------------- */}
        {etapa === 1 && (
          <section className="space-y-4 rounded-lg border border-border bg-surface p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Telefone" htmlFor="telefone" obrigatorio dica="Com DDD" erro={errors.telefone?.message}>
                <Input
                  id="telefone"
                  inputMode="numeric"
                  placeholder="(21) 99999-8888"
                  {...register("telefone", {
                    required: "Informe o telefone",
                    validate: (v) =>
                      [10, 11].includes(soDigitos(v).length) || "Telefone deve ter 10 ou 11 dígitos",
                  })}
                />
              </Campo>
              <Campo label="Telefone alternativo" htmlFor="telefoneAlt">
                <Input id="telefoneAlt" inputMode="numeric" {...register("telefoneAlt")} />
              </Campo>
            </div>
            <Campo label="E-mail" htmlFor="email" erro={errors.email?.message}>
              <Input
                id="email"
                type="email"
                {...register("email", {
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "E-mail inválido" },
                })}
              />
            </Campo>
            <Checkbox id="whatsappOptIn" label="Autoriza contato por WhatsApp" {...register("whatsappOptIn")} />

            <hr className="border-border" />

            <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
              <Campo label="CEP" htmlFor="cep" dica="8 dígitos">
                <Input id="cep" inputMode="numeric" placeholder="25000-000" {...register("cep")} />
              </Campo>
              <Campo label="Logradouro" htmlFor="logradouro">
                <Input id="logradouro" {...register("logradouro")} />
              </Campo>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Campo label="Número" htmlFor="numero">
                <Input id="numero" {...register("numero")} />
              </Campo>
              <Campo label="Complemento" htmlFor="complemento">
                <Input id="complemento" {...register("complemento")} />
              </Campo>
              <Campo label="Bairro" htmlFor="bairro">
                <Input id="bairro" {...register("bairro")} />
              </Campo>
            </div>
            <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
              <Campo label="Cidade" htmlFor="cidade">
                <Input id="cidade" {...register("cidade")} />
              </Campo>
              <Campo label="UF" htmlFor="uf">
                <Input id="uf" maxLength={2} {...register("uf")} />
              </Campo>
            </div>
          </section>
        )}

        {/* ---------------- Etapa 3: Composição familiar ---------------- */}
        {etapa === 2 && (
          <section className="space-y-4 rounded-lg border border-border bg-surface p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Membros da família além do titular (opcional).
              </p>
              <Botao
                type="button"
                variante="outline"
                onClick={() =>
                  append({
                    nomeCompleto: "",
                    cpf: "",
                    dataNascimento: "",
                    parentesco: "",
                    ocupacao: "",
                    escolaridade: "",
                    rendaMensal: "",
                    observacoes: "",
                  })
                }
              >
                <Plus className="h-4 w-4" />
                Adicionar membro
              </Botao>
            </div>

            {fields.length === 0 ? (
              <p className="rounded-md border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                Nenhum membro adicionado.
              </p>
            ) : (
              <div className="space-y-4">
                {fields.map((field, i) => (
                  <div key={field.id} className="rounded-md border border-border p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-semibold text-foreground">Membro {i + 1}</span>
                      <button
                        type="button"
                        onClick={() => remove(i)}
                        className="inline-flex items-center gap-1 text-xs text-danger hover:underline"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remover
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Campo
                        label="Nome completo"
                        obrigatorio
                        erro={errors.membros?.[i]?.nomeCompleto?.message}
                      >
                        <Input
                          {...register(`membros.${i}.nomeCompleto`, {
                            required: "Informe o nome",
                          })}
                        />
                      </Campo>
                      <Campo label="Parentesco" obrigatorio erro={errors.membros?.[i]?.parentesco?.message}>
                        <Select
                          {...register(`membros.${i}.parentesco`, {
                            required: "Selecione o parentesco",
                          })}
                        >
                          <option value="">—</option>
                          {parentescoOpts.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </Select>
                      </Campo>
                      <Campo
                        label="Data de nascimento"
                        obrigatorio
                        erro={errors.membros?.[i]?.dataNascimento?.message}
                      >
                        <Input
                          type="date"
                          {...register(`membros.${i}.dataNascimento`, {
                            required: "Informe a data",
                          })}
                        />
                      </Campo>
                      <Campo label="CPF">
                        <Input inputMode="numeric" {...register(`membros.${i}.cpf`)} />
                      </Campo>
                      <Campo label="Ocupação">
                        <Input {...register(`membros.${i}.ocupacao`)} />
                      </Campo>
                      <Campo label="Renda mensal (R$)">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          {...register(`membros.${i}.rendaMensal`)}
                        />
                      </Campo>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ---------------- Etapa 4: Socioeconômico ---------------- */}
        {etapa === 3 && (
          <section className="space-y-4 rounded-lg border border-border bg-surface p-6">
            <Alerta tipo="info">
              Opcional. Se informar a renda familiar, os campos marcados com{" "}
              <span className="text-danger">*</span> tornam-se obrigatórios.
            </Alerta>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Renda familiar total (R$)" htmlFor="rendaFamiliarTotal" erro={errors.rendaFamiliarTotal?.message}>
                <Input
                  id="rendaFamiliarTotal"
                  type="number"
                  step="0.01"
                  min="0"
                  {...register("rendaFamiliarTotal", {
                    validate: (v) =>
                      v === "" || Number(v) >= 0 || "Valor inválido",
                  })}
                />
              </Campo>
              <Campo
                label="Renda per capita (R$)"
                htmlFor="rendaPerCapita"
                obrigatorio={temSocio}
                erro={errors.rendaPerCapita?.message}
              >
                <Input
                  id="rendaPerCapita"
                  type="number"
                  step="0.01"
                  min="0"
                  {...register("rendaPerCapita", {
                    validate: (v, fv) =>
                      !fv.rendaFamiliarTotal || v !== "" || "Informe a renda per capita",
                  })}
                />
              </Campo>
              <Campo
                label="Situação de moradia"
                htmlFor="situacaoMoradia"
                obrigatorio={temSocio}
                erro={errors.situacaoMoradia?.message}
              >
                <Select
                  id="situacaoMoradia"
                  {...register("situacaoMoradia", {
                    validate: (v, fv) =>
                      !fv.rendaFamiliarTotal || v !== "" || "Selecione a situação",
                  })}
                >
                  <option value="">—</option>
                  {moradiaOpts.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </Campo>
              <div className="grid grid-cols-2 gap-4">
                <Campo
                  label="Pessoas na moradia"
                  htmlFor="numeroPessoasMoradia"
                  obrigatorio={temSocio}
                  erro={errors.numeroPessoasMoradia?.message}
                >
                  <Input
                    id="numeroPessoasMoradia"
                    type="number"
                    min="1"
                    {...register("numeroPessoasMoradia", {
                      validate: (v, fv) =>
                        !fv.rendaFamiliarTotal ||
                        (v !== "" && Number(v) >= 1) ||
                        "Informe um número ≥ 1",
                    })}
                  />
                </Campo>
                <Campo label="Cômodos" htmlFor="numeroComodos">
                  <Input id="numeroComodos" type="number" min="1" {...register("numeroComodos")} />
                </Campo>
              </div>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-foreground">Benefícios</legend>
              <div className="flex flex-wrap gap-4">
                <Checkbox id="bf" label="Bolsa Família" {...register("recebeBolsaFamilia")} />
                <Checkbox id="bpc" label="BPC" {...register("recebeBPC")} />
                <Checkbox id="gas" label="Auxílio Gás" {...register("recebeAuxilioGas")} />
              </div>
            </fieldset>

            <Campo label="Outros benefícios" htmlFor="outrosBeneficios">
              <Input id="outrosBeneficios" {...register("outrosBeneficios")} />
            </Campo>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-foreground">Infraestrutura</legend>
              <div className="flex flex-wrap gap-4">
                <Checkbox id="agua" label="Água encanada" {...register("temAguaEncanada")} />
                <Checkbox id="esgoto" label="Esgoto" {...register("temEsgoto")} />
                <Checkbox id="energia" label="Energia elétrica" {...register("temEnergiaEletrica")} />
              </div>
            </fieldset>

            <Campo label="Vulnerabilidades observadas" htmlFor="vulnerabilidades">
              <Textarea id="vulnerabilidades" {...register("vulnerabilidades")} />
            </Campo>
          </section>
        )}

        {/* ---------------- Etapa 5: Revisão ---------------- */}
        {etapa === 4 && (
          <section className="space-y-4 rounded-lg border border-border bg-surface p-6">
            <h2 className="text-lg font-semibold text-foreground">Revisão</h2>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Titular</dt>
                <dd className="font-medium text-foreground">{getValues("nomeCompleto") || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">CPF</dt>
                <dd className="font-medium text-foreground">{getValues("cpf") || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Telefone</dt>
                <dd className="font-medium text-foreground">{getValues("telefone") || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Membros</dt>
                <dd className="font-medium text-foreground">{fields.length}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Dados socioeconômicos</dt>
                <dd className="font-medium text-foreground">{temSocio ? "Preenchidos" : "Não preenchidos"}</dd>
              </div>
            </dl>

            <Alerta tipo="info">
              Documentos e termos de consentimento (LGPD) serão anexados em uma próxima
              etapa — o upload de arquivos ainda não está disponível.
            </Alerta>

            {erroEnvio ? <Alerta>{erroEnvio}</Alerta> : null}
          </section>
        )}

        {erroEnvio && etapa !== 4 ? <Alerta>{erroEnvio}</Alerta> : null}

        {/* ---------------- Navegação ---------------- */}
        <div className="flex items-center justify-between">
          <Botao type="button" variante="ghost" onClick={voltar} disabled={etapa === 0 || enviando}>
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Botao>

          {etapa < ETAPAS.length - 1 ? (
            <Botao type="button" onClick={avancar}>
              Avançar
            </Botao>
          ) : (
            <Botao type="submit" carregando={enviando}>
              <Check className="h-4 w-4" />
              Criar ficha
            </Botao>
          )}
        </div>
      </form>
    </main>
  );
}
