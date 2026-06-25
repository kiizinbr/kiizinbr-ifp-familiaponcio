/**
 * Verificação PÚBLICA de documento médico — ENTRADA MANUAL do código.
 * Quem não tem o QR (recebeu o documento impresso/escaneado) digita aqui o
 * código de verificação e cai na mesma tela de resultado de
 * /verificar-documento/[codigo]. Sem login.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { HelpCircle, Search, ShieldCheck } from "lucide-react";

import { Botao, Campo, Input } from "@/components/ui";

export default function VerificarDocumentoEntradaPage() {
  const router = useRouter();
  const [codigo, setCodigo] = useState("");

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const limpo = codigo.trim();
    if (!limpo) return;
    // Reusa a tela de resultado já existente (server component público).
    router.push(`/verificar-documento/${encodeURIComponent(limpo)}`);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-12">
      <p className="text-xs uppercase tracking-widest text-primary">IFP Connect</p>
      <h1 className="mt-1 text-lg font-bold text-foreground">
        Verificação de documento médico
      </h1>

      <div className="mt-6 w-full rounded-lg border border-border bg-surface p-6 shadow-casa-sm">
        <ShieldCheck className="mx-auto h-12 w-12 text-primary" />
        <p className="mt-3 text-center text-sm text-muted-foreground">
          Digite o <strong>código de verificação</strong> impresso no atestado, receita
          ou declaração para confirmar a autenticidade junto ao Instituto Família Poncio.
        </p>

        <form onSubmit={enviar} className="mt-5 space-y-4">
          <Campo
            label="Código do documento"
            htmlFor="codigo"
            dica="Você encontra o código abaixo do QR, no rodapé do documento."
          >
            <Input
              id="codigo"
              name="codigo"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="Ex.: ABCD-1234-EFGH"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
            />
          </Campo>

          <Botao type="submit" className="w-full" disabled={!codigo.trim()}>
            <Search className="h-4 w-4" /> Verificar documento
          </Botao>
        </form>
      </div>

      <Link
        href="/como-ser-atendido"
        className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
      >
        <HelpCircle className="h-4 w-4" /> Como ser atendido no IFP?
      </Link>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Dúvidas? Entre em contato com o Instituto Família Poncio — Duque de Caxias/RJ.
      </p>
    </main>
  );
}
