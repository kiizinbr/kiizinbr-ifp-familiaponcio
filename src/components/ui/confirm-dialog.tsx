"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "./button";
import { SubmitButton } from "./submit-button";

type Props = {
  /** Server action executada ao confirmar (recebe o FormData do `<form>`). */
  action: (formData: FormData) => void | Promise<void>;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  /** Rótulo do gatilho que abre o modal. */
  triggerLabel: ReactNode;
  cancelLabel?: string;
  /** Estilo de perigo no gatilho e no confirmar (ações irreversíveis). */
  danger?: boolean;
  /** Campos ocultos enviados junto da action (ex.: `{ id }`). */
  hiddenFields?: Record<string, string>;
  triggerClassName?: string;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Confirmação real (modal do Design Kit) para ações destrutivas/irreversíveis —
 * substitui `window.confirm()`, que aceita Enter por reflexo e é fraco em a11y.
 *
 * Acessibilidade: `role="dialog"` + `aria-modal`, título/descrição ligados por
 * `aria-labelledby`/`aria-describedby`, foco inicial no **Cancelar** (default
 * seguro), Escape e clique no scrim fecham, foco preso no diálogo e devolvido
 * ao gatilho ao fechar. O confirmar é um `SubmitButton` (anti-duplo-clique).
 */
export function ConfirmDialog({
  action,
  title,
  message,
  confirmLabel,
  triggerLabel,
  cancelLabel = "Cancelar",
  danger = false,
  hiddenFields,
  triggerClassName,
}: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const descId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const close = useCallback(() => setOpen(false), []);

  // Foco no Cancelar ao abrir; restaura no gatilho ao fechar.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    return () => (previouslyFocused ?? triggerRef.current)?.focus();
  }, [open]);

  // Escape fecha; Tab fica preso dentro do diálogo (focus trap simples).
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant={danger ? "danger" : "secondary"}
        className={triggerClassName}
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </Button>

      {mounted && open
        ? createPortal(
            <div
              className="modal-scrim"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) close();
              }}
            >
              <div
                ref={dialogRef}
                className="modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descId}
              >
                <div className="m-head">
                  <h2 id={titleId} className="m-title">
                    {title}
                  </h2>
                </div>
                <div id={descId} className="m-body">
                  {message}
                </div>
                <form
                  className="m-foot"
                  action={async (formData) => {
                    // Aguarda a action; se ela faz `redirect()`, a navegação
                    // interrompe aqui (e o modal some). Em ações que revalidam
                    // sem redirect, fecha o modal ao concluir.
                    await action(formData);
                    setOpen(false);
                  }}
                >
                  {hiddenFields
                    ? Object.entries(hiddenFields).map(([name, value]) => (
                        <input key={name} type="hidden" name={name} value={value} />
                      ))
                    : null}
                  <Button ref={cancelRef} type="button" variant="ghost" onClick={close}>
                    {cancelLabel}
                  </Button>
                  <SubmitButton variant={danger ? "danger" : "primary"}>
                    {confirmLabel}
                  </SubmitButton>
                </form>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
