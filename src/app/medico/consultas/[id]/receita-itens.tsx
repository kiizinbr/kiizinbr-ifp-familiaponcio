"use client";

import { useId, useRef, useState } from "react";
import clsx from "clsx";
import styles from "./prontuario.module.css";

/**
 * Cap de itens por receita — espelha MAX_RECEITA_ITENS / ReceitaItensSchema de
 * src/lib/medico/receita.ts (constante local pra não puxar zod pro client).
 */
const MAX_RECEITA_ITENS = 20;

interface Linha {
  uid: string;
  medicamento: string;
  posologia: string;
  quantidade: string;
  via: string;
}

/** Item serializado no hidden `itensJson` (só linhas com medicamento+posologia preenchidos). */
interface ItemSerializado {
  medicamento: string;
  posologia: string;
  quantidade: string;
  via: string;
}

function linhaVazia(uid: string): Linha {
  return { uid, medicamento: "", posologia: "", quantidade: "", via: "" };
}

/**
 * Lista repetível de medicamentos da receita (1..N). Inputs CONTROLADOS — o valor
 * de cada linha alimenta o hidden `itensJson` em tempo real (caso "value drives
 * other UI" das regras React). A validação que conta é a Zod server-side em
 * emitirReceitaAction; aqui o client só marca linha incompleta (UX) e NUNCA
 * desabilita o submit. `observacoes` NÃO vive aqui — segue input plano no <form> pai.
 *
 * Mecânica de lista + a11y + foco-after-remove clonada de cid10-combobox.tsx.
 */
export function ReceitaItens() {
  const baseId = useId();
  const seqRef = useRef(0);
  const addBtnRef = useRef<HTMLButtonElement | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>(() => [linhaVazia(`${baseId}-0`)]);
  const [anuncio, setAnuncio] = useState("");

  const cheio = linhas.length >= MAX_RECEITA_ITENS;

  // key estável por linha removível: useId + contador (regra react/patterns: nunca
  // key por index em lista removível). Inicia em 1 (o uid -0 já foi consumido).
  function novoUid(): string {
    return `${baseId}-${++seqRef.current}`;
  }

  function atualizar(uid: string, campo: keyof Omit<Linha, "uid">, valor: string) {
    setLinhas((atual) => atual.map((l) => (l.uid === uid ? { ...l, [campo]: valor } : l)));
  }

  function adicionar() {
    if (linhas.length >= MAX_RECEITA_ITENS) {
      // No cap: não adiciona e anuncia na live region (não desabilitar com foco dentro).
      setAnuncio(`Limite de ${MAX_RECEITA_ITENS} medicamentos atingido`);
      return;
    }
    setLinhas((atual) => [...atual, linhaVazia(novoUid())]);
    setAnuncio("Medicamento adicionado");
  }

  function remover(uid: string) {
    setLinhas((atual) => {
      if (atual.length <= 1) return atual; // sempre ao menos 1 linha (paridade com o form atual)
      return atual.filter((l) => l.uid !== uid);
    });
    setAnuncio("Medicamento removido");
    // O botão × removido é desmontado com a linha — sem isto o foco cai pro <body>.
    addBtnRef.current?.focus();
  }

  // Só linhas com medicamento E posologia preenchidos entram no wire format — a
  // action revalida com Zod (min(1) reprova receita sem item válido).
  const itens: ItemSerializado[] = linhas
    .filter((l) => l.medicamento.trim() && l.posologia.trim())
    .map((l) => ({
      medicamento: l.medicamento.trim(),
      posologia: l.posologia.trim(),
      quantidade: l.quantidade.trim(),
      via: l.via.trim(),
    }));

  return (
    <>
      {linhas.map((l, i) => {
        const numero = i + 1;
        const podeRemover = linhas.length > 1;
        const incompleta = Boolean(
          (l.medicamento.trim() || l.posologia.trim()) &&
          !(l.medicamento.trim() && l.posologia.trim()),
        );
        return (
          <div key={l.uid} className={styles.receitaItem}>
            <div className={styles.receitaItemHead}>
              <span className={styles.receitaItemNum}>{numero}.</span>
              {podeRemover ? (
                <button
                  type="button"
                  className={styles.cidChipBtn}
                  aria-label={`Remover medicamento ${numero}`}
                  title="Remover medicamento"
                  onClick={() => remover(l.uid)}
                >
                  ×
                </button>
              ) : null}
            </div>
            <input
              className={clsx(styles.docInput, incompleta && styles.docInputIncompleto)}
              aria-label={`Medicamento ${numero}`}
              placeholder="Medicamento"
              value={l.medicamento}
              onChange={(e) => atualizar(l.uid, "medicamento", e.target.value)}
            />
            <input
              className={clsx(styles.docInput, incompleta && styles.docInputIncompleto)}
              aria-label={`Posologia ${numero}`}
              placeholder="Posologia (ex.: 1 comp. de 8/8h por 7 dias)"
              value={l.posologia}
              onChange={(e) => atualizar(l.uid, "posologia", e.target.value)}
            />
            <div className={styles.docRow}>
              <input
                className={styles.docInput}
                aria-label={`Quantidade ${numero}`}
                placeholder="Quantidade"
                value={l.quantidade}
                onChange={(e) => atualizar(l.uid, "quantidade", e.target.value)}
              />
              <input
                className={styles.docInput}
                aria-label={`Via ${numero}`}
                placeholder="Via"
                value={l.via}
                onChange={(e) => atualizar(l.uid, "via", e.target.value)}
              />
            </div>
          </div>
        );
      })}

      <button
        ref={addBtnRef}
        type="button"
        className={styles.receitaAddBtn}
        onClick={adicionar}
        aria-disabled={cheio}
      >
        + Adicionar medicamento
      </button>
      {cheio ? (
        <span className={styles.micro}>máximo de {MAX_RECEITA_ITENS} medicamentos</span>
      ) : null}

      <span role="status" aria-live="polite" className="sr-only">
        {anuncio}
      </span>
      <input type="hidden" name="itensJson" value={JSON.stringify(itens)} />
    </>
  );
}
