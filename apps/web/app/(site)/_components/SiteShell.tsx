/**
 * Casca do site público. Server Component:
 *   - carrega as fontes do Designer (Hanken Grotesk + IBM Plex Mono) via
 *     next/font/google e expõe como variáveis --site-font-ui/--site-font-mono;
 *   - importa o CSS escopado do site (`.ifp-site`), que NÃO vaza pro app CASA.
 * O conteúdo + interações ficam no client component <SiteInstitucional/>.
 */
import { Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";

import "../site-public.css";
import SiteInstitucional from "./SiteInstitucional";

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export default function SiteShell() {
  return (
    <div
      style={
        {
          "--site-font-ui": hanken.style.fontFamily,
          "--site-font-mono": plexMono.style.fontFamily,
        } as React.CSSProperties
      }
    >
      <SiteInstitucional />
    </div>
  );
}
