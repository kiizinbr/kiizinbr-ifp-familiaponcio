import { registrarPresencasAction } from "../../actions";
import { resumoFrequencia } from "@/lib/capacitacao/presenca";
import { SubmitButton } from "@/components/ui/submit-button";
import styles from "../../capacitacao.module.css";
import { PresencaToggle } from "./presenca-toggle";
import { PresencaAtalho } from "./presenca-atalho";

type MatriculadoPresenca = {
  id: string;
  nome: string;
  presencas: { presente: boolean }[];
};

/**
 * Registro de presença mobile-first (F1): a instrutora usa no CELULAR (~375px).
 * Cada linha tem um toggle segmentado Presente/Falta com SEMÂNTICA CORRETA (1
 * toque, alvo ≥44px no gate coarse) — substitui o checkbox 22px invertido. Mostra
 * a frequência acumulada por aluna. Server Component — usa form action; idempotente
 * por (matrícula, data). A lógica/contrato da action permanece INTOCADA.
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

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <label className={styles.label} style={{ maxWidth: 240, marginBottom: 0 }}>
              <span className={styles.labelText}>Data da aula</span>
              <input type="date" name="data" defaultValue={hoje} required className="input" />
            </label>
            <PresencaAtalho />
          </div>

          <ul className={styles.rosterList}>
            {matriculados.map((m) => {
              const r = resumoFrequencia(m.presencas);
              return (
                <li key={m.id}>
                  <div className={styles.rosterRow}>
                    <div className={styles.rosterMain}>
                      <div className={styles.rosterName}>{m.nome}</div>
                      <span className={styles.micro}>
                        {r.total > 0 ? `${r.percentual}% · ${r.presentes}/${r.total}` : "Sem aulas"}
                      </span>
                    </div>
                    <PresencaToggle id={m.id} nomeAcessivel={m.nome} />
                  </div>
                </li>
              );
            })}
          </ul>

          <div
            style={{
              position: "sticky",
              bottom: 0,
              paddingTop: 12,
              paddingBottom: 4,
              background: "var(--surface)",
            }}
          >
            <SubmitButton pendingLabel="Salvando presença…" size="lg" className="btn-block">
              Salvar chamada do dia
            </SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
}
