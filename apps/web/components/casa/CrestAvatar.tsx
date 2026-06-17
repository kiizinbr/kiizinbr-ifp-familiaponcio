/**
 * CrestAvatar — avatar em moldura ogival (escudo gótico) da direção CASA.
 * Foto (ou iniciais) recortada no clipPath `#ifp-ogival` (ver <CasaDefs/>),
 * com moldura dourada (ou na cor da unidade). Altura = largura × 1.16.
 */
type CrestAvatarProps = {
  iniciais: string;
  /** largura em px (altura é derivada) */
  size?: number;
  /** moldura dourada (true) ou na cor da unidade (false) */
  gold?: boolean;
  /** se houver foto, substitui as iniciais */
  fotoUrl?: string;
  className?: string;
};

export function CrestAvatar({
  iniciais,
  size = 46,
  gold = true,
  fotoUrl,
  className,
}: CrestAvatarProps) {
  const altura = Math.round(size * 1.16);
  const stroke = gold ? "var(--ifp-dourado)" : "var(--unidade)";
  return (
    <span
      className={className}
      style={{ position: "relative", flex: "0 0 auto", display: "inline-block", width: size, height: altura }}
    >
      <span
        style={{
          width: "100%",
          height: "100%",
          clipPath: "url(#ifp-ogival)",
          WebkitClipPath: "url(#ifp-ogival)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontWeight: 600,
          letterSpacing: "0.04em",
          fontSize: size * 0.32,
          background: fotoUrl
            ? `center / cover no-repeat url(${fotoUrl})`
            : "linear-gradient(150deg, var(--unidade), var(--unidade-escuro))",
        }}
      >
        {fotoUrl ? "" : iniciais}
      </span>
      <svg
        viewBox="0 0 100 116"
        preserveAspectRatio="none"
        aria-hidden
        style={{ position: "absolute", inset: 0, color: stroke, pointerEvents: "none" }}
      >
        <path
          d="M50,4 C78,4 94,22 94,42 C94,74 74,96 50,112 C26,96 6,74 6,42 C6,22 22,4 50,4 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth={4}
        />
      </svg>
    </span>
  );
}
