"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";

type Props = {
  /** Server action de assinar+concluir (recebe FormData com consultaId/notaId). */
  action: (formData: FormData) => void | Promise<void>;
  consultaId: string;
  notaId: string;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * "Assinar e concluir" com guarda de alterações não salvas.
 *
 * O form de assinar é SEPARADO do `formEvolucao` (texto/vitais/CID) e a action
 * de assinar só congela o último rascunho SALVO — não recebe o conteúdo da tela.
 * Adicionar um chip de CID dá feedback de "adicionado" que PARECE persistência;
 * sem esta guarda, o médico assinaria uma nota IMUTÁVEL sem os diagnósticos que
 * está vendo (correção só via addendo).
 *
 * Esta guarda é 100% client-side: NÃO altera a transação sagrada de assinar nem
 * toca em nota já assinada. Se `formEvolucao` está "sujo" (input != defaultValue,
 * ou diagnósticos != snapshot inicial), intercepta o submit e abre um diálogo:
 * salvar o rascunho primeiro (recomendado) ou assinar mesmo assim.
 */
export function AssinarButton({ action, consultaId, notaId }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const descId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  // Snapshot do diagnosticosJson no mount: o hidden é controlado (sem
  // defaultValue), então guardamos o valor inicial pra comparar a sujeira.
  const diagInicialRef = useRef<string | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const evo = document.getElementById("formEvolucao") as HTMLFormElement | null;
    const hidden = evo?.querySelector<HTMLInputElement>('input[name="diagnosticosJson"]');
    diagInicialRef.current = hidden?.value ?? null;
  }, []);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const trigger = triggerRef.current;
    cancelRef.current?.focus();
    return () => (previouslyFocused ?? trigger)?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
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
  }, [open]);

  /** `formEvolucao` tem alterações não salvas? (texto/vitais != default; CID != snapshot). */
  function temAlteracoesNaoSalvas(): boolean {
    const evo = document.getElementById("formEvolucao") as HTMLFormElement | null;
    if (!evo) return false;
    // #18 — mede o textarea oculto name="texto" (data-soap-fonte) como verdade do
    // texto; as caixas SOAP/texto-livre auxiliares (data-soap-aux) são controladas
    // (sem defaultValue) e são IGNORADAS — senão dariam falso "alterações não
    // salvas" antes de assinar a nota imutável. Fallback no primeiro textarea
    // não-aux preserva o comportamento sem SoapEditor.
    const fonte = evo.querySelector<HTMLTextAreaElement>("textarea[data-soap-fonte]");
    const textarea =
      fonte ?? evo.querySelector<HTMLTextAreaElement>("textarea:not([data-soap-aux])");
    if (textarea && textarea.value !== textarea.defaultValue) return true;
    const inputs = evo.querySelectorAll<HTMLInputElement>('input[type="text"], input:not([type])');
    for (const input of inputs) {
      if (input.name === "diagnosticosJson") continue;
      if (input.name === "consultaId") continue;
      if (input.value !== input.defaultValue) return true;
    }
    const hidden = evo.querySelector<HTMLInputElement>('input[name="diagnosticosJson"]');
    // Baseline do CID: o autosave publica em `evo.dataset.cidBaseline` o
    // diagnosticosJson que FOI persistido a cada save confirmado. Preferi-lo ao
    // snapshot de MOUNT (diagInicialRef) quando presente elimina o falso
    // "Alterações não salvas" depois que o autosave salvou um CID — o indicador
    // "salvo às HH:MM" já confirmou. Sem autosave (dataset ausente) cai no
    // snapshot de mount, comportamento idêntico ao anterior. Fail-safe: assinar
    // nunca assina sem o conteúdo; aqui só removemos o aviso redundante.
    const cidBaseline = evo.dataset.cidBaseline ?? diagInicialRef.current;
    if (hidden && cidBaseline != null && hidden.value !== cidBaseline) {
      return true;
    }
    return false;
  }

  function aoClicar(event: React.MouseEvent<HTMLButtonElement>) {
    if (temAlteracoesNaoSalvas()) {
      event.preventDefault(); // segura o submit; abre a confirmação
      setOpen(true);
    }
    // sem alterações: deixa o submit nativo do form seguir normalmente
  }

  function salvarRascunhoPrimeiro() {
    setOpen(false);
    (document.getElementById("formEvolucao") as HTMLFormElement | null)?.requestSubmit();
  }

  return (
    <>
      <form ref={formRef} action={action} style={{ marginTop: 10, textAlign: "right" }}>
        <input type="hidden" name="consultaId" value={consultaId} />
        <input type="hidden" name="notaId" value={notaId} />
        <SubmitButton pendingLabel="Assinando…" onClick={aoClicar}>
          Assinar e concluir →
        </SubmitButton>
      </form>

      {mounted && open
        ? createPortal(
            <div
              className="modal-scrim"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setOpen(false);
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
                    Alterações não salvas
                  </h2>
                </div>
                <div id={descId} className="m-body">
                  Há mudanças na evolução (texto, sinais vitais ou diagnósticos CID) que ainda não
                  foram salvas. Assinar agora congela a nota IMUTÁVEL sem elas — correções depois só
                  entram como addendo. Salve o rascunho primeiro.
                </div>
                <div className="m-foot">
                  <Button
                    ref={cancelRef}
                    type="button"
                    variant="ghost"
                    onClick={() => setOpen(false)}
                  >
                    Voltar
                  </Button>
                  <Button type="button" variant="secondary" onClick={salvarRascunhoPrimeiro}>
                    Salvar rascunho
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => {
                      setOpen(false);
                      formRef.current?.requestSubmit();
                    }}
                  >
                    Assinar mesmo assim
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
