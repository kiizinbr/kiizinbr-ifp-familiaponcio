import { atualizarTurmaAction } from "../../actions";
import styles from "../../capacitacao.module.css";

/** Formata uma Date (coluna @db.Date) como yyyy-mm-dd para preencher <input type="date">. */
function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Painel de edição dos dados básicos da turma (datas/local/capacidade). Server component:
 * usa <details> nativo para expandir/colapsar (sem JS) e o form action atualizarTurmaAction.
 * Só é renderizado quando podeEditarTurma(status) — a action revalida a regra no servidor.
 */
export function EditarTurmaPanel({
  turmaId,
  dataInicio,
  dataFim,
  local,
  capacidade,
}: {
  turmaId: string;
  dataInicio: Date;
  dataFim: Date;
  local: string | null;
  capacidade: number;
}) {
  return (
    <div className={styles.card}>
      <details>
        <summary className={styles.cardHeader} style={{ cursor: "pointer", listStyle: "none" }}>
          <span className={styles.tick} />
          <h2 className={styles.cardTitle}>EDITAR TURMA</h2>
        </summary>
        <div className={styles.body}>
          <form action={atualizarTurmaAction} className={styles.form}>
            <input type="hidden" name="turmaId" value={turmaId} />

            <div className={styles.fieldGrid}>
              <label className={styles.label}>
                <span className={styles.labelText}>Início</span>
                <input
                  name="dataInicio"
                  type="date"
                  required
                  defaultValue={toDateInput(dataInicio)}
                  className={styles.input}
                />
              </label>
              <label className={styles.label}>
                <span className={styles.labelText}>Término</span>
                <input
                  name="dataFim"
                  type="date"
                  required
                  defaultValue={toDateInput(dataFim)}
                  className={styles.input}
                />
              </label>
            </div>

            <div className={styles.fieldGrid}>
              <label className={styles.label}>
                <span className={styles.labelText}>Capacidade</span>
                <input
                  name="capacidade"
                  type="number"
                  min={1}
                  required
                  defaultValue={capacidade}
                  className={styles.input}
                />
              </label>
              <label className={styles.label}>
                <span className={styles.labelText}>Local</span>
                <input
                  name="local"
                  defaultValue={local ?? ""}
                  placeholder="Ex: Sala 2 — Sede"
                  className={styles.input}
                />
              </label>
            </div>

            <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
              Salvar alterações
            </button>
          </form>
        </div>
      </details>
    </div>
  );
}
