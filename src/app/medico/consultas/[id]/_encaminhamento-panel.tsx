import Link from "next/link";
import type { Route } from "next";
import type { Especialidade, Encaminhamento } from "@prisma/client";
import { SubmitButton } from "@/components/ui/submit-button";
import { criarEncaminhamentoAction } from "./encaminhamento-actions";
import styles from "./prontuario.module.css";

type EncComEsp = Encaminhamento & {
  especialidade: Pick<Especialidade, "nome" | "corDestaque">;
};

const STATUS_LABEL: Record<string, string> = {
  aguardando_agendamento: "Aguardando agendamento",
  agendado: "Agendado",
  cancelado: "Cancelado",
};

export function EncaminhamentoPanel({
  consultaId,
  cidadaoId,
  especialidades,
  encaminhamentos,
  podeEncaminhar,
}: {
  consultaId: string;
  cidadaoId: string;
  especialidades: Pick<Especialidade, "id" | "nome">[];
  encaminhamentos: EncComEsp[];
  podeEncaminhar: boolean;
}) {
  const temPendente = encaminhamentos.some((e) => e.status === "aguardando_agendamento");

  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.tick} />
        <h3 className={styles.cardTitle}>Encaminhar a especialista</h3>
      </div>
      <div className={styles.body}>
        {encaminhamentos.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {encaminhamentos.map((e) => (
              <div key={e.id} style={{ fontSize: 13 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: e.especialidade.corDestaque,
                      flex: "none",
                    }}
                  />
                  <span style={{ fontWeight: 700 }}>{e.especialidade.nome}</span>
                </span>
                <span style={{ color: "var(--text-3)" }}> · {STATUS_LABEL[e.status]}</span>
                {e.motivo ? (
                  <div style={{ color: "var(--text-3)", fontSize: 12 }}>{e.motivo}</div>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {podeEncaminhar ? (
          <form
            action={criarEncaminhamentoAction}
            style={{ display: "flex", flexDirection: "column", gap: 10 }}
          >
            <input type="hidden" name="consultaOrigemId" value={consultaId} />
            <input type="hidden" name="cidadaoId" value={cidadaoId} />
            <select name="especialidadeId" required defaultValue="" className={styles.cidInput}>
              <option value="" disabled>
                Especialidade…
              </option>
              {especialidades.map((esp) => (
                <option key={esp.id} value={esp.id}>
                  {esp.nome}
                </option>
              ))}
            </select>
            <textarea
              name="motivo"
              placeholder="Motivo (ex.: ansiedade e depressão)"
              className={styles.note}
              style={{ minHeight: 64 }}
            />
            <SubmitButton pendingLabel="Encaminhando…">Encaminhar</SubmitButton>
          </form>
        ) : (
          <p className={styles.muted}>Só o profissional/gestão registra encaminhamento.</p>
        )}

        {temPendente && (
          <Link
            href={"/medico/encaminhamentos" as Route}
            className={styles.lk}
            style={{ display: "inline-block", marginTop: 12, fontSize: 12 }}
          >
            Ver fila de agendamento →
          </Link>
        )}
      </div>
    </section>
  );
}
