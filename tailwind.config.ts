import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ifp: {
          medico: "rgb(var(--ifp-medico) / <alpha-value>)",
          capacitacao: "rgb(var(--ifp-capacitacao) / <alpha-value>)",
          esportivo: "rgb(var(--ifp-esportivo) / <alpha-value>)",
          educacional: "rgb(var(--ifp-educacional) / <alpha-value>)",
          social: "rgb(var(--ifp-social) / <alpha-value>)",
        },
      },
    },
  },
};

export default config;
