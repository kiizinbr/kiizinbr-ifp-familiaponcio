"use client";

/**
 * Perfil da criança (console da equipe): alergias em destaque, autorizados
 * (restrição judicial em vermelho), autorizações de imagem por escopo e
 * histórico de check-in/out.
 *
 * A gestora gerencia daqui: cadastra/revoga autorizados e concede/revoga a
 * autorização de imagem por escopo (default negado — LGPD Art. 14).
 */
import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Camera,
  Lock,
  Plus,
  ShieldCheck,
  X,
} from "lucide-react";

import { Alerta, Botao, Campo, Checkbox, Input, Spinner } from "@/components/ui";
import { idade } from "@/lib/idade";
import { cn } from "@/lib/cn";
import {
  ESCOPO_IMAGEM_LABEL,
  type AutorizadoItem,
  type EscopoImagem,
  type PerfilCrianca,
  useAtualizarAutorizacaoImagem,
  useCriarAutorizado,
  usePerfilCrianca,
  useRevogarAutorizado,
} from "@/lib/use-educacional";

const ESCOPOS: EscopoImagem[] = ["USO_INTERNO", "REDES_IFP", "IMPRENSA"];

export default function PerfilCriancaPage({
  params,
}: {
  params: { membroId: string };
}) {
  const { membroId } = params;
  const { data, isLoading, error } = usePerfilCrianca(membroId);
  const [novoAberto, setNovoAberto] = useState(false);

  if (isLoading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Spinner label="Carregando perfil..." />
      </main>
    );
  }
  if (error || !data) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Alerta tipo="erro">{(error as Error)?.message ?? "Criança não encontrada"}</Alerta>
      </main>
    );
  }

  const { crianca, matricula, autorizados, autorizacoesImagem, ultimosChecks } = data;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <Link
        href={`/educacional/turmas/${matricula.turma.id}`}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {matricula.turma.nome}
      </Link>

      <h1 className="mt-2 text-xl font-bold text-foreground">{crianca.nomeCompleto}</h1>
      <p className="text-xs text-muted-foreground">
        {idade(crianca.dataNascimento)} anos · {matricula.turma.nome} · Resp.{" "}
        {crianca.ficha.nomeCompleto} ({crianca.ficha.telefone})
      </p>

      {crianca.alergias.length > 0 && (
        <div className="mt-4 rounded-lg border border-danger/60 bg-danger/10 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-bold text-danger">
            <AlertTriangle className="h-4 w-4" /> Alergias
          </p>
          <ul className="mt-1 text-sm text-foreground">
            {crianca.alergias.map((a) => (
              <li key={a.id}>
                {a.descricao} <span className="text-xs text-danger">({a.gravidade})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <ShieldCheck className="h-4 w-4" /> Autorizados a entregar/retirar
          </h2>
          {!novoAberto ? (
            <Botao
              variante="outline"
              className="px-3 py-1.5 text-xs"
              onClick={() => setNovoAberto(true)}
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </Botao>
          ) : null}
        </div>

        {novoAberto ? (
          <NovoAutorizado membroId={membroId} onFechar={() => setNovoAberto(false)} />
        ) : null}

        <ul className="mt-2 space-y-2">
          {autorizados.map((a) => (
            <AutorizadoLinha key={a.id} membroId={membroId} autorizado={a} />
          ))}
          {autorizados.length === 0 && (
            <li className="rounded-lg border border-dashed border-border px-4 py-4 text-center text-xs text-muted-foreground">
              Nenhum autorizado cadastrado.
            </li>
          )}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Camera className="h-4 w-4" /> Autorizações de imagem (default: negado)
        </h2>
        <ul className="mt-2 grid gap-2 sm:grid-cols-3">
          {ESCOPOS.map((escopo) => (
            <ToggleImagem
              key={escopo}
              membroId={membroId}
              escopo={escopo}
              registros={autorizacoesImagem}
            />
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          Termo vigente v1-2026 · cada escopo é independente e começa negado (LGPD Art. 14).
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Últimos check-ins/outs
        </h2>
        <ul className="mt-2 space-y-1">
          {ultimosChecks.map((c) => (
            <li key={c.id} className="text-xs text-muted-foreground">
              <span
                className={cn(
                  "font-semibold",
                  c.sentido === "ENTRADA" ? "text-success" : "text-info",
                )}
              >
                {c.sentido === "ENTRADA" ? "Entrada" : "Saída"}
              </span>{" "}
              · {new Date(c.ocorridoEm).toLocaleString("pt-BR")} · com {c.autorizado.nome}{" "}
              ({c.autorizado.parentesco})
            </li>
          ))}
          {ultimosChecks.length === 0 && (
            <li className="text-xs text-muted-foreground">Nenhum registro ainda.</li>
          )}
        </ul>
      </section>
    </main>
  );
}

/** Form inline para cadastrar uma pessoa autorizada a buscar a criança. */
function NovoAutorizado({
  membroId,
  onFechar,
}: {
  membroId: string;
  onFechar: () => void;
}) {
  const criar = useCriarAutorizado(membroId);
  const [form, setForm] = useState({
    nome: "",
    documento: "",
    parentesco: "",
    vigenteAte: "",
    restricaoJudicial: false,
  });
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setErro(null);
    if (
      form.nome.trim().length < 3 ||
      form.documento.trim().length < 3 ||
      form.parentesco.trim().length < 2
    ) {
      setErro("Informe nome, documento e parentesco.");
      return;
    }
    try {
      await criar.mutateAsync({
        nome: form.nome.trim(),
        documento: form.documento.trim(),
        parentesco: form.parentesco.trim(),
        vigenteAte: form.vigenteAte
          ? new Date(`${form.vigenteAte}T23:59:59`).toISOString()
          : undefined,
        restricaoJudicial: form.restricaoJudicial,
      });
      onFechar();
    } catch (e) {
      setErro((e as Error).message || "Falha ao cadastrar autorizado.");
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-primary/30 bg-surface p-4 shadow-casa-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Novo autorizado</h3>
        <button
          onClick={onFechar}
          aria-label="Fechar"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Campo label="Nome completo" htmlFor="nome" obrigatorio>
          <Input
            id="nome"
            value={form.nome}
            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            maxLength={120}
          />
        </Campo>
        <Campo label="Documento" htmlFor="doc" obrigatorio dica="RG, CPF ou CNH conferido no ato.">
          <Input
            id="doc"
            value={form.documento}
            onChange={(e) => setForm((f) => ({ ...f, documento: e.target.value }))}
            maxLength={40}
          />
        </Campo>
        <Campo label="Parentesco" htmlFor="par" obrigatorio>
          <Input
            id="par"
            value={form.parentesco}
            onChange={(e) => setForm((f) => ({ ...f, parentesco: e.target.value }))}
            placeholder="mãe, avó, van escolar…"
            maxLength={40}
          />
        </Campo>
        <Campo label="Válido até" htmlFor="vig" dica="Opcional — em branco = sem prazo.">
          <Input
            id="vig"
            type="date"
            value={form.vigenteAte}
            onChange={(e) => setForm((f) => ({ ...f, vigenteAte: e.target.value }))}
          />
        </Campo>
      </div>

      <div className="mt-3 rounded-md border border-danger/40 bg-danger/5 px-3 py-2">
        <Checkbox
          id="restricao"
          label="Restrição judicial — bloqueia a retirada (nunca liberar)"
          checked={form.restricaoJudicial}
          onChange={(e) =>
            setForm((f) => ({ ...f, restricaoJudicial: e.target.checked }))
          }
        />
      </div>

      {erro ? (
        <div className="mt-3">
          <Alerta>{erro}</Alerta>
        </div>
      ) : null}

      <div className="mt-4 flex justify-end gap-2">
        <Botao variante="ghost" onClick={onFechar}>
          Cancelar
        </Botao>
        <Botao onClick={salvar} carregando={criar.isPending}>
          <Plus className="h-4 w-4" /> Cadastrar
        </Botao>
      </div>
    </div>
  );
}

/** Linha de um autorizado, com status e ação de revogar (com confirmação). */
function AutorizadoLinha({
  membroId,
  autorizado: a,
}: {
  membroId: string;
  autorizado: AutorizadoItem;
}) {
  const revogar = useRevogarAutorizado(membroId);
  const [confirmando, setConfirmando] = useState(false);
  const bloqueado = Boolean(a.revogadoEm || a.restricaoJudicial);

  return (
    <li
      className={cn(
        "rounded-lg border px-4 py-2.5 text-sm",
        bloqueado ? "border-danger/60 bg-danger/10" : "border-border bg-surface",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-foreground">{a.nome}</p>
          <p className="text-xs capitalize text-muted-foreground">
            {a.parentesco} · doc. {a.documento}
            {a.vigenteAte
              ? ` · até ${new Date(a.vigenteAte).toLocaleDateString("pt-BR")}`
              : ""}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {a.restricaoJudicial ? (
            <span className="flex items-center gap-1 text-xs font-bold text-danger">
              <Lock className="h-3.5 w-3.5" /> RESTRIÇÃO JUDICIAL
            </span>
          ) : a.revogadoEm ? (
            <span className="text-xs font-semibold text-danger">Revogado</span>
          ) : (
            <span className="text-xs font-semibold text-success">Ativo</span>
          )}

          {!a.revogadoEm ? (
            confirmando ? (
              <span className="flex items-center gap-1">
                <Botao
                  variante="danger"
                  className="px-2 py-1 text-xs"
                  carregando={revogar.isPending}
                  onClick={() => revogar.mutate(a.id)}
                >
                  Confirmar
                </Botao>
                <Botao
                  variante="ghost"
                  className="px-2 py-1 text-xs"
                  onClick={() => setConfirmando(false)}
                >
                  Não
                </Botao>
              </span>
            ) : (
              <Botao
                variante="ghost"
                className="px-2 py-1 text-xs text-danger"
                onClick={() => setConfirmando(true)}
              >
                <Ban className="h-3.5 w-3.5" /> Revogar
              </Botao>
            )
          ) : null}
        </div>
      </div>

      {revogar.isError ? (
        <p className="mt-2 text-xs text-danger">
          {(revogar.error as Error).message}
        </p>
      ) : null}
    </li>
  );
}

/** Cartão de um escopo de imagem com botão conceder/revogar (default negado). */
function ToggleImagem({
  membroId,
  escopo,
  registros,
}: {
  membroId: string;
  escopo: EscopoImagem;
  registros: PerfilCrianca["autorizacoesImagem"];
}) {
  const atualizar = useAtualizarAutorizacaoImagem(membroId);
  const registro = registros.find((r) => r.escopo === escopo);
  const concedida = Boolean(registro?.concedido && !registro?.revogadoEm);

  return (
    <li
      className={cn(
        "flex flex-col gap-2 rounded-lg border px-3 py-2 text-xs",
        concedida
          ? "border-success/60 bg-success/10 text-foreground"
          : "border-border bg-surface text-muted-foreground",
      )}
    >
      <div>
        <p className="font-semibold">{ESCOPO_IMAGEM_LABEL[escopo]}</p>
        <p className="mt-0.5 font-bold">{concedida ? "Concedida" : "Negada"}</p>
      </div>
      <Botao
        variante={concedida ? "outline" : "primary"}
        className="px-2 py-1 text-xs"
        carregando={atualizar.isPending}
        onClick={() => atualizar.mutate({ escopo, concedido: !concedida })}
      >
        {concedida ? "Revogar" : "Conceder"}
      </Botao>
      {atualizar.isError ? (
        <p className="text-danger">{(atualizar.error as Error).message}</p>
      ) : null}
    </li>
  );
}
