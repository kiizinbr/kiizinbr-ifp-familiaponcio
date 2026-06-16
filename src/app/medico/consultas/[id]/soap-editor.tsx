"use client";

import { useEffect, useId, useRef, useState } from "react";
import clsx from "clsx";
import {
  parseSoap,
  serializeSoap,
  SOAP_LABELS,
  SOAP_ORDEM,
  type SecoesSoap,
} from "@/lib/medico/soap";
import styles from "./prontuario.module.css";

/**
 * SoapEditor (#18) — island 100% client-side que substitui VISUALMENTE o
 * `<textarea name="texto">` da evolução, sem mudar o contrato do form.
 *
 * FONTE ÚNICA DE VERDADE: existe UM textarea oculto `name="texto"` (marcado com
 * `data-soap-fonte`) — é a ÚNICA coisa submetida no FormData. As caixas SOAP (4)
 * e a caixa de texto-livre (1) são AUXILIARES (sem `name`, portanto não vão pro
 * FormData) e a cada keystroke re-serializam → gravam no oculto → disparam
 * Event('input', {bubbles:true}) (mesmo truque do CopiarUltima) p/ o autosave e o
 * guard de "alterações não salvas" enxergarem como digitação. Logo
 * salvarRascunhoCore/salvarRascunho seguem recebendo exatamente 1 `texto` e NUNCA
 * inspecionam o conteúdo — assinatura/imutabilidade/autosave intactos byte-a-byte.
 *
 * MODO INICIAL: parseSoap(defaultValue). Nota legada (sem marcador) abre em
 * "Texto livre" com o conteúdo intacto; nota já estruturada abre em SOAP. O
 * médico alterna pelo toggle quando quiser.
 *
 * IMPORTANTE p/ os guards: o `defaultValue` do oculto é o `texto` original da
 * nota (o baseline). Os guards comparam o oculto (data-soap-fonte) contra seu
 * defaultValue — as caixas auxiliares são IGNORADAS por elas (sem `name` e
 * marcadas com data-soap-aux).
 */

type Modo = "soap" | "livre";

type Props = {
  /** `notaEvolucao.texto` atual (ou "" se nota nova). Vira o defaultValue do oculto. */
  defaultValue: string;
};

export function SoapEditor({ defaultValue }: Props) {
  const inicial = parseSoap(defaultValue);
  const [modo, setModo] = useState<Modo>(inicial.modo);
  // Estado controlado das caixas auxiliares. No modo livre, `livre` espelha o
  // texto bruto; no modo soap, as 4 seções.
  const [secoes, setSecoes] = useState<SecoesSoap>({
    s: inicial.s,
    o: inicial.o,
    a: inicial.a,
    p: inicial.p,
  });
  const [livre, setLivre] = useState<string>(
    inicial.modo === "livre" ? inicial.livre : serializeSoap(inicial),
  );
  const hiddenRef = useRef<HTMLTextAreaElement>(null);
  // True enquanto ESTE island está escrevendo no oculto — distingue o input que
  // nós disparamos (commit) do input vindo de FORA (CopiarUltima/modelos, que
  // escrevem em textarea[name="texto"] e disparam input). Sem isso, re-sincronizar
  // a partir do nosso próprio commit causaria laço.
  const escrevendoRef = useRef(false);
  const toggleId = useId();

  /** Grava `valor` no oculto e dispara input (autosave + guard reconhecem). */
  function commit(valor: string) {
    const ta = hiddenRef.current;
    if (!ta) return;
    escrevendoRef.current = true;
    ta.value = valor;
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    escrevendoRef.current = false;
  }

  // Re-hidrata as caixas quando algo EXTERNO escreve no oculto (CopiarUltima /
  // "Copiar da última" / modelos). Esses islands escrevem em
  // textarea[name="texto"] (= nosso oculto) e disparam input; aqui re-parseamos
  // o novo `texto` p/ as caixas visíveis refletirem, sem reescrever o oculto (não
  // re-commitamos: o input externo já notificou autosave/guard).
  useEffect(() => {
    const ta = hiddenRef.current;
    if (!ta) return;
    function aoInputExterno() {
      if (escrevendoRef.current) return; // foi o nosso commit — ignora
      const novo = ta?.value ?? "";
      const p = parseSoap(novo);
      setSecoes({ s: p.s, o: p.o, a: p.a, p: p.p });
      if (p.modo === "soap") {
        setModo("soap");
        setLivre(novo);
      } else {
        // Conteúdo externo SEM marcador (modo "livre"): se há texto (nota legada
        // copiada da última / modelo sem cabeçalho), as 4 caixas SOAP ficariam
        // VAZIAS enquanto o oculto tem o texto — e a 1ª digitação numa caixa
        // re-serializaria das seções vazias e DESCARTARIA o copiado. Por isso
        // alinhamos o modo VISÍVEL ao conteúdo: caímos em "livre" espelhando o
        // oculto na caixa de texto livre (o que o médico vê = o que está no
        // oculto; digitar depois preserva o copiado). Não re-commitamos: o input
        // externo já notificou autosave/guard. Conteúdo vazio mantém o modo atual.
        setLivre(p.livre);
        if (p.livre !== "") setModo("livre");
      }
    }
    ta.addEventListener("input", aoInputExterno);
    return () => ta.removeEventListener("input", aoInputExterno);
  }, []);

  function onSecaoChange(chave: keyof SecoesSoap, valor: string) {
    const proximas = { ...secoes, [chave]: valor };
    setSecoes(proximas);
    commit(serializeSoap(proximas));
  }

  function onLivreChange(valor: string) {
    setLivre(valor);
    commit(valor);
  }

  function alternarModo(novo: Modo) {
    if (novo === modo) return;
    if (novo === "soap") {
      // Texto livre → SOAP: re-parseia o que está na caixa livre, distribuindo
      // pelas seções (marcadores reconhecidos) ou jogando tudo no Subjetivo
      // (preâmbulo). O `texto` submetido é re-serializado canônico.
      const p = parseSoap(livre);
      const proximas: SecoesSoap = { s: p.s, o: p.o, a: p.a, p: p.p };
      // Sem nenhum marcador, parseSoap devolve livre puro → joga no Subjetivo p/
      // o conteúdo não sumir ao trocar de aba.
      if (p.modo === "livre") proximas.s = p.livre;
      setSecoes(proximas);
      setModo("soap");
      commit(serializeSoap(proximas));
    } else {
      // SOAP → Texto livre: a caixa livre recebe a serialização atual (legível
      // crua: "## Subjetivo …"). O `texto` submetido não muda (já é isso).
      const serial = serializeSoap(secoes);
      setLivre(serial);
      setModo("livre");
      commit(serial);
    }
  }

  return (
    <div className={styles.soap}>
      {/* Oculto: ÚNICA entrada submetida. defaultValue = baseline p/ os guards. */}
      <textarea
        ref={hiddenRef}
        name="texto"
        data-soap-fonte=""
        defaultValue={defaultValue}
        hidden
        readOnly
        aria-hidden="true"
        tabIndex={-1}
      />

      <div className={styles.soapToggle} role="group" aria-label="Formato da nota" id={toggleId}>
        <button
          type="button"
          data-soap-aux=""
          className={clsx(styles.soapToggleBtn, modo === "soap" && styles.soapToggleOn)}
          aria-pressed={modo === "soap"}
          onClick={() => alternarModo("soap")}
        >
          SOAP
        </button>
        <button
          type="button"
          data-soap-aux=""
          className={clsx(styles.soapToggleBtn, modo === "livre" && styles.soapToggleOn)}
          aria-pressed={modo === "livre"}
          onClick={() => alternarModo("livre")}
        >
          Texto livre
        </button>
      </div>

      {modo === "soap" ? (
        <div className={styles.soapGrid}>
          {SOAP_ORDEM.map((chave) => (
            <label key={chave} className={styles.soapField}>
              <span className={styles.soapLabel}>{SOAP_LABELS[chave]}</span>
              <textarea
                data-soap-aux=""
                className={clsx(styles.note, styles.soapBox)}
                aria-label={SOAP_LABELS[chave]}
                value={secoes[chave]}
                onChange={(e) => onSecaoChange(chave, e.target.value)}
                placeholder={PLACEHOLDER[chave]}
              />
            </label>
          ))}
        </div>
      ) : (
        <textarea
          data-soap-aux=""
          className={styles.note}
          aria-label="Texto da evolução"
          value={livre}
          onChange={(e) => onLivreChange(e.target.value)}
          placeholder="Anamnese, exame físico, conduta…"
        />
      )}
    </div>
  );
}

const PLACEHOLDER: Record<keyof SecoesSoap, string> = {
  s: "Queixa, história, relato do paciente…",
  o: "Exame físico, sinais, achados objetivos…",
  a: "Hipótese diagnóstica, avaliação…",
  p: "Conduta, prescrição, orientações, retorno…",
};
