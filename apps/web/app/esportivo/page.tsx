"use client";

/**
 * Painel do Centro Esportivo: KPIs, turmas em andamento e criação de turma.
 * Molde: painel da Capacitação (uma tela só — turmas listadas aqui mesmo).
 */
import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { Award, CalendarClock, ChevronRight, Hourglass, Medal, Plus, TrendingUp } from "lucide-react";

import { Alerta, Botao, Campo, Input, Select, Spinner } from "@/components/ui";
import { Card, JubaRing, Kpi, ListRow, PageHeader, Pill, SecTitle } from "@/components/casa";
import { STATUS_TURMA_LABEL } from "@/lib/api";
import { cn } from "@/lib/cn";
import {
  useCriarTurmaEsportiva,
  useModalidades,
  usePainelEsportivo,
  useResumoEsportivo,
  useTurmasEsportivas,
  type CriarTurmaEsportivaPayload,
} from "@/lib/use-esportivo";

interface FormTurma {
  modalidadeId: string;
  codigo: string;
  diasHorario: string;
  local: string;
  faixaEtariaMin: string;
  faixaEtariaMax: string;
  inicioEm: string;
  vagasTotais: string;
}

function FormNovaTurma({ aoFechar }: { aoFechar: () => void }) {
  const { data: modalidades } = useModalidades();
  const criar = useCriarTurmaEsportiva();
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormTurma>({
    defaultValues: {
      modalidadeId: "",
      codigo: "",
      diasHorario: "",
      local: "",
      faixaEtariaMin: "",
      faixaEtariaMax: "",
      inicioEm: new Date().toISOString().slice(0, 10),
      vagasTotais: "20",
    },
    mode: "onTouched",
  });

  async function salvar(v: FormTurma) {
    setErroEnvio(null);
    const payload: CriarTurmaEsportivaPayload = {
      modalidadeId: v.modalidadeId,
      codigo: v.codigo.trim().toUpperCase(),
      diasHorario: v.diasHorario.trim(),
      inicioEm: v.inicioEm,
      vagasTotais: Number(v.vagasTotais),
      ...(v.local.trim() ? { local: v.local.trim() } : {}),
      ...(v.faixaEtariaMin ? { faixaEtariaMin: Number(v.faixaEtariaMin) } : {}),
      ...(v.faixaEtariaMax ? { faixaEtariaMax: Number(v.faixaEtariaMax) } : {}),
    };
    try {
      await criar.mutateAsync(payload);
      aoFechar();
    } catch (error: unknown) {
      setErroEnvio(error instanceof Error ? error.message : "Falha ao criar turma");
    }
  }

  return (
    <form
      onSubmit={handleSubmit(salvar)}
      className="mt-4 space-y-4 rounded-lg border border-border bg-surface p-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          label="Modalidade"
          htmlFor="modalidadeId"
          obrigatorio
          erro={errors.modalidadeId?.message}
        >
          <Select
            id="modalidadeId"
            {...register("modalidadeId", { required: "Escolha a modalidade" })}
          >
            <option value="">Selecione...</option>
            {modalidades?.items.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </Select>
        </Campo>
        <Campo
          label="Código da turma"
          htmlFor="codigo"
          obrigatorio
          dica='Ex.: "JUDO-2026-2" (único no sistema).'
          erro={errors.codigo?.message}
        >
          <Input
            id="codigo"
            placeholder="JUDO-2026-2"
            {...register("codigo", {
              required: "Informe o código",
              maxLength: { value: 20, message: "Máximo de 20 caracteres" },
            })}
          />
        </Campo>
        <Campo
          label="Dias e horário"
          htmlFor="diasHorario"
          obrigatorio
          erro={errors.diasHorario?.message}
        >
          <Input
            id="diasHorario"
            placeholder="Ter/Qui 9h-10h30"
            {...register("diasHorario", { required: "Informe dias e horário" })}
          />
        </Campo>
        <Campo label="Local" htmlFor="local">
          <Input id="local" placeholder="Tatame 1, quadra..." {...register("local")} />
        </Campo>
        <Campo label="Início" htmlFor="inicioEm" obrigatorio erro={errors.inicioEm?.message}>
          <Input
            id="inicioEm"
            type="date"
            {...register("inicioEm", { required: "Informe a data de início" })}
          />
        </Campo>
        <Campo
          label="Vagas"
          htmlFor="vagasTotais"
          obrigatorio
          dica="Lotou → próximas matrículas caem na lista de espera."
          erro={errors.vagasTotais?.message}
        >
          <Input
            id="vagasTotais"
            type="number"
            min={1}
            max={100}
            {...register("vagasTotais", {
              required: "Informe as vagas",
              min: { value: 1, message: "Mínimo 1" },
              max: { value: 100, message: "Máximo 100" },
            })}
          />
        </Campo>
        <Campo label="Idade mínima (anos)" htmlFor="faixaEtariaMin">
          <Input id="faixaEtariaMin" type="number" min={0} {...register("faixaEtariaMin")} />
        </Campo>
        <Campo label="Idade máxima (anos)" htmlFor="faixaEtariaMax">
          <Input id="faixaEtariaMax" type="number" min={0} {...register("faixaEtariaMax")} />
        </Campo>
      </div>

      {erroEnvio ? <Alerta tipo="erro">{erroEnvio}</Alerta> : null}

      <div className="flex justify-end gap-2">
        <Botao type="button" variante="ghost" onClick={aoFechar} disabled={criar.isPending}>
          Cancelar
        </Botao>
        <Botao type="submit" carregando={criar.isPending}>
          Criar turma
        </Botao>
      </div>
    </form>
  );
}

function horaDe(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function PainelEsportivo() {
  const { data: resumo, isLoading, error } = useResumoEsportivo();
  const { data: turmas, isLoading: carregandoTurmas } = useTurmasEsportivas();
  const { data: painel } = usePainelEsportivo();
  const [criando, setCriando] = useState(false);

  if (isLoading || carregandoTurmas) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Spinner label="Carregando painel..." />
      </main>
    );
  }
  if (error) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Alerta tipo="erro">{(error as Error).message}</Alerta>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <PageHeader
        titulo="Centro Esportivo"
        descricao="Modalidades, turmas e graduações verificáveis."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Turmas em andamento" valor={resumo?.turmasEmAndamento ?? "—"} />
        <Kpi label="Atletas ativos" valor={resumo?.atletasAtivos ?? "—"} />
        <Kpi label="Graduações concedidas" valor={resumo?.graduacoesConcedidas ?? "—"} />
        <Kpi label="Lista de espera" valor={resumo?.listaEspera ?? "—"} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="flex items-center gap-4">
          <JubaRing
            pct={painel?.ocupacao.pct ?? 0}
            size={72}
            label={painel?.ocupacao.pct != null ? `${painel.ocupacao.pct}%` : "—"}
          />
          <div>
            <SecTitle>Ocupação das turmas</SecTitle>
            <p className="text-sm text-muted-foreground">
              {painel
                ? `${painel.ocupacao.atletasAtivos} de ${painel.ocupacao.vagasTotais} vagas ativas`
                : "Carregando..."}
            </p>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <SecTitle icon={<CalendarClock />}>Em quadra hoje</SecTitle>
          {painel && painel.emQuadraHoje.length > 0 ? (
            <div className="space-y-2">
              {painel.emQuadraHoje.map((t) => (
                <Link key={t.treinoId} href={`/esportivo/turmas/${t.turmaId}`} className="block">
                  <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm transition hover:shadow-casa-sm">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-foreground">
                        {t.modalidade} · {t.codigo}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {horaDe(t.data)}
                        {t.local ? ` · ${t.local}` : ""} · {t.diasHorario}
                      </div>
                    </div>
                    <Pill tom={t.selado ? "ok" : "warn"}>{t.selado ? "Chamada selada" : "Chamada aberta"}</Pill>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum treino marcado para hoje.</p>
          )}
        </Card>
      </div>

      {painel && painel.ocupacaoPorModalidade.length > 0 ? (
        <Card className="mt-4">
          <div className="mb-3 flex items-center justify-between">
            <SecTitle icon={<TrendingUp />}>Ocupação por modalidade</SecTitle>
            {painel.listaEsperaTotal > 0 ? (
              <Pill tom="warn">
                <Hourglass className="h-3 w-3" /> {painel.listaEsperaTotal} na espera
              </Pill>
            ) : null}
          </div>
          <div className="space-y-2.5">
            {painel.ocupacaoPorModalidade.map((m) => (
              <div key={m.modalidade}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-semibold text-foreground">{m.modalidade}</span>
                  <span className="text-xs text-muted-foreground">
                    {m.atletasAtivos}/{m.vagasTotais} vagas
                    {m.pct != null ? ` · ${m.pct}%` : ""} · {m.turmas} turma(s)
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--unidade-suave)]">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      (m.pct ?? 0) >= 100 ? "bg-warning" : "bg-[var(--unidade)]",
                    )}
                    style={{ width: `${Math.min(m.pct ?? 0, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {painel && painel.proximosExames.length > 0 ? (
        <Card className="mt-4">
          <SecTitle icon={<Award />}>Próximo exame de faixa</SecTitle>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {painel.proximosExames.map((e) => (
              <Link key={e.turmaId} href={`/esportivo/turmas/${e.turmaId}`} className="block">
                <div className="rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm transition hover:shadow-casa-sm">
                  <div className="font-semibold text-foreground">{e.proximoNivel}</div>
                  <div className="text-xs text-muted-foreground">
                    {e.modalidade} · {e.codigo} · {e.atletas} atleta(s)
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="mt-8 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Medal className="h-4 w-4" /> Turmas
        </h2>
        {!criando ? (
          <Botao onClick={() => setCriando(true)}>
            <Plus className="h-4 w-4" /> Nova turma
          </Botao>
        ) : null}
      </div>

      {criando ? <FormNovaTurma aoFechar={() => setCriando(false)} /> : null}

      <div className="mt-3">
        {turmas?.items.map((t) => (
          <Link key={t.id} href={`/esportivo/turmas/${t.id}`} className="group block">
            <ListRow
              className="transition group-hover:shadow-casa-sm"
              avatar={<Medal className="h-4 w-4" />}
              titulo={
                <span className="group-hover:text-primary">
                  {t.modalidade.nome} · {t.codigo}
                </span>
              }
              subtitulo={`${t.diasHorario}${t.local ? ` · ${t.local}` : ""} · ${t._count.matriculas}/${t.vagasTotais} atletas${
                t.faixaEtariaMin != null && t.faixaEtariaMax != null
                  ? ` · ${t.faixaEtariaMin}–${t.faixaEtariaMax} anos`
                  : ""
              }`}
              trailing={
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                      t.status === "ENCERRADA"
                        ? "border-border text-muted-foreground"
                        : "border-primary/60 bg-primary/10 text-primary",
                    )}
                  >
                    {STATUS_TURMA_LABEL[t.status]}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              }
            />
          </Link>
        ))}
        {turmas?.items.length === 0 && (
          <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            <Medal className="mx-auto mb-2 h-5 w-5" />
            Nenhuma turma ainda — crie a primeira em “Nova turma”.
          </div>
        )}
      </div>
    </main>
  );
}
