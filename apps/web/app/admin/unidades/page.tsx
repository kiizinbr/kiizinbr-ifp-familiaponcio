"use client";

/**
 * CRUD de unidades (tenants) — só SUPER_ADMIN. Lista as unidades do Instituto,
 * permite editar nome/contato, ativar/desativar (soft) e criar uma unidade para
 * um TIPO ainda não cadastrado (o tipo é único: 409 se já existir).
 */
import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Building2, MapPin, Phone, Plus, Users } from "lucide-react";

import { Alerta, Botao, Campo, Input, Select, Spinner } from "@/components/ui";
import { Card, PageHeader, Pill } from "@/components/casa";
import { type TipoUnidade } from "@/lib/api";
import {
  useCriarUnidade,
  useDefinirUnidadeAtiva,
  useEditarUnidade,
  useUnidades,
  type CriarUnidadePayload,
  type EditarUnidadePayload,
  type UnidadeAdmin,
} from "@/lib/use-admin";

const TIPO_LABEL: Record<TipoUnidade, string> = {
  MEDICO: "Médico",
  CAPACITACAO: "Capacitação",
  ESPORTIVO: "Esportivo",
  EDUCACIONAL: "Educacional",
};

const TODOS_TIPOS = Object.keys(TIPO_LABEL) as TipoUnidade[];

// ------------------------------------------------------------
// Formulário de nova unidade
// ------------------------------------------------------------
function FormNovaUnidade({
  tiposDisponiveis,
  aoFechar,
}: {
  tiposDisponiveis: TipoUnidade[];
  aoFechar: () => void;
}) {
  const criar = useCriarUnidade();
  const [tipo, setTipo] = useState<TipoUnidade | "">(tiposDisponiveis[0] ?? "");
  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const [endereco, setEndereco] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!tipo) {
      setErro("Todos os tipos de unidade já estão cadastrados.");
      return;
    }
    if (!nome.trim() || !slug.trim()) {
      setErro("Informe nome e identificador (slug).");
      return;
    }
    const payload: CriarUnidadePayload = {
      tipo,
      nome: nome.trim(),
      slug: slug.trim().toLowerCase(),
      ...(endereco.trim() ? { endereco: endereco.trim() } : {}),
      ...(telefone.trim() ? { telefone: telefone.trim() } : {}),
      ...(email.trim() ? { email: email.trim() } : {}),
    };
    try {
      await criar.mutateAsync(payload);
      aoFechar();
    } catch (error: unknown) {
      setErro(error instanceof Error ? error.message : "Falha ao criar unidade.");
    }
  }

  return (
    <Card className="mb-6">
      <form onSubmit={salvar} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Tipo" htmlFor="u-tipo" obrigatorio>
            <Select id="u-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoUnidade)}>
              {tiposDisponiveis.length === 0 ? <option value="">(nenhum tipo livre)</option> : null}
              {tiposDisponiveis.map((t) => (
                <option key={t} value={t}>
                  {TIPO_LABEL[t]}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo
            label="Identificador (slug)"
            htmlFor="u-slug"
            obrigatorio
            dica="Minúsculo, sem espaços (ex.: medico)."
          >
            <Input
              id="u-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="medico"
            />
          </Campo>
          <Campo label="Nome" htmlFor="u-nome" obrigatorio className="sm:col-span-2">
            <Input
              id="u-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Centro Médico IFP"
            />
          </Campo>
          <Campo label="Endereço" htmlFor="u-end" className="sm:col-span-2">
            <Input id="u-end" value={endereco} onChange={(e) => setEndereco(e.target.value)} />
          </Campo>
          <Campo label="Telefone" htmlFor="u-tel">
            <Input id="u-tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          </Campo>
          <Campo label="E-mail" htmlFor="u-email">
            <Input id="u-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Campo>
        </div>

        {erro ? <Alerta tipo="erro">{erro}</Alerta> : null}

        <div className="flex justify-end gap-2">
          <Botao type="button" variante="ghost" onClick={aoFechar} disabled={criar.isPending}>
            Cancelar
          </Botao>
          <Botao type="submit" carregando={criar.isPending} disabled={tiposDisponiveis.length === 0}>
            <Plus className="h-4 w-4" /> Criar unidade
          </Botao>
        </div>
      </form>
    </Card>
  );
}

// ------------------------------------------------------------
// Edição inline + ações por unidade
// ------------------------------------------------------------
function LinhaUnidade({ u }: { u: UnidadeAdmin }) {
  const editar = useEditarUnidade();
  const definirAtiva = useDefinirUnidadeAtiva();
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(u.nome);
  const [endereco, setEndereco] = useState(u.endereco ?? "");
  const [telefone, setTelefone] = useState(u.telefone ?? "");
  const [email, setEmail] = useState(u.email ?? "");
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const payload: EditarUnidadePayload = {
      nome: nome.trim(),
      endereco: endereco.trim(),
      telefone: telefone.trim(),
      email: email.trim(),
    };
    try {
      await editar.mutateAsync({ id: u.id, payload });
      setEditando(false);
    } catch (error: unknown) {
      setErro(error instanceof Error ? error.message : "Falha ao salvar.");
    }
  }

  async function alternarAtiva() {
    setErro(null);
    try {
      await definirAtiva.mutateAsync({ id: u.id, ativo: !u.ativo });
    } catch (error: unknown) {
      setErro(error instanceof Error ? error.message : "Falha ao atualizar.");
    }
  }

  return (
    <Card className={u.ativo ? "" : "opacity-70"}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <span className="font-semibold text-foreground">{u.nome}</span>
            <Pill tom="unidade">{TIPO_LABEL[u.tipo]}</Pill>
            <Pill>{u.slug}</Pill>
            {!u.ativo ? <Pill tom="warn">Inativa</Pill> : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
            {u.endereco ? (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> {u.endereco}
              </span>
            ) : null}
            {u.telefone ? (
              <span className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> {u.telefone}
              </span>
            ) : null}
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> {u._count.usuarios} usuário(s)
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Botao variante="outline" onClick={() => setEditando((v) => !v)}>
            {editando ? "Fechar" : "Editar"}
          </Botao>
          <Botao
            variante={u.ativo ? "danger" : "primary"}
            onClick={alternarAtiva}
            carregando={definirAtiva.isPending}
          >
            {u.ativo ? "Desativar" : "Ativar"}
          </Botao>
        </div>
      </div>

      {editando ? (
        <form onSubmit={salvar} className="mt-4 grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
          <Campo label="Nome" htmlFor={`e-nome-${u.id}`} className="sm:col-span-2">
            <Input id={`e-nome-${u.id}`} value={nome} onChange={(e) => setNome(e.target.value)} />
          </Campo>
          <Campo label="Endereço" htmlFor={`e-end-${u.id}`} className="sm:col-span-2">
            <Input id={`e-end-${u.id}`} value={endereco} onChange={(e) => setEndereco(e.target.value)} />
          </Campo>
          <Campo label="Telefone" htmlFor={`e-tel-${u.id}`}>
            <Input id={`e-tel-${u.id}`} value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          </Campo>
          <Campo label="E-mail" htmlFor={`e-email-${u.id}`}>
            <Input
              id={`e-email-${u.id}`}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Campo>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Botao type="submit" carregando={editar.isPending}>
              Salvar
            </Botao>
          </div>
        </form>
      ) : null}

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
export default function PaginaUnidades() {
  const { data: session } = useSession();
  const ehAdmin = session?.perfis?.includes("SUPER_ADMIN") ?? false;
  const { data, isLoading, error } = useUnidades();
  const [criando, setCriando] = useState(false);

  // Tipos ainda não cadastrados (o tipo é único no schema).
  const tiposLivres = useMemo(() => {
    const usados = new Set((data?.items ?? []).map((u) => u.tipo));
    return TODOS_TIPOS.filter((t) => !usados.has(t));
  }, [data?.items]);

  if (!ehAdmin) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Alerta tipo="erro">A gestão de unidades é exclusiva do Super Admin.</Alerta>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <PageHeader
        titulo="Unidades"
        descricao="Os centros do Instituto. Edite contato, ative/desative e cadastre novos tipos."
        acoes={
          !criando ? (
            <Botao onClick={() => setCriando(true)} disabled={tiposLivres.length === 0}>
              <Plus className="h-4 w-4" /> Nova unidade
            </Botao>
          ) : null
        }
      />

      {criando ? (
        <FormNovaUnidade tiposDisponiveis={tiposLivres} aoFechar={() => setCriando(false)} />
      ) : null}

      {isLoading ? <Spinner label="Carregando unidades..." /> : null}
      {error ? <Alerta tipo="erro">{(error as Error).message}</Alerta> : null}

      {data ? (
        <div className="space-y-3">
          {data.items.map((u) => (
            <LinhaUnidade key={u.id} u={u} />
          ))}
        </div>
      ) : null}
    </main>
  );
}
