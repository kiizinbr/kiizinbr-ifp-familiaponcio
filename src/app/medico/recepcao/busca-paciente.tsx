"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { Route } from "next";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { SubmitButton } from "@/components/ui/submit-button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCpf } from "@/lib/cpf";
import { buscarPacientesAction, type PacienteEncontrado } from "./buscar-action";

/** Espelha o esqueleto de debounce do cid10-combobox (constantes locais). */
const DEBOUNCE_MS = 300;
const MIN_CHARS = 2;

interface Props {
  /** `q` inicial vindo do server (deep-link/refresh) — também é o defaultValue. */
  qInicial: string;
  /** Resultados server-side da 1ª carga (no-JS / ?q=) — semente até o island assumir. */
  iniciais: PacienteEncontrado[];
}

/**
 * #16 — Busca incremental de paciente: resultados aparecem enquanto digita
 * (debounce ~300ms), com foco automático no campo (paridade com a marcação,
 * consultas/nova). O `<form method="get">` + botão "Buscar" continuam montados
 * como FALLBACK garantido (no-JS / Enter); este island monta por cima e assume a
 * interação ao vivo. Modelado 1:1 no cid10-combobox: seqRef descarta respostas
 * out-of-order, debounceRef limpa no unmount, useTransition não trava a digitação.
 *
 * A QUERY e o RBAC vivem em buscarPacientesAction (read-only, 3 guards server-side).
 * Erro da action NUNCA derruba a tela: cai num aviso inline curto (mesmo estilo
 * --danger do ENC_ERROS) e o botão "Buscar" segue como caminho garantido.
 */
export function BuscaPaciente({ qInicial, iniciais }: Props) {
  const [query, setQuery] = useState(qInicial);
  const [resultados, setResultados] = useState<PacienteEncontrado[]>(iniciais);
  // Só consideramos "buscou" quando o termo é longo o bastante; abaixo disso a
  // lista é limpa e nem o EmptyState aparece (espelha o guard do cid10).
  const [buscou, setBuscou] = useState(qInicial.trim().length >= MIN_CHARS);
  const [erro, setErro] = useState(false);
  const [anuncio, setAnuncio] = useState("");
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seqRef = useRef(0);

  // Foco automático no campo via `autoFocus` no JSX (paridade com consultas/nova).
  // NÃO duplicar com um focus() programático num effect de mount: o focus() pode
  // forçar scroll-into-view inesperado quando a tela já rolou.

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function buscar(q: string) {
    const seq = ++seqRef.current;
    setAnuncio("Buscando…");
    startTransition(async () => {
      try {
        const encontrados = await buscarPacientesAction(q);
        if (seq !== seqRef.current) return; // resposta out-of-order — descarta
        setErro(false);
        setResultados(encontrados);
        setBuscou(true);
        setAnuncio(
          encontrados.length === 0
            ? "Nenhum paciente encontrado"
            : `${encontrados.length} paciente(s) encontrado(s)`,
        );
      } catch (e) {
        unstable_rethrow(e); // preserva redirect de sessão expirada
        if (seq !== seqRef.current) return;
        setErro(true);
        setResultados([]);
        setBuscou(true);
        setAnuncio("Busca indisponível — use o botão Buscar");
      }
    });
  }

  function aoDigitar(valor: string) {
    setQuery(valor);
    setErro(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = valor.trim();
    if (q.length < MIN_CHARS) {
      seqRef.current++; // invalida buscas em voo
      setResultados([]);
      setBuscou(false);
      setAnuncio("");
      return;
    }
    debounceRef.current = setTimeout(() => buscar(q), DEBOUNCE_MS);
  }

  return (
    <>
      {/* FALLBACK no-JS: o form GET + botão "Buscar" seguem no DOM. Com JS, o
          input controlado dispara a busca incremental; Enter submete o form
          (comportamento atual, reserva). */}
      <form method="get" style={{ display: "flex", gap: 8 }}>
        <input
          name="q"
          value={query}
          onChange={(e) => aoDigitar(e.target.value)}
          autoFocus
          autoComplete="off"
          aria-label="Buscar paciente"
          placeholder="Buscar paciente por nome, CPF ou telefone"
          className="input"
          style={{ flex: 1 }}
        />
        <SubmitButton variant="secondary" pendingLabel="Buscando…">
          Buscar
        </SubmitButton>
      </form>

      {/* Live region (espelha cid10-combobox): anuncia "Buscando…" e a contagem
          de resultados / indisponibilidade ao leitor de tela. Enquanto a busca
          incremental está em voo, isPending mantém o "Buscando…" coerente. */}
      <span role="status" aria-live="polite" className="sr-only">
        {isPending ? "Buscando…" : anuncio}
      </span>

      {erro ? (
        <div
          role="alert"
          style={{
            marginTop: 10,
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid var(--danger)",
            color: "var(--danger)",
            fontSize: 13,
          }}
        >
          Busca indisponível — use o botão Buscar.
        </div>
      ) : null}

      {!erro && buscou && resultados.length === 0 ? (
        <EmptyState
          titulo="Ninguém encontrado"
          descricao="Nenhum paciente bate com essa busca. Confira o nome, o CPF ou o telefone — ou cadastre um novo."
          cta={
            <Link href={"/app/cidadaos/novo" as Route} className="btn btn-secondary">
              Cadastrar paciente
            </Link>
          }
        />
      ) : null}

      {resultados.length > 0 ? (
        <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
          {resultados.map((c) => (
            <Link
              key={c.id}
              href={`/medico/consultas/nova?cidadaoId=${c.id}` as Route}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid var(--line)",
                textDecoration: "none",
              }}
            >
              <span style={{ color: "var(--text)", fontWeight: 600 }}>{c.nomeCompleto}</span>
              <span className="mono" style={{ color: "var(--text-3)", fontSize: 12 }}>
                {formatCpf(c.cpf)} · {c.telefonePrincipal}
              </span>
            </Link>
          ))}
        </div>
      ) : null}
    </>
  );
}
