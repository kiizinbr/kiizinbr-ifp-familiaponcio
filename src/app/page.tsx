import type { Metadata } from "next";
import Script from "next/script";
import "@/styles/site.css";
import { siteHtml } from "@/components/site/site-content";

export const metadata: Metadata = {
  title: "Instituto Família Pôncio — Mudar realidades com abrigo, saúde, educação e amor",
  description:
    "Organização filantrópica em Duque de Caxias/RJ. Cuidamos de famílias e crianças em quatro frentes: saúde, capacitação, esporte e recreação.",
};

/**
 * Site institucional público (one-page) — porta de entrada do sistema.
 *
 * O markup vem do handoff do Designer (ProjetoVisualIFP) e é renderizado como
 * HTML estático (server-rendered, bom p/ SEO). Os comportamentos (splash,
 * dropdown "Acesso ao Sistema", transição de leão até o login, slideshow do
 * hero, count-up, Palavra do Dia) rodam como scripts vanilla por cima do DOM —
 * sem estado React, então não há conflito de hidratação. Os links de acesso
 * (`data-go`) já apontam pras rotas reais `/<unidade>/login`.
 */
export default function LandingPage() {
  return (
    <>
      {/*
        Seguro: `siteHtml` é uma CONSTANTE de build (markup estático do Designer),
        sem nenhuma entrada de usuário — não há vetor de XSS aqui.
      */}
      <div dangerouslySetInnerHTML={{ __html: siteHtml }} />
      <Script src="/site/image-slot.js" strategy="afterInteractive" />
      <Script src="/site/site.js" strategy="afterInteractive" />
    </>
  );
}
