"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import clsx from "clsx";
import type { Cid10Item, DiagnosticoChip } from "@/lib/medico/cid10";
import { buscarCid10Action } from "./cid10-actions";
import styles from "./prontuario.module.css";

/**
 * Cap de diagnósticos por nota — espelha MAX_DIAGNOSTICOS / DiagnosticosSchema
 * de src/lib/medico/cid10.ts (constante local pra não puxar zod pro client).
 */
const MAX_DIAGNOSTICOS = 10;
const DEBOUNCE_MS = 250;
const MIN_CHARS = 2;

type Opcao =
  | { tipo: "cid"; codigo: string; descricao: string }
  | { tipo: "livre"; descricao: string };

function rotuloChip(d: DiagnosticoChip): string {
  return d.codigoCid ? `${d.codigoCid} ${d.descricao}` : d.descricao;
}

/**
 * Combobox de diagnóstico CID-10 (busca server-side na tabela Cid10) com chips
 * de N diagnósticos e exatamente 1 principal. O estado vai pro form como hidden
 * `diagnosticosJson` (SEMPRE presente — [] limpa a lista no salvar). Enter
 * dentro do input NUNCA submete o formEvolucao; busca vazia/indisponível abre o
 * escape hatch de texto livre (CID continua opcional, nunca bloqueia).
 */
export function Cid10Combobox({ defaultDiagnosticos }: { defaultDiagnosticos: DiagnosticoChip[] }) {
  const baseId = useId();
  const inputId = `${baseId}-cid-input`;
  const listboxId = `${baseId}-cid-listbox`;

  const [itens, setItens] = useState<DiagnosticoChip[]>(defaultDiagnosticos);
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<Cid10Item[]>([]);
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const [erroBusca, setErroBusca] = useState(false);
  const [anuncio, setAnuncio] = useState("");
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seqRef = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const cheio = itens.length >= MAX_DIAGNOSTICOS;
  const termo = query.trim();

  // Opções do listbox: resultados + escape hatch de texto livre quando a busca
  // volta vazia ou está indisponível.
  const opcoes: Opcao[] = resultados.map((r) => ({
    tipo: "cid" as const,
    codigo: r.codigo,
    descricao: r.descricao,
  }));
  if (termo.length >= MIN_CHARS && (erroBusca || resultados.length === 0)) {
    opcoes.push({ tipo: "livre", descricao: termo });
  }
  const mostrarLista = aberto && opcoes.length > 0;

  function fecharLista() {
    setAberto(false);
    setAtivo(0);
  }

  function buscar(q: string) {
    const seq = ++seqRef.current;
    setAnuncio("buscando…");
    startTransition(async () => {
      try {
        const encontrados = await buscarCid10Action(q);
        if (seq !== seqRef.current) return; // resposta out-of-order — descarta
        setErroBusca(false);
        setResultados(encontrados);
        setAberto(true);
        setAtivo(0);
        setAnuncio(
          encontrados.length === 0
            ? "Nenhum resultado"
            : `${encontrados.length} resultado${encontrados.length === 1 ? "" : "s"}`,
        );
      } catch (e) {
        unstable_rethrow(e); // preserva redirect de sessão expirada
        if (seq !== seqRef.current) return;
        setErroBusca(true);
        setResultados([]);
        setAberto(true);
        setAtivo(0);
        setAnuncio("Busca indisponível — adicione como texto livre");
      }
    });
  }

  function aoDigitar(valor: string) {
    setQuery(valor);
    setErroBusca(false);
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

  function limparBusca() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    seqRef.current++;
    setQuery("");
    setResultados([]);
    setErroBusca(false);
    fecharLista();
    inputRef.current?.focus(); // mantém o foco — fluxo de digitação contínua
  }

  function adicionar(chip: DiagnosticoChip) {
    setItens([...itens, chip]);
    setAnuncio(`Adicionado: ${rotuloChip(chip)}`);
    limparBusca();
  }

  function selecionar(opcao: Opcao) {
    if (opcao.tipo === "cid") {
      if (itens.some((i) => i.codigoCid === opcao.codigo)) {
        setAnuncio(`${opcao.codigo} já adicionado`);
        limparBusca();
        return;
      }
      adicionar({
        codigoCid: opcao.codigo,
        descricao: opcao.descricao,
        principal: itens.length === 0,
      });
      return;
    }
    const chave = opcao.descricao.toLowerCase();
    if (itens.some((i) => i.codigoCid === null && i.descricao.toLowerCase() === chave)) {
      setAnuncio(`${opcao.descricao} já adicionado`);
      limparBusca();
      return;
    }
    adicionar({ codigoCid: null, descricao: opcao.descricao, principal: itens.length === 0 });
  }

  function remover(idx: number) {
    const alvo = itens[idx];
    if (!alvo) return;
    let restantes = itens.filter((_, i) => i !== idx);
    // Remover o principal promove o primeiro restante.
    if (alvo.principal && restantes.length > 0) {
      restantes = restantes.map((d, i) => ({ ...d, principal: i === 0 }));
    }
    setItens(restantes);
    setAnuncio(`Removido: ${rotuloChip(alvo)}`);
  }

  function tornarPrincipal(idx: number) {
    const alvo = itens[idx];
    if (!alvo) return;
    setItens(itens.map((d, i) => ({ ...d, principal: i === idx })));
    setAnuncio(`Diagnóstico principal: ${rotuloChip(alvo)}`);
  }

  function aoTeclar(e: React.KeyboardEvent<HTMLInputElement>) {
    const total = opcoes.length;
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
    if (e.key === "Home" && mostrarLista) {
      e.preventDefault();
      setAtivo(0);
      return;
    }
    if (e.key === "End" && mostrarLista) {
      e.preventDefault();
      setAtivo(total - 1);
      return;
    }
    if (e.key === "Enter") {
      // SEMPRE preventDefault: Enter neste input JAMAIS submete o formEvolucao.
      e.preventDefault();
      const escolha = mostrarLista ? opcoes[ativo] : undefined;
      if (escolha) selecionar(escolha);
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
    <>
      {itens.length > 0 ? (
        <div className={styles.cidrow}>
          {itens.map((d, i) => (
            <span
              key={`${d.codigoCid ?? "livre"}:${d.descricao}`}
              className={clsx(styles.cid, d.principal && styles.cidPrincipal)}
            >
              {d.codigoCid ? <span className={styles.cidCode}>{d.codigoCid}</span> : null}
              <span>{d.descricao}</span>
              {!d.principal ? (
                <button
                  type="button"
                  className={styles.cidChipBtn}
                  aria-label={`Tornar ${rotuloChip(d)} o diagnóstico principal`}
                  title="Tornar principal"
                  onClick={() => tornarPrincipal(i)}
                >
                  ☆
                </button>
              ) : null}
              <button
                type="button"
                className={styles.cidChipBtn}
                aria-label={`Remover diagnóstico ${rotuloChip(d)}`}
                title="Remover"
                onClick={() => remover(i)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <div className={styles.cidCombo}>
        <label className="sr-only" htmlFor={inputId}>
          Adicionar diagnóstico CID-10
        </label>
        <input
          ref={inputRef}
          id={inputId}
          className={clsx(styles.cidInput, styles.cidComboInput)}
          role="combobox"
          aria-expanded={mostrarLista}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            mostrarLista && opcoes[ativo] ? `${baseId}-opt-${ativo}` : undefined
          }
          placeholder={
            cheio ? "Limite de diagnósticos atingido" : "Buscar CID — código ou descrição"
          }
          autoComplete="off"
          disabled={cheio}
          value={query}
          onChange={(e) => aoDigitar(e.target.value)}
          onKeyDown={aoTeclar}
          onBlur={fecharLista}
        />
        {mostrarLista ? (
          <ul
            role="listbox"
            id={listboxId}
            aria-label="Resultados da busca CID-10"
            className={styles.cidListbox}
          >
            {opcoes.map((op, i) => (
              <li
                key={op.tipo === "cid" ? op.codigo : "livre"}
                id={`${baseId}-opt-${i}`}
                role="option"
                aria-selected={i === ativo}
                className={clsx(
                  styles.cidOption,
                  i === ativo && styles.cidOptionAtiva,
                  op.tipo === "livre" && styles.cidAddLivre,
                )}
                onMouseDown={(e) => e.preventDefault()} // clique não rouba o foco do input
                onClick={() => selecionar(op)}
                onMouseEnter={() => setAtivo(i)}
              >
                {op.tipo === "cid" ? (
                  <>
                    <span className={styles.cidOptionCode}>{op.codigo}</span>
                    <span>{op.descricao}</span>
                  </>
                ) : (
                  <span>
                    {erroBusca
                      ? `Busca indisponível — adicionar sem código: “${op.descricao}”`
                      : `Adicionar sem código: “${op.descricao}”`}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : null}
        <span role="status" aria-live="polite" className="sr-only">
          {anuncio}
        </span>
        <input type="hidden" name="diagnosticosJson" value={JSON.stringify(itens)} />
      </div>
      {cheio ? (
        <span className={styles.micro}>máximo de {MAX_DIAGNOSTICOS} diagnósticos</span>
      ) : null}
    </>
  );
}
