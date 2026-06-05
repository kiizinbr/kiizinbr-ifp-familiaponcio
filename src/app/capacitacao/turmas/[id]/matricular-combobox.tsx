"use client";

import { useState, useTransition } from "react";
import { matricularAction, buscarCandidatosAction } from "../../actions";
import styles from "../../capacitacao.module.css";

type Candidato = { id: string; nome: string };

/**
 * Form de matrícula com busca INCREMENTAL server-side (combobox). Substitui o
 * <select> estático de 300 — inviável com 1064+ alunas. Só envia ao escolher alguém.
 */
export function MatricularCombobox({ turmaId }: { turmaId: string }) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<Candidato[]>([]);
  const [escolhido, setEscolhido] = useState<Candidato | null>(null);
  const [pending, startTransition] = useTransition();

  function buscar(q: string) {
    setQuery(q);
    setEscolhido(null);
    if (q.trim().length < 2) {
      setResultados([]);
      return;
    }
    startTransition(async () => {
      setResultados(await buscarCandidatosAction(turmaId, q));
    });
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
            <button
              type="button"
              className={`${styles.btn} ${styles.btnSm} ${styles.btnGhost}`}
              onClick={() => {
                setEscolhido(null);
                setQuery("");
              }}
            >
              trocar
            </button>
          </div>
        </div>
      ) : (
        <label className={styles.label}>
          <span className={styles.labelText}>Cidadão</span>
          <input
            className={styles.select}
            value={query}
            onChange={(e) => buscar(e.target.value)}
            placeholder="Buscar por nome ou CPF…"
            autoComplete="off"
            aria-label="Buscar cidadão por nome ou CPF"
          />
          {pending ? <span className={styles.micro}>buscando…</span> : null}
          {resultados.length > 0 ? (
            <ul
              style={{
                listStyle: "none",
                margin: "4px 0 0",
                padding: 0,
                border: "1px solid var(--line)",
                borderRadius: 8,
                maxHeight: 220,
                overflow: "auto",
              }}
            >
              {resultados.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setEscolhido(c);
                      setResultados([]);
                    }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 10px",
                      background: "none",
                      border: 0,
                      cursor: "pointer",
                      color: "var(--text)",
                    }}
                  >
                    {c.nome}
                  </button>
                </li>
              ))}
            </ul>
          ) : query.trim().length >= 2 && !pending ? (
            <span className={styles.micro}>Nenhum cidadão encontrado.</span>
          ) : null}
        </label>
      )}

      <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={!escolhido}>
        Matricular
      </button>
    </form>
  );
}
