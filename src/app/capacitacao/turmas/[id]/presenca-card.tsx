import { registrarPresencasAction } from "../../actions";
import { resumoFrequencia } from "@/lib/capacitacao/presenca";
import styles from "../../capacitacao.module.css";

type MatriculadoPresenca = {
  id: string;
  nome: string;
  presencas: { presente: boolean }[];
};

/**
 * Registro de presença mobile-first (F1.A.2): cada linha é um rótulo tappável com
 * checkbox (default = presente; toque marca falta). Mostra a frequência acumulada
 * por aluna. Server component — usa form action; idempotente por (matrícula, data).
 */
export function PresencaCard({
  turmaId,
  matriculados,
  hoje,
}: {
  turmaId: string;
  matriculados: MatriculadoPresenca[];
  hoje: string;
}) {
  return (
    <div className={styles.card} style={{ marginTop: 22 }}>
      <div className={styles.cardHeader}>
        <span className={styles.tick} />
        <h2 className={styles.cardTitle}>REGISTRAR PRESENÇA</h2>
      </div>
      <div className={styles.body}>
        <form action={registrarPresencasAction}>
          <input type="hidden" name="turmaId" value={turmaId} />
          <input type="hidden" name="roster" value={matriculados.map((m) => m.id).join(",")} />

          <label className={styles.label} style={{ maxWidth: 240 }}>
            <span className={styles.labelText}>Data da aula</span>
            <input type="date" name="data" defaultValue={hoje} required className={styles.select} />
          </label>

          <ul style={{ listStyle: "none", margin: "14px 0", padding: 0, display: "grid", gap: 6 }}>
            {matriculados.map((m) => {
              const r = resumoFrequencia(m.presencas);
              return (
                <li key={m.id}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "12px 14px",
                      border: "1px solid var(--line)",
                      borderRadius: 10,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      name={`p_${m.id}`}
                      defaultChecked
                      style={{ width: 22, height: 22, flex: "none" }}
                    />
                    <span style={{ flex: 1, color: "var(--text)" }}>{m.nome}</span>
                    <span className={styles.micro}>
                      {r.total > 0 ? `${r.percentual}% · ${r.presentes}/${r.total}` : "—"}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
            Salvar presença do dia
          </button>
        </form>
      </div>
    </div>
  );
}
