"use client";

/**
 * Painel de Configuração da plataforma (A6) — só SUPER_ADMIN.
 * LÊ a config (unidades, perfis, parâmetros) e permite ajustar parâmetros
 * simples. Cada alteração persiste e gera auditoria (LGPD) no backend.
 * Reusa o CRUD de unidades (link para /admin/unidades) — aqui é só leitura.
 */
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Building2, Settings, ShieldCheck, Users } from "lucide-react";

import { Alerta, Botao, Campo, Checkbox, Input, Spinner } from "@/components/ui";
import { Card, Kpi, PageHeader, Pill, SecTitle } from "@/components/casa";
import { type TipoUnidade } from "@/lib/api";
import {
  useAtualizarParametro,
  useConfigPlataforma,
  type ParametroConfig,
  type ValorParametro,
} from "@/lib/use-admin";

const TIPO_LABEL: Record<TipoUnidade, string> = {
  MEDICO: "Médico",
  CAPACITACAO: "Capacitação",
  ESPORTIVO: "Esportivo",
  EDUCACIONAL: "Educacional",
};

// ------------------------------------------------------------
// Editor de um parâmetro (controle por tipo: boolean/number/string)
// ------------------------------------------------------------
function LinhaParametro({ p }: { p: ParametroConfig }) {
  const atualizar = useAtualizarParametro();
  const [valor, setValor] = useState<ValorParametro>(p.valor);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  // ReSincroniza o estado local se o servidor mandar um valor novo (refetch).
  useEffect(() => {
    setValor(p.valor);
  }, [p.valor]);

  const mudou = valor !== p.valor;

  async function salvar() {
    setErro(null);
    setSalvo(false);
    try {
      await atualizar.mutateAsync({ chave: p.chave, valor });
      setSalvo(true);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar.");
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground">{p.rotulo}</span>
            {p.personalizado ? <Pill tom="unidade">Personalizado</Pill> : <Pill>Padrão</Pill>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{p.descricao}</p>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">{p.chave}</p>
        </div>

        <div className="flex w-full max-w-xs flex-col gap-3 sm:w-auto">
          {p.tipo === "boolean" ? (
            <Checkbox
              id={`cfg-${p.chave}`}
              label="Ativado"
              checked={Boolean(valor)}
              onChange={(e) => setValor(e.target.checked)}
            />
          ) : p.tipo === "number" ? (
            <Campo label="Valor" htmlFor={`cfg-${p.chave}`}>
              <Input
                id={`cfg-${p.chave}`}
                type="number"
                value={String(valor)}
                min={p.min}
                max={p.max}
                onChange={(e) => setValor(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </Campo>
          ) : (
            <Campo label="Valor" htmlFor={`cfg-${p.chave}`}>
              <Input
                id={`cfg-${p.chave}`}
                value={String(valor)}
                maxLength={p.maxLength}
                onChange={(e) => setValor(e.target.value)}
              />
            </Campo>
          )}

          <Botao onClick={salvar} carregando={atualizar.isPending} disabled={!mudou}>
            Salvar
          </Botao>
        </div>
      </div>

      {erro ? (
        <div className="mt-3">
          <Alerta tipo="erro">{erro}</Alerta>
        </div>
      ) : null}
      {salvo && !mudou ? (
        <div className="mt-3">
          <Alerta tipo="info">Parâmetro salvo e registrado na auditoria.</Alerta>
        </div>
      ) : null}
    </Card>
  );
}

// ------------------------------------------------------------
// Página
// ------------------------------------------------------------
export default function PaginaConfig() {
  const { data: session } = useSession();
  const ehAdmin = session?.perfis?.includes("SUPER_ADMIN") ?? false;
  const { data, isLoading, error } = useConfigPlataforma();

  if (!ehAdmin) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Alerta tipo="erro">O painel de configuração é exclusivo do Super Admin.</Alerta>
      </main>
    );
  }

  const ativas = data?.unidades.filter((u) => u.ativo).length ?? 0;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <PageHeader
        titulo="Configuração"
        descricao="Parâmetros e estrutura da plataforma. Cada ajuste é registrado na auditoria."
      />

      {isLoading ? <Spinner label="Carregando configuração..." /> : null}
      {error ? <Alerta tipo="erro">{(error as Error).message}</Alerta> : null}

      {data ? (
        <div className="space-y-8">
          {/* Visão geral */}
          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi label="Unidades ativas" valor={`${ativas}/${data.unidades.length}`} />
            <Kpi label="Perfis de acesso" valor={data.perfis.length} />
            <Kpi label="Parâmetros" valor={data.parametros.length} />
          </div>

          {/* Unidades (leitura — CRUD fica em /admin/unidades) */}
          <section>
            <SecTitle icon={<Building2 />}>Unidades da plataforma</SecTitle>
            <div className="space-y-2">
              {data.unidades.map((u) => (
                <Card key={u.id} className={u.ativo ? "" : "opacity-70"}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground">{u.nome}</span>
                      <Pill tom="unidade">{TIPO_LABEL[u.tipo]}</Pill>
                      <Pill>{u.slug}</Pill>
                      {!u.ativo ? <Pill tom="warn">Inativa</Pill> : null}
                    </div>
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Users className="h-3.5 w-3.5" /> {u.usuarios} usuário(s)
                    </span>
                  </div>
                </Card>
              ))}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Para criar/editar/desativar unidades, use a tela{" "}
              <a href="/admin/unidades" className="font-medium text-primary underline">
                Unidades
              </a>
              .
            </p>
          </section>

          {/* Perfis de acesso (somente leitura — referência do RBAC) */}
          <section>
            <SecTitle icon={<ShieldCheck />}>Perfis de acesso</SecTitle>
            <div className="flex flex-wrap gap-2">
              {data.perfis.map((perfil) => (
                <Pill key={perfil}>{perfil}</Pill>
              ))}
            </div>
          </section>

          {/* Parâmetros ajustáveis */}
          <section>
            <SecTitle icon={<Settings />}>Parâmetros</SecTitle>
            <div className="space-y-3">
              {data.parametros.map((p) => (
                <LinhaParametro key={p.chave} p={p} />
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
