"use client";

/**
 * Bloco do ODONTOGRAMA da prancha de atendimento.
 * Grid FDI de 32 dentes (2 arcadas) + plano de tratamento. Clicar num dente
 * abre um painel inline (estado + procedimento + observação). O estado é
 * editado localmente e salvo via PUT (idempotente). Selado = somente leitura.
 */
import { useEffect, useMemo, useState } from "react";
import { Save, Smile } from "lucide-react";

import { Alerta, Botao, Campo, Input, Select, Textarea } from "@/components/ui";
import {
  ESTADO_DENTE_COR,
  ESTADO_DENTE_LABEL,
  FDI_INF,
  FDI_SUP,
  useOdontograma,
  useSalvarOdontograma,
  type DenteInput,
  type EstadoDente,
} from "@/lib/use-medico-clinico";

const ESTADOS = Object.keys(ESTADO_DENTE_LABEL) as EstadoDente[];

type MapaDentes = Record<number, DenteInput>;

export function OdontogramaBloco({
  atendimentoId,
  readOnly,
}: {
  atendimentoId: string;
  readOnly: boolean;
}) {
  const { data } = useOdontograma(atendimentoId);
  const salvar = useSalvarOdontograma();

  const [mapa, setMapa] = useState<MapaDentes>({});
  const [observacoes, setObservacoes] = useState("");
  const [selecionado, setSelecionado] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  // Hidrata o estado local quando o odontograma chega da API (uma vez).
  const carregado = data?.id;
  useEffect(() => {
    if (!data) return;
    const m: MapaDentes = {};
    for (const d of data.dentes) {
      m[d.numeroFdi] = {
        numeroFdi: d.numeroFdi,
        estado: d.estado,
        procedimento: d.procedimento ?? undefined,
        observacoes: d.observacoes ?? undefined,
      };
    }
    setMapa(m);
    setObservacoes(data.observacoes ?? "");
  }, [carregado]); // eslint-disable-line react-hooks/exhaustive-deps

  const dente = selecionado != null ? mapa[selecionado] : undefined;

  function setDente(numeroFdi: number, patch: Partial<DenteInput>) {
    setMapa((m) => ({
      ...m,
      [numeroFdi]: {
        numeroFdi,
        estado: m[numeroFdi]?.estado ?? "HIGIDO",
        procedimento: m[numeroFdi]?.procedimento,
        observacoes: m[numeroFdi]?.observacoes,
        ...patch,
      },
    }));
    setSalvo(false);
  }

  // Só manda dentes que saíram do estado HÍGIDO sem nota (reduz ruído).
  const dentesParaSalvar = useMemo(
    () =>
      Object.values(mapa).filter(
        (d) => d.estado !== "HIGIDO" || d.procedimento || d.observacoes,
      ),
    [mapa],
  );

  async function salvarAgora() {
    setErro(null);
    try {
      await salvar.mutateAsync({
        atendimentoId,
        observacoes: observacoes.trim() || undefined,
        dentes: dentesParaSalvar,
      });
      setSalvo(true);
    } catch (e) {
      setErro((e as Error).message || "Não foi possível salvar o odontograma.");
    }
  }

  function Dente({ n }: { n: number }) {
    const d = mapa[n];
    const estado = d?.estado ?? "HIGIDO";
    const ativo = selecionado === n;
    return (
      <button
        type="button"
        onClick={() => setSelecionado(ativo ? null : n)}
        title={`Dente ${n} · ${ESTADO_DENTE_LABEL[estado]}`}
        className={
          "flex h-10 w-9 flex-col items-center justify-center rounded-md border text-[11px] font-semibold transition " +
          ESTADO_DENTE_COR[estado] +
          (ativo ? " ring-2 ring-primary ring-offset-1" : "")
        }
      >
        <Smile className="h-3 w-3 opacity-60" />
        {n}
      </button>
    );
  }

  return (
    <section className="space-y-4 rounded-[14px] border border-border bg-surface p-4">
      <h3 className="flex items-center gap-2 font-semibold text-foreground">
        <Smile className="h-4 w-4 text-primary" /> Odontograma (FDI)
      </h3>

      {/* Arcadas */}
      <div className="space-y-2 overflow-x-auto">
        <div className="flex justify-center gap-1">
          {FDI_SUP.map((n) => (
            <Dente key={n} n={n} />
          ))}
        </div>
        <div className="flex justify-center gap-1">
          {FDI_INF.map((n) => (
            <Dente key={n} n={n} />
          ))}
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-2">
        {ESTADOS.map((e) => (
          <span
            key={e}
            className={
              "rounded-full border px-2 py-0.5 text-[10px] font-medium " + ESTADO_DENTE_COR[e]
            }
          >
            {ESTADO_DENTE_LABEL[e]}
          </span>
        ))}
      </div>

      {/* Painel do dente selecionado */}
      {selecionado != null ? (
        <div className="space-y-3 rounded-md border border-border bg-muted/40 p-3">
          <p className="text-sm font-semibold text-foreground">Dente {selecionado}</p>
          <Campo label="Estado" htmlFor="dente-estado">
            <Select
              id="dente-estado"
              disabled={readOnly}
              value={dente?.estado ?? "HIGIDO"}
              onChange={(e) =>
                setDente(selecionado, { estado: e.target.value as EstadoDente })
              }
            >
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {ESTADO_DENTE_LABEL[e]}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo label="Procedimento (plano)" htmlFor="dente-proc">
            <Input
              id="dente-proc"
              disabled={readOnly}
              value={dente?.procedimento ?? ""}
              onChange={(e) => setDente(selecionado, { procedimento: e.target.value })}
              placeholder="Ex.: Restauração oclusal"
            />
          </Campo>
          <Campo label="Observações" htmlFor="dente-obs">
            <Input
              id="dente-obs"
              disabled={readOnly}
              value={dente?.observacoes ?? ""}
              onChange={(e) => setDente(selecionado, { observacoes: e.target.value })}
            />
          </Campo>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Toque num dente para registrar estado e plano de tratamento.
        </p>
      )}

      {/* Plano geral */}
      <Campo label="Plano de tratamento geral" htmlFor="odonto-obs">
        <Textarea
          id="odonto-obs"
          rows={2}
          disabled={readOnly}
          value={observacoes}
          onChange={(e) => {
            setObservacoes(e.target.value);
            setSalvo(false);
          }}
          placeholder="Sequência de procedimentos, prioridades, encaminhamentos..."
        />
      </Campo>

      {erro ? <Alerta>{erro}</Alerta> : null}
      {salvo ? <Alerta tipo="info">Odontograma salvo.</Alerta> : null}

      {!readOnly ? (
        <Botao type="button" onClick={salvarAgora} carregando={salvar.isPending}>
          <Save className="h-4 w-4" /> Salvar odontograma
        </Botao>
      ) : null}
    </section>
  );
}
