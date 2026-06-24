"use client";

/**
 * Perfil da criança (console da equipe): alergias em destaque, autorizados
 * (restrição judicial em vermelho), autorizações de imagem por escopo e
 * histórico de check-in/out.
 *
 * Gestora/admin também gerencia daqui (antes era só via Swagger):
 * cadastra autorizado, revoga (efeito imediato, registro preservado) e
 * concede/revoga autorização de imagem por escopo (default negado).
 */
import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  Lock,
  Plus,
  ShieldCheck,
} from "lucide-react";

import { Alerta, Botao, Campo, Checkbox, Input, Spinner } from "@/components/ui";
import { SinalizarSocial } from "@/components/casa";
import { idade } from "@/lib/idade";
import { cn } from "@/lib/cn";
import {
  ESCOPO_IMAGEM_LABEL,
  useAtualizarAutorizacaoImagem,
  useCriarAutorizado,
  usePerfilCrianca,
  useRevogarAutorizado,
  type EscopoImagem,
} from "@/lib/use-educacional";

const PERFIS_GESTAO = ["SUPER_ADMIN", "GESTOR_UNIDADE"];
const ESCOPOS: EscopoImagem[] = ["USO_INTERNO", "REDES_IFP", "IMPRENSA"];

interface FormAutorizado {
  nome: string;
  documento: string;
  parentesco: string;
  vigenteAte: string;
  restricaoJudicial: boolean;
}

function FormNovoAutorizado({
  membroId,
  aoFechar,
}: {
  membroId: string;
  aoFechar: () => void;
}) {
  const criar = useCriarAutorizado();
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormAutorizado>({
    defaultValues: {
      nome: "",
      documento: "",
      parentesco: "",
      vigenteAte: "",
      restricaoJudicial: false,
    },
    mode: "onTouched",
  });

  async function salvar(v: FormAutorizado) {
    setErroEnvio(null);
    try {
      await criar.mutateAsync({
        membroId,
        nome: v.nome.trim(),
        documento: v.documento.trim(),
        parentesco: v.parentesco.trim(),
        restricaoJudicial: v.restricaoJudicial,
        ...(v.vigenteAte ? { vigenteAte: v.vigenteAte } : {}),
      });
      aoFechar();
    } catch (error: unknown) {
      setErroEnvio(error instanceof Error ? error.message : "Falha ao cadastrar autorizado");
    }
  }

  return (
    <form
      onSubmit={handleSubmit(salvar)}
      className="mt-3 space-y-4 rounded-lg border border-border bg-surface p-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Nome completo" htmlFor="nome" obrigatorio erro={errors.nome?.message}>
          <Input
            id="nome"
            placeholder="Quem entrega/retira a criança"
            {...register("nome", {
              required: "Informe o nome",
              minLength: { value: 3, message: "Mínimo de 3 caracteres" },
            })}
          />
        </Campo>
        <Campo
          label="Documento"
          htmlFor="documento"
          obrigatorio
          dica="RG/CPF/CNH conferido no ato."
          erro={errors.documento?.message}
        >
          <Input
            id="documento"
            placeholder="Documento conferido"
            {...register("documento", {
              required: "Informe o documento",
              minLength: { value: 3, message: "Mínimo de 3 caracteres" },
            })}
          />
        </Campo>
        <Campo
          label="Parentesco"
          htmlFor="parentesco"
          obrigatorio
          erro={errors.parentesco?.message}
        >
          <Input
            id="parentesco"
            placeholder="mãe, avó, tio, van escolar..."
            {...register("parentesco", {
              required: "Informe o parentesco",
              minLength: { value: 2, message: "Mínimo de 2 caracteres" },
            })}
          />
        </Campo>
        <Campo
          label="Vigência até"
          htmlFor="vigenteAte"
          dica="Em branco = sem prazo (ex.: autorização pontual de um passeio)."
        >
          <Input id="vigenteAte" type="date" {...register("vigenteAte")} />
        </Campo>
      </div>

      <div className="rounded-md border border-danger/40 bg-danger/5 px-3 py-2">
        <Checkbox
          id="restricaoJudicial"
          label="Possui restrição judicial — o sistema BLOQUEIA a retirada por esta pessoa"
          {...register("restricaoJudicial")}
        />
      </div>

      {erroEnvio ? <Alerta tipo="erro">{erroEnvio}</Alerta> : null}

      <div className="flex justify-end gap-2">
        <Botao type="button" variante="ghost" onClick={aoFechar} disabled={criar.isPending}>
          Cancelar
        </Botao>
        <Botao type="submit" carregando={criar.isPending}>
          Cadastrar
        </Botao>
      </div>
    </form>
  );
}

export default function PerfilCriancaPage({
  params,
}: {
  params: { membroId: string };
}) {
  const { membroId } = params;
  const { data: session } = useSession();
  const { data, isLoading, error } = usePerfilCrianca(membroId);
  const revogar = useRevogarAutorizado();
  const atualizarImagem = useAtualizarAutorizacaoImagem();

  const [cadastrando, setCadastrando] = useState(false);
  const [revogandoId, setRevogandoId] = useState<string | null>(null);
  const [escopoPendente, setEscopoPendente] = useState<EscopoImagem | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const ehGestor = session?.perfis?.some((p) => PERFIS_GESTAO.includes(p)) ?? false;

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

  async function confirmarRevogacao(id: string) {
    setErroAcao(null);
    try {
      await revogar.mutateAsync({ id, membroId });
      setRevogandoId(null);
    } catch (e: unknown) {
      setErroAcao(e instanceof Error ? e.message : "Falha ao revogar autorização");
    }
  }

  async function alternarImagem(escopo: EscopoImagem, concedido: boolean) {
    setErroAcao(null);
    setEscopoPendente(escopo);
    try {
      await atualizarImagem.mutateAsync({ membroId, escopo, concedido });
    } catch (e: unknown) {
      setErroAcao(e instanceof Error ? e.message : "Falha ao atualizar autorização de imagem");
    } finally {
      setEscopoPendente(null);
    }
  }

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

      {/* Ponte cross-vertical: educador sinaliza a família desta criança ao Social. */}
      <SinalizarSocial fichaId={crianca.ficha.id} membroId={crianca.id} className="mt-4" />

      {erroAcao ? (
        <div className="mt-4">
          <Alerta tipo="erro">{erroAcao}</Alerta>
        </div>
      ) : null}

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <ShieldCheck className="h-4 w-4" /> Autorizados a entregar/retirar
          </h2>
          {ehGestor && !cadastrando ? (
            <button
              type="button"
              onClick={() => setCadastrando(true)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              <Plus className="h-3.5 w-3.5" /> Cadastrar
            </button>
          ) : null}
        </div>

        {cadastrando ? (
          <FormNovoAutorizado membroId={membroId} aoFechar={() => setCadastrando(false)} />
        ) : null}

        <ul className="mt-2 space-y-2">
          {autorizados.map((a) => {
            const bloqueado = Boolean(a.revogadoEm || a.restricaoJudicial);
            const emConfirmacao = revogandoId === a.id;
            return (
              <li
                key={a.id}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-2.5 text-sm",
                  bloqueado
                    ? "border-danger/60 bg-danger/10"
                    : "border-border bg-surface",
                )}
              >
                <div>
                  <p className="font-semibold text-foreground">{a.nome}</p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {a.parentesco} · doc. {a.documento}
                    {a.vigenteAte
                      ? ` · vigente até ${new Date(a.vigenteAte).toLocaleDateString("pt-BR")}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {a.restricaoJudicial ? (
                    <span className="flex items-center gap-1 text-xs font-bold text-danger">
                      <Lock className="h-3.5 w-3.5" /> RESTRIÇÃO JUDICIAL
                    </span>
                  ) : a.revogadoEm ? (
                    <span className="text-xs font-semibold text-danger">Revogado</span>
                  ) : (
                    <span className="text-xs font-semibold text-success">Ativo</span>
                  )}
                  {ehGestor && !a.revogadoEm ? (
                    emConfirmacao ? (
                      <span className="flex items-center gap-2">
                        <Botao
                          variante="danger"
                          className="px-2.5 py-1 text-xs"
                          carregando={revogar.isPending}
                          onClick={() => confirmarRevogacao(a.id)}
                        >
                          Confirmar revogação
                        </Botao>
                        <Botao
                          variante="ghost"
                          className="px-2.5 py-1 text-xs"
                          disabled={revogar.isPending}
                          onClick={() => setRevogandoId(null)}
                        >
                          Cancelar
                        </Botao>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setRevogandoId(a.id)}
                        className="text-xs font-semibold text-danger hover:underline"
                      >
                        Revogar
                      </button>
                    )
                  ) : null}
                </div>
              </li>
            );
          })}
          {autorizados.length === 0 && (
            <li className="rounded-lg border border-dashed border-border px-4 py-4 text-center text-xs text-muted-foreground">
              Nenhum autorizado cadastrado — só responsáveis com cadastro podem
              entregar/retirar.
            </li>
          )}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Camera className="h-4 w-4" /> Autorizações de imagem (default: negado)
        </h2>
        <ul className="mt-2 grid gap-2 sm:grid-cols-3">
          {ESCOPOS.map((escopo) => {
            const atual = autorizacoesImagem.find((a) => a.escopo === escopo);
            const concedida = Boolean(atual?.concedido && !atual.revogadoEm);
            return (
              <li
                key={escopo}
                className={cn(
                  "rounded-lg border px-3 py-2 text-xs",
                  concedida
                    ? "border-success/60 bg-success/10 text-foreground"
                    : "border-border bg-surface text-muted-foreground",
                )}
              >
                <p className="font-semibold">{ESCOPO_IMAGEM_LABEL[escopo]}</p>
                <p className="mt-0.5 font-bold">{concedida ? "Concedida" : "Negada"}</p>
                {ehGestor ? (
                  <button
                    type="button"
                    disabled={escopoPendente === escopo}
                    onClick={() => alternarImagem(escopo, !concedida)}
                    className={cn(
                      "mt-1.5 text-xs font-semibold hover:underline disabled:opacity-60",
                      concedida ? "text-danger" : "text-primary",
                    )}
                  >
                    {concedida ? "Revogar" : "Conceder (termo assinado)"}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
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
