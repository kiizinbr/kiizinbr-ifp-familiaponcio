"use client";

/**
 * Bloco de PRESCRIÇÃO da prancha de atendimento.
 * - Monta itens (medicamento + posologia) e emite via API.
 * - O bloqueio de alergia é SERVER-SIDE: se a API responder 409
 *   (ALERGIA_CONFLITO), mostramos os conflitos em vermelho e exigimos uma
 *   justificativa clínica; reenviar com `override.motivo` registra o override
 *   consciente (trilha de auditoria).
 */
import { useState } from "react";
import { AlertTriangle, Check, Pill, Plus, Trash2 } from "lucide-react";

import { Alerta, Botao, Campo, Input, Textarea } from "@/components/ui";
import { ApiError } from "@/lib/api";
import {
  GRAVIDADE_LABEL,
  useEmitirPrescricao,
  type ConflitoAlergia,
  type PrescricaoEmitida,
  type PrescricaoItemInput,
} from "@/lib/use-medico";

export function PrescricaoBloco({
  atendimentoId,
  readOnly,
}: {
  atendimentoId: string;
  readOnly: boolean;
}) {
  const emitir = useEmitirPrescricao();
  const [itens, setItens] = useState<PrescricaoItemInput[]>([]);
  const [medicamento, setMedicamento] = useState("");
  const [posologia, setPosologia] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [conflitos, setConflitos] = useState<ConflitoAlergia[] | null>(null);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [emitidas, setEmitidas] = useState<PrescricaoEmitida[]>([]);

  function adicionar() {
    const m = medicamento.trim();
    const p = posologia.trim();
    if (!m || !p) return;
    setItens((xs) => [...xs, { medicamento: m, posologia: p }]);
    setMedicamento("");
    setPosologia("");
    setConflitos(null); // a lista mudou → reavalia ao emitir de novo
  }

  function remover(i: number) {
    setItens((xs) => xs.filter((_, idx) => idx !== i));
    setConflitos(null);
  }

  async function emitirAgora(override?: { motivo: string }) {
    if (itens.length === 0) return;
    setErro(null);
    try {
      const res = await emitir.mutateAsync({
        atendimentoId,
        itens,
        observacoes: observacoes.trim() || undefined,
        override,
      });
      setEmitidas((xs) => [res, ...xs]);
      setItens([]);
      setObservacoes("");
      setConflitos(null);
      setMotivo("");
    } catch (e) {
      if (
        e instanceof ApiError &&
        e.status === 409 &&
        (e.body as { code?: string })?.code === "ALERGIA_CONFLITO"
      ) {
        setConflitos((e.body as { conflitos: ConflitoAlergia[] }).conflitos);
      } else {
        setErro((e as Error).message || "Não foi possível emitir a prescrição.");
      }
    }
  }

  // Atendimento selado sem prescrições nesta sessão: nada a mostrar.
  if (readOnly && emitidas.length === 0) return null;

  return (
    <section className="space-y-4 rounded-[14px] border border-border bg-surface-2 p-4">
      <h3 className="flex items-center gap-2 font-semibold text-foreground">
        <Pill className="h-4 w-4 text-primary" /> Prescrição
      </h3>

      {/* Prescrições emitidas nesta sessão */}
      {emitidas.map((p) => (
        <div key={p.id} className="rounded-md border border-success/40 bg-success/5 p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-success">
            <Check className="h-3.5 w-3.5" /> Prescrição emitida
            {p.alergiaOverride ? (
              <span className="text-danger">· override de alergia registrado</span>
            ) : null}
          </div>
          <ul className="mt-2 space-y-1 text-sm">
            {p.itens.map((it) => (
              <li key={it.id} className="text-foreground">
                <strong>{it.medicamento}</strong> — {it.posologia}
                {it.conflitoAlergia ? (
                  <span className="ml-1 text-xs text-danger">(conflito de alergia)</span>
                ) : null}
              </li>
            ))}
          </ul>
          {p.alergiaOverrideMotivo ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Justificativa: {p.alergiaOverrideMotivo}
            </p>
          ) : null}
        </div>
      ))}

      {!readOnly ? (
        <>
          {/* Itens em rascunho */}
          {itens.length > 0 ? (
            <ul className="space-y-1">
              {itens.map((it, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm"
                >
                  <span>
                    <strong className="text-foreground">{it.medicamento}</strong>{" "}
                    <span className="text-muted-foreground">— {it.posologia}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => remover(i)}
                    className="text-muted-foreground transition hover:text-danger"
                    aria-label="Remover item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {/* Adicionar item */}
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <Input
              placeholder="Medicamento (ex.: Amoxicilina 500mg)"
              value={medicamento}
              onChange={(e) => setMedicamento(e.target.value)}
            />
            <Input
              placeholder="Posologia (ex.: 1 cp 8/8h por 7 dias)"
              value={posologia}
              onChange={(e) => setPosologia(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  adicionar();
                }
              }}
            />
            <Botao
              variante="outline"
              type="button"
              onClick={adicionar}
              disabled={!medicamento.trim() || !posologia.trim()}
            >
              <Plus className="h-4 w-4" /> Item
            </Botao>
          </div>

          <Campo label="Observações (opcional)" htmlFor="presc-obs">
            <Textarea
              id="presc-obs"
              rows={2}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Orientações gerais ao paciente..."
            />
          </Campo>

          {/* Conflito de alergia — vermelho, com justificativa obrigatória */}
          {conflitos && conflitos.length > 0 ? (
            <div className="space-y-3 rounded-md border-2 border-danger/60 bg-danger/5 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-danger">
                <AlertTriangle className="h-4 w-4" /> Conflito de alergia — prescrição NÃO emitida
              </div>
              <ul className="space-y-1 text-sm text-foreground">
                {conflitos.map((c, i) => (
                  <li key={i}>
                    <strong>{c.medicamento}</strong> casa com a alergia{" "}
                    <strong>{c.alergiaDescricao}</strong>
                    {c.gravidade ? (
                      <span className="ml-1 text-xs font-semibold text-danger">
                        ({GRAVIDADE_LABEL[c.gravidade]})
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
              <Campo
                label="Justificativa clínica para prescrever mesmo assim"
                htmlFor="presc-motivo"
                obrigatorio
              >
                <Textarea
                  id="presc-motivo"
                  rows={2}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ex.: paciente já usou sem reação; benefício supera o risco."
                />
              </Campo>
              <Botao
                variante="danger"
                type="button"
                onClick={() => emitirAgora({ motivo: motivo.trim() })}
                carregando={emitir.isPending}
                disabled={motivo.trim().length < 5}
              >
                Justificar e prescrever mesmo assim
              </Botao>
            </div>
          ) : null}

          {erro ? <Alerta>{erro}</Alerta> : null}

          {!conflitos ? (
            <Botao
              type="button"
              onClick={() => emitirAgora()}
              carregando={emitir.isPending}
              disabled={itens.length === 0}
            >
              <Pill className="h-4 w-4" /> Emitir prescrição
            </Botao>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
