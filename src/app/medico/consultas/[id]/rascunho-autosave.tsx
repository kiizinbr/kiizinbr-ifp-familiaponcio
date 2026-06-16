"use client";

import { useEffect, useRef, useState } from "react";
import { unstable_rethrow } from "next/navigation";
import clsx from "clsx";
import { autosalvarRascunhoAction } from "./prontuario-actions";
import styles from "./prontuario.module.css";

/**
 * Autosave do rascunho da nota — island 100% client-side montado DENTRO do
 * #formEvolucao (só no ramo `podeEditar`). Debounce ~2s após parar de digitar,
 * chama `autosalvarRascunhoAction` (mesmo `salvarRascunhoCore`: auth/RBAC/IDOR
 * server-side) e RETORNA o resultado SEM redirect — atualiza o indicador
 * "Rascunho salvo às HH:MM" e zera o estado sujo.
 *
 * NÃO toca a transação sagrada: salvar rascunho é equivalente a digitar; a nota
 * imutável só nasce na assinatura. A detecção de "sujo" é clonada do AssinarButton
 * (textarea/inputs != defaultValue, diagnosticosJson != snapshot) — o guard de
 * alterações-não-salvas do AssinarButton continua válido (o sujo some ~2s depois
 * que o autosave confirma).
 *
 * Coerência com o caminho manual: o autosave NÃO redireciona nem revalida
 * navegação; o ack "Rascunho salvo às HH:MM" (?salvo=) do botão manual segue
 * intacto. Os dois indicadores convivem (banner do RSC + indicador vivo do island).
 */

const DEBOUNCE_MS = 2000;

type Estado =
  | { fase: "ocioso" }
  | { fase: "salvando" }
  | { fase: "salvo"; em: Date }
  | { fase: "sujo" }
  | { fase: "erro"; erro: "diagnosticos" | "cid_indisponivel" | "nota_assinada" | "generico" };

const ERRO_MSG: Record<string, string> = {
  diagnosticos: "Não foi possível salvar os diagnósticos — alterações não salvas.",
  cid_indisponivel: "Validação de CID indisponível — alterações não salvas.",
  nota_assinada: "Nota já assinada em outra aba — alterações não salvas.",
  generico: "Erro ao salvar — alterações não salvas.",
};

function snapshotDiag(evo: HTMLFormElement): string | null {
  const hidden = evo.querySelector<HTMLInputElement>('input[name="diagnosticosJson"]');
  return hidden?.value ?? null;
}

export function RascunhoAutosave() {
  const [estado, setEstado] = useState<Estado>({ fase: "ocioso" });
  // Snapshot inicial do diagnosticosJson (hidden controlado, sem defaultValue) —
  // mesma estratégia do AssinarButton para comparar a sujeira do CID.
  const diagInicialRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // seqRef anti out-of-order (padrão do Cid10Combobox): descarta respostas de
  // autosaves antigos que cheguem depois de um mais novo.
  const seqRef = useRef(0);
  // Espelha o estado sujo de forma síncrona para o beforeunload (que não pode
  // depender do React re-renderizar antes do unload disparar).
  const sujoRef = useRef(false);

  useEffect(() => {
    const evo = document.getElementById("formEvolucao") as HTMLFormElement | null;
    diagInicialRef.current = evo ? snapshotDiag(evo) : null;
  }, []);

  /** #formEvolucao tem alterações não salvas? (clonado do AssinarButton.) */
  function temAlteracoesNaoSalvas(evo: HTMLFormElement): boolean {
    const textarea = evo.querySelector<HTMLTextAreaElement>("textarea");
    if (textarea && textarea.value !== textarea.defaultValue) return true;
    const inputs = evo.querySelectorAll<HTMLInputElement>('input[type="text"], input:not([type])');
    for (const input of inputs) {
      if (input.name === "diagnosticosJson") continue;
      if (input.name === "consultaId") continue;
      if (input.name === "voltar") continue;
      if (input.value !== input.defaultValue) return true;
    }
    const hidden = snapshotDiag(evo);
    if (diagInicialRef.current != null && hidden !== diagInicialRef.current) return true;
    return false;
  }

  async function salvar() {
    const evo = document.getElementById("formEvolucao") as HTMLFormElement | null;
    if (!evo) return;
    if (!temAlteracoesNaoSalvas(evo)) {
      // Já está no estado salvo (ex.: digitou e desfez dentro da janela do
      // debounce, ou um click sem mudança real). Não salva (anti-loop) e tira o
      // indicador de "sujo" pra ele não mentir.
      sujoRef.current = false;
      setEstado((e) => (e.fase === "sujo" ? { fase: "ocioso" } : e));
      return;
    }

    const seq = ++seqRef.current;
    setEstado({ fase: "salvando" });
    try {
      // Snapshot do que está sendo enviado: ao confirmar, o "sujo" é avaliado
      // contra ESTE conteúdo, não contra um defaultValue que o RSC ainda não
      // repovoou (o island não recarrega a página).
      const enviado = new FormData(evo);
      const resultado = await autosalvarRascunhoAction(enviado);
      if (seq !== seqRef.current) return; // resposta out-of-order — descarta

      if (!resultado.ok) {
        // nota_assinada (outra aba) / diagnosticos / cid_indisponivel: mantém as
        // alterações não salvas, NÃO redireciona e NÃO entra em loop de retry.
        sujoRef.current = true;
        setEstado({ fase: "erro", erro: resultado.erro });
        return;
      }
      // Sucesso: o conteúdo enviado vira o novo "baseline" do CID e o sujo zera.
      const cidEnviado = String(enviado.get("diagnosticosJson") ?? "") || null;
      diagInicialRef.current = cidEnviado;
      // Publica o baseline do CID no próprio form pro AssinarButton ler — o hidden
      // diagnosticosJson é controlado (sem defaultValue), então o AssinarButton
      // compararia contra o snapshot de MOUNT dele, que o autosave não atualiza.
      // Gravar o que FOI persistido aqui elimina o falso "Alterações não salvas"
      // ao assinar logo após um autosave de CID (o indicador "salvo às HH:MM" já
      // confirmou). cidEnviado===null → "" (CID limpo é estado salvo, não ausência).
      evo.dataset.cidBaseline = cidEnviado ?? "";
      // Re-baseia textarea/inputs para o valor enviado, espelhando o que o save
      // persistiu — assim a próxima checagem de sujeira parte do estado salvo
      // (o RSC não recarregou). Equivalente ao defaultValue após um save manual.
      const textarea = evo.querySelector<HTMLTextAreaElement>("textarea");
      if (textarea) textarea.defaultValue = textarea.value;
      const inputs = evo.querySelectorAll<HTMLInputElement>(
        'input[type="text"], input:not([type])',
      );
      for (const input of inputs) {
        if (input.name === "diagnosticosJson") continue;
        if (input.name === "consultaId") continue;
        if (input.name === "voltar") continue;
        input.defaultValue = input.value;
      }
      sujoRef.current = false;
      setEstado({ fase: "salvo", em: new Date(resultado.salvoEm) });
    } catch (e) {
      unstable_rethrow(e); // preserva redirect de sessão expirada (RBAC lança no core)
      if (seq !== seqRef.current) return;
      sujoRef.current = true;
      // Erro genérico de transporte/inesperado (a falha real de CID vira
      // `cid_indisponivel` via `resultado.erro` acima) — não fingir um problema
      // de CID específico que pode enganar o médico.
      setEstado({ fase: "erro", erro: "generico" });
    }
  }

  // Escuta input/change/click no #formEvolucao e agenda o autosave debounced.
  // - input/change: digitação no textarea, vitais e na busca do combobox CID.
  // - click: o Cid10Combobox COMMITA chips por clique de botão (add/remover/
  //   principal) e NÃO dispara evento nativo ao atualizar o hidden controlado;
  //   o click bubbla até o form e (re)arma o debounce. `salvar()` é a autoridade
  //   final — relê o DOM no disparo (2s depois, já com o hidden atualizado) e
  //   PULA se não houver sujeira, então o click extra nunca salva à toa.
  useEffect(() => {
    const evo = document.getElementById("formEvolucao") as HTMLFormElement | null;
    if (!evo) return;

    function agendar() {
      const form = document.getElementById("formEvolucao") as HTMLFormElement | null;
      if (!form) return;
      // Sempre (re)arma o debounce; a decisão real de salvar/pular fica em
      // salvar() no disparo, com o DOM já estabilizado (evita falso "limpo" no
      // commit de chip CID, cujo hidden o React ainda não atualizou no click).
      sujoRef.current = temAlteracoesNaoSalvas(form);
      if (sujoRef.current) setEstado({ fase: "sujo" });
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void salvar();
      }, DEBOUNCE_MS);
    }

    evo.addEventListener("input", agendar);
    evo.addEventListener("change", agendar);
    evo.addEventListener("click", agendar);
    return () => {
      evo.removeEventListener("input", agendar);
      evo.removeEventListener("change", agendar);
      evo.removeEventListener("click", agendar);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Aviso ao sair com alterações não salvas — conservador, SÓ quando sujo.
  useEffect(() => {
    function aoSair(e: BeforeUnloadEvent) {
      if (!sujoRef.current) return;
      e.preventDefault();
      e.returnValue = ""; // browsers exibem o prompt padrão de "sair sem salvar"
    }
    window.addEventListener("beforeunload", aoSair);
    return () => window.removeEventListener("beforeunload", aoSair);
  }, []);

  const indicador = (() => {
    switch (estado.fase) {
      case "salvando":
        return { classe: styles.autosaveSalvando, texto: "Salvando…" };
      case "salvo":
        return {
          classe: styles.autosaveSalvo,
          texto: `Rascunho salvo às ${estado.em.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })}`,
        };
      case "sujo":
        return { classe: styles.autosaveSujo, texto: "Alterações não salvas…" };
      case "erro":
        return {
          classe: styles.autosaveErro,
          texto: ERRO_MSG[estado.erro] ?? "Alterações não salvas.",
        };
      default:
        return { classe: undefined, texto: "" };
    }
  })();

  return (
    <span
      className={clsx(styles.autosave, indicador.classe)}
      role="status"
      aria-live="polite"
      data-fase={estado.fase}
    >
      {indicador.texto}
    </span>
  );
}
