"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "./button";
import type { ButtonVariant, ButtonSize } from "@/lib/ui/button";

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Texto anunciado a leitores de tela enquanto o envio está pendente. */
  pendingLabel?: string;
}

/**
 * Botão de submit que lê o estado do `<form>` pai via `useFormStatus`: enquanto
 * a server action está pendente ele desabilita (anti-duplo-clique) e mostra o
 * spinner do kit, anunciando `pendingLabel` a leitores de tela.
 *
 * DEVE ser renderizado dentro de um `<form action={...}>` — fora de um form,
 * `pending` é sempre `false`.
 */
export function SubmitButton({ children, pendingLabel = "Enviando…", disabled, ...rest }: Props) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} disabled={pending || disabled} {...rest}>
      {children}
      {pending ? <span className="sr-only">{pendingLabel}</span> : null}
    </Button>
  );
}
