/**
 * Faixa "STAGING" no topo das telas autenticadas. Server component: lê a env
 * de RUNTIME `STAGING_BANNER` (não NEXT_PUBLIC → liga/desliga sem rebuild).
 * Em produção a env fica desligada e o banner some.
 */
export function StagingBanner() {
  if (process.env.STAGING_BANNER !== "1") return null;
  return (
    <div
      style={{
        background: "var(--live)",
        color: "#fff",
        textAlign: "center",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.02em",
        padding: "5px 12px",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      ⚠ STAGING · DADOS DE DEMONSTRAÇÃO — não usar com dados reais
    </div>
  );
}
