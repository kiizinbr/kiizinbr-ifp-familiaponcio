"use client";

/**
 * Troca de senha — usada no primeiro acesso (senha provisória) e quando o admin
 * reseta a senha. O middleware empurra todo usuário com `mustChangePassword`
 * para cá; após trocar, `update()` limpa o flag na sessão e libera a navegação.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { KeyRound, LogOut } from "lucide-react";

import { Alerta, Botao, Campo, Input } from "@/components/ui";
import { useTrocarSenha } from "@/lib/use-admin";

export default function TrocarSenhaPage() {
  const router = useRouter();
  const { data: session, update } = useSession({ required: true });
  const trocar = useTrocarSenha();

  const [senhaAtual, setSenhaAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const primeiroAcesso = session?.mustChangePassword ?? false;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (nova.length < 8) {
      setErro("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (nova !== confirma) {
      setErro("As senhas não conferem.");
      return;
    }

    try {
      await trocar.mutateAsync({ senhaAtual, novaSenha: nova });
      await update({ mustChangePassword: false });
      router.replace("/");
    } catch (error: unknown) {
      setErro(error instanceof Error ? error.message : "Não foi possível trocar a senha.");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-lg border border-border bg-surface p-8 shadow-ifp-md"
      >
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <KeyRound className="h-5 w-5" />
          </span>
          <h1 className="text-2xl font-bold text-foreground">
            {primeiroAcesso ? "Defina sua senha" : "Trocar senha"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {primeiroAcesso
              ? "Sua senha é provisória. Crie uma senha pessoal para continuar."
              : "Escolha uma nova senha de acesso."}
          </p>
        </div>

        <div className="space-y-4">
          <Campo label={primeiroAcesso ? "Senha provisória" : "Senha atual"} htmlFor="atual" obrigatorio>
            <Input
              id="atual"
              type="password"
              autoComplete="current-password"
              value={senhaAtual}
              onChange={(e) => setSenhaAtual(e.target.value)}
              required
            />
          </Campo>
          <Campo label="Nova senha" htmlFor="nova" obrigatorio dica="Mínimo de 8 caracteres.">
            <Input
              id="nova"
              type="password"
              autoComplete="new-password"
              value={nova}
              onChange={(e) => setNova(e.target.value)}
              required
            />
          </Campo>
          <Campo label="Confirmar nova senha" htmlFor="confirma" obrigatorio>
            <Input
              id="confirma"
              type="password"
              autoComplete="new-password"
              value={confirma}
              onChange={(e) => setConfirma(e.target.value)}
              required
            />
          </Campo>

          {erro ? <Alerta tipo="erro">{erro}</Alerta> : null}

          <Botao type="submit" carregando={trocar.isPending} className="w-full">
            Salvar nova senha
          </Botao>
        </div>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" /> Sair
          </button>
        </div>
      </form>
    </main>
  );
}
