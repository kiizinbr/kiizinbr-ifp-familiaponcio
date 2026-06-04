# Spec — Site Institucional Público (Instituto Família Pôncio)

**Data:** 2026-06-04
**Onde:** app IFP Connect (Next.js) — a rota pública `/`
**Status:** direção visual **C (Imersivo Color-Forward)** aprovada por Erick via mockup; conteúdo/tom definidos.

## Objetivo

Substituir a landing mínima atual (`src/app/page.tsx`, hoje um grid de cards-de-login) por um **site institucional one-page, novo e vibrante** — a cara pública do Instituto Família Pôncio. O mesmo deploy Next.js serve o site público (em `/`) e o sistema interno (atrás do login). Um **"Acesso ao Sistema"** no topo abre um dropdown com as unidades, levando ao login de cada uma.

### Sucesso =
Um visitante (comunidade, parceiro, empresa) abre `/`, entende em segundos o que o Instituto é e faz, navega pelas 5 unidades, sente a identidade (acolhimento + fé equilibrada + transformação social) e, se for da equipe, acessa o sistema pelo dropdown.

## Decisões fechadas (com Erick, 2026-06-04)

- **§D1 Escopo:** one-page premium (cresce pra multi-página depois, sem retrabalho).
- **§D2 Tom de fé:** equilibrado — fé com lugar de honra (versículo + valores no "Quem Somos"), mas hero/unidades comunicam transformação social.
- **§D3 Conteúdo:** copy escrita por nós (abaixo); assets = o que já temos (logo, leão, foto aérea); números/fotos-de-unidade/contato = placeholders marcados, Erick troca depois.
- **§D4 SEM doação:** **nenhum** pedido público de doação. Apoiadores são empresas/empresários → a relação é de **Parceria** institucional. A seção de apoio chama-se "Parcerias".
- **§D5 Direção visual: C — Imersivo Color-Forward** (vibrante, cor saturada do brandbook, faixas por unidade). Mockup de referência: **`public/lab/site-c.html`**.
- **§D6 Acesso ao Sistema:** dropdown no topo (não tela intermediária) → login de cada unidade.

## Direção visual (C — Imersivo Color-Forward)

Referência viva: **`public/lab/site-c.html`** (a implementação real recria isto como página Next). Características:
- **Cor protagonista:** campos saturados do brandbook; **cada unidade é uma faixa full-bleed no seu acento** (médico=teal `#007571`, capacitação=laranja `#FF772E`, esportivo=laranja-escuro `#C24D0F`, recreativo=teal-claro `#10C2BB`, social=cinza `#4A4A49`), com gradiente rico dentro da própria família de cor, watermark-glyph gigante, numeração mono (01–05) e padrão diagonal sutil.
- **Hero imersivo:** cena de cor cheia (gradiente teal-escuro→marrom) + fita diagonal laranja + foto (`/unidades/medico.jpg`) + glows desfocados; "spectrum bar" das 5 cores logo abaixo.
- **Versículo** (Provérbios 11:25) e **Parcerias** como painéis imersivos de cor; **Impacto** em campos/cards de cor cheia.
- **Acabamento:** Hanken Grotesk (títulos/UI) + IBM Plex Mono (kickers/números), grão sutil, profundidade (sombras/camadas), **reveals no scroll** e micro-interações — tudo atrás de `prefers-reduced-motion`. Responsivo mobile-first.

## Arquitetura / implementação

A página é construída **de verdade no app** (não fica como HTML do lab):
- **`src/app/page.tsx`** (server component) — reescrita: renderiza as seções do site. Substitui o conteúdo atual.
- **`src/components/site/site.module.css`** — CSS Module com o estilo imersivo do site público (é uma cara PRÓPRIA, distinta da "ferramenta clínica" do kit). Reusa as **fontes self-hostadas** (Hanken/IBM Plex já em `/public/fonts`) e a **paleta do brandbook** (`--ifp-*` / hexes), mas o layout/seções são do site. NÃO depende do `.ifp-kit`. Os componentes de `src/components/site/` importam ele.
- **`src/components/site/acesso-sistema.tsx`** (client) — o botão "Acesso ao Sistema" + dropdown (toggle), com os links `/${slug}/login` (medico, capacitacao, esportivo, recreativo, social) + "Acesso executivo" `/poncio/login`. Fecha no clique-fora/Esc.
- **`src/components/site/reveal.tsx`** (client, opcional) — wrapper de reveal-on-scroll via IntersectionObserver, respeitando `prefers-reduced-motion`. Ou um único client component de "site interactions".
- **Seções** como componentes server pequenos (Hero, UnidadesBands, QuemSomos, Impacto, Parcerias, ContatoRodape) em `src/components/site/` — cada um uma responsabilidade, fáceis de editar/testar.
- **Dados das unidades** reusam `src/lib/unidades.ts` (nomes, slugs, cores) onde fizer sentido; a copy descritiva fica no componente/numa const.
- **Não** quebra o sistema: `/medico`, `/login`, etc. seguem iguais; só a `/` muda. O `getLandingPath`/proxy não é afetado (a `/` pública é aberta).

## Conteúdo (copy aprovada — placeholders marcados)

- **Hero:** eyebrow "Instituto Família Pôncio · Duque de Caxias / RJ"; título "Mudar realidades com abrigo, saúde, educação e amor."; subtítulo "Cuidamos de famílias e crianças de Duque de Caxias em cinco frentes — saúde, capacitação, esporte, recreação e acolhimento social."; CTAs "Conheça nossas unidades" + "Fale com a gente" (**sem doação**).
- **Unidades (5):** Centro Médico (saúde + odontológico), Centro de Capacitação (cursos/capacitação profissional), Centro Esportivo (esporte + Jiu-Jitsu), Centro Recreativo (recreação/cuidado infantil), Serviço Social (acolhimento + apoio a TEA/TDAH) — descrições no mockup.
- **Quem Somos:** Missão "Mudar realidades através de abrigo, amor, saúde, educação e capacitação profissional."; Visão "Ser referência em todas as esferas de atendimento ao próximo."; Valores "Familiares e direcionados pelos princípios da palavra de Deus."; origem (experiência espiritual, cuidar de crianças); **Versículo** Provérbios 11:25 em destaque.
- **Impacto (placeholder*):** 5 unidades · +500 famílias* · +8 anos* · centenas de crianças* (marcados "a confirmar").
- **Parcerias:** "Construído com quem acredita." — empresas/parceiros caminham com o instituto; CTA "Seja um parceiro"/"Fale com a gente" → contato. **Nunca "doar".**
- **Contato/rodapé:** Duque de Caxias / RJ; telefone/WhatsApp/e-mail/endereço = placeholder "a confirmar"; redes Instagram + YouTube @institutofamiliaponcio; rodapé "© Instituto Família Pôncio — organização filantrópica sem fins lucrativos".

## Acessibilidade & responsividade

- Contraste AA (cuidado com texto sobre faixas claras — ex.: recreativo teal-claro usa texto escuro). Foco visível nos links/dropdown. Dropdown navegável por teclado (abre/fecha, Esc, setas). `prefers-reduced-motion` desliga animações restaurando o estado final. Mobile-first com breakpoints reais.

## Verificação

- Build verde (ritual). `/` renderiza o site novo; dropdown "Acesso ao Sistema" leva a cada `/${slug}/login`. Responsivo (mobile/desktop). Sem nenhuma menção a doação. Visual fiel à direção C (screenshots before/after). Deploy: entra no próximo update da VM staging.

## Fora de escopo (agora)

- Multi-página (Quem Somos / Eventos-Poncioland / Unidade-por-página) — fase futura.
- Fotos reais das unidades, números de impacto reais, contato real (Erick fornece → troca de placeholders).
- Formulário de contato funcional (envio de e-mail) — por ora "Fale com a gente" pode ser link `mailto:`/WhatsApp placeholder ou âncora.
- Qualquer captação/doação online.
- SEO avançado/metadata rica, multi-idioma, blog/notícias.
