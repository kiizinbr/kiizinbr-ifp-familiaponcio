/**
 * Brandmark — o leão coroado oficial do IFP, recolorível.
 *
 * Renderiza a marca via CSS mask + `background-color: currentColor`, então a cor
 * vem do `color` herdado (ex.: `text-primary` ou `style={{ color: "var(--unidade)" }}`).
 * O PNG-máscara vive em `public/leao-oficial-mask.png` (servido por URL, não file://).
 */
type BrandmarkProps = {
  /** lado do quadrado (px) ou qualquer unidade CSS */
  size?: number | string;
  className?: string;
  /** rótulo acessível; some do fluxo se decorativo */
  title?: string;
};

export function Brandmark({ size = 32, className, title }: BrandmarkProps) {
  const dim = typeof size === "number" ? `${size}px` : size;
  const maskUrl = 'url("/leao-oficial-mask.png")';
  return (
    <span
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={className}
      style={{
        display: "inline-block",
        width: dim,
        height: dim,
        backgroundColor: "currentColor",
        WebkitMaskImage: maskUrl,
        maskImage: maskUrl,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}
