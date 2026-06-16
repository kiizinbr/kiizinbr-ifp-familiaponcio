"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import clsx from "clsx";
import { matricularAction, buscarCandidatosAction } from "../../actions";
import { SubmitButton } from "@/components/ui/submit-button";
import styles from "../../capacitacao.module.css";

type Candidato = { id: string; nome: string };

const DEBOUNCE_MS = 250;
const MIN_CHARS = 2;

/**
 * Form de matrícula com busca INCREMENTAL server-side (combobox). Substitui o
 * <select> estático de 300 — inviável com 1064+ alunas. Só envia ao escolher alguém.
 *
 * A11y espelha o combobox de CID-10 do Médico (src/app/medico/consultas/[id]/
 * cid10-combobox.tsx): role="combobox" + listbox/option, aria-expanded/controls/
 * activedescendant, navegação ArrowUp/Down/Enter/Escape, live region de contagem
 * e debounce com seqRef anti-out-of-order. O CONTRATO DE SUBMIT é INTOCADO:
 * action={matricularAction}, hidden turmaId, e ao escolher injeta hidden
 * cidadaoId={escolhido.id}; SubmitButton disabled enquanto nada foi escolhido.
 */
export function MatricularCombobox({ turmaId }: { turmaId: string }) {
  const baseId = useId();
  const inputId = `${baseId}-mat-input`;
  const listboxId = `${baseId}-mat-listbox`;

  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<Candidato[]>([]);
  const [escolhido, setEscolhido] = useState<Candidato | null>(null);
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const [anuncio, setAnuncio] = useState("");
  const [pending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seqRef = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const mostrarLista = aberto && resultados.length > 0;

  // Foco visível na navegação por teclado: o cursor é virtual
  // (aria-activedescendant mantém o foco DOM no input), então o browser NÃO
  // rola sozinho — rolamos a opção ativa para a área visível quando `ativo` muda.
  useEffect(() => {
    document.getElementById(`${baseId}-opt-${ativo}`)?.scrollIntoView({ block: "nearest" });
  }, [ativo, baseId]);

  function fecharLista() {
    setAberto(false);
    setAtivo(0);
  }

  function buscar(q: string) {
    const seq = ++seqRef.current;
    setAnuncio("buscando…");
    startTransition(async () => {
      try {
        const encontrados = await buscarCandidatosAction(turmaId, q);
        if (seq !== seqRef.current) return; // resposta out-of-order — descarta
        setResultados(encontrados);
        setAberto(true);
        setAtivo(0);
        setAnuncio(
          encontrados.length === 0
            ? "Nenhum cidadão encontrado"
            : `${encontrados.length} resultado${encontrados.length === 1 ? "" : "s"}`,
        );
      } catch (e) {
        unstable_rethrow(e); // preserva redirect de sessão expirada
        if (seq !== seqRef.current) return;
        setResultados([]);
        fecharLista();
        setAnuncio("Busca indisponível");
      }
    });
  }

  function aoDigitar(valor: string) {
    setQuery(valor);
    setEscolhido(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = valor.trim();
    if (q.length < MIN_CHARS) {
      seqRef.current++; // invalida buscas em voo
      setResultados([]);
      fecharLista();
      return;
    }
    debounceRef.current = setTimeout(() => buscar(q), DEBOUNCE_MS);
  }

  function escolher(c: Candidato) {
    setEscolhido(c);
    setResultados([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    seqRef.current++;
    fecharLista();
    setAnuncio(`Selecionado: ${c.nome}`);
  }

  function trocar() {
    setEscolhido(null);
    setQuery("");
    setResultados([]);
    fecharLista();
    setAnuncio("");
    inputRef.current?.focus();
  }

  function aoTeclar(e: React.KeyboardEvent<HTMLInputElement>) {
    const total = resultados.length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!aberto && total > 0) {
        setAberto(true);
        setAtivo(0);
      } else if (aberto && total > 0) {
        setAtivo((a) => Math.min(a + 1, total - 1));
      }
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (aberto && total > 0) setAtivo((a) => Math.max(a - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      // Enter SELECIONA o candidato ativo — NUNCA submete o form direto (o submit
      // é deliberado, pelo botão "Matricular", e só com alguém escolhido).
      e.preventDefault();
      const alvo = mostrarLista ? resultados[ativo] : undefined;
      if (alvo) escolher(alvo);
      return;
    }
    if (e.key === "Escape") {
      if (aberto) {
        e.preventDefault();
        fecharLista(); // 1º Esc fecha o listbox
      } else if (query) {
        e.preventDefault();
        aoDigitar(""); // 2º Esc limpa a query
      }
      return;
    }
    if (e.key === "Tab") {
      fecharLista(); // segue o fluxo normal de Tab
    }
  }

  return (
    <form action={matricularAction} className={styles.form}>
      <input type="hidden" name="turmaId" value={turmaId} />

      {escolhido ? (
        <div className={styles.label}>
          <input type="hidden" name="cidadaoId" value={escolhido.id} />
          <span className={styles.labelText}>Cidadão</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <strong>{escolhido.nome}</strong>
            <button type="button" className="btn btn-sm btn-secondary" onClick={trocar}>
              trocar
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.label}>
          <label className={styles.labelText} htmlFor={inputId}>
            Cidadão
          </label>
          <div className={styles.comboWrap}>
            <input
              ref={inputRef}
              id={inputId}
              className={styles.select}
              role="combobox"
              aria-expanded={mostrarLista}
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={
                mostrarLista && resultados[ativo] ? `${baseId}-opt-${ativo}` : undefined
              }
              value={query}
              onChange={(e) => aoDigitar(e.target.value)}
              onKeyDown={aoTeclar}
              onBlur={fecharLista}
              placeholder="Buscar por nome ou CPF…"
              autoComplete="off"
            />
            {mostrarLista ? (
              <ul
                role="listbox"
                id={listboxId}
                aria-label="Resultados da busca de cidadãos"
                className={styles.comboListbox}
              >
                {resultados.map((c, i) => (
                  <li
                    key={c.id}
                    id={`${baseId}-opt-${i}`}
                    role="option"
                    aria-selected={i === ativo}
                    className={clsx(styles.comboOption, i === ativo && styles.comboOptionAtiva)}
                    onMouseDown={(e) => e.preventDefault()} // clique não rouba o foco do input
                    onClick={() => escolher(c)}
                    onMouseEnter={() => setAtivo(i)}
                  >
                    {c.nome}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          {pending ? <span className={styles.micro}>buscando…</span> : null}
          {!pending && query.trim().length >= MIN_CHARS && resultados.length === 0 ? (
            <span className={styles.micro}>Nenhum cidadão encontrado.</span>
          ) : null}
          <span role="status" aria-live="polite" className="sr-only">
            {anuncio}
          </span>
        </div>
      )}

      <SubmitButton disabled={!escolhido} pendingLabel="Matriculando…">
        Matricular
      </SubmitButton>
    </form>
  );
}
