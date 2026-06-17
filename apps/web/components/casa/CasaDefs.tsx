/**
 * CasaDefs — definições SVG globais do design CASA (montar UMA vez no root layout).
 * Hoje expõe o clipPath ogival usado pelo CrestAvatar (moldura em escudo gótico).
 */
export function CasaDefs() {
  return (
    <svg width={0} height={0} aria-hidden style={{ position: "absolute" }}>
      <defs>
        <clipPath id="ifp-ogival" clipPathUnits="objectBoundingBox">
          <path d="M0.5,0.04 C0.80,0.04 0.94,0.18 0.94,0.40 C0.94,0.70 0.74,0.92 0.5,1 C0.26,0.92 0.06,0.70 0.06,0.40 C0.06,0.18 0.20,0.04 0.5,0.04 Z" />
        </clipPath>
      </defs>
    </svg>
  );
}
