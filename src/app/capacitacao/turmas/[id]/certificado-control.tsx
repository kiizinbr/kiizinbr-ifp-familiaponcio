import Link from "next/link";
import type { Route } from "next";
import type { StatusMatricula } from "@prisma/client";
import { avaliarElegibilidade } from "@/lib/capacitacao/certificado";
import { emitirCertificadoAction } from "../../actions";
import styles from "../../capacitacao.module.css";

/**
 * Controle de certificado por matrícula (server component). Só aparece para
 * matrícula concluída: link de verificação se já emitido; botão de emitir se
 * elegível (>=80%); aviso curto com o motivo se inelegível. Reusa avaliarElegibilidade.
 */
export function CertificadoControl({
  matriculaId,
  turmaId,
  status,
  presencas,
  certificadoCodigo,
  podeEmitir,
}: {
  matriculaId: string;
  turmaId: string;
  status: StatusMatricula;
  presencas: readonly { presente: boolean }[];
  certificadoCodigo: string | null;
  podeEmitir: boolean;
}) {
  if (status !== "concluido") return null;

  if (certificadoCodigo) {
    return (
      <Link
        href={`/verificar/${certificadoCodigo}` as Route}
        className={`${styles.btn} ${styles.btnSm} ${styles.btnGhost}`}
      >
        🎓 Certificado emitido
      </Link>
    );
  }

  if (!podeEmitir) return null;

  const elig = avaliarElegibilidade(status, presencas);
  if (!elig.elegivel) {
    return (
      <span className={styles.micro} title={elig.motivo ?? ""} style={{ color: "var(--text-3)" }}>
        sem certificado · {elig.percentual}%
      </span>
    );
  }

  return (
    <form action={emitirCertificadoAction}>
      <input type="hidden" name="matriculaId" value={matriculaId} />
      <input type="hidden" name="turmaId" value={turmaId} />
      <button type="submit" className={`${styles.btn} ${styles.btnSm} ${styles.btnGhost}`}>
        🎓 Emitir certificado
      </button>
    </form>
  );
}
