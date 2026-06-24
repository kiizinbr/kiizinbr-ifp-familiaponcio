"use client";

/**
 * Ficha clínica do beneficiário: dados, alergias e condições crônicas (com
 * registro e inativação) e o histórico longitudinal de atendimentos selados.
 */
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  FileText,
  Plus,
  X,
} from "lucide-react";

import {
  GRAVIDADE_LABEL,
  useAdicionarAlergia,
  useAdicionarCondicao,
  useAtualizarAlergia,
  useAtualizarCondicao,
  useFichaClinica,
  type FichaClinica,
  type GravidadeAlergia,
  type MembroFicha,
} from "@/lib/use-medico";
import { Alerta, Botao, Campo, Input, Select, Spinner } from "@/components/ui";
import { SinalizarSocial } from "@/components/casa";
import { cn } from "@/lib/cn";
import { idade } from "@/lib/idade";

const GRAV_ESTILO: Record<GravidadeAlergia, string> = {
  LEVE: "border-warning/40 text-warning",
  MODERADA: "border-warning bg-warning/10 text-warning",
  GRAVE: "border-danger bg-danger/10 text-danger",
};

function dataBR(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Select de "para quem" (titular ou dependente). */
function SeletorMembro({
  membros,
  value,
  onChange,
}: {
  membros: MembroFicha[];
  value: string;
  onChange: (v: string) => void;
}) {
  if (membros.length === 0) return null;
  return (
    <Campo label="Para quem" htmlFor="membro">
      <Select id="membro" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Titular</option>
        {membros.map((m) => (
          <option key={m.id} value={m.id}>
            {m.nomeCompleto} ({m.parentesco.toLowerCase()})
          </option>
        ))}
      </Select>
    </Campo>
  );
}

function FormAlergia({ ficha, onFechar }: { ficha: FichaClinica; onFechar: () => void }) {
  const adicionar = useAdicionarAlergia();
  const [descricao, setDescricao] = useState("");
  const [gravidade, setGravidade] = useState<"" | GravidadeAlergia>("");
  const [membroId, setMembroId] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (descricao.trim().length < 2) {
      setErro("Descreva a alergia.");
      return;
    }
    try {
      await adicionar.mutateAsync({
        fichaId: ficha.id,
        dados: {
          descricao: descricao.trim(),
          ...(gravidade ? { gravidade } : {}),
          ...(membroId ? { membroId } : {}),
        },
      });
      onFechar();
    } catch (err) {
      setErro((err as Error).message || "Falha ao registrar.");
    }
  }

  return (
    <form onSubmit={salvar} className="mt-3 space-y-3 rounded-lg border border-border bg-surface p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo label="Alergia" htmlFor="al-desc" obrigatorio className="sm:col-span-2">
          <Input id="al-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Dipirona" />
        </Campo>
        <Campo label="Gravidade" htmlFor="al-grav">
          <Select id="al-grav" value={gravidade} onChange={(e) => setGravidade(e.target.value as GravidadeAlergia | "")}>
            <option value="">Não informada</option>
            <option value="LEVE">Leve</option>
            <option value="MODERADA">Moderada</option>
            <option value="GRAVE">Grave</option>
          </Select>
        </Campo>
        <SeletorMembro membros={ficha.membros} value={membroId} onChange={setMembroId} />
      </div>
      {erro ? <Alerta tipo="erro">{erro}</Alerta> : null}
      <div className="flex justify-end gap-2">
        <Botao type="button" variante="ghost" onClick={onFechar} disabled={adicionar.isPending}>Cancelar</Botao>
        <Botao type="submit" carregando={adicionar.isPending}>Registrar alergia</Botao>
      </div>
    </form>
  );
}

function FormCondicao({ ficha, onFechar }: { ficha: FichaClinica; onFechar: () => void }) {
  const adicionar = useAdicionarCondicao();
  const [descricao, setDescricao] = useState("");
  const [cid10, setCid10] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [membroId, setMembroId] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (descricao.trim().length < 2) {
      setErro("Descreva a condição.");
      return;
    }
    try {
      await adicionar.mutateAsync({
        fichaId: ficha.id,
        dados: {
          descricao: descricao.trim(),
          ...(cid10.trim() ? { cid10: cid10.trim() } : {}),
          ...(observacoes.trim() ? { observacoes: observacoes.trim() } : {}),
          ...(membroId ? { membroId } : {}),
        },
      });
      onFechar();
    } catch (err) {
      setErro((err as Error).message || "Falha ao registrar.");
    }
  }

  return (
    <form onSubmit={salvar} className="mt-3 space-y-3 rounded-lg border border-border bg-surface p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo label="Condição crônica" htmlFor="co-desc" obrigatorio className="sm:col-span-2">
          <Input id="co-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Hipertensão" />
        </Campo>
        <Campo label="CID-10" htmlFor="co-cid" dica="Opcional.">
          <Input id="co-cid" value={cid10} onChange={(e) => setCid10(e.target.value)} placeholder="I10" maxLength={10} />
        </Campo>
        <SeletorMembro membros={ficha.membros} value={membroId} onChange={setMembroId} />
        <Campo label="Observações" htmlFor="co-obs" className="sm:col-span-2">
          <Input id="co-obs" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} maxLength={300} />
        </Campo>
      </div>
      {erro ? <Alerta tipo="erro">{erro}</Alerta> : null}
      <div className="flex justify-end gap-2">
        <Botao type="button" variante="ghost" onClick={onFechar} disabled={adicionar.isPending}>Cancelar</Botao>
        <Botao type="submit" carregando={adicionar.isPending}>Registrar condição</Botao>
      </div>
    </form>
  );
}

export default function FichaClinicaPage() {
  const { fichaId } = useParams<{ fichaId: string }>();
  const { data: ficha, isLoading, isError, error } = useFichaClinica(fichaId);
  const atualizarAlergia = useAtualizarAlergia();
  const atualizarCondicao = useAtualizarCondicao();
  const [addAlergia, setAddAlergia] = useState(false);
  const [addCondicao, setAddCondicao] = useState(false);

  if (isLoading) return <main className="mx-auto max-w-3xl px-6 py-8"><Spinner /></main>;
  if (isError || !ficha) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-8">
        <Alerta>Não foi possível abrir a ficha: {(error as Error)?.message}</Alerta>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <Link href="/medico/beneficiarios" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> Beneficiários
      </Link>

      <div className="mt-3 rounded-lg border border-border bg-surface p-5">
        <h1 className="text-xl font-bold text-foreground">{ficha.nomeCompleto}</h1>
        <p className="text-sm text-muted-foreground">
          {ficha.protocolo} · {idade(ficha.dataNascimento)} anos
          {ficha.telefone ? ` · ${ficha.telefone}` : ""}
        </p>
        {ficha.membros.length > 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Família: {ficha.membros.map((m) => m.nomeCompleto).join(", ")}
          </p>
        ) : null}
        {/* Ponte cross-vertical: pedir um olhar do Serviço Social para esta família. */}
        <SinalizarSocial
          fichaId={ficha.id}
          membros={ficha.membros.map((m) => ({ id: m.id, nomeCompleto: m.nomeCompleto }))}
          className="mt-4"
        />
      </div>

      {/* Alergias */}
      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold text-foreground">
            <AlertTriangle className="h-4 w-4 text-danger" /> Alergias
          </h2>
          {!addAlergia ? (
            <button onClick={() => setAddAlergia(true)} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
              <Plus className="h-4 w-4" /> Registrar
            </button>
          ) : null}
        </div>
        {addAlergia ? <FormAlergia ficha={ficha} onFechar={() => setAddAlergia(false)} /> : null}
        <ul className="mt-3 space-y-2">
          {ficha.alergias.map((a) => (
            <li key={a.id} className={cn("flex items-center gap-3 rounded-lg border border-border bg-surface p-3", !a.ativa && "opacity-60")}>
              <span className="min-w-0 flex-1 font-medium text-foreground">{a.descricao}</span>
              {a.gravidade ? (
                <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", GRAV_ESTILO[a.gravidade])}>
                  {GRAVIDADE_LABEL[a.gravidade]}
                </span>
              ) : null}
              {!a.ativa ? <span className="text-xs text-muted-foreground">inativa</span> : null}
              <button
                onClick={() => atualizarAlergia.mutate({ id: a.id, dados: { ativa: !a.ativa } })}
                disabled={atualizarAlergia.isPending}
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                {a.ativa ? "Inativar" : "Reativar"}
              </button>
            </li>
          ))}
          {ficha.alergias.length === 0 ? (
            <li className="rounded-lg border border-dashed border-border p-3 text-center text-sm text-muted-foreground">
              Nenhuma alergia registrada.
            </li>
          ) : null}
        </ul>
      </section>

      {/* Condições crônicas */}
      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold text-foreground">
            <Activity className="h-4 w-4 text-primary" /> Condições crônicas
          </h2>
          {!addCondicao ? (
            <button onClick={() => setAddCondicao(true)} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
              <Plus className="h-4 w-4" /> Registrar
            </button>
          ) : null}
        </div>
        {addCondicao ? <FormCondicao ficha={ficha} onFechar={() => setAddCondicao(false)} /> : null}
        <ul className="mt-3 space-y-2">
          {ficha.condicoesCronicas.map((c) => (
            <li key={c.id} className={cn("flex items-center gap-3 rounded-lg border border-border bg-surface p-3", !c.ativa && "opacity-60")}>
              <div className="min-w-0 flex-1">
                <span className="font-medium text-foreground">{c.descricao}</span>
                {c.cid10 ? <span className="ml-2 text-xs text-muted-foreground">{c.cid10}</span> : null}
                {c.observacoes ? <div className="text-xs text-muted-foreground">{c.observacoes}</div> : null}
              </div>
              {!c.ativa ? <span className="text-xs text-muted-foreground">inativa</span> : null}
              <button
                onClick={() => atualizarCondicao.mutate({ id: c.id, dados: { ativa: !c.ativa } })}
                disabled={atualizarCondicao.isPending}
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                {c.ativa ? "Inativar" : "Reativar"}
              </button>
            </li>
          ))}
          {ficha.condicoesCronicas.length === 0 ? (
            <li className="rounded-lg border border-dashed border-border p-3 text-center text-sm text-muted-foreground">
              Nenhuma condição registrada.
            </li>
          ) : null}
        </ul>
      </section>

      {/* Histórico de atendimentos */}
      <section className="mt-6">
        <h2 className="flex items-center gap-2 font-semibold text-foreground">
          <FileText className="h-4 w-4 text-primary" /> Histórico de atendimentos ({ficha.atendimentos.length})
        </h2>
        <ul className="mt-3 space-y-2">
          {ficha.atendimentos.map((at) => {
            const corpo = (
              <div className="rounded-lg border border-border bg-surface p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    {dataBR(at.encerradoEm)}
                    {at.membro ? <span className="ml-2 text-xs font-normal text-muted-foreground">{at.membro.nomeCompleto}</span> : null}
                  </span>
                  <span className="text-xs text-muted-foreground">{at.profissional.user.nome}</span>
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {at.cid10 ? <span className="font-medium text-foreground">{at.cid10} · </span> : null}
                  {at.avaliacao ?? at.subjetivo ?? "Sem avaliação registrada"}
                </div>
                {at.plano ? <div className="mt-0.5 text-xs text-muted-foreground">Conduta: {at.plano}</div> : null}
              </div>
            );
            return (
              <li key={at.id}>
                {at.agendamentoId ? (
                  <Link href={`/medico/atendimento/${at.agendamentoId}`} className="block transition hover:opacity-90">{corpo}</Link>
                ) : (
                  corpo
                )}
              </li>
            );
          })}
          {ficha.atendimentos.length === 0 ? (
            <li className="rounded-lg border border-dashed border-border p-3 text-center text-sm text-muted-foreground">
              Nenhum atendimento selado ainda.
            </li>
          ) : null}
        </ul>
      </section>
    </main>
  );
}
