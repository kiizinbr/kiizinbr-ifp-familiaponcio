/**
 * Tailwind config — apps/web (IFP Connect)
 *
 * Os tokens são consumidos das CSS variables definidas em
 * packages/design-tokens/tokens.css. Isso permite que mudanças
 * de tema por unidade (data-theme="medico", etc.) funcionem
 * sem rebuild do Tailwind.
 */
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  darkMode: ["class"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--ifp-font-family)"],
        garet: ["Garet", "Inter", "sans-serif"],
      },
      colors: {
        // Paleta IFP (acesso direto)
        ifp: {
          orange: {
            DEFAULT: "var(--ifp-orange-primary)",
            mid: "var(--ifp-orange-mid)",
            deep: "var(--ifp-orange-deep)",
          },
          teal: {
            DEFAULT: "var(--ifp-teal-bright)",
            bright: "var(--ifp-teal-bright)",
            deep: "var(--ifp-teal-deep)",
          },
          gray: "var(--ifp-gray)",
          white: "var(--ifp-white)",
          papel: "var(--ifp-papel)",
          tinta: "var(--ifp-tinta)",
          dourado: "var(--ifp-dourado)",
        },
        // Trio da unidade ativa (direção CASA) — muda por data-theme
        unidade: {
          DEFAULT: "var(--unidade)",
          escuro: "var(--unidade-escuro)",
          suave: "var(--unidade-suave)",
        },
        // Aliases semânticos (mudam por data-theme)
        primary: {
          DEFAULT: "var(--color-primary)",
          hover: "var(--color-primary-hover)",
          foreground: "var(--ifp-white)",
        },
        background: "var(--color-bg)",
        surface: "var(--color-surface)",
        foreground: "var(--color-text)",
        muted: {
          DEFAULT: "var(--color-surface)",
          foreground: "var(--color-text-muted)",
        },
        border: "var(--color-border)",
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        danger: "var(--color-danger)",
        info: "var(--color-info)",
      },
      backgroundImage: {
        "ifp-gradient-orange": "var(--ifp-gradient-orange)",
        "ifp-gradient-teal": "var(--ifp-gradient-teal)",
      },
      borderRadius: {
        sm: "var(--ifp-radius-sm)",
        md: "var(--ifp-radius-md)",
        lg: "var(--ifp-radius-lg)",
        xl: "var(--ifp-radius-xl)",
      },
      boxShadow: {
        "ifp-sm": "var(--ifp-shadow-sm)",
        "ifp-md": "var(--ifp-shadow-md)",
        "ifp-lg": "var(--ifp-shadow-lg)",
        casa: "var(--ifp-shadow-casa)",
        "casa-sm": "var(--ifp-shadow-casa-sm)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
