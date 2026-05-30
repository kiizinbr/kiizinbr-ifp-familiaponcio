"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";

import {
  asOptions,
  ESCOLARIDADE_LABEL,
  ESTADO_CIVIL_LABEL,
  PARENTESCO_LABEL,
  SITUACAO_MORADIA_LABEL,
  STATUS_LABEL,
  UNIDADES,
  type Elegibilidade,
  type StatusElegibilidade,
} from "@/lib/api";
import { useFicha, useUpdateElegibilidade } from "@/lib/use-fichas";
import {
  formatCpf,
  formatDataHora,
  formatDataISO,
  formatMoeda,
  formatTelefone,
  idadeAnos,
} from "@/lib/format";
import { Alerta, BadgeStatus, Botao, Campo, Select, Spinner, Textarea, Input } from "@/components/ui";

const statusOptions = asOptions(STATUS_LABEL);

// Item de exibição rótulo/valor.
function Item({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{children || "—"}</dd>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <h2 className="mb-4 text-lg font-semibold text-foreground">{titulo}</h2>
      {children}
    </section>
  );
}

// Card de elegibilidade por unidade (estado local de edição + salvar).
function CardElegibilidade({
  fichaId,
  slug,
  nome,
  atual,
}: {
  fichaId: string;
  slug: string;
  nome: string;
  atual?: Elegibilidade;
}) {
  const mutation = useUpdateElegibilidade();
  const [status, setStatus] = useState<StatusElegibilidade>(atual?.status ?? "PENDENTE");
  const [motivo, setMotivo] = useState(atual?.motivo ?? "");
  const [reavaliarEm, setReavaliarEm] = useState(atual?.reavaliarEm?.slice(0, 10) ?? "");
  const [salvo, setSalvo] = useState(false);

  async function salvar() {
    setSalvo(false);
    await mutation.mutateAsync({
      id: fichaId,
      unidadeSlug: slug,
      dados: {
        status,
        ...(motivo.trim() ? { motivo: motivo.trim() } : {}),
        ...(reavaliarEm ? { reavaliarEm } : {}),
      },
    });
    setSalvo(true);
  }

  return (
    <div className="rounded-md border border-border p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">{nome}</span>
        {atual ? <BadgeStatus status={atual.status} /> : (
          <span className="text-xs text-muted-foreground">não avaliada</span>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value as StatusElegibilidade)}>
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </Campo>
        <Campo label="Reavaliar em">
          <Input type="date" value={reavaliarEm} onChange={(e) => setReavaliarEm(e.target.value)} />
        </Campo>
      </div>
      <Campo label="Motivo / observação" className="mt-3">
        <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} />
      </Campo>
      <div className="mt-3 flex items-center gap-3">
        <Botao type="button" onClick={salvar} carregando={mutation.isPending}>
          Salvar elegibilidade
        </Botao>
        {salvo && !mutation.isPending ? (
          <span className="inline-flex items-center gap-1 text-xs text-success">
            <Check className="h-3.5 w-3.5" /> salvo
          </span>
        ) : null}
        {mutation.isError ? (
          <span className="text-xs text-danger">{(mutation.error as Error).message}</span>
        ) : null}
      </div>
      {atual?.avaliadoEm ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Última avaliação: {formatDataHora(atual.avaliadoEm)}
        </p>
      ) : null}
    </div>
  );
}

export default function FichaDetalhePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data: ficha, isLoading, isError, error } = useFicha(id);

  if (isLoading) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        <Spinner label="Carregando ficha..." />
      </main>
    );
  }

  if (isError || !ficha) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10">
        <Link
          href="/servico-social/fichas"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <Alerta>{(error as Error)?.message ?? "Ficha não encontrada."}</Alerta>
      </main>
    );
  }

  const idade = idadeAnos(ficha.dataNascimento);
  const endereco = [
    ficha.logradouro,
    ficha.numero,
    ficha.complemento,
    ficha.bairro,
    [ficha.cidade, ficha.uf].filter(Boolean).join("/"),
    ficha.cep ? `CEP ${ficha.cep}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const beneficios = [
    ficha.dadosSocio?.recebeBolsaFamilia && "Bolsa Família",
    ficha.dadosSocio?.recebeBPC && "BPC",
    ficha.dadosSocio?.recebeAuxilioGas && "Auxílio Gás",
    ficha.dadosSocio?.outrosBeneficios,
  ].filter(Boolean) as string[];

  return (
    <main className="mx-auto max-w-4xl space-y-5 px-6 py-10">
      <Link
        href="/servico-social/fichas"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para a listagem
      </Link>

      {/* Cabeçalho */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {ficha.nomeCompleto}
            {!ficha.ativa ? (
              <span className="ml-2 align-middle text-sm font-normal text-danger">(inativa)</span>
            ) : null}
          </h1>
          <p className="text-sm text-muted-foreground">
            {ficha.protocolo} · cadastrada em {formatDataHora(ficha.criadoEm)}
          </p>
        </div>
      </header>

      {/* Titular */}
      <Secao titulo="Dados do titular">
        <dl className="grid gap-4 sm:grid-cols-3">
          <Item label="CPF">{formatCpf(ficha.cpf)}</Item>
          <Item label="RG">{ficha.rg}</Item>
          <Item label="Nascimento">
            {formatDataISO(ficha.dataNascimento)}
            {idade !== null ? ` (${idade} anos)` : ""}
          </Item>
          <Item label="Estado civil">
            {ficha.estadoCivil ? ESTADO_CIVIL_LABEL[ficha.estadoCivil] : null}
          </Item>
          <Item label="Escolaridade">
            {ficha.escolaridade ? ESCOLARIDADE_LABEL[ficha.escolaridade] : null}
          </Item>
          <Item label="WhatsApp">{ficha.whatsappOptIn ? "Autorizado" : "Não"}</Item>
        </dl>
      </Secao>

      {/* Contato e endereço */}
      <Secao titulo="Contato e endereço">
        <dl className="grid gap-4 sm:grid-cols-3">
          <Item label="Telefone">{formatTelefone(ficha.telefone)}</Item>
          <Item label="Telefone alt.">{formatTelefone(ficha.telefoneAlt)}</Item>
          <Item label="E-mail">{ficha.email}</Item>
          <div className="sm:col-span-3">
            <Item label="Endereço">{endereco}</Item>
          </div>
        </dl>
      </Secao>

      {/* Composição familiar */}
      <Secao titulo={`Composição familiar (${ficha.membros.length})`}>
        {ficha.membros.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum membro cadastrado.</p>
        ) : (
          <ul className="divide-y divide-border">
            {ficha.membros.map((m) => {
              const idadeM = idadeAnos(m.dataNascimento);
              return (
                <li key={m.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
                  <span className="font-medium text-foreground">{m.nomeCompleto}</span>
                  <span className="text-muted-foreground">
                    {PARENTESCO_LABEL[m.parentesco]}
                    {idadeM !== null ? ` · ${idadeM} anos` : ""}
                    {m.ocupacao ? ` · ${m.ocupacao}` : ""}
                    {m.rendaMensal ? ` · ${formatMoeda(m.rendaMensal)}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Secao>

      {/* Socioeconômico */}
      <Secao titulo="Dados socioeconômicos">
        {!ficha.dadosSocio ? (
          <p className="text-sm text-muted-foreground">Não preenchidos.</p>
        ) : (
          <dl className="grid gap-4 sm:grid-cols-3">
            <Item label="Renda familiar total">{formatMoeda(ficha.dadosSocio.rendaFamiliarTotal)}</Item>
            <Item label="Renda per capita">{formatMoeda(ficha.dadosSocio.rendaPerCapita)}</Item>
            <Item label="Situação de moradia">
              {SITUACAO_MORADIA_LABEL[ficha.dadosSocio.situacaoMoradia]}
            </Item>
            <Item label="Pessoas na moradia">{ficha.dadosSocio.numeroPessoasMoradia}</Item>
            <Item label="Cômodos">{ficha.dadosSocio.numeroComodos}</Item>
            <Item label="Benefícios">{beneficios.length ? beneficios.join(", ") : "Nenhum"}</Item>
            <Item label="Infraestrutura">
              {[
                ficha.dadosSocio.temAguaEncanada && "Água",
                ficha.dadosSocio.temEsgoto && "Esgoto",
                ficha.dadosSocio.temEnergiaEletrica && "Energia",
              ]
                .filter(Boolean)
                .join(", ") || "—"}
            </Item>
            <div className="sm:col-span-3">
              <Item label="Vulnerabilidades">{ficha.dadosSocio.vulnerabilidades}</Item>
            </div>
          </dl>
        )}
      </Secao>

      {/* Elegibilidade por unidade */}
      <Secao titulo="Elegibilidade por unidade">
        <p className="mb-4 text-sm text-muted-foreground">
          Defina o status de cada unidade. Gestores só enxergam beneficiários{" "}
          <strong>aprovados</strong> para a sua unidade.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {UNIDADES.map((u) => (
            <CardElegibilidade
              key={u.slug}
              fichaId={ficha.id}
              slug={u.slug}
              nome={u.nome}
              atual={ficha.elegibilidades.find((e) => e.unidade.slug === u.slug)}
            />
          ))}
        </div>
      </Secao>

      {ficha.observacoes ? (
        <Secao titulo="Observações">
          <p className="whitespace-pre-wrap text-sm text-foreground">{ficha.observacoes}</p>
        </Secao>
      ) : null}
    </main>
  );
}
