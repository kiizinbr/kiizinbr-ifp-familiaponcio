import type { Metadata } from "next";
import Script from "next/script";
import "@/styles/site.css";
import { siteHtml } from "@/components/site/site-content";
import { auth } from "@/lib/auth";
import { getLandingPath } from "@/lib/rbac";

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
export default async function LandingPage() {
  // O site institucional é a porta de entrada e aparece SEMPRE — logado ou não
  // (decisão do Erick, 2026-06-09). O pós-login NÃO cai mais aqui: vai pro
  // resolvedor /inicio (login actions), então o `/` pode ser sempre a vitrine sem
  // reintroduzir o "preso na landing" (D5). Logado: o CTA "Acesso ao Sistema" vira
  // "Meu painel" via window.__IFP_HOME__ (lido pelo site.js).
  const session = await auth();
  const homePath = session ? getLandingPath(session) : null;

  return (
    <>
      {/*
        Seguro: `siteHtml` é uma CONSTANTE de build (markup estático do Designer),
        sem nenhuma entrada de usuário — não há vetor de XSS aqui.
      */}
      <div dangerouslySetInnerHTML={{ __html: siteHtml }} />
      {homePath && homePath !== "/login" ? (
        <script
          // homePath vem de getLandingPath (nosso) — JSON.stringify evita injeção.
          dangerouslySetInnerHTML={{ __html: `window.__IFP_HOME__=${JSON.stringify(homePath)}` }}
        />
      ) : null}
      <Script src="/site/site.js" strategy="afterInteractive" />
    </>
  );
}
