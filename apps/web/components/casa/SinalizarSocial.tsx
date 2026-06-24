"use client";

/**
 * Ponte cross-vertical (D2) — "Sinalizar ao Social".
 *
 * Ação reutilizável nas telas das verticais (médico/educacional/...) onde um
 * profissional acompanha uma família e quer pedir um olhar do Serviço Social.
 * É a ponta que faltava: o endpoint POST /servico-social/ponte já existia e o
 * lado social já consome a fila, mas nenhuma vertical tinha o botão para CRIAR.
 *
 * Padrão da casa: botão + painel inline com useState (não há componente Modal
 * no projeto). Estados de loading/erro/sucesso explícitos. Só aparece para os
 * perfis que o controller aceita no POST (SUPER_ADMIN, PROFISSIONAL,
 * GESTOR_UNIDADE) — checado pela sessão, igual às outras telas.
 */
import { useState } from "react";
import { useSession } from "next-auth/react";
import { CheckCircle2, HeartHandshake } from "lucide-react";

import { Alerta, Botao, Campo, Select, Textarea } from "@/components/ui";
import {
  PRIORIDADE_SINAL_LABEL,
  TIPO_SINALIZACAO_LABEL,
  type PrioridadeSinal,
  type TipoSinalizacao,
} from "@/lib/api";
import { useSinalizarPonte } from "@/lib/use-sinalizar-ponte";

/** Quem pode CRIAR uma sinalização (espelha o @Perfis do POST /ponte). */
const PERFIS_SINALIZAM = ["SUPER_ADMIN", "PROFISSIONAL", "GESTOR_UNIDADE"];

const TIPOS: TipoSinalizacao[] = ["ENCAMINHAMENTO", "OBSERVACAO", "ALERTA"];
const PRIORIDADES: PrioridadeSinal[] = ["NORMAL", "URGENTE"];

/** Membro opcional ("para quem", dentro da família) que pode ser referenciado. */
export interface MembroOpcao {
  id: string;
  nomeCompleto: string;
}

export function SinalizarSocial({
  fichaId,
  membros,
  membroId: membroFixo,
  className,
}: {
  /** Ficha cidadã (família) que será sinalizada. Obrigatório no POST. */
  fichaId: string;
  /** Lista para escolher um membro específico (titular = vazio). Opcional. */
  membros?: MembroOpcao[];
  /** Membro fixo (quando a tela já é de uma pessoa, ex.: a criança). */
  membroId?: string;
  className?: string;
}) {
  const { data: session } = useSession();
  const sinalizar = useSinalizarPonte();

  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState<TipoSinalizacao | "">("");
  const [prioridade, setPrioridade] = useState<PrioridadeSinal>("NORMAL");
  const [membroId, setMembroId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviada, setEnviada] = useState(false);

  const podeSinalizar = session?.perfis?.some((p) => PERFIS_SINALIZAM.includes(p)) ?? false;
  if (!podeSinalizar) return null;

  function fechar() {
    setAberto(false);
    setTipo("");
    setPrioridade("NORMAL");
    setMembroId("");
    setDescricao("");
    setErro(null);
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (descricao.trim().length < 3) {
      setErro("Descreva o motivo (mín. 3 caracteres), sem copiar prontuário/dados sensíveis.");
      return;
    }
    try {
      // membroFixo tem prioridade; senão usa o selecionado (vazio = titular).
      const membroAlvo = membroFixo ?? (membroId || undefined);
      await sinalizar.mutateAsync({
        fichaId,
        descricao: descricao.trim(),
        ...(tipo ? { tipo } : {}),
        prioridade,
        ...(membroAlvo ? { membroId: membroAlvo } : {}),
      });
      setEnviada(true);
      fechar();
    } catch (err) {
      setErro((err as Error).message || "Falha ao enviar a sinalização.");
    }
  }

  // Confirmação curta após enviar (some ao abrir um novo formulário).
  if (enviada && !aberto) {
    return (
      <div className={className}>
        <p className="inline-flex items-center gap-2 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm font-medium text-success">
          <CheckCircle2 className="h-4 w-4" /> Sinalização enviada ao Serviço Social.
        </p>
        <button
          type="button"
          onClick={() => {
            setEnviada(false);
            setAberto(true);
          }}
          className="ml-3 text-sm font-semibold text-primary hover:underline"
        >
          Sinalizar de novo
        </button>
      </div>
    );
  }

  if (!aberto) {
    return (
      <div className={className}>
        <Botao type="button" variante="outline" onClick={() => setAberto(true)}>
          <HeartHandshake className="h-4 w-4" /> Sinalizar ao Social
        </Botao>
      </div>
    );
  }

  return (
    <form
      onSubmit={enviar}
      className={`space-y-3 rounded-lg border border-border bg-surface p-4 ${className ?? ""}`}
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <HeartHandshake className="h-4 w-4 text-primary" /> Sinalizar ao Serviço Social
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo label="Tipo" htmlFor="sin-tipo">
          <Select
            id="sin-tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoSinalizacao | "")}
          >
            <option value="">Padrão</option>
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {TIPO_SINALIZACAO_LABEL[t]}
              </option>
            ))}
          </Select>
        </Campo>

        <Campo label="Prioridade" htmlFor="sin-prio">
          <Select
            id="sin-prio"
            value={prioridade}
            onChange={(e) => setPrioridade(e.target.value as PrioridadeSinal)}
          >
            {PRIORIDADES.map((p) => (
              <option key={p} value={p}>
                {PRIORIDADE_SINAL_LABEL[p]}
              </option>
            ))}
          </Select>
        </Campo>

        {!membroFixo && membros && membros.length > 0 ? (
          <Campo label="Para quem" htmlFor="sin-membro" className="sm:col-span-2">
            <Select id="sin-membro" value={membroId} onChange={(e) => setMembroId(e.target.value)}>
              <option value="">Titular</option>
              {membros.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nomeCompleto}
                </option>
              ))}
            </Select>
          </Campo>
        ) : null}

        <Campo
          label="Motivo"
          htmlFor="sin-desc"
          obrigatorio
          dica="Refira a família sem copiar prontuário/dados sensíveis (LGPD)."
          className="sm:col-span-2"
        >
          <Textarea
            id="sin-desc"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            maxLength={500}
            placeholder="Ex.: Família relata dificuldade de transporte — avaliar apoio."
          />
        </Campo>
      </div>

      {erro ? <Alerta tipo="erro">{erro}</Alerta> : null}

      <div className="flex justify-end gap-2">
        <Botao type="button" variante="ghost" onClick={fechar} disabled={sinalizar.isPending}>
          Cancelar
        </Botao>
        <Botao type="submit" carregando={sinalizar.isPending}>
          Enviar sinalização
        </Botao>
      </div>
    </form>
  );
}
