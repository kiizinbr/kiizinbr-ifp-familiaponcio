"use client";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { anonimizarCidadaoAction } from "./anonimizar-actions";

const MENSAGEM =
  "Anonimizar esta ficha é IRREVERSÍVEL: apaga nome, CPF, contatos, dados de " +
  "saúde e socioeconômicos e remove os anexos. Esta ação não pode ser desfeita.";

/** Anonimização LGPD com confirmação real (modal do kit). A action revalida o RBAC. */
export function AnonimizarButton({ cidadaoId }: { cidadaoId: string }) {
  return (
    <ConfirmDialog
      action={anonimizarCidadaoAction}
      danger
      title="Anonimizar ficha (LGPD)"
      message={MENSAGEM}
      triggerLabel="Anonimizar ficha (LGPD)"
      confirmLabel="Sim, anonimizar"
      hiddenFields={{ id: cidadaoId }}
    />
  );
}
