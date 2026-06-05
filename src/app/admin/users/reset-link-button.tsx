"use client";

import { useActionState, useState } from "react";
import { gerarLinkResetAction, type LinkResetResult } from "./actions";

/** Gera e copia o link de reset de senha de um usuário (super_admin). Sem e-mail. */
export function ResetLinkButton({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState<LinkResetResult | null, FormData>(
    gerarLinkResetAction,
    null,
  );
  const [copiado, setCopiado] = useState(false);

  const link = state?.ok ? state.link : null;
  const urlCompleta = link && typeof window !== "undefined" ? window.location.origin + link : link;

  if (link) {
    return (
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        title={urlCompleta ?? ""}
        onClick={() => {
          if (urlCompleta) {
            navigator.clipboard
              ?.writeText(urlCompleta)
              .then(() => setCopiado(true))
              .catch(() => undefined);
          }
        }}
      >
        {copiado ? "Copiado ✓" : "Copiar link de reset"}
      </button>
    );
  }

  return (
    <form action={action} style={{ display: "inline" }}>
      <input type="hidden" name="userId" value={userId} />
      <button type="submit" disabled={pending} className="btn btn-secondary btn-sm">
        {pending ? "Gerando..." : "Gerar link de reset"}
      </button>
      {state && !state.ok && (
        <span role="alert" style={{ color: "var(--danger)", fontSize: 12, marginLeft: 6 }}>
          {state.error}
        </span>
      )}
    </form>
  );
}
