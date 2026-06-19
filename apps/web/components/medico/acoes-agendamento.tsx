"use client";

/**
 * Ações de gestão de um agendamento (confirmar presença, marcar falta, cancelar
 * e reagendar) — usadas na agenda e na fila do dia. Só aparecem enquanto o
 * agendamento está AGENDADO/CONFIRMADO (depois de iniciar o atendimento, some).
 */
import { useState } from "react";
import { Ban, CalendarClock, Check, UserX, X } from "lucide-react";

import { Alerta, Botao, Input } from "@/components/ui";
import { useAtualizarAgendamento } from "@/lib/use-medico";
import type { StatusAgendamento } from "@/lib/api";

const GERENCIAVEIS: StatusAgendamento[] = ["AGENDADO", "CONFIRMADO"];

/** ISO → valor de <input type="datetime-local"> no fuso local. */
function paraInputLocal(iso: string) {
  const d = new Date(iso);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

const btn =
  "inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted disabled:opacity-50";

export function AcoesAgendamento({
  id,
  status,
  inicioEm,
}: {
  id: string;
  status: StatusAgendamento;
  inicioEm: string;
}) {
  const atualizar = useAtualizarAgendamento();
  const [reagendando, setReagendando] = useState(false);
  const [quando, setQuando] = useState(() => paraInputLocal(inicioEm));
  const [erro, setErro] = useState<string | null>(null);

  if (!GERENCIAVEIS.includes(status)) return null;

  async function aplicar(
    dados: Parameters<typeof atualizar.mutateAsync>[0]["dados"],
    confirmar?: string,
  ) {
    if (confirmar && !confirm(confirmar)) return;
    setErro(null);
    try {
      await atualizar.mutateAsync({ id, dados });
      setReagendando(false);
    } catch (e) {
      setErro((e as Error).message || "Falha.");
    }
  }

  async function reagendar() {
    if (!quando) return;
    await aplicar({ inicioEm: new Date(quando).toISOString() });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {status === "AGENDADO" ? (
        <button
          className={btn}
          disabled={atualizar.isPending}
          onClick={() => aplicar({ status: "CONFIRMADO" })}
        >
          <Check className="h-3 w-3" /> Confirmar
        </button>
      ) : null}
      <button
        className={btn}
        disabled={atualizar.isPending}
        onClick={() => aplicar({ status: "FALTOU" }, "Marcar falta deste paciente?")}
      >
        <UserX className="h-3 w-3" /> Falta
      </button>
      <button
        className={btn}
        disabled={atualizar.isPending}
        onClick={() => setReagendando((r) => !r)}
      >
        <CalendarClock className="h-3 w-3" /> Reagendar
      </button>
      <button
        className={`${btn} hover:border-danger/40 hover:text-danger`}
        disabled={atualizar.isPending}
        onClick={() => aplicar({ status: "CANCELADO" }, "Cancelar este agendamento?")}
      >
        <Ban className="h-3 w-3" /> Cancelar
      </button>

      {reagendando ? (
        <span className="flex items-center gap-1.5">
          <Input
            type="datetime-local"
            value={quando}
            onChange={(e) => setQuando(e.target.value)}
            className="w-auto py-1 text-xs"
          />
          <Botao className="px-2 py-1 text-xs" carregando={atualizar.isPending} onClick={reagendar}>
            Salvar
          </Botao>
          <button className={btn} onClick={() => setReagendando(false)} aria-label="Fechar">
            <X className="h-3 w-3" />
          </button>
        </span>
      ) : null}

      {erro ? (
        <span className="basis-full">
          <Alerta tipo="erro">{erro}</Alerta>
        </span>
      ) : null}
    </div>
  );
}
