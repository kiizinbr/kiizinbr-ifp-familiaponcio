"use client";

/**
 * Bloco de DOCUMENTOS MÉDICOS da prancha de atendimento.
 * Emite atestado / receita / declaração; cada um ganha um QR + link de
 * verificação pública e download em PDF (mesmo padrão do certificado da
 * Capacitação). Documento emitido é imutável — corrige-se revogando.
 */
import { useState } from "react";
import { FileCheck, FileDown, FileText, ShieldCheck, XCircle } from "lucide-react";

import { Alerta, Botao, Campo, Input, Select, Textarea } from "@/components/ui";
import { API_BASE_URL } from "@/lib/api";
import {
  TIPO_DOC_LABEL,
  useDocumentosDoAtendimento,
  useEmitirDocumento,
  useRevogarDocumento,
  type TipoDocumentoMedico,
} from "@/lib/use-medico-clinico";

const TIPOS: TipoDocumentoMedico[] = ["ATESTADO", "RECEITA", "DECLARACAO"];

export function DocumentosBloco({
  atendimentoId,
  readOnly,
}: {
  atendimentoId: string;
  readOnly: boolean;
}) {
  const { data } = useDocumentosDoAtendimento(atendimentoId);
  const emitir = useEmitirDocumento();
  const revogar = useRevogarDocumento();

  const [tipo, setTipo] = useState<TipoDocumentoMedico>("ATESTADO");
  const [conteudo, setConteudo] = useState("");
  const [cid10, setCid10] = useState("");
  const [dias, setDias] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [revogandoId, setRevogandoId] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");

  const documentos = data?.items ?? [];

  async function emitirAgora() {
    if (conteudo.trim().length < 3) return;
    setErro(null);
    try {
      await emitir.mutateAsync({
        atendimentoId,
        tipo,
        conteudo: conteudo.trim(),
        cid10: tipo === "ATESTADO" && cid10.trim() ? cid10.trim() : undefined,
        diasAfastamento:
          tipo === "ATESTADO" && dias.trim() ? Number(dias) : undefined,
      });
      setConteudo("");
      setCid10("");
      setDias("");
    } catch (e) {
      setErro((e as Error).message || "Não foi possível emitir o documento.");
    }
  }

  async function revogarAgora(id: string) {
    if (motivo.trim().length < 5) return;
    setErro(null);
    try {
      await revogar.mutateAsync({ id, motivo: motivo.trim() });
      setRevogandoId(null);
      setMotivo("");
    } catch (e) {
      setErro((e as Error).message || "Não foi possível revogar.");
    }
  }

  // Atendimento selado e sem documentos: nada a mostrar.
  if (readOnly && documentos.length === 0) return null;

  return (
    <section className="space-y-4 rounded-[14px] border border-border bg-surface p-4">
      <h3 className="flex items-center gap-2 font-semibold text-foreground">
        <FileText className="h-4 w-4 text-primary" /> Documentos
      </h3>

      {/* Documentos já emitidos */}
      {documentos.map((d) => {
        const url = `${API_BASE_URL}/medico/documentos/verificar/${d.codigoVerificacao}`;
        return (
          <div
            key={d.id}
            className={
              "rounded-md border p-3 " +
              (d.revogadoEm
                ? "border-danger/40 bg-danger/5"
                : "border-success/40 bg-success/5")
            }
          >
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              {d.revogadoEm ? (
                <span className="inline-flex items-center gap-1 text-danger">
                  <XCircle className="h-3.5 w-3.5" /> {TIPO_DOC_LABEL[d.tipo]} revogado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-success">
                  <FileCheck className="h-3.5 w-3.5" /> {TIPO_DOC_LABEL[d.tipo]} emitido
                </span>
              )}
              {d.diasAfastamento ? (
                <span className="text-muted-foreground">
                  · {d.diasAfastamento} dia(s) de afastamento
                </span>
              ) : null}
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{d.conteudo}</p>
            {d.revogadoMotivo ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Motivo da revogação: {d.revogadoMotivo}
              </p>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <a
                href={`${url}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-primary hover:text-primary"
              >
                <FileDown className="h-3.5 w-3.5" /> PDF
              </a>
              <a
                href={`/verificar-documento/${d.codigoVerificacao}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-primary hover:text-primary"
              >
                <ShieldCheck className="h-3.5 w-3.5" /> Verificação pública
              </a>
              {!readOnly && !d.revogadoEm ? (
                revogandoId === d.id ? (
                  <div className="mt-1 w-full space-y-2 rounded-md border border-danger/40 bg-danger/5 p-2">
                    <Campo label="Motivo da revogação" htmlFor={`mot-${d.id}`} obrigatorio>
                      <Input
                        id={`mot-${d.id}`}
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        placeholder="Ex.: erro de digitação; reemitido corrigido."
                      />
                    </Campo>
                    <div className="flex gap-2">
                      <Botao
                        variante="danger"
                        type="button"
                        onClick={() => revogarAgora(d.id)}
                        carregando={revogar.isPending}
                        disabled={motivo.trim().length < 5}
                      >
                        Confirmar revogação
                      </Botao>
                      <Botao
                        variante="outline"
                        type="button"
                        onClick={() => {
                          setRevogandoId(null);
                          setMotivo("");
                        }}
                      >
                        Cancelar
                      </Botao>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setRevogandoId(d.id);
                      setMotivo("");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md border border-danger/40 px-3 py-1.5 text-xs font-medium text-danger transition hover:bg-danger/10"
                  >
                    <XCircle className="h-3.5 w-3.5" /> Revogar
                  </button>
                )
              ) : null}
            </div>
          </div>
        );
      })}

      {/* Emissão de novo documento */}
      {!readOnly ? (
        <div className="space-y-3 rounded-md border border-border bg-muted/40 p-3">
          <div className="grid gap-2 sm:grid-cols-[160px_1fr]">
            <Campo label="Tipo" htmlFor="doc-tipo">
              <Select
                id="doc-tipo"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoDocumentoMedico)}
              >
                {TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {TIPO_DOC_LABEL[t]}
                  </option>
                ))}
              </Select>
            </Campo>
            {tipo === "ATESTADO" ? (
              <div className="grid grid-cols-2 gap-2">
                <Campo label="Dias de afastamento" htmlFor="doc-dias">
                  <Input
                    id="doc-dias"
                    inputMode="numeric"
                    value={dias}
                    onChange={(e) => setDias(e.target.value.replace(/\D/g, ""))}
                    placeholder="Ex.: 3"
                  />
                </Campo>
                <Campo label="CID-10 (opcional)" htmlFor="doc-cid">
                  <Input
                    id="doc-cid"
                    maxLength={10}
                    value={cid10}
                    onChange={(e) => setCid10(e.target.value.toUpperCase())}
                    placeholder="J11"
                  />
                </Campo>
              </div>
            ) : null}
          </div>

          <Campo label="Texto do documento" htmlFor="doc-conteudo" obrigatorio>
            <Textarea
              id="doc-conteudo"
              rows={3}
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              placeholder="Conteúdo do atestado / receita / declaração..."
            />
          </Campo>

          {erro ? <Alerta>{erro}</Alerta> : null}

          <Botao
            type="button"
            onClick={emitirAgora}
            carregando={emitir.isPending}
            disabled={conteudo.trim().length < 3}
          >
            <FileText className="h-4 w-4" /> Emitir {TIPO_DOC_LABEL[tipo].toLowerCase()}
          </Botao>
        </div>
      ) : null}
    </section>
  );
}
