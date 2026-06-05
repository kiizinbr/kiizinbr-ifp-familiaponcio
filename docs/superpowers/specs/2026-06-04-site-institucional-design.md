# Spec — Site Institucional Público (Instituto Família Pôncio)

**Data:** 2026-06-04
**Onde:** app IFP Connect (Next.js) — a rota pública `/`
**Status:** ✅ **IMPLEMENTADO no `/` do app (2026-06-04)** — pivot para o **handoff do Claude Designer** (`ProjetoVisualIFP`). A direção C descrita abaixo virou referência histórica do brainstorming; ver **"Implementação real"** logo abaixo.

## Objetivo

Substituir a landing mínima atual (`src/app/page.tsx`, hoje um grid de cards-de-login) por um **site institucional one-page, novo e vibrante** — a cara pública do Instituto Família Pôncio. O mesmo deploy Next.js serve o site público (em `/`) e o sistema interno (atrás do login). Um **"Acesso ao Sistema"** no topo abre um dropdown com as unidades, levando ao login de cada uma.

### Sucesso =

Um visitante (comunidade, parceiro, empresa) abre `/`, entende em segundos o que o Instituto é e faz, navega pelas 4 unidades, sente a identidade (acolhimento + fé equilibrada + transformação social) e, se for da equipe, acessa o sistema pelo dropdown.

## Implementação real (2026-06-04) — handoff do Designer

**Pivot:** em vez de construir a direção C do zero, Erick gerou o site no **Claude Designer** (pacote `C:\Dev\ProjetoVisualIFP (1).zip`), gostou mais que os mocks, e pediu pra implementar. O que está **no ar em `/`**:

- **Site one-page do Designer:** splash com leão · nav · dropdown "Acesso ao Sistema" · hero com **emblema central + 4 medalhões de unidade orbitando** (slideshow das fotos aéreas) · cards de unidade com medalhão temático + adereço · banner aéreo · Quem Somos · galeria "Momentos" · Impacto (count-up) · **"Faça parte"** (voluntário/compartilhe/indique — **sem doação**) · **Palavra do Dia** (versículo diário) · rodapé · **transição de leão** ao entrar no sistema.
- **Mascote/leão resolvido pelo Designer** (dispensou o "mascote-em-faixas" da direção C): `lion-white.png` (sobre disco colorido) + `lion-brown.png` (sobre claro), medalhão na cor da unidade + anel girando + adereço por unidade = o "leão veste a unidade".
- **Arquitetura real (≠ componentes React planejados abaixo):** `src/app/page.tsx` (server) renderiza o markup via `dangerouslySetInnerHTML` a partir da **constante de build** `src/components/site/site-content.ts` (markup estático do Designer, sem input de usuário → sem XSS); estilos em `src/styles/site.css` (importado só na `/`); comportamentos vanilla em `/public/site/site.js` + `image-slot.js` (via `next/script`); assets em `/public/{loaders,fotos}`. `data-go` reescrito pras rotas reais `/<unidade>/login`. `public/**` adicionado ao ignore do ESLint (scripts vendados).
- **Serviço Social = transversal** (atende DENTRO de todas as unidades, visita todas dia a dia): fora dos cards públicos; no dropdown vira grupo "Equipe interna" com texto "Atende em todas as unidades, dia a dia".
- **Gates verdes:** format + typecheck + lint + build. **Pendências:** otimizar fotos aéreas (~2–3MB cada); fotos externas (Wix) → trocar por locais/placeholder; e2e; a transição/animações de leão são suprimidas sob `prefers-reduced-motion` (servidor do Erick tem isso ligado → ele não vê a transição; visitante normal vê — avaliar exceção como no `site-c`).
- **Gotcha de ambiente:** dev server roda no WSL observando `/mnt/c` (FS Windows) → **inotify não pega edições do lado Windows**; mudança em arquivo compilado exige **reiniciar o `pnpm dev`** (arquivos estáticos do `public/` atualizam sozinhos). Verify/build via `wsl ... bash /mnt/c/.../script.sh` **pelo PowerShell** (o Bash-tool/Git-Bash mangla o path `/mnt/c`).

## Decisões fechadas (com Erick, 2026-06-04)

- **§D1 Escopo:** one-page premium (cresce pra multi-página depois, sem retrabalho).
- **§D2 Tom de fé:** equilibrado — fé com lugar de honra (versículo + valores no "Quem Somos"), mas hero/unidades comunicam transformação social.
- **§D3 Conteúdo:** copy escrita por nós (abaixo); assets = o que já temos (logo, leão, foto aérea); números/fotos-de-unidade/contato = placeholders marcados, Erick troca depois.
- **§D4 SEM doação:** **nenhum** pedido público de doação. Apoiadores são empresas/empresários → a relação é de **Parceria** institucional. A seção de apoio chama-se "Parcerias".
- **§D5 Direção visual: C — Imersivo Color-Forward** (vibrante, cor saturada do brandbook, faixas por unidade). Mockup de referência: **`public/lab/site-c.html`**.
- **§D6 Acesso ao Sistema:** dropdown no topo (não tela intermediária) → login de cada unidade.
- **§D7 Serviço Social NÃO é unidade:** é apoio interno/triagem (define quem pode ser atendido), transversal ao instituto — não é uma frente de atendimento ao público. Sai das faixas públicas e da contagem de "unidades" (passam a ser **4**: médico, capacitação, esportivo, recreativo). Mantém acesso ao sistema (`/social/login`) no dropdown, sob um grupo **"Equipe interna"** (junto do acesso executivo). Obs.: a mesma imprecisão existe no sistema (tratar `/social` como "unidade") — revisar fora deste escopo.

## Direção visual (C — Imersivo Color-Forward)

Referência viva: **`public/lab/site-c.html`** (a implementação real recria isto como página Next). Características:

- **Cor protagonista:** campos saturados do brandbook; **cada unidade é uma faixa full-bleed no seu acento** (médico=teal `#007571`, capacitação=laranja `#FF772E`, esportivo=laranja-escuro `#C24D0F`, recreativo=teal-claro `#10C2BB`), com gradiente rico dentro da própria família de cor, watermark-glyph gigante, numeração mono (01–04) e padrão diagonal sutil. (Cinza saiu — era do Serviço Social, que não é unidade.)
- **Hero imersivo:** cena de cor cheia (gradiente teal-escuro→marrom) + fita diagonal laranja + foto (`/unidades/medico.jpg`) + glows desfocados; "spectrum bar" das 5 cores logo abaixo.
- **Versículo** (Provérbios 11:25) e **Parcerias** como painéis imersivos de cor; **Impacto** em campos/cards de cor cheia.
- **Acabamento:** Hanken Grotesk (títulos/UI) + IBM Plex Mono (kickers/números), grão sutil, profundidade (sombras/camadas), **reveals no scroll** e micro-interações — tudo atrás de `prefers-reduced-motion`. Responsivo mobile-first.

## Mascote animado — "o leão veste a unidade" (asset do Erick)

Erick criou (export `C:\Dev\Mascote Loaders (offline).html`) uma família de **loaders do leão por unidade**: o **leão real** (a logo existente) entra num **medalhão da cor da unidade**, com um adereço em ícone e uma **personalidade de movimento** própria — "mesmo mascote, muda a cor e o jeito". Técnica confirmada na sondagem: **CSS keyframes puro** (14 animações), leão = `<img>` da logo existente, anel/medalhão em SVG+CSS — **sem Lottie/canvas** → trivial de portar.

- **Componente:** `src/components/site/leao-mascote.tsx` (+ estilos no `site.module.css`) — **parametrizado por unidade/acento** (`<LeaoMascote unit="medico" />`); a cor vem do acento da unidade. O CSS (keyframes + classes) é **extraído do export do Erick** (renderizar no browser → capturar CSS/markup) e adaptado pro React. Leão = `/logo/ifp-symbol.png`. **Respeita `prefers-reduced-motion`** (medalhão estático como fallback).
- **Uso 1 (recomendado — emblema vivo):** em cada faixa full-bleed de unidade (direção C), o leão animado na cor da unidade vira o emblema central — anima ao entrar na viewport / no hover.
- **Uso 2 (loader de transição):** ao clicar "Acesso ao Sistema → [unidade]", mostra o leão **na cor daquela unidade** enquanto o login carrega — ponte poética site↔sistema (aparece no clique, antes da navegação).

## Arquitetura / implementação

A página é construída **de verdade no app** (não fica como HTML do lab):

- **`src/app/page.tsx`** (server component) — reescrita: renderiza as seções do site. Substitui o conteúdo atual.
- **`src/components/site/site.module.css`** — CSS Module com o estilo imersivo do site público (é uma cara PRÓPRIA, distinta da "ferramenta clínica" do kit). Reusa as **fontes self-hostadas** (Hanken/IBM Plex já em `/public/fonts`) e a **paleta do brandbook** (`--ifp-*` / hexes), mas o layout/seções são do site. NÃO depende do `.ifp-kit`. Os componentes de `src/components/site/` importam ele.
- **`src/components/site/acesso-sistema.tsx`** (client) — o botão "Acesso ao Sistema" + dropdown (toggle), com os links das 4 unidades `/${slug}/login` (medico, capacitacao, esportivo, recreativo) sob "Unidades", e um grupo **"Equipe interna"** com Serviço Social (`/social/login`) + "Acesso executivo" (`/poncio/login`). Fecha no clique-fora/Esc.
- **`src/components/site/reveal.tsx`** (client, opcional) — wrapper de reveal-on-scroll via IntersectionObserver, respeitando `prefers-reduced-motion`. Ou um único client component de "site interactions".
- **`src/components/site/leao-mascote.tsx`** (+ CSS no module) — o **mascote animado parametrizado por unidade** (ver seção "Mascote animado"); usado como emblema vivo nas faixas de unidade e como loader de transição pro login.
- **Seções** como componentes server pequenos (Hero, UnidadesBands, QuemSomos, Impacto, Parcerias, ContatoRodape) em `src/components/site/` — cada um uma responsabilidade, fáceis de editar/testar.
- **Dados das unidades** reusam `src/lib/unidades.ts` (nomes, slugs, cores) onde fizer sentido; a copy descritiva fica no componente/numa const.
- **Não** quebra o sistema: `/medico`, `/login`, etc. seguem iguais; só a `/` muda. O `getLandingPath`/proxy não é afetado (a `/` pública é aberta).

## Conteúdo (copy aprovada — placeholders marcados)

- **Hero:** eyebrow "Instituto Família Pôncio · Duque de Caxias / RJ"; título "Mudar realidades com abrigo, saúde, educação e amor."; subtítulo "Cuidamos de famílias e crianças de Duque de Caxias em cinco frentes — saúde, capacitação, esporte, recreação e acolhimento social."; CTAs "Conheça nossas unidades" + "Fale com a gente" (**sem doação**).
- **Unidades (4):** Centro Médico (saúde + odontológico), Centro de Capacitação (cursos/capacitação profissional), Centro Esportivo (esporte + Jiu-Jitsu), Centro Recreativo (recreação/cuidado infantil) — descrições no mockup. **Serviço Social NÃO entra como unidade** (é apoio interno/triagem); fica fora das faixas públicas, só com acesso ao sistema no dropdown ("Equipe interna").
- **Quem Somos:** Missão "Mudar realidades através de abrigo, amor, saúde, educação e capacitação profissional."; Visão "Ser referência em todas as esferas de atendimento ao próximo."; Valores "Familiares e direcionados pelos princípios da palavra de Deus."; origem (experiência espiritual, cuidar de crianças); **Versículo** Provérbios 11:25 em destaque.
- **Impacto (placeholder\*):** 4 unidades · +500 famílias* · +8 anos* · centenas de crianças\* (marcados "a confirmar").
- **Parcerias:** "Construído com quem acredita." — empresas/parceiros caminham com o instituto; CTA "Seja um parceiro"/"Fale com a gente" → contato. **Nunca "doar".**
- **Contato/rodapé:** Duque de Caxias / RJ; telefone/WhatsApp/e-mail/endereço = placeholder "a confirmar"; redes Instagram + YouTube @institutofamiliaponcio; rodapé "© Instituto Família Pôncio — organização filantrópica sem fins lucrativos".

## Acessibilidade & responsividade

- Contraste AA (cuidado com texto sobre faixas claras — ex.: recreativo teal-claro usa texto escuro). Foco visível nos links/dropdown. Dropdown navegável por teclado (abre/fecha, Esc, setas). `prefers-reduced-motion` desliga animações restaurando o estado final. Mobile-first com breakpoints reais.

## Verificação

- Build verde (ritual). `/` renderiza o site novo; dropdown "Acesso ao Sistema" leva a cada `/${slug}/login`. **O mascote (leão) anima na cor de cada unidade** e fica estático com `prefers-reduced-motion`. Responsivo (mobile/desktop). Sem nenhuma menção a doação. Visual fiel à direção C (screenshots before/after). Deploy: entra no próximo update da VM staging.

## Fora de escopo (agora)

- Multi-página (Quem Somos / Eventos-Poncioland / Unidade-por-página) — fase futura.
- Fotos reais das unidades, números de impacto reais, contato real (Erick fornece → troca de placeholders).
- Formulário de contato funcional (envio de e-mail) — por ora "Fale com a gente" pode ser link `mailto:`/WhatsApp placeholder ou âncora.
- Qualquer captação/doação online.
- SEO avançado/metadata rica, multi-idioma, blog/notícias.
