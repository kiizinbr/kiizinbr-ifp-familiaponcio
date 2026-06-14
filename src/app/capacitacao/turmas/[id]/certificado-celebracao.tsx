"use client";

import { useEffect, useRef } from "react";
import { CertificadoCartao, type CertificadoCartaoDados } from "./certificado-cartao";
import styles from "./certificado.module.css";

/** Paleta canônica IFP do confetti (scaffold cert-capacitacao.html). */
const CONFETTI_CORES = ["#FF772E", "#C24D0F", "#10C2BB", "#007571", "#752C05"] as const;
const CONFETTI_FALLBACK = CONFETTI_CORES[0];
const CONFETTI_QTD = 60;
const CONFETTI_VIDA_MS = 4200;

interface CertificadoCelebracaoProps {
  /** Snapshot do certificado (carregado no server, passado como prop). */
  cert: CertificadoCartaoDados;
  /** QR de verificação já gerado (data URL PNG via qrDataUrl). */
  qr: string;
  /** URL pública de verificação (compartilhada no WhatsApp). */
  verificacaoUrl: string;
  /** URL de download do PDF (rota pública /verificar/{codigo}/pdf). */
  pdfUrl: string;
  /** Primeiro nome do aluno, p/ o cabeçalho de congratulação. */
  primeiroNome: string;
}

/**
 * Tela de celebração pós-emissão (momento WOW): cabeçalho de parabéns + o cartão
 * cerimonial + confetti + ações de compartilhar/baixar. Client Component porque o
 * confetti precisa de efeito + `prefers-reduced-motion`. Não acessa banco: recebe o
 * snapshot, o QR e as URLs já prontos do server (F2 monta as props no page.tsx).
 */
export function CertificadoCelebracao({
  cert,
  qr,
  verificacaoUrl,
  pdfUrl,
  primeiroNome,
}: CertificadoCelebracaoProps) {
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const stage = stageRef.current;
    if (!stage) return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    const nodes: HTMLSpanElement[] = [];

    const dispara = () => {
      for (let i = 0; i < CONFETTI_QTD; i++) {
        const c = document.createElement("span");
        c.className = styles.confetti ?? "";
        c.style.left = `${Math.random() * 100}%`;
        const cor =
          CONFETTI_CORES[(Math.random() * CONFETTI_CORES.length) | 0] ?? CONFETTI_FALLBACK;
        c.style.background = cor;
        c.style.animationDelay = `${Math.random() * 0.6}s`;
        c.style.animationDuration = `${2.2 + Math.random() * 1.4}s`;
        stage.appendChild(c);
        nodes.push(c);
        const id = setTimeout(() => c.remove(), CONFETTI_VIDA_MS);
        timers.push(id);
      }
    };

    dispara();
    const onShare = () => dispara();
    stage.addEventListener("ifp:celebrar", onShare);

    return () => {
      stage.removeEventListener("ifp:celebrar", onShare);
      timers.forEach(clearTimeout);
      nodes.forEach((n) => n.remove());
    };
  }, []);

  const handleShare = () => {
    stageRef.current?.dispatchEvent(new CustomEvent("ifp:celebrar"));
  };

  const wppTexto = encodeURIComponent(
    `Concluí o curso de ${cert.nomeCurso} pelo Instituto Família Pôncio! Verifique meu certificado: ${verificacaoUrl}`,
  );

  return (
    // data-unit garante o acento laranja (--unit) da moldura/régua mesmo se a
    // celebração for montada fora de um ancestral capacitacao (ex.: rota própria).
    <div ref={stageRef} className={styles.stage} data-unit="capacitacao">
      <div className={styles.congrats}>
        <span className={styles.congratsKicker}>Parabéns, {primeiroNome}!</span>
        <h1>Seu certificado está pronto 🎉</h1>
      </div>

      <CertificadoCartao cert={cert} qr={qr} />

      <div className={styles.actionsRow}>
        <a
          className={`btn btn-lg ${styles.wpp}`}
          href={`https://wa.me/?text=${wppTexto}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleShare}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2a10 10 0 0 0-8.5 15.3L2 22l4.8-1.3A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-2.8.8.8-2.8-.2-.3A8 8 0 1 1 12 20z" />
          </svg>
          Compartilhar no WhatsApp
        </a>
        <a
          className="btn btn-secondary btn-lg"
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Baixar PDF
        </a>
      </div>
    </div>
  );
}
