"use client";

/**
 * Triagem de enfermagem (acolhimento na chegada) — a enfermagem colhe os sinais
 * vitais e classifica o risco do paciente que já chegou. O médico lê esta triagem
 * na abertura da prancha. Espelha o passo de vitais da prancha do atendimento.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";

import {
  usePrancha,
  useTriagemEnfermagem,
  useSalvarTriagem,
  type TriagemPayload,
} from "@/lib/use-medico";
import { Alerta, Botao, Campo, Input, Select, Spinner, Textarea } from "@/components/ui";
import { CrestAvatar } from "@/components/casa";
import { BadgeRisco } from "@/components/medico/badge-risco";
import { CLASSIFICACAO_RISCO_LABEL, type ClassificacaoRisco } from "@/lib/api";
import { idade } from "@/lib/idade";

const RISCOS: ClassificacaoRisco[] = ["AZUL", "VERDE", "AMARELO", "LARANJA", "VERMELHO"];

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[partes.length - 1]?.[0] ?? "")).toUpperCase();
}

/** Campos numéricos como string (inputs controlados). */
type Form = {
  classificacaoRisco: ClassificacaoRisco;
  pressaoSistolica: string;
  pressaoDiastolica: string;
  frequenciaCardiaca: string;
  frequenciaRespiratoria: string;
  temperaturaC: string;
  saturacaoO2: string;
  pesoKg: string;
  alturaCm: string;
  glicemia: string;
  dorEscala: string;
  queixaPrincipal: string;
  observacoes: string;
};

const VAZIO: Form = {
  classificacaoRisco: "VERDE",
  pressaoSistolica: "", pressaoDiastolica: "", frequenciaCardiaca: "",
  frequenciaRespiratoria: "", temperaturaC: "", saturacaoO2: "",
  pesoKg: "", alturaCm: "", glicemia: "", dorEscala: "",
  queixaPrincipal: "", observacoes: "",
};

const VITAIS_CAMPOS: [keyof Form, string][] = [
  ["pressaoSistolica", "PA sist. (mmHg)"],
  ["pressaoDiastolica", "PA diast. (mmHg)"],
  ["frequenciaCardiaca", "FC (bpm)"],
  ["frequenciaRespiratoria", "FR (irpm)"],
  ["temperaturaC", "Temp (°C)"],
  ["saturacaoO2", "SatO₂ (%)"],
  ["pesoKg", "Peso (kg)"],
  ["alturaCm", "Altura (cm)"],
  ["glicemia", "Glicemia (mg/dL)"],
  ["dorEscala", "Dor (0-10)"],
];

export default function TriagemPage({ params }: { params: { agendamentoId: string } }) {
  const { agendamentoId } = params;
  const router = useRouter();

  const { data: prancha, isLoading, isError, error } = usePrancha(agendamentoId);
  const { data: triagem } = useTriagemEnfermagem(agendamentoId);
  const salvar = useSalvarTriagem();

  const [form, setForm] = useState<Form>(VAZIO);
  const [toast, setToast] = useState<{ msg: string; tipo: "ok" | "erro" } | null>(null);

  // Hidrata uma vez com a triagem existente (edição), se houver.
  const hidratado = useRef(false);
  useEffect(() => {
    if (!triagem || hidratado.current) return;
    hidratado.current = true;
    setForm({
      classificacaoRisco: triagem.classificacaoRisco,
      pressaoSistolica: triagem.pressaoSistolica?.toString() ?? "",
      pressaoDiastolica: triagem.pressaoDiastolica?.toString() ?? "",
      frequenciaCardiaca: triagem.frequenciaCardiaca?.toString() ?? "",
      frequenciaRespiratoria: triagem.frequenciaRespiratoria?.toString() ?? "",
      temperaturaC: triagem.temperaturaC ?? "",
      saturacaoO2: triagem.saturacaoO2?.toString() ?? "",
      pesoKg: triagem.pesoKg ?? "",
      alturaCm: triagem.alturaCm ?? "",
      glicemia: triagem.glicemia?.toString() ?? "",
      dorEscala: triagem.dorEscala?.toString() ?? "",
      queixaPrincipal: triagem.queixaPrincipal ?? "",
      observacoes: triagem.observacoes ?? "",
    });
  }, [triagem]);

  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timeoutsRef.current.forEach(clearTimeout), []);

  function avisar(msg: string, tipo: "ok" | "erro" = "ok") {
    setToast({ msg, tipo });
    timeoutsRef.current.push(setTimeout(() => setToast(null), 3500));
  }

  function payload(): TriagemPayload {
    const n = (s: string) => (s.trim() === "" ? undefined : Number(s.replace(",", ".")));
    return {
      classificacaoRisco: form.classificacaoRisco,
      pressaoSistolica: n(form.pressaoSistolica),
      pressaoDiastolica: n(form.pressaoDiastolica),
      frequenciaCardiaca: n(form.frequenciaCardiaca),
      frequenciaRespiratoria: n(form.frequenciaRespiratoria),
      temperaturaC: n(form.temperaturaC),
      saturacaoO2: n(form.saturacaoO2),
      pesoKg: n(form.pesoKg),
      alturaCm: n(form.alturaCm),
      glicemia: n(form.glicemia),
      dorEscala: n(form.dorEscala),
      queixaPrincipal: form.queixaPrincipal.trim() || undefined,
      observacoes: form.observacoes.trim() || undefined,
    };
  }

  async function gravar() {
    try {
      await salvar.mutateAsync({ agendamentoId, dados: payload() });
      avisar("Triagem registrada.");
      timeoutsRef.current.push(setTimeout(() => router.push("/medico/fila-chegada"), 1200));
    } catch (e) {
      avisar((e as Error).message || "Falha ao registrar triagem.", "erro");
    }
  }

  if (isLoading) {
    return <main className="mx-auto max-w-3xl px-6 py-8"><Spinner label="Abrindo triagem..." /></main>;
  }
  if (isError || !prancha) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-8">
        <Alerta>Não foi possível abrir a triagem: {(error as Error)?.message}</Alerta>
      </main>
    );
  }

  const paciente = prancha.membro?.nomeCompleto ?? prancha.ficha.nomeCompleto;
  const nascimento = prancha.membro?.dataNascimento ?? prancha.ficha.dataNascimento;
  const chegou = !!prancha.chegouEm;

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      {/* Cabeçalho do paciente */}
      <div className="rounded-[18px] border border-border bg-surface p-5 shadow-casa-sm">
        <div className="flex flex-wrap items-center gap-4">
          <CrestAvatar iniciais={iniciais(paciente)} size={56} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold text-foreground">{paciente}</h1>
            <p className="text-sm text-muted-foreground">
              {idade(nascimento)} anos · {prancha.ficha.protocolo}
            </p>
          </div>
          {triagem ? <BadgeRisco risco={triagem.classificacaoRisco} /> : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {prancha.ficha.alergias.map((a) => (
            <span key={a.id} className="inline-flex items-center rounded-full border border-danger/40 bg-danger/10 px-2.5 py-0.5 text-xs font-medium text-danger">
              Alergia: {a.descricao}
            </span>
          ))}
        </div>
      </div>

      {!chegou ? (
        <div className="mt-4">
          <Alerta>
            Marque a chegada do paciente na recepção antes de fazer a triagem.
          </Alerta>
        </div>
      ) : null}

      {/* Formulário */}
      <div className="mt-6 space-y-6 rounded-[18px] border border-border bg-surface p-6 shadow-ifp-sm">
        <section className="space-y-3">
          <h2 className="font-semibold text-foreground">Classificação de risco</h2>
          <Campo label="Prioridade do acolhimento" htmlFor="risco" obrigatorio>
            <Select
              id="risco"
              value={form.classificacaoRisco}
              onChange={(e) =>
                setForm((f) => ({ ...f, classificacaoRisco: e.target.value as ClassificacaoRisco }))
              }
            >
              {RISCOS.map((r) => (
                <option key={r} value={r}>
                  {CLASSIFICACAO_RISCO_LABEL[r]}
                </option>
              ))}
            </Select>
          </Campo>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold text-foreground">Sinais vitais na chegada</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {VITAIS_CAMPOS.map(([campo, rotulo]) => (
              <Campo key={campo} label={rotulo} htmlFor={campo}>
                <Input
                  id={campo}
                  inputMode="decimal"
                  value={form[campo]}
                  onChange={(e) => setForm((f) => ({ ...f, [campo]: e.target.value }))}
                />
              </Campo>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <Campo label="Queixa principal (relato do paciente)" htmlFor="queixa">
            <Textarea
              id="queixa"
              rows={2}
              value={form.queixaPrincipal}
              onChange={(e) => setForm((f) => ({ ...f, queixaPrincipal: e.target.value }))}
              placeholder="O que trouxe o paciente hoje?"
            />
          </Campo>
          <Campo label="Observações da enfermagem" htmlFor="obs">
            <Textarea
              id="obs"
              rows={2}
              value={form.observacoes}
              onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
            />
          </Campo>
        </section>
      </div>

      {/* Barra de ações */}
      <div className="mt-6 flex items-center justify-between">
        <Link href="/medico/fila-chegada" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Fila de chegada
        </Link>
        <Botao onClick={gravar} carregando={salvar.isPending} disabled={!chegou}>
          <Save className="h-4 w-4" /> {triagem ? "Atualizar triagem" : "Registrar triagem"}
        </Botao>
      </div>

      {toast ? (
        <div
          role="status"
          className={
            "fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full px-5 py-2.5 text-sm font-medium text-ifp-white shadow-casa " +
            (toast.tipo === "ok" ? "bg-primary" : "bg-danger")
          }
        >
          {toast.msg}
        </div>
      ) : null}
    </main>
  );
}
