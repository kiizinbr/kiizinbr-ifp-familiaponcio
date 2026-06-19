"use client";

/**
 * Gestão de usuários (go-live de auth). O admin/gestor cria contas: o sistema
 * gera uma SENHA PROVISÓRIA mostrada aqui na tela (sem e-mail) para ser repassada
 * pessoalmente; no 1º login o usuário é obrigado a trocá-la. Também dá para
 * resetar a senha (gera nova provisória) e ativar/desativar o acesso.
 */
import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Check,
  Copy,
  KeyRound,
  Plus,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import { Alerta, Botao, Campo, Checkbox, Input, Spinner } from "@/components/ui";
import { Card, PageHeader, Pill } from "@/components/casa";
import { UNIDADES } from "@/lib/api";
import {
  useCriarUsuario,
  useDefinirAtivo,
  useResetarSenha,
  useUsuarios,
  type CriarUsuarioPayload,
  type UsuarioItem,
} from "@/lib/use-admin";

const PERFIL_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  PRESIDENCIA: "Presidência",
  SERVICO_SOCIAL: "Serviço Social",
  GESTOR_UNIDADE: "Gestor de unidade",
  PROFISSIONAL: "Profissional",
  RECEPCAO: "Recepção",
  RESPONSAVEL_FAMILIAR: "Responsável familiar",
};

const TODOS_PERFIS = Object.keys(PERFIL_LABEL);
/** O que um GESTOR_UNIDADE pode conceder (espelha a regra do backend). */
const PERFIS_GESTOR = ["PROFISSIONAL", "RECEPCAO", "RESPONSAVEL_FAMILIAR"];

function iniciais(nome: string) {
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? (p[p.length - 1]?.[0] ?? "") : "")).toUpperCase();
}

interface Credencial {
  titulo: string;
  nome: string;
  email: string;
  senha: string;
}

// ------------------------------------------------------------
// Cartão da senha provisória (aparece após criar/resetar)
// ------------------------------------------------------------
function CredencialCard({ cred, aoFechar }: { cred: Credencial; aoFechar: () => void }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(cred.senha);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <Card className="mb-6 border-success/40 bg-success/5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <KeyRound className="h-4 w-4 text-success" /> {cred.titulo}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {cred.nome} · {cred.email}
          </p>
        </div>
        <button
          onClick={aoFechar}
          aria-label="Fechar"
          className="text-muted-foreground transition hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <code className="rounded-md border border-border bg-background px-3 py-2 font-mono text-lg tracking-wider text-foreground">
          {cred.senha}
        </code>
        <Botao variante="outline" onClick={copiar}>
          {copiado ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
          {copiado ? "Copiado" : "Copiar"}
        </Botao>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Anote e repasse com segurança. Esta senha <strong>não será mostrada de novo</strong> —
        no primeiro acesso o usuário será obrigado a trocá-la.
      </p>
    </Card>
  );
}

// ------------------------------------------------------------
// Formulário de novo usuário
// ------------------------------------------------------------
function FormNovoUsuario({
  perfisDisponiveis,
  unidadesDisponiveis,
  aoCriar,
  aoFechar,
}: {
  perfisDisponiveis: string[];
  unidadesDisponiveis: { slug: string; nome: string }[];
  aoCriar: (cred: Credencial) => void;
  aoFechar: () => void;
}) {
  const criar = useCriarUsuario();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [perfis, setPerfis] = useState<string[]>([]);
  const [unidades, setUnidades] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  function alternar(lista: string[], valor: string): string[] {
    return lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!nome.trim() || !email.trim()) {
      setErro("Informe nome e e-mail.");
      return;
    }
    if (perfis.length === 0) {
      setErro("Selecione ao menos um perfil.");
      return;
    }

    const payload: CriarUsuarioPayload = {
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
      perfis,
      ...(cpf.trim() ? { cpf: cpf.replace(/\D/g, "") } : {}),
      ...(unidades.length ? { unidades } : {}),
    };

    try {
      const res = await criar.mutateAsync(payload);
      aoCriar({
        titulo: "Usuário criado — senha provisória",
        nome: res.user.nome,
        email: res.user.email,
        senha: res.senhaProvisoria,
      });
      aoFechar();
    } catch (error: unknown) {
      setErro(error instanceof Error ? error.message : "Falha ao criar usuário.");
    }
  }

  return (
    <Card className="mb-6">
      <form onSubmit={salvar} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Nome completo" htmlFor="nome" obrigatorio>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Maria da Silva"
            />
          </Campo>
          <Campo label="E-mail" htmlFor="email" obrigatorio>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="maria@ifp.org.br"
            />
          </Campo>
          <Campo label="CPF" htmlFor="cpf" dica="Opcional — só números.">
            <Input
              id="cpf"
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
              placeholder="00000000000"
              inputMode="numeric"
            />
          </Campo>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-foreground">
            Perfis <span className="text-danger">*</span>
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {perfisDisponiveis.map((p) => (
              <Checkbox
                key={p}
                id={`perfil-${p}`}
                label={PERFIL_LABEL[p] ?? p}
                checked={perfis.includes(p)}
                onChange={() => setPerfis((atual) => alternar(atual, p))}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-foreground">
            Unidades{" "}
            <span className="text-xs font-normal text-muted-foreground">
              (necessário para Profissional, Recepção e Gestor)
            </span>
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {unidadesDisponiveis.map((u) => (
              <Checkbox
                key={u.slug}
                id={`unidade-${u.slug}`}
                label={u.nome}
                checked={unidades.includes(u.slug)}
                onChange={() => setUnidades((atual) => alternar(atual, u.slug))}
              />
            ))}
          </div>
        </div>

        {erro ? <Alerta tipo="erro">{erro}</Alerta> : null}

        <div className="flex justify-end gap-2">
          <Botao type="button" variante="ghost" onClick={aoFechar} disabled={criar.isPending}>
            Cancelar
          </Botao>
          <Botao type="submit" carregando={criar.isPending}>
            <UserPlus className="h-4 w-4" /> Criar usuário
          </Botao>
        </div>
      </form>
    </Card>
  );
}

// ------------------------------------------------------------
// Linha de usuário
// ------------------------------------------------------------
function LinhaUsuario({
  u,
  souEu,
  aoCredencial,
}: {
  u: UsuarioItem;
  souEu: boolean;
  aoCredencial: (cred: Credencial) => void;
}) {
  const resetar = useResetarSenha();
  const definirAtivo = useDefinirAtivo();
  const [erro, setErro] = useState<string | null>(null);

  async function resetarSenha() {
    setErro(null);
    try {
      const res = await resetar.mutateAsync(u.id);
      aoCredencial({
        titulo: "Senha redefinida — nova senha provisória",
        nome: u.nome,
        email: u.email,
        senha: res.senhaProvisoria,
      });
    } catch (error: unknown) {
      setErro(error instanceof Error ? error.message : "Falha ao resetar senha.");
    }
  }

  async function alternarAtivo() {
    setErro(null);
    try {
      await definirAtivo.mutateAsync({ id: u.id, ativo: !u.ativo });
    } catch (error: unknown) {
      setErro(error instanceof Error ? error.message : "Falha ao atualizar acesso.");
    }
  }

  return (
    <Card className={u.ativo ? "" : "opacity-70"}>
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--unidade-suave)] font-semibold text-[var(--unidade-escuro)]">
          {iniciais(u.nome)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">{u.nome}</span>
            {souEu ? <span className="text-xs text-muted-foreground">(você)</span> : null}
          </div>
          <div className="text-sm text-muted-foreground">{u.email}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {u.perfis.map((p) => (
              <Pill key={p} tom="unidade">
                {PERFIL_LABEL[p] ?? p}
              </Pill>
            ))}
            {u.unidades.map((un) => (
              <Pill key={un.slug}>{un.nome}</Pill>
            ))}
            {!u.ativo ? <Pill tom="warn">Inativo</Pill> : null}
            {u.mustChangePassword ? <Pill tom="warn">Senha provisória</Pill> : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Botao
            variante="outline"
            onClick={resetarSenha}
            carregando={resetar.isPending}
            title="Gera nova senha provisória"
          >
            <KeyRound className="h-4 w-4" /> Resetar senha
          </Botao>
          <Botao
            variante={u.ativo ? "danger" : "primary"}
            onClick={alternarAtivo}
            carregando={definirAtivo.isPending}
            disabled={souEu && u.ativo}
            title={souEu && u.ativo ? "Você não pode desativar a si mesmo" : undefined}
          >
            {u.ativo ? "Desativar" : "Ativar"}
          </Botao>
        </div>
      </div>
      {erro ? (
        <div className="mt-3">
          <Alerta tipo="erro">{erro}</Alerta>
        </div>
      ) : null}
    </Card>
  );
}

// ------------------------------------------------------------
// Página
// ------------------------------------------------------------
export default function PaginaUsuarios() {
  const { data: session } = useSession();
  const { data, isLoading, error } = useUsuarios();
  const [criando, setCriando] = useState(false);
  const [credencial, setCredencial] = useState<Credencial | null>(null);

  const ehAdmin = session?.perfis?.includes("SUPER_ADMIN") ?? false;

  const perfisDisponiveis = ehAdmin ? TODOS_PERFIS : PERFIS_GESTOR;
  const unidadesDisponiveis = useMemo(() => {
    if (ehAdmin) return UNIDADES.map((u) => ({ slug: u.slug, nome: u.nome }));
    // Gestor: só as próprias unidades (nome bonito vem do mapa, fallback no slug).
    return (session?.unidades ?? []).map((u) => ({
      slug: u.slug,
      nome: UNIDADES.find((x) => x.slug === u.slug)?.nome ?? u.slug,
    }));
  }, [ehAdmin, session?.unidades]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <PageHeader
        titulo="Usuários"
        descricao="Crie e gerencie os acessos ao sistema."
        acoes={
          !criando ? (
            <Botao onClick={() => setCriando(true)}>
              <Plus className="h-4 w-4" /> Novo usuário
            </Botao>
          ) : null
        }
      />

      {credencial ? (
        <CredencialCard cred={credencial} aoFechar={() => setCredencial(null)} />
      ) : null}

      {criando ? (
        <FormNovoUsuario
          perfisDisponiveis={perfisDisponiveis}
          unidadesDisponiveis={unidadesDisponiveis}
          aoCriar={setCredencial}
          aoFechar={() => setCriando(false)}
        />
      ) : null}

      {isLoading ? <Spinner label="Carregando usuários..." /> : null}
      {error ? <Alerta tipo="erro">{(error as Error).message}</Alerta> : null}

      {data ? (
        <>
          <p className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" /> {data.items.length} usuário(s)
          </p>
          <div className="space-y-3">
            {data.items.map((u) => (
              <LinhaUsuario
                key={u.id}
                u={u}
                souEu={u.id === session?.user?.id}
                aoCredencial={setCredencial}
              />
            ))}
            {data.items.length === 0 ? (
              <Card className="text-center text-sm text-muted-foreground">
                <ShieldCheck className="mx-auto mb-2 h-5 w-5" />
                Nenhum usuário visível para você ainda.
              </Card>
            ) : null}
          </div>
        </>
      ) : null}
    </main>
  );
}
