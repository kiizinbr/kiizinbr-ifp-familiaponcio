"use client";

/**
 * "Minha conta" — dados do usuário logado (lidos de /auth/me) e atalho para
 * trocar a senha. Acessível pelo avatar do ShellInterno (qualquer perfil).
 */
import Link from "next/link";
import { Building2, KeyRound, Mail, ShieldCheck, User } from "lucide-react";

import { Alerta, Botao, Spinner } from "@/components/ui";
import { Card, PageHeader, Pill, SecTitle } from "@/components/casa";
import { formatCpf, formatDataHora } from "@/lib/format";
import { useMinhaConta } from "@/lib/use-conta";

/** Rótulos legíveis para os perfis (o enum do banco é em caixa-alta). */
const PERFIL_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Administrador",
  PRESIDENCIA: "Presidência",
  SERVICO_SOCIAL: "Serviço Social",
  GESTOR_UNIDADE: "Gestor de Unidade",
  PROFISSIONAL: "Profissional",
  RECEPCAO: "Recepção",
  RESPONSAVEL_FAMILIAR: "Responsável Familiar",
};

function rotuloPerfil(perfil: string) {
  return PERFIL_LABEL[perfil] ?? perfil;
}

/** Linha rótulo + valor, com ícone opcional. */
function Linha({
  icone,
  rotulo,
  valor,
}: {
  icone?: React.ReactNode;
  rotulo: string;
  valor: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-border py-3 last:border-0">
      {icone ? <span className="mt-0.5 text-primary [&>svg]:h-4 [&>svg]:w-4">{icone}</span> : null}
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {rotulo}
        </div>
        <div className="mt-0.5 break-words text-sm text-foreground">{valor}</div>
      </div>
    </div>
  );
}

export default function MinhaContaPage() {
  const { data: conta, isLoading, isError, error } = useMinhaConta();

  if (isLoading) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <Spinner label="Carregando sua conta…" />
      </main>
    );
  }

  if (isError || !conta) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <Alerta tipo="erro">
          {error instanceof Error ? error.message : "Não foi possível carregar sua conta."}
        </Alerta>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader
        titulo="Minha conta"
        descricao="Seus dados de acesso ao IFP Connect."
        acoes={
          <Link href="/trocar-senha">
            <Botao variante="outline">
              <KeyRound className="h-4 w-4" /> Trocar senha
            </Botao>
          </Link>
        }
      />

      <Card className="mb-6">
        <SecTitle icon={<User />}>Dados pessoais</SecTitle>
        <Linha icone={<User />} rotulo="Nome" valor={conta.nome} />
        <Linha icone={<Mail />} rotulo="E-mail" valor={conta.email} />
        <Linha rotulo="CPF" valor={formatCpf(conta.cpf)} />
        <Linha rotulo="Último acesso" valor={formatDataHora(conta.ultimoLogin)} />
        <Linha rotulo="Conta criada em" valor={formatDataHora(conta.criadoEm)} />
      </Card>

      <Card className="mb-6">
        <SecTitle icon={<ShieldCheck />}>Perfis de acesso</SecTitle>
        {conta.perfis.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum perfil atribuído.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {conta.perfis.map((p) => (
              <Pill key={p} tom="unidade">
                {rotuloPerfil(p)}
              </Pill>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <SecTitle icon={<Building2 />}>Unidades</SecTitle>
        {conta.unidades.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Você não está vinculado a nenhuma unidade específica.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {conta.unidades.map((u) => (
              <Pill key={u.id} tom="neutro">
                {u.nome}
              </Pill>
            ))}
          </div>
        )}
      </Card>
    </main>
  );
}
