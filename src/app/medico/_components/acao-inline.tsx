"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { unstable_rethrow } from "next/navigation";

/**
 * #10 — Envelopa uma ação de fila (Chegou/Confirmar/Iniciar/Chamar/etc.) para que
 * um erro da action caia COLADO ao próprio cartão/linha (aviso vermelho inline,
 * idêntico ao da fila de encaminhamentos) em vez de derrubar a subárvore /medico
 * inteira no `error.tsx`.
 *
 * As server actions NÃO mudam: continuam lançando server-side (RBAC, contratos,
 * anti-overbooking intactos). Só trocamos QUEM captura o throw — aqui, no cliente,
 * inline — em vez de deixá-lo subir até o boundary de tela cheia.
 *
 * NUANCE CRÍTICA: `redirect()` do Next (checkin/chamar/transition+irParaProntuario)
 * funciona LANÇANDO um erro de controle de fluxo. `unstable_rethrow` re-lança esse
 * erro interno (e `notFound`/`forbidden`) para o framework tratar, e é no-op para
 * erros reais — preservando o ack `?checkin`/`?chamado` e o atalho #12.
 *
 * Os filhos seguem sendo o(s) SubmitButton(s) do form (anti-duplo-clique via
 * `useFormStatus`). `error.tsx` fica reservado só para falha de CARREGAMENTO da
 * página (auth/db no corpo do Server Component).
 */

type Props = {
  /** Server action do form (recebe o FormData). Inalterada — continua lançando. */
  action: (formData: FormData) => void | Promise<void>;
  /** Campos ocultos enviados junto da action (ex.: `{ id, para }`). */
  hiddenFields?: Record<string, string>;
  /** Conteúdo do form — tipicamente o SubmitButton (e markup irmão, ex.: "Rechamar"). */
  children: ReactNode;
  /** Estilo do `<form>` (mantém o layout inline/flex da linha de origem). */
  formStyle?: React.CSSProperties;
};

/**
 * Mensagens amigáveis por `error.name` / trecho de `message`. Sem inventar cor —
 * o aviso usa só o token semântico `--danger` (idêntico ao bloco ENC_ERROS).
 */
function mensagemAmigavel(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  const msg = error instanceof Error ? error.message : "";

  if (name === "TransicaoInvalidaError") {
    return "Esse atendimento mudou de status em outra tela. Atualize a fila.";
  }
  if (name === "SlotIndisponivelError") {
    return "Esse horário acabou de ser reservado. Tente de novo.";
  }
  if (/sem permiss/i.test(msg)) {
    return "Você não tem permissão para esta ação.";
  }
  if (/sem sess/i.test(msg)) {
    return "Sua sessão expirou. Entre de novo.";
  }
  return "Não foi possível concluir. Tente de novo.";
}

export function AcaoInline({ action, hiddenFields, children, formStyle }: Props) {
  const [erro, setErro] = useState<string | null>(null);

  return (
    <>
      <form
        style={formStyle}
        action={async (formData) => {
          setErro(null);
          try {
            await action(formData);
          } catch (e) {
            // redirect()/notFound()/forbidden() do Next são controle de fluxo:
            // re-lança pro framework (senão o ack ?checkin/?chamado e o atalho #12
            // param de funcionar). Para erros reais, é no-op e seguimos pro inline.
            unstable_rethrow(e);
            setErro(mensagemAmigavel(e));
          }
        }}
      >
        {hiddenFields
          ? Object.entries(hiddenFields).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))
          : null}
        {children}
      </form>
      {erro ? (
        <div
          role="alert"
          style={{
            marginTop: 8,
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid var(--danger)",
            color: "var(--danger)",
            fontSize: 13,
          }}
        >
          {erro}
        </div>
      ) : null}
    </>
  );
}
