"use client";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cancelarEncaminhamentoAction } from "./actions";

/** Motivos curtos persistidos em `canceladoMotivo` (o valor viaja como texto). */
const MOTIVOS = ["Desistência", "Reagendou", "Duplicado", "Erro"] as const;

/**
 * Cancelar encaminhamento com confirmação real (modal do kit) + motivo.
 * Reusa o ConfirmDialog: o `<select name="motivo">` viaja no MESMO FormData e
 * já é persistido por `cancelarEncaminhamentoAction` (coluna `canceladoMotivo`),
 * sem mudar o contrato da action. A action revalida e o RBAC fica nela.
 */
export function CancelarEncaminhamentoButton({ encaminhamentoId }: { encaminhamentoId: string }) {
  return (
    <ConfirmDialog
      action={cancelarEncaminhamentoAction}
      danger
      triggerVariant="ghost"
      triggerSize="sm"
      triggerLabel="Cancelar"
      title="Cancelar encaminhamento?"
      message="O pedido sai da fila de agendamento. Selecione o motivo para registro."
      confirmLabel="Cancelar pedido"
      cancelLabel="Voltar"
      hiddenFields={{ encaminhamentoId }}
    >
      <label className="field-group" style={{ marginBottom: 0, marginTop: 14 }}>
        <span className="label">
          Motivo <span className="req">*</span>
        </span>
        <select name="motivo" className="select" required defaultValue="">
          <option value="" disabled>
            Selecione…
          </option>
          {MOTIVOS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
    </ConfirmDialog>
  );
}
