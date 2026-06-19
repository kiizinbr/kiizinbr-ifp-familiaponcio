"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Search,
  Stethoscope,
  X,
} from "lucide-react";

import {
  PARENTESCO_LABEL,
  STATUS_AGENDAMENTO_LABEL,
  type FichaBuscaItem,
  type StatusAgendamento,
} from "@/lib/api";
import {
  useAgendaDoDia,
  useBuscarFichas,
  useCriarAgendamento,
} from "@/lib/use-medico";
import { Alerta, Botao, Campo, Input, Select, Spinner } from "@/components/ui";
import { PageHeader } from "@/components/casa";
import { AcoesAgendamento } from "@/components/medico/acoes-agendamento";
import { cn } from "@/lib/cn";
import { idade } from "@/lib/idade";

const statusEstilo: Record<StatusAgendamento, string> = {
  AGENDADO: "border-border text-muted-foreground",
  CONFIRMADO: "border-info/50 text-info",
  EM_ATENDIMENTO: "border-primary/60 bg-primary/10 text-primary",
  CONCLUIDO: "border-success/50 text-success",
  FALTOU: "border-warning/50 text-warning",
  CANCELADO: "border-border text-muted-foreground line-through",
};

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** Data de hoje no fuso local em formato YYYY-MM-DD (compatível com a API). */
function hojeISO() {
  return new Date().toLocaleDateString("en-CA");
}

/** Soma n dias a uma data YYYY-MM-DD (meio-dia evita problemas de fuso/DST). */
function addDias(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("en-CA");
}

const DURACOES = [
  { valor: "15", rotulo: "15 min" },
  { valor: "30", rotulo: "30 min" },
  { valor: "45", rotulo: "45 min" },
  { valor: "60", rotulo: "1 hora" },
];

/** Form de novo agendamento: busca paciente → escolhe → quem/quando/duração + motivo. */
function NovoAgendamento({ onFechar }: { onFechar: () => void }) {
  const [busca, setBusca] = useState("");
  const [fichaId, setFichaId] = useState<string | null>(null);
  const [nomeEscolhido, setNomeEscolhido] = useState("");
  const [membros, setMembros] = useState<FichaBuscaItem["membros"]>([]);
  const [membroId, setMembroId] = useState(""); // "" = titular
  const [quando, setQuando] = useState("");
  const [duracao, setDuracao] = useState("30");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const { data: resultados, isFetching } = useBuscarFichas(busca);
  const criar = useCriarAgendamento();

  function escolher(f: FichaBuscaItem) {
    setFichaId(f.id);
    setNomeEscolhido(f.nomeCompleto);
    setMembros(f.membros ?? []);
    setMembroId("");
  }

  function trocar() {
    setFichaId(null);
    setBusca("");
    setMembros([]);
    setMembroId("");
  }

  async function salvar() {
    setErro(null);
    if (!fichaId || !quando) {
      setErro("Escolha o paciente e a data/hora.");
      return;
    }
    const inicio = new Date(quando);
    const fim = new Date(inicio.getTime() + Number(duracao) * 60_000);
    try {
      await criar.mutateAsync({
        fichaId,
        membroId: membroId || undefined,
        inicioEm: inicio.toISOString(),
        fimEm: fim.toISOString(),
        motivo: motivo.trim() || undefined,
      });
      onFechar();
    } catch (e) {
      setErro((e as Error).message || "Falha ao agendar.");
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-primary/30 bg-surface p-4 shadow-casa-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-foreground">Novo agendamento</h2>
        <button onClick={onFechar} aria-label="Fechar" className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {!fichaId ? (
        <Campo label="Paciente" htmlFor="busca" dica="Digite nome, CPF ou protocolo (mín. 2 letras)" className="mt-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="busca"
              className="pl-9"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Ex.: Silva"
              autoFocus
            />
          </div>
          {busca.trim().length >= 2 ? (
            <ul className="mt-2 divide-y divide-border rounded-md border border-border">
              {(resultados?.items ?? []).map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => escolher(f)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    <span className="font-medium text-foreground">{f.nomeCompleto}</span>
                    <span className="text-xs text-muted-foreground">{f.protocolo}</span>
                  </button>
                </li>
              ))}
              {!isFetching && (resultados?.items ?? []).length === 0 ? (
                <li className="px-3 py-2 text-sm text-muted-foreground">
                  Nenhum paciente encontrado.
                </li>
              ) : null}
            </ul>
          ) : null}
        </Campo>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between rounded-md bg-primary/10 px-3 py-2 text-sm">
            <span className="font-medium text-foreground">{nomeEscolhido}</span>
            <button
              type="button"
              onClick={trocar}
              className="text-xs text-primary hover:underline"
            >
              trocar
            </button>
          </div>

          {membros.length > 0 ? (
            <Campo label="Para quem" htmlFor="membro" dica="Atende o titular ou um dependente da ficha.">
              <Select
                id="membro"
                value={membroId}
                onChange={(e) => setMembroId(e.target.value)}
              >
                <option value="">Titular — {nomeEscolhido}</option>
                {membros.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nomeCompleto} ({PARENTESCO_LABEL[m.parentesco]})
                  </option>
                ))}
              </Select>
            </Campo>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Data e hora" htmlFor="quando" obrigatorio>
              <Input
                id="quando"
                type="datetime-local"
                value={quando}
                onChange={(e) => setQuando(e.target.value)}
              />
            </Campo>
            <Campo label="Duração" htmlFor="duracao">
              <Select id="duracao" value={duracao} onChange={(e) => setDuracao(e.target.value)}>
                {DURACOES.map((d) => (
                  <option key={d.valor} value={d.valor}>
                    {d.rotulo}
                  </option>
                ))}
              </Select>
            </Campo>
          </div>

          <Campo label="Motivo" htmlFor="motivo">
            <Input
              id="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: consulta de rotina"
              maxLength={300}
            />
          </Campo>
        </div>
      )}

      {erro ? <div className="mt-3"><Alerta>{erro}</Alerta></div> : null}

      <div className="mt-4 flex justify-end gap-2">
        <Botao variante="ghost" onClick={onFechar}>Cancelar</Botao>
        <Botao onClick={salvar} carregando={criar.isPending} disabled={!fichaId || !quando}>
          <CalendarPlus className="h-4 w-4" /> Agendar
        </Botao>
      </div>
    </div>
  );
}

export default function AgendaPage() {
  const [dataSel, setDataSel] = useState(hojeISO);
  const { data, isLoading, isError, error } = useAgendaDoDia(dataSel);
  const [novoAberto, setNovoAberto] = useState(false);

  const ehHoje = dataSel === hojeISO();

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <PageHeader
        titulo={ehHoje ? "Agenda do dia" : "Agenda"}
        descricao={new Date(`${dataSel}T12:00:00`).toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "2-digit",
          month: "long",
        })}
        acoes={
          !novoAberto ? (
            <Botao onClick={() => setNovoAberto(true)}>
              <CalendarPlus className="h-4 w-4" /> Novo agendamento
            </Botao>
          ) : undefined
        }
      />

      {/* Navegação de data — a API e o hook já aceitam ?data=YYYY-MM-DD */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Botao
          variante="outline"
          className="px-2 py-1.5"
          aria-label="Dia anterior"
          onClick={() => setDataSel((d) => addDias(d, -1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Botao>
        <Botao
          variante={ehHoje ? "primary" : "outline"}
          className="px-3 py-1.5 text-xs"
          onClick={() => setDataSel(hojeISO())}
        >
          Hoje
        </Botao>
        <Botao
          variante="outline"
          className="px-2 py-1.5"
          aria-label="Próximo dia"
          onClick={() => setDataSel((d) => addDias(d, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Botao>
        <Input
          type="date"
          value={dataSel}
          onChange={(e) => setDataSel(e.target.value || hojeISO())}
          className="w-auto"
          aria-label="Escolher data"
        />
      </div>

      {novoAberto ? <NovoAgendamento onFechar={() => setNovoAberto(false)} /> : null}

      {isLoading ? <Spinner label="Carregando agenda..." /> : null}
      {isError ? (
        <div className="mt-6">
          <Alerta>Não foi possível carregar a agenda: {(error as Error)?.message}</Alerta>
        </div>
      ) : null}

      {data && data.items.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-muted-foreground">
          Nenhum paciente agendado para este dia.
        </div>
      ) : null}

      <ul className="mt-6 space-y-3">
        {data?.items.map((ag) => (
          <li key={ag.id} className="space-y-2">
            <Link
              href={`/medico/atendimento/${ag.id}`}
              className="group flex items-center gap-4 rounded-[18px] border border-border bg-surface p-4 shadow-[var(--ifp-shadow-casa-sm)] transition hover:shadow-[var(--ifp-shadow-casa)]"
            >
              <div className="w-14 shrink-0 text-center">
                <div className="text-lg font-bold text-primary">{hora(ag.inicioEm)}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {hora(ag.fimEm)}
                </div>
              </div>

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Stethoscope className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-foreground group-hover:text-primary">
                  {ag.membro?.nomeCompleto ?? ag.ficha.nomeCompleto}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {idade(ag.membro?.dataNascimento ?? ag.ficha.dataNascimento)} anos
                  </span>
                </div>
                <div className="truncate text-sm text-muted-foreground">
                  {ag.motivo ?? "Sem motivo informado"} · {ag.ficha.protocolo}
                </div>
              </div>

              <span
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                  statusEstilo[ag.status],
                )}
              >
                {STATUS_AGENDAMENTO_LABEL[ag.status]}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
            </Link>
            <div className="px-4">
              <AcoesAgendamento id={ag.id} status={ag.status} inicioEm={ag.inicioEm} />
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
