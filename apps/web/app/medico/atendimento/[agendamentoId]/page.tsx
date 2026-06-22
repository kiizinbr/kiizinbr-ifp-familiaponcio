"use client";

/**
 * Prancha de atendimento — port React do protótipo Connect (flagship médico).
 * 5 passos: Resumo → Queixa (S) → Exame (O + vitais) → Conduta (A/CID + P) → Selo.
 * Tudo em estado React, hidratado do draft da API; prontuário selado vira leitura.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Lock, Save, ShieldCheck, Stamp } from "lucide-react";
import Link from "next/link";

import { usePrancha, useIniciarAtendimento, useSalvarSoap, useSalvarVitais, useEncerrarAtendimento, type VitaisPayload } from "@/lib/use-medico";
import { Alerta, Botao, Campo, Input, Spinner, Textarea } from "@/components/ui";
import { CrestAvatar } from "@/components/casa";
import { ChipClinico } from "@/components/medico/chip-clinico";
import { PranchaStepper, PASSOS_PRANCHA } from "@/components/medico/prancha-stepper";
import { PrescricaoBloco } from "@/components/medico/prescricao-bloco";
import { idade } from "@/lib/idade";

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[partes.length - 1]?.[0] ?? "")).toUpperCase();
}

/** Campos de vitais como string (inputs controlados); converte pro payload no save. */
type VitaisForm = Record<keyof Omit<VitaisPayload, "queixaPrincipal">, string> & {
  queixaPrincipal: string;
};

const VITAIS_VAZIO: VitaisForm = {
  pressaoSistolica: "", pressaoDiastolica: "", frequenciaCardiaca: "",
  frequenciaRespiratoria: "", temperaturaC: "", saturacaoO2: "",
  pesoKg: "", alturaCm: "", glicemia: "", queixaPrincipal: "",
};

const ATALHOS_QUEIXA = ["Febre", "Dor de cabeça", "Tosse", "Dor abdominal", "Mal-estar"];

export default function PranchaPage({ params }: { params: { agendamentoId: string } }) {
  const { agendamentoId } = params;
  const router = useRouter();

  const { data: prancha, isLoading, isError, error } = usePrancha(agendamentoId);
  const iniciar = useIniciarAtendimento();
  const salvarSoap = useSalvarSoap();
  const salvarVitais = useSalvarVitais();
  const encerrar = useEncerrarAtendimento();

  const [passo, setPasso] = useState(0);
  const [soap, setSoap] = useState({ subjetivo: "", objetivo: "", avaliacao: "", plano: "", cid10: "" });
  const [vitais, setVitais] = useState<VitaisForm>(VITAIS_VAZIO);
  const [toast, setToast] = useState<{ msg: string; tipo: "ok" | "erro" } | null>(null);

  const atendimento = prancha?.atendimento ?? null;
  const selado = !!atendimento?.encerradoEm;

  // Auto-inicia o atendimento na primeira abertura (idempotente no backend)
  const jaIniciou = useRef(false);
  useEffect(() => {
    if (prancha && !prancha.atendimento && !jaIniciou.current && !selado) {
      jaIniciou.current = true;
      iniciar.mutate(agendamentoId);
    }
  }, [prancha, agendamentoId, iniciar, selado]);

  // Hidrata o form com o draft vindo da API (uma vez por atendimento)
  const hidratadoPara = useRef<string | null>(null);
  useEffect(() => {
    if (!atendimento || hidratadoPara.current === atendimento.id) return;
    hidratadoPara.current = atendimento.id;
    setSoap({
      subjetivo: atendimento.subjetivo ?? "",
      objetivo: atendimento.objetivo ?? "",
      avaliacao: atendimento.avaliacao ?? "",
      plano: atendimento.plano ?? "",
      cid10: atendimento.cid10 ?? "",
    });
    const v = atendimento.vitais;
    if (v) {
      setVitais({
        pressaoSistolica: v.pressaoSistolica?.toString() ?? "",
        pressaoDiastolica: v.pressaoDiastolica?.toString() ?? "",
        frequenciaCardiaca: v.frequenciaCardiaca?.toString() ?? "",
        frequenciaRespiratoria: v.frequenciaRespiratoria?.toString() ?? "",
        temperaturaC: v.temperaturaC ?? "",
        saturacaoO2: v.saturacaoO2?.toString() ?? "",
        pesoKg: v.pesoKg ?? "",
        alturaCm: v.alturaCm ?? "",
        glicemia: v.glicemia?.toString() ?? "",
        queixaPrincipal: v.queixaPrincipal ?? "",
      });
    }
  }, [atendimento]);

  function avisar(msg: string, tipo: "ok" | "erro" = "ok") {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3500);
  }

  function vitaisPayload(): VitaisPayload {
    const n = (s: string) => (s.trim() === "" ? undefined : Number(s.replace(",", ".")));
    return {
      pressaoSistolica: n(vitais.pressaoSistolica),
      pressaoDiastolica: n(vitais.pressaoDiastolica),
      frequenciaCardiaca: n(vitais.frequenciaCardiaca),
      frequenciaRespiratoria: n(vitais.frequenciaRespiratoria),
      temperaturaC: n(vitais.temperaturaC),
      saturacaoO2: n(vitais.saturacaoO2),
      pesoKg: n(vitais.pesoKg),
      alturaCm: n(vitais.alturaCm),
      glicemia: n(vitais.glicemia),
      queixaPrincipal: vitais.queixaPrincipal.trim() || undefined,
    };
  }

  async function salvarRascunho() {
    if (!atendimento) return;
    try {
      await salvarSoap.mutateAsync({ atendimentoId: atendimento.id, dados: soap });
      await salvarVitais.mutateAsync({ atendimentoId: atendimento.id, dados: vitaisPayload() });
      avisar("Rascunho salvo.");
    } catch (e) {
      avisar((e as Error).message || "Falha ao salvar.", "erro");
    }
  }

  async function selar() {
    if (!atendimento) return;
    try {
      await salvarSoap.mutateAsync({ atendimentoId: atendimento.id, dados: soap });
      await salvarVitais.mutateAsync({ atendimentoId: atendimento.id, dados: vitaisPayload() });
      await encerrar.mutateAsync(atendimento.id);
      avisar("Atendimento selado.");
      setTimeout(() => router.push("/medico/agenda"), 1200);
    } catch (e) {
      avisar((e as Error).message || "Não foi possível selar.", "erro");
    }
  }

  // Aviso (não bloqueante) se a conduta cita uma alergia ativa do paciente
  const alertaAlergia = useMemo(() => {
    const plano = soap.plano.toLowerCase();
    if (!plano || !prancha) return null;
    const batida = prancha.ficha.alergias.find((a) => plano.includes(a.descricao.toLowerCase()));
    return batida ? batida.descricao : null;
  }, [soap.plano, prancha]);

  if (isLoading) return <main className="mx-auto max-w-4xl px-6 py-8"><Spinner label="Abrindo prancha..." /></main>;
  if (isError || !prancha) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-8">
        <Alerta>Não foi possível abrir o atendimento: {(error as Error)?.message}</Alerta>
      </main>
    );
  }

  const paciente = prancha.membro?.nomeCompleto ?? prancha.ficha.nomeCompleto;
  const nascimento = prancha.membro?.dataNascimento ?? prancha.ficha.dataNascimento;
  const elegMedico = prancha.ficha.elegibilidades.find((e) => e.unidade.slug === "medico");
  const liberado = elegMedico?.status === "APROVADO";
  const ro = selado; // somente leitura

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      {/* ---------- Cabeçalho do paciente ---------- */}
      <div className="rounded-[18px] border border-border bg-surface p-5 shadow-casa-sm">
        <div className="flex flex-wrap items-center gap-4">
          <CrestAvatar iniciais={iniciais(paciente)} size={56} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold text-foreground">{paciente}</h1>
            <p className="text-sm text-muted-foreground">
              {idade(nascimento)} anos · {prancha.ficha.protocolo} ·{" "}
              {new Date(prancha.inicioEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <span
            className={
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold " +
              (liberado ? "border-success/50 bg-success/10 text-success" : "border-warning/50 bg-warning/10 text-warning")
            }
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            {liberado ? "Liberado p/ Médico" : "Elegibilidade pendente"}
          </span>
        </div>

        {/* chips clínicos com dado real */}
        <div className="mt-4 flex flex-wrap gap-2">
          {prancha.ficha.alergias.map((a) => (
            <ChipClinico key={a.id} tipo="alergia">
              Alergia: {a.descricao}{a.gravidade === "GRAVE" ? " (grave)" : ""}
            </ChipClinico>
          ))}
          {prancha.ficha.condicoesCronicas.map((c) => (
            <ChipClinico key={c.id} tipo="cronico">
              {c.descricao}{c.cid10 ? ` · ${c.cid10}` : ""}
            </ChipClinico>
          ))}
          {prancha.ficha.alergias.length === 0 && prancha.ficha.condicoesCronicas.length === 0 ? (
            <ChipClinico tipo="neutro">Sem alergias ou condições registradas</ChipClinico>
          ) : null}
        </div>
      </div>

      {selado ? (
        <div className="mt-4">
          <Alerta tipo="info">
            <span className="inline-flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Atendimento selado em{" "}
              {new Date(atendimento!.encerradoEm!).toLocaleString("pt-BR")} — prontuário em
              modo somente leitura.
            </span>
          </Alerta>
        </div>
      ) : null}

      {/* ---------- Stepper ---------- */}
      <div className="mt-6">
        <PranchaStepper atual={passo} onIrPara={setPasso} />
      </div>

      {/* ---------- Conteúdo do passo ---------- */}
      <div className="mt-6 rounded-[18px] border border-border bg-surface p-6 shadow-ifp-sm">
        {passo === 0 ? (
          <section className="space-y-4">
            <h2 className="font-semibold text-foreground">Resumo da consulta</h2>
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Motivo:</strong>{" "}
              {prancha.motivo ?? "Não informado"}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["PA", vitais.pressaoSistolica && vitais.pressaoDiastolica ? `${vitais.pressaoSistolica}/${vitais.pressaoDiastolica}` : "—"],
                ["Temp", vitais.temperaturaC ? `${vitais.temperaturaC} °C` : "—"],
                ["SatO₂", vitais.saturacaoO2 ? `${vitais.saturacaoO2}%` : "—"],
                ["FC", vitais.frequenciaCardiaca ? `${vitais.frequenciaCardiaca} bpm` : "—"],
              ].map(([rotulo, valor]) => (
                <div key={rotulo} className="rounded-md bg-muted px-3 py-2 text-center">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{rotulo}</div>
                  <div className="text-sm font-semibold text-foreground">{valor}</div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {passo === 1 ? (
          <section className="space-y-4">
            <h2 className="font-semibold text-foreground">Queixa do paciente (S)</h2>
            <div className="flex flex-wrap gap-2">
              {ATALHOS_QUEIXA.map((a) => (
                <button
                  key={a}
                  type="button"
                  disabled={ro}
                  onClick={() => setSoap((s) => ({ ...s, subjetivo: s.subjetivo ? `${s.subjetivo}; ${a}` : a }))}
                  className="rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-50"
                >
                  + {a}
                </button>
              ))}
            </div>
            <Campo label="Relato / queixa principal" htmlFor="subjetivo">
              <Textarea
                id="subjetivo"
                rows={5}
                disabled={ro}
                value={soap.subjetivo}
                onChange={(e) => setSoap((s) => ({ ...s, subjetivo: e.target.value }))}
                placeholder="Descreva a queixa do paciente..."
              />
            </Campo>
          </section>
        ) : null}

        {passo === 2 ? (
          <section className="space-y-4">
            <h2 className="font-semibold text-foreground">Exame físico (O) e sinais vitais</h2>
            <Campo label="Achados do exame" htmlFor="objetivo">
              <Textarea
                id="objetivo"
                rows={3}
                disabled={ro}
                value={soap.objetivo}
                onChange={(e) => setSoap((s) => ({ ...s, objetivo: e.target.value }))}
                placeholder="Ausculta, inspeção, palpação..."
              />
            </Campo>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {([
                ["pressaoSistolica", "PA sist. (mmHg)"],
                ["pressaoDiastolica", "PA diast. (mmHg)"],
                ["frequenciaCardiaca", "FC (bpm)"],
                ["frequenciaRespiratoria", "FR (irpm)"],
                ["temperaturaC", "Temp (°C)"],
                ["saturacaoO2", "SatO₂ (%)"],
                ["pesoKg", "Peso (kg)"],
                ["alturaCm", "Altura (cm)"],
                ["glicemia", "Glicemia (mg/dL)"],
              ] as [keyof VitaisForm, string][]).map(([campo, rotulo]) => (
                <Campo key={campo} label={rotulo} htmlFor={campo}>
                  <Input
                    id={campo}
                    inputMode="decimal"
                    disabled={ro}
                    value={vitais[campo]}
                    onChange={(e) => setVitais((v) => ({ ...v, [campo]: e.target.value }))}
                  />
                </Campo>
              ))}
            </div>
          </section>
        ) : null}

        {passo === 3 ? (
          <section className="space-y-4">
            <h2 className="font-semibold text-foreground">Avaliação (A) e conduta (P)</h2>
            <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
              <Campo label="Hipótese diagnóstica" htmlFor="avaliacao">
                <Textarea
                  id="avaliacao"
                  rows={2}
                  disabled={ro}
                  value={soap.avaliacao}
                  onChange={(e) => setSoap((s) => ({ ...s, avaliacao: e.target.value }))}
                />
              </Campo>
              <Campo label="CID-10" htmlFor="cid10">
                <Input
                  id="cid10"
                  maxLength={10}
                  disabled={ro}
                  value={soap.cid10}
                  onChange={(e) => setSoap((s) => ({ ...s, cid10: e.target.value.toUpperCase() }))}
                  placeholder="G44.2"
                />
              </Campo>
            </div>
            <Campo label="Conduta / plano (medicação, atestado, retorno)" htmlFor="plano" obrigatorio>
              <Textarea
                id="plano"
                rows={4}
                disabled={ro}
                value={soap.plano}
                onChange={(e) => setSoap((s) => ({ ...s, plano: e.target.value }))}
              />
            </Campo>
            {alertaAlergia ? (
              <Alerta>
                ⚠ A conduta menciona <strong>{alertaAlergia}</strong> — o paciente tem alergia
                registrada a essa substância. Confira antes de selar.
              </Alerta>
            ) : null}

            {atendimento ? (
              <PrescricaoBloco atendimentoId={atendimento.id} readOnly={ro} />
            ) : null}
          </section>
        ) : null}

        {passo === 4 ? (
          <section className="space-y-4">
            <h2 className="font-semibold text-foreground">Selo do atendimento</h2>
            <ul className="space-y-2 text-sm">
              {[
                ["Queixa (S)", soap.subjetivo],
                ["Exame (O)", soap.objetivo],
                ["Avaliação (A)", soap.avaliacao + (soap.cid10 ? ` · ${soap.cid10}` : "")],
                ["Conduta (P)", soap.plano],
              ].map(([rotulo, valor]) => (
                <li key={rotulo} className="flex gap-2">
                  <span className={"mt-0.5 h-2 w-2 shrink-0 rounded-full " + (valor?.trim() ? "bg-success" : "bg-warning")} />
                  <div className="min-w-0">
                    <span className="font-medium text-foreground">{rotulo}:</span>{" "}
                    <span className="text-muted-foreground">{valor?.trim() || "não preenchido"}</span>
                  </div>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Ao selar, o prontuário fica <strong>imutável</strong> e o agendamento é concluído.
            </p>
            {!ro ? (
              <Botao onClick={selar} carregando={encerrar.isPending} disabled={!soap.subjetivo.trim() || !soap.plano.trim()}>
                <Stamp className="h-4 w-4" /> Selar atendimento
              </Botao>
            ) : null}
          </section>
        ) : null}
      </div>

      {/* ---------- Barra de ações ---------- */}
      <div className="mt-6 flex items-center justify-between">
        <Link href="/medico/agenda" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Agenda
        </Link>
        <div className="flex items-center gap-2">
          {!ro ? (
            <Botao variante="outline" onClick={salvarRascunho} carregando={salvarSoap.isPending || salvarVitais.isPending}>
              <Save className="h-4 w-4" /> Salvar rascunho
            </Botao>
          ) : null}
          {passo < PASSOS_PRANCHA.length - 1 ? (
            <Botao variante="outline" onClick={() => setPasso((p) => p + 1)}>
              Próximo <ArrowRight className="h-4 w-4" />
            </Botao>
          ) : null}
        </div>
      </div>

      {/* ---------- Toast ---------- */}
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
