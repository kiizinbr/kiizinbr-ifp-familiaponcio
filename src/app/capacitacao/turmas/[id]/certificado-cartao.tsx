import Image from "next/image";
import styles from "./certificado.module.css";

const fmtData = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

/** Snapshot mínimo do certificado (o que o próprio diploma mostra). */
export interface CertificadoCartaoDados {
  codigo: string;
  nomeAluno: string;
  nomeCurso: string;
  cargaHoraria: number;
  percentualFrequencia: number;
  emitidoEm: Date;
}

interface CertificadoCartaoProps {
  cert: CertificadoCartaoDados;
  /** QR de verificação já gerado (data URL PNG via qrDataUrl). Omitido = sem QR. */
  qr?: string;
  /** Nome de quem assina (coordenação). Default institucional. */
  assinatura?: string;
}

/**
 * Cartão cerimonial do certificado — porta o `.cert` do scaffold cert-capacitacao.html
 * para React. Server Component puro (recebe o snapshot já carregado + QR pronto): a
 * moldura dupla, o leão grande e a régua sob o nome saem laranja via `--unit` (herda
 * de `data-unit="capacitacao"` do ancestral). Reusado pela celebração pós-emissão e
 * pela verificação pública. NÃO contém lógica de emissão — só apresentação.
 */
export function CertificadoCartao({
  cert,
  qr,
  assinatura = "Coordenação",
}: CertificadoCartaoProps) {
  return (
    <div className={styles.cert}>
      <Image className={styles.lion} src="/logo/ifp-symbol.png" alt="IFP" width={88} height={88} />
      <div className={styles.kicker}>Instituto Família Pôncio</div>
      <div className={styles.title}>Certificado de Conclusão</div>
      <div className={styles.bodyText}>Certificamos que</div>
      <div className={styles.name}>{cert.nomeAluno}</div>
      <div className={styles.bodyText}>
        concluiu com aproveitamento o curso de <b>{cert.nomeCurso}</b> ({cert.cargaHoraria}h), com
        frequência de <b>{cert.percentualFrequencia}%</b>, pela trilha CapacitaSUAS.
      </div>

      <div className={styles.foot}>
        <div className={styles.sig}>
          <div className={styles.sigLine} />
          <div className={styles.sigName}>{assinatura}</div>
          <div className={styles.sigRole}>Capacitação</div>
        </div>

        {qr ? (
          <div className={styles.qrWrap}>
            {/* QR real (PNG data URL) — escaneável → /verificar/{codigo} */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.qr} src={qr} alt={`QR de verificação ${cert.codigo}`} />
            <span className={styles.qrLabel}>VALIDAR · {cert.codigo}</span>
          </div>
        ) : (
          <div className={styles.qrWrap}>
            <span className={styles.qrLabel}>{cert.codigo}</span>
          </div>
        )}

        <div className={styles.sig}>
          <div className={styles.sigLine} />
          <div className={styles.sigName}>{fmtData.format(cert.emitidoEm)}</div>
          <div className={styles.sigRole}>Data de emissão</div>
        </div>
      </div>
    </div>
  );
}
