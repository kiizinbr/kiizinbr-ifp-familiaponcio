"use client";

/**
 * Painel do Centro Esportivo: KPIs, turmas em andamento e criação de turma.
 * Molde: painel da Capacitação (uma tela só — turmas listadas aqui mesmo).
 */
import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { ChevronRight, Hourglass, Medal, Plus, Trophy, Users } from "lucide-react";

import { Alerta, Botao, Campo, Input, Select, Spinner } from "@/components/ui";
import { STATUS_TURMA_LABEL } from "@/lib/api";
import { cn } from "@/lib/cn";
import {
  useCriarTurmaEsportiva,
  useModalidades,
  useResumoEsportivo,
  useTurmasEsportivas,
  type CriarTurmaEsportivaPayload,
} from "@/lib/use-esportivo";

function Kpi({
  rotulo,
  valor,
  icone,
}: {
  rotulo: string;
  valor: number | string;
  icone: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-ifp-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {rotulo}
        </span>
        <span className="text-primary">{icone}</span>
      </div>
      <div className="mt-2 text-3xl font-bold text-foreground">{valor}</div>
    </div>
  );
}

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

export default function PainelEsportivo() {
  const { data: resumo, isLoading, error } = useResumoEsportivo();
  const { data: turmas, isLoading: carregandoTurmas } = useTurmasEsportivas();
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
      <h1 className="text-2xl font-bold text-foreground">Centro Esportivo</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Modalidades, turmas e graduações verificáveis.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          rotulo="Turmas em andamento"
          valor={resumo?.turmasEmAndamento ?? "—"}
          icone={<Medal className="h-5 w-5" />}
        />
        <Kpi
          rotulo="Atletas ativos"
          valor={resumo?.atletasAtivos ?? "—"}
          icone={<Users className="h-5 w-5" />}
        />
        <Kpi
          rotulo="Graduações concedidas"
          valor={resumo?.graduacoesConcedidas ?? "—"}
          icone={<Trophy className="h-5 w-5" />}
        />
        <Kpi
          rotulo="Lista de espera"
          valor={resumo?.listaEspera ?? "—"}
          icone={<Hourglass className="h-5 w-5" />}
        />
      </div>

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

      <ul className="mt-3 space-y-2">
        {turmas?.items.map((t) => (
          <li key={t.id}>
            <Link
              href={`/esportivo/turmas/${t.id}`}
              className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 transition hover:border-primary/50"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Medal className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {t.modalidade.nome} · {t.codigo}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.diasHorario}
                    {t.local ? ` · ${t.local}` : ""} · {t._count.matriculas}/{t.vagasTotais}{" "}
                    atletas
                    {t.faixaEtariaMin != null && t.faixaEtariaMax != null
                      ? ` · ${t.faixaEtariaMin}–${t.faixaEtariaMax} anos`
                      : ""}
                  </p>
                </div>
              </div>
              <span className="flex items-center gap-2">
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
              </span>
            </Link>
          </li>
        ))}
        {turmas?.items.length === 0 && (
          <li className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            <Medal className="mx-auto mb-2 h-5 w-5" />
            Nenhuma turma ainda — crie a primeira em “Nova turma”.
          </li>
        )}
      </ul>
    </main>
  );
}
