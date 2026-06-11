"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarPlus, ChevronRight, Search, Stethoscope, X } from "lucide-react";

import { STATUS_AGENDAMENTO_LABEL, type StatusAgendamento } from "@/lib/api";
import {
  useAgendaDoDia,
  useBuscarFichas,
  useCriarAgendamento,
} from "@/lib/use-medico";
import { Alerta, Botao, Campo, Input, Spinner } from "@/components/ui";
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

/** Form de novo agendamento: busca paciente → escolhe → data/hora + motivo. */
function NovoAgendamento({ onFechar }: { onFechar: () => void }) {
  const [busca, setBusca] = useState("");
  const [fichaId, setFichaId] = useState<string | null>(null);
  const [nomeEscolhido, setNomeEscolhido] = useState("");
  const [quando, setQuando] = useState("");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const { data: resultados, isFetching } = useBuscarFichas(busca);
  const criar = useCriarAgendamento();

  async function salvar() {
    setErro(null);
    if (!fichaId || !quando) {
      setErro("Escolha o paciente e a data/hora.");
      return;
    }
    try {
      await criar.mutateAsync({
        fichaId,
        inicioEm: new Date(quando).toISOString(),
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
                    onClick={() => {
                      setFichaId(f.id);
                      setNomeEscolhido(f.nomeCompleto);
                    }}
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
              onClick={() => { setFichaId(null); setBusca(""); }}
              className="text-xs text-primary hover:underline"
            >
              trocar
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Data e hora" htmlFor="quando" obrigatorio>
              <Input
                id="quando"
                type="datetime-local"
                value={quando}
                onChange={(e) => setQuando(e.target.value)}
              />
            </Campo>
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
  const { data, isLoading, isError, error } = useAgendaDoDia();
  const [novoAberto, setNovoAberto] = useState(false);

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agenda do dia</h1>
          {data?.dia ? (
            <p className="text-sm text-muted-foreground">
              {new Date(`${data.dia}T12:00:00`).toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "2-digit",
                month: "long",
              })}
            </p>
          ) : null}
        </div>
        {!novoAberto ? (
          <Botao onClick={() => setNovoAberto(true)}>
            <CalendarPlus className="h-4 w-4" /> Novo agendamento
          </Botao>
        ) : null}
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
          Nenhum paciente agendado para hoje.
        </div>
      ) : null}

      <ul className="mt-6 space-y-3">
        {data?.items.map((ag) => (
          <li key={ag.id}>
            <Link
              href={`/medico/atendimento/${ag.id}`}
              className="group flex items-center gap-4 rounded-lg border border-border bg-surface p-4 shadow-ifp-sm transition hover:shadow-casa-sm"
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
          </li>
        ))}
      </ul>
    </main>
  );
}
