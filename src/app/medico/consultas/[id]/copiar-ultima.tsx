"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import type { ModeloEvolucao } from "@/lib/medico/modelos-evolucao";
import styles from "./prontuario.module.css";

/**
 * "Copiar da última consulta" + modelos de evolução por especialidade — island
 * 100% client-side, ZERO server action e ZERO schema. Tudo é manipulação do
 * textarea que JÁ existe (`textarea[name="texto"]` dentro de `#formEvolucao`,
 * renderizado só quando `podeEditar`). Reuso do padrão consagrado no diretório:
 * AssinarButton/Cid10Combobox leem/escrevem o DOM do formEvolucao por id — esta
 * peça faz o mesmo.
 *
 * REGRA DE OURO: nunca sobrescrever silenciosamente. Se o textarea está vazio,
 * insere direto. Se já há texto, abre o modal (markup/a11y clonados do
 * AssinarButton) com Cancelar / Acrescentar ao final / Substituir.
 *
 * CRÍTICO: após escrever, dispara um Event('input', {bubbles:true}) no textarea —
 * é o que faz o guard de unsaved-changes do AssinarButton (e o autosave) enxergar
 * a inserção como se fosse digitação. Sem isso, o médico copiaria texto e a
 * assinatura congelaria a nota IMUTÁVEL sem ele.
 *
 * LÓGICA SAGRADA INTOCADA: não toca RBAC (só renderiza sob `podeEditar`),
 * anti-overbooking, assinatura/imutabilidade nem actions. Inserir texto no
 * rascunho é equivalente a digitar.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type Ultima = { texto: string; especialidade: string; data: string };

type Props = {
  ultima?: Ultima;
  modelos: ModeloEvolucao[];
};

/** Escreve no textarea do #formEvolucao e dispara o input event (guard/autosave). */
function escreverNoTextarea(valor: string) {
  const evo = document.getElementById("formEvolucao") as HTMLFormElement | null;
  const textarea = evo?.querySelector<HTMLTextAreaElement>('textarea[name="texto"]');
  if (!textarea) return;
  textarea.value = valor;
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.focus();
}

function textoAtual(): string {
  const evo = document.getElementById("formEvolucao") as HTMLFormElement | null;
  const textarea = evo?.querySelector<HTMLTextAreaElement>('textarea[name="texto"]');
  return textarea?.value ?? "";
}

export function CopiarUltima({ ultima, modelos }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  // O texto pendente que o modal vai aplicar (da "última" ou de um modelo).
  const pendenteRef = useRef<string>("");
  const titleId = useId();
  const descId = useId();
  const triggerRef = useRef<HTMLElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

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

  /** Vazio → insere direto. Com texto → abre o modal de confirmação. */
  function aplicar(texto: string, origem: HTMLElement | null) {
    if (textoAtual().trim() === "") {
      escreverNoTextarea(texto);
      return;
    }
    pendenteRef.current = texto;
    triggerRef.current = origem;
    setOpen(true);
  }

  function acrescentarAoFinal() {
    const atual = textoAtual();
    const sep = atual.endsWith("\n") || atual === "" ? "" : "\n\n";
    escreverNoTextarea(`${atual}${sep}${pendenteRef.current}`);
    setOpen(false);
  }

  function substituir() {
    escreverNoTextarea(pendenteRef.current);
    setOpen(false);
  }

  // Nada para inserir: nem "última" com texto nem modelos. Não renderiza barra.
  if (!ultima && modelos.length === 0) return null;

  return (
    <>
      <div className={styles.copiarBar}>
        {ultima ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            title={`Última: ${ultima.especialidade} · ${ultima.data}`}
            onClick={(e) => aplicar(ultima.texto, e.currentTarget)}
          >
            Copiar da última consulta
          </Button>
        ) : null}
        {modelos.length > 0 ? (
          <div className={styles.copiarModelos}>
            <span className={styles.micro}>Modelos</span>
            {modelos.map((m) => (
              <Button
                key={m.titulo}
                type="button"
                variant="ghost"
                size="sm"
                onClick={(e) => aplicar(m.texto, e.currentTarget)}
              >
                {m.titulo}
              </Button>
            ))}
          </div>
        ) : null}
      </div>

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
                    Já há texto na evolução
                  </h2>
                </div>
                <div id={descId} className="m-body">
                  A evolução já tem conteúdo. Você pode acrescentar o texto ao final do que já
                  escreveu ou substituir tudo pelo novo texto.
                </div>
                <div className="m-foot">
                  <Button
                    ref={cancelRef}
                    type="button"
                    variant="ghost"
                    onClick={() => setOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="button" variant="secondary" onClick={acrescentarAoFinal}>
                    Acrescentar ao final
                  </Button>
                  <Button type="button" variant="primary" onClick={substituir}>
                    Substituir
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
