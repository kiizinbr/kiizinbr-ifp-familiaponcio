"use client";

/**
 * Tela do dia da turma — mobile/tablet do educador (padrão Brightwheel):
 * check-in/out com seleção do autorizado COM FOTO (revogado/restrição =
 * card vermelho bloqueado) + lançamentos de rotina em 5–10s (tags de 1 toque)
 * + fechamento do diário.
 */
import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronRight,
  Layers,
  LogIn,
  LogOut,
  Lock,
  NotebookPen,
  X,
} from "lucide-react";

import { Alerta, Botao, Input, Spinner } from "@/components/ui";
import { idade } from "@/lib/idade";
import { cn } from "@/lib/cn";
import {
  TAGS_ROTINA,
  TIPO_ROTINA_LABEL,
  useAutorizados,
  useCheckin,
  useCheckout,
  useDiarioDoDia,
  useFecharDiario,
  useRegistrarRotina,
  useRegistrarRotinaLote,
  useTurmaInfantil,
  type AutorizadoItem,
  type EstadoDia,
  type MatriculaTurmaDia,
  type SentidoCheck,
  type TipoRegistroRotina,
} from "@/lib/use-educacional";

const estadoEstilo: Record<EstadoDia, string> = {
  SEM_CHECKIN: "border-border text-muted-foreground",
  PRESENTE: "border-success/60 bg-success/10 text-success",
  SAIU: "border-info/50 text-info",
};

const estadoLabel: Record<EstadoDia, string> = {
  SEM_CHECKIN: "Sem check-in",
  PRESENTE: "Presente",
  SAIU: "Saiu",
};

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[partes.length - 1]?.[0] ?? "")).toUpperCase();
}

/** Card de autorizado no modal — bloqueado fica vermelho e não clicável. */
function CardAutorizado({
  autorizado,
  selecionado,
  onSelect,
}: {
  autorizado: AutorizadoItem;
  selecionado: boolean;
  onSelect: () => void;
}) {
  const vencido =
    autorizado.vigenteAte !== null && new Date(autorizado.vigenteAte) < new Date();
  const bloqueado = Boolean(
    autorizado.revogadoEm || autorizado.restricaoJudicial || vencido,
  );
  const motivo = autorizado.restricaoJudicial
    ? "RESTRIÇÃO JUDICIAL — não liberar"
    : autorizado.revogadoEm
      ? "Autorização revogada"
      : vencido
        ? "Autorização vencida"
        : null;

  return (
    <button
      type="button"
      disabled={bloqueado}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition",
        bloqueado
          ? "cursor-not-allowed border-danger/60 bg-danger/10 opacity-90"
          : selecionado
            ? "border-primary bg-primary/10"
            : "border-border bg-surface hover:border-primary/50",
      )}
    >
      {autorizado.fotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={autorizado.fotoUrl}
          alt=""
          className="h-12 w-12 rounded-full object-cover"
        />
      ) : (
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
          {iniciais(autorizado.nome)}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">
          {autorizado.nome}
        </p>
        <p className="text-xs capitalize text-muted-foreground">{autorizado.parentesco}</p>
        {motivo && (
          <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-danger">
            <AlertTriangle className="h-3 w-3" /> {motivo}
          </p>
        )}
      </div>
      {selecionado && !bloqueado && <Check className="h-5 w-5 shrink-0 text-primary" />}
      {bloqueado && <Lock className="h-5 w-5 shrink-0 text-danger" />}
    </button>
  );
}

/** Modal de check-in/out: escolhe QUEM entregou/retirou (segurança física). */
function ModalCheck({
  matricula,
  sentido,
  onFechar,
}: {
  matricula: MatriculaTurmaDia;
  sentido: SentidoCheck;
  onFechar: () => void;
}) {
  const { data, isLoading } = useAutorizados(matricula.membroId);
  const checkin = useCheckin();
  const checkout = useCheckout();
  const [autorizadoId, setAutorizadoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const mutation = sentido === "ENTRADA" ? checkin : checkout;

  async function confirmar() {
    if (!autorizadoId) {
      setErro("Selecione quem está " + (sentido === "ENTRADA" ? "entregando" : "retirando") + ".");
      return;
    }
    setErro(null);
    try {
      await mutation.mutateAsync({ membroId: matricula.membroId, autorizadoId });
      onFechar();
    } catch (e) {
      setErro((e as Error).message || "Falha ao registrar.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-background p-5 sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">
            {sentido === "ENTRADA" ? "Check-in" : "Check-out"} ·{" "}
            {matricula.crianca.nomeCompleto.split(" ")[0]}
          </h2>
          <button
            type="button"
            onClick={onFechar}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {sentido === "ENTRADA"
            ? "Quem está ENTREGANDO a criança?"
            : "Quem está RETIRANDO a criança? Confira a foto e o documento."}
        </p>

        {matricula.crianca.alergias.length > 0 && (
          <div className="mt-3 rounded-lg border border-danger/60 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">
            ⚠ Alergias: {matricula.crianca.alergias.map((a) => a.descricao).join(", ")}
          </div>
        )}

        <div className="mt-4 space-y-2">
          {isLoading && <Spinner label="Carregando autorizados..." />}
          {data?.items.map((a) => (
            <CardAutorizado
              key={a.id}
              autorizado={a}
              selecionado={autorizadoId === a.id}
              onSelect={() => setAutorizadoId(a.id)}
            />
          ))}
        </div>

        {erro && (
          <div className="mt-3">
            <Alerta tipo="erro">{erro}</Alerta>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <Botao variante="outline" onClick={onFechar} className="flex-1">
            Cancelar
          </Botao>
          <Botao
            onClick={confirmar}
            disabled={mutation.isPending}
            className="flex-1"
          >
            {mutation.isPending ? "Registrando..." : "Confirmar"}
          </Botao>
        </div>
      </div>
    </div>
  );
}

/** Painel de rotina por criança: tipo → tag de 1 toque (envia direto) + nota livre. */
function PainelRotina({ matricula }: { matricula: MatriculaTurmaDia }) {
  const { data } = useDiarioDoDia(matricula.membroId);
  const registrar = useRegistrarRotina();
  const fechar = useFecharDiario();
  const [tipo, setTipo] = useState<TipoRegistroRotina | null>(null);
  const [nota, setNota] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const diario = data?.diario ?? null;
  const fechado = diario?.status === "FECHADO";

  async function enviar(descricao: string) {
    if (!tipo) return;
    setErro(null);
    try {
      await registrar.mutateAsync({ membroId: matricula.membroId, tipo, descricao });
      setTipo(null);
      setNota("");
    } catch (e) {
      setErro((e as Error).message || "Falha ao lançar.");
    }
  }

  async function fecharDiario() {
    if (!diario) return;
    setErro(null);
    try {
      await fechar.mutateAsync(diario.id);
    } catch (e) {
      setErro((e as Error).message || "Falha ao fechar o diário.");
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-border bg-background p-3">
      {fechado ? (
        <p className="flex items-center gap-2 text-sm font-semibold text-success">
          <Lock className="h-4 w-4" /> Diário fechado — visível à família.
        </p>
      ) : (
        <>
          {!tipo ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {(Object.keys(TIPO_ROTINA_LABEL) as TipoRegistroRotina[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  className="rounded-lg border border-border bg-surface px-3 py-3 text-sm font-semibold text-foreground transition hover:border-primary/60 hover:text-primary"
                >
                  {TIPO_ROTINA_LABEL[t]}
                </button>
              ))}
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-primary">
                  {TIPO_ROTINA_LABEL[tipo]}
                </p>
                <button
                  type="button"
                  onClick={() => setTipo(null)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  trocar tipo
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {TAGS_ROTINA[tipo].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    disabled={registrar.isPending}
                    onClick={() => enviar(tag)}
                    className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20"
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <Input
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  placeholder="Ou escreva uma nota curta..."
                  className="flex-1"
                />
                <Botao
                  disabled={registrar.isPending || nota.trim().length < 2}
                  onClick={() => enviar(nota.trim())}
                >
                  Lançar
                </Botao>
              </div>
            </div>
          )}

          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">
              {diario?.registros?.length ?? 0} registro(s) hoje
            </p>
            <Botao
              variante="outline"
              disabled={!diario || (diario.registros?.length ?? 0) === 0 || fechar.isPending}
              onClick={fecharDiario}
            >
              <Lock className="mr-1 h-3.5 w-3.5" /> Fechar diário do dia
            </Botao>
          </div>
        </>
      )}

      {(diario?.registros?.length ?? 0) > 0 && (
        <ul className="mt-2 space-y-1">
          {diario?.registros.map((r) => (
            <li key={r.id} className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">
                {TIPO_ROTINA_LABEL[r.tipo]}:
              </span>{" "}
              {r.descricao}
            </li>
          ))}
        </ul>
      )}

      {erro && (
        <div className="mt-2">
          <Alerta tipo="erro">{erro}</Alerta>
        </div>
      )}
    </div>
  );
}

/**
 * Lançamento em LOTE para a turma toda: escolhe o tipo, dispara por tag de 1
 * toque (ou nota) e a API cria o registro no diário de cada criança. Diários
 * já selados são PULADOS (a API devolve a contagem), não derruba o lote.
 */
function PainelLote({ turmaId, onFechar }: { turmaId: string; onFechar: () => void }) {
  const lote = useRegistrarRotinaLote();
  const [tipo, setTipo] = useState<TipoRegistroRotina | null>(null);
  const [nota, setNota] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [resumo, setResumo] = useState<{ aplicados: number; pulados: number } | null>(null);

  async function enviar(descricao: string) {
    if (!tipo) return;
    setErro(null);
    try {
      const r = await lote.mutateAsync({ turmaId, tipo, descricao });
      setResumo({ aplicados: r.aplicados.length, pulados: r.pulados.length });
      setTipo(null);
      setNota("");
    } catch (e) {
      setErro((e as Error).message || "Falha ao lançar em lote.");
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-primary/40 bg-primary/5 p-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Layers className="h-4 w-4" /> Rotina para a turma toda
        </p>
        <button
          type="button"
          onClick={onFechar}
          className="rounded p-1 text-muted-foreground hover:text-foreground"
          aria-label="Fechar lote"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Lança o mesmo registro no diário de cada criança. Diários já fechados são pulados.
      </p>

      {!tipo ? (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {(Object.keys(TIPO_ROTINA_LABEL) as TipoRegistroRotina[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTipo(t);
                setResumo(null);
              }}
              className="rounded-lg border border-border bg-surface px-3 py-3 text-sm font-semibold text-foreground transition hover:border-primary/60 hover:text-primary"
            >
              {TIPO_ROTINA_LABEL[t]}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-primary">{TIPO_ROTINA_LABEL[tipo]}</p>
            <button
              type="button"
              onClick={() => setTipo(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              trocar tipo
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {TAGS_ROTINA[tipo].map((tag) => (
              <button
                key={tag}
                type="button"
                disabled={lote.isPending}
                onClick={() => enviar(tag)}
                className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20"
              >
                {tag}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Input
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Ou escreva uma nota curta para todos..."
              className="flex-1"
            />
            <Botao disabled={lote.isPending || nota.trim().length < 2} onClick={() => enviar(nota.trim())}>
              Lançar p/ turma
            </Botao>
          </div>
        </div>
      )}

      {resumo && (
        <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-success">
          <Check className="h-4 w-4" /> Lançado em {resumo.aplicados} criança(s)
          {resumo.pulados > 0 ? ` · ${resumo.pulados} com diário já fechado (pulado)` : ""}.
        </p>
      )}

      {erro && (
        <div className="mt-3">
          <Alerta tipo="erro">{erro}</Alerta>
        </div>
      )}
    </div>
  );
}

export default function TurmaDoDia({ params }: { params: { id: string } }) {
  const { id } = params;
  const { data: turma, isLoading, error } = useTurmaInfantil(id);
  const [modal, setModal] = useState<{
    matricula: MatriculaTurmaDia;
    sentido: SentidoCheck;
  } | null>(null);
  const [rotinaAberta, setRotinaAberta] = useState<string | null>(null);
  const [loteAberto, setLoteAberto] = useState(false);

  if (isLoading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Spinner label="Carregando turma..." />
      </main>
    );
  }
  if (error || !turma) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Alerta tipo="erro">{(error as Error)?.message ?? "Turma não encontrada"}</Alerta>
      </main>
    );
  }

  const presentes = turma.matriculas.filter((m) => m.estadoDia === "PRESENTE").length;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <Link
        href="/educacional"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Painel
      </Link>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">{turma.nome}</h1>
          <p className="text-xs text-muted-foreground">
            {turma.dia} · {presentes} presente(s) de {turma.matriculas.length}
          </p>
        </div>
        <Botao
          variante={loteAberto ? "primary" : "outline"}
          onClick={() => setLoteAberto((v) => !v)}
        >
          <Layers className="mr-1 h-4 w-4" /> Rotina em lote
        </Botao>
      </div>

      {loteAberto && <PainelLote turmaId={id} onFechar={() => setLoteAberto(false)} />}

      <ul className="mt-5 space-y-3">
        {turma.matriculas.map((m) => (
          <li key={m.id} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href={`/educacional/criancas/${m.membroId}`}
                  className="group inline-flex items-center gap-1"
                >
                  <span className="truncate text-sm font-semibold text-foreground group-hover:text-primary">
                    {m.crianca.nomeCompleto}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </Link>
                <p className="text-xs text-muted-foreground">
                  {idade(m.crianca.dataNascimento)} anos · resp.{" "}
                  {m.ficha.nomeCompleto.split(" ")[0]}
                </p>
                {m.crianca.alergias.length > 0 && (
                  <p className="mt-1 inline-flex items-center gap-1 rounded-full border border-danger/60 bg-danger/10 px-2 py-0.5 text-[11px] font-bold text-danger">
                    <AlertTriangle className="h-3 w-3" />
                    {m.crianca.alergias.map((a) => a.descricao).join(", ")}
                  </p>
                )}
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                  estadoEstilo[m.estadoDia],
                )}
              >
                {estadoLabel[m.estadoDia]}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {m.estadoDia !== "PRESENTE" && (
                <Botao onClick={() => setModal({ matricula: m, sentido: "ENTRADA" })}>
                  <LogIn className="mr-1 h-4 w-4" /> Check-in
                </Botao>
              )}
              {m.estadoDia === "PRESENTE" && (
                <Botao onClick={() => setModal({ matricula: m, sentido: "SAIDA" })}>
                  <LogOut className="mr-1 h-4 w-4" /> Check-out
                </Botao>
              )}
              <Botao
                variante="outline"
                onClick={() =>
                  setRotinaAberta(rotinaAberta === m.membroId ? null : m.membroId)
                }
              >
                <NotebookPen className="mr-1 h-4 w-4" /> Rotina
              </Botao>
            </div>

            {rotinaAberta === m.membroId && <PainelRotina matricula={m} />}
          </li>
        ))}
      </ul>

      {modal && (
        <ModalCheck
          matricula={modal.matricula}
          sentido={modal.sentido}
          onFechar={() => setModal(null)}
        />
      )}
    </main>
  );
}
