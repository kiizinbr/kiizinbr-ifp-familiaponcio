"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";

/**
 * Toggle de presença mobile-first (F1). Substitui o checkbox 22px invertido por
 * um par segmentado Presente/Falta com a SEMÂNTICA CORRETA (palavra escrita, não
 * só um estado de "marcado/desmarcado"). Default = Presente (preserva o
 * `defaultChecked` anterior).
 *
 * Contrato com a action INTOCADO: o único campo enviado é
 * `<input type="checkbox" name={`p_${id}`} hidden>`. Quando `presente`, o campo
 * existe no FormData → `registrarPresencasAction` lê `formData.has('p_'+id)` = true.
 * Quando falta, o checkbox fica desmarcado → `has()` = false → falta.
 *
 * Atalho "Todos presentes/Todas faltas": ouve um `CustomEvent` no `window`
 * (`ifp:presenca-todos`, detail `{ presente: boolean }`) emitido por um botão no
 * card. Mantém o card como Server Component (sem elevar estado).
 */
export function PresencaToggle({ id, nomeAcessivel }: { id: string; nomeAcessivel: string }) {
  const [presente, setPresente] = useState(true);

  useEffect(() => {
    function onTodos(event: Event) {
      const detail = (event as CustomEvent<{ presente: boolean }>).detail;
      if (detail && typeof detail.presente === "boolean") {
        setPresente(detail.presente);
      }
    }
    window.addEventListener("ifp:presenca-todos", onTodos);
    return () => window.removeEventListener("ifp:presenca-todos", onTodos);
  }, []);

  return (
    <>
      {/* Único campo enviado ao FormData — contrato byte-a-byte com a action. */}
      <input type="checkbox" name={`p_${id}`} checked={presente} hidden readOnly />
      {/* Escolha mutuamente exclusiva (Presente XOR Falta) → radiogroup, não dois
          toggles independentes: aria-pressed em ambos faria o leitor de tela
          anunciar dois alternadores soltos. role=radio + aria-checked diz "uma
          de duas opções", e o leitor anuncia só a ativa. */}
      <div className="segmented" role="radiogroup" aria-label={`Presença de ${nomeAcessivel}`}>
        <button
          type="button"
          role="radio"
          className={clsx(presente && "on")}
          aria-checked={presente}
          aria-label={`${nomeAcessivel}: presente`}
          onClick={() => setPresente(true)}
        >
          Presente
        </button>
        <button
          type="button"
          role="radio"
          className={clsx(!presente && "on")}
          aria-checked={!presente}
          aria-label={`${nomeAcessivel}: falta`}
          onClick={() => setPresente(false)}
        >
          Falta
        </button>
      </div>
    </>
  );
}
