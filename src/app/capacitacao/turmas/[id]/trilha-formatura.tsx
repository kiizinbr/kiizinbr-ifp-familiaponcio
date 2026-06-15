import clsx from "clsx";
import styles from "../../capacitacao.module.css";

/**
 * Trilha da turma (F2): jornada derivada dos fatos (read-only).
 * Server Component puro — recebe tudo por props, não toca banco.
 *
 * Copy honesta: "Aula X registrada · formatura em DD/MM". Sem "de Y" porque o
 * schema não tem nº de aulas planejado (derivar de cargaHorária mentiria).
 */

const fmtCurto = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

interface TrilhaFormaturaProps {
  /** Datas distintas de chamada já registradas na turma. */
  aulasRegistradas: number;
  /** Data de formatura = dataFim da turma. */
  formatura: Date;
  /** Frequência agregada da turma (0-100): presenças / chamadas. */
  percentualTurma: number;
}

export function TrilhaFormatura({
  aulasRegistradas,
  formatura,
  percentualTurma,
}: TrilhaFormaturaProps) {
  const pct = Math.min(100, Math.max(0, Math.round(percentualTurma)));
  const aulaLabel =
    aulasRegistradas === 1 ? "Aula 1 registrada" : `${aulasRegistradas} aulas registradas`;

  return (
    <div className="card">
      <header>
        <span className="tick" />
        <h3>TRILHA DA TURMA</h3>
      </header>
      <div className="body">
        <div className={styles.meter}>
          <div className={clsx(styles.meterFill)} style={{ width: `${pct}%` }} />
        </div>
        <p className={styles.meterText}>
          <b>{aulaLabel}</b> · formatura em {fmtCurto.format(formatura)} · frequência {pct}%
        </p>
      </div>
    </div>
  );
}
