"use client";

/**
 * Site institucional público (one-page) — porta de entrada do IFP Connect.
 * Portado 1:1 do kit do Designer (site-institucional/"Site Institucional.html"
 * + site.css + site.js). Tom: energético/vibrante, fé com lugar de honra,
 * SEM doação, SEM parcerias.
 *
 * É um único client component porque o conteúdo é estático (sem dados de
 * servidor) e todas as interações do site.js viram efeitos React aqui:
 *   - splash de entrada (1x por sessão)
 *   - sombra da nav ao rolar
 *   - dropdown "Acesso ao Sistema" → /login?unidade=<slug> com transição-leão
 *   - hero slideshow sincronizado com os medalhões orbitando
 *   - count-up dos números (IntersectionObserver)
 *   - reveals on-scroll
 *   - "Palavra do Dia" (popup 1x/dia por localStorage)
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  ACESSO_INTERNO,
  ACESSO_UNIDADES,
  HERO_SLIDES,
  REFLECTIONS,
  type AcessoItem,
} from "./data";
import {
  ArrowRightBig,
  ArrowRightIcon,
  ChevronDown,
  ClockIcon,
  CloseIcon,
  EyeIcon,
  GradIcon,
  GridIcon,
  HeartIcon,
  InstagramIcon,
  LockIcon,
  MailIcon,
  MapPinIcon,
  MedalIcon,
  PhoneIcon,
  PinIcon,
  ShareIcon,
  ShieldCheckIcon,
  SmileIcon,
  ToothIcon,
  UsersIcon,
  YoutubeIcon,
} from "./icons";

const LION = "/site/loaders/lion-white.png";

/* Conteúdo das unidades (cards informativos — NÃO logam). */
const UNIT_CARDS = [
  {
    tag: "Saúde",
    u1: "#007571",
    u2: "#10c2bb",
    img: "https://static.wixstatic.com/media/fb51a3_4e5eaeaab2f84088b57c1258cd289010~mv2.jpg/v1/fill/w_880,h_560,al_c,q_85,enc_avif,quality_auto/medico.jpg",
    alt: "Atendimento odontológico no Centro Médico",
    prop: <ToothIcon />,
    nome: "Centro Médico",
    desc: "Atendimento de saúde e odontológico para a comunidade, com acolhimento e dignidade.",
    feats: ["Clínica", "Odontologia", "Triagem"],
  },
  {
    tag: "Educação",
    u1: "#ff772e",
    u2: "#c24d0f",
    img: "https://static.wixstatic.com/media/fb51a3_14fdccc7a24e4936b0ced5530bb5394a~mv2.jpg/v1/fill/w_880,h_560,al_c,q_85,enc_avif,quality_auto/capacitacao.jpg",
    alt: "Curso de barbearia no Centro de Capacitação",
    prop: <GradIcon />,
    nome: "Centro de Capacitação",
    desc: "Cursos e capacitação profissional que abrem portas e geram autonomia para o futuro.",
    feats: ["Cursos", "Profissionalizante", "Certificação"],
  },
  {
    tag: "Esporte & disciplina",
    u1: "#c24d0f",
    u2: "#752c05",
    img: "https://static.wixstatic.com/media/fb51a3_825d4d74bde84711a87fa15409c2dbe6~mv2.jpg/v1/fill/w_880,h_560,al_c,q_85,enc_avif,quality_auto/esportivo.jpg",
    alt: "Aula de Jiu-Jitsu no Centro Esportivo",
    prop: <MedalIcon />,
    nome: "Centro Esportivo",
    desc: "Esporte e disciplina que formam caráter — incluindo turmas de Jiu-Jitsu para crianças e jovens.",
    feats: ["Jiu-Jitsu", "Disciplina", "Turmas"],
  },
  {
    tag: "Cuidado infantil",
    u1: "#10c2bb",
    u2: "#1a9d6b",
    img: "https://static.wixstatic.com/media/fb51a3_32fba3b6b23949b0b7208b8167f27635~mv2.jpg/v1/fill/w_880,h_560,al_c,q_85,enc_avif,quality_auto/recreativo.jpg",
    alt: "Crianças do Centro Recreativo",
    prop: <SmileIcon />,
    nome: "Centro Recreativo",
    desc: "Recreação e cuidado infantil em um espaço seguro, alegre e cheio de afeto.",
    feats: ["Recreação", "Espaço seguro", "Crianças"],
  },
];

const GALLERY = [
  { cls: "tall", src: "https://static.wixstatic.com/media/fb51a3_ecc8af3a4ec54bc794ba0ea383612d72~mv2.jpg/v1/fill/w_640,h_800,al_c,q_85,enc_avif,quality_auto/g1.jpg", alt: "Jiu-Jitsu no Centro Esportivo", u: "Centro Esportivo", cap: "Jiu-Jitsu que forma caráter" },
  { cls: "wide", src: "/site/fotos/aerea-capacitacao.jpg", alt: "Vista aérea do Centro de Capacitação", u: "Centro de Capacitação", cap: "Nossa sede, vista de cima" },
  { cls: "", src: "https://static.wixstatic.com/media/fb51a3_8a99f7065c5e40689890a4c64fad4177~mv2.jpg/v1/fill/w_600,h_500,al_c,q_85,enc_avif,quality_auto/g3.jpg", alt: "Pintura no Centro Recreativo", u: "Centro Recreativo", cap: "Arte e afeto" },
  { cls: "", src: "https://static.wixstatic.com/media/fb51a3_f8e6cda03d17449a9ff2ea5f62fe9361~mv2.jpg/v1/fill/w_600,h_500,al_c,q_85,enc_avif,quality_auto/g4.jpg", alt: "Curso de design de sobrancelha", u: "Centro de Capacitação", cap: "Design de sobrancelha" },
  { cls: "", src: "https://static.wixstatic.com/media/fb51a3_1115adae750b412085bb23120cc6a4d2~mv2.jpg/v1/fill/w_600,h_500,al_c,q_85,enc_avif,quality_auto/g5.jpg", alt: "Educação infantil no Centro Recreativo", u: "Centro Recreativo", cap: "Cuidar brincando" },
  { cls: "", src: "https://static.wixstatic.com/media/fb51a3_5d9946aaf4d74c7899d907e132b99d46~mv2.jpg/v1/fill/w_600,h_500,al_c,q_85,enc_avif,quality_auto/g6.jpg", alt: "Curso de cabeleireiro", u: "Centro de Capacitação", cap: "Cabeleireiro profissional" },
];

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export default function SiteInstitucional() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const reduce = useRef(false);

  const [splashGone, setSplashGone] = useState(false);
  const [navScrolled, setNavScrolled] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const [dailyOpen, setDailyOpen] = useState(false);

  // transição-leão ao navegar para o login da unidade
  const [transition, setTransition] = useState<{ phrase: string; u1: string; u2: string; ox: number; oy: number } | null>(null);

  // ----- prefers-reduced-motion (uma vez) -----
  useEffect(() => {
    reduce.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // ----- SPLASH (1x por sessão) -----
  useEffect(() => {
    const seen = sessionStorage.getItem("ifp-splash-seen");
    if (seen) {
      setSplashGone(true);
      return;
    }
    sessionStorage.setItem("ifp-splash-seen", "1");
    const t = setTimeout(() => setSplashGone(true), reduce.current ? 250 : 2000);
    return () => clearTimeout(t);
  }, []);

  // trava o scroll do <body> enquanto splash/daily/transição estiverem ativos
  useEffect(() => {
    const lock = !splashGone || dailyOpen || transition !== null;
    document.body.style.overflow = lock ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [splashGone, dailyOpen, transition]);

  // ----- NAV: sombra ao rolar -----
  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ----- HERO slideshow (auto a cada 4,4s; pausa no hover) -----
  const heroPaused = useRef(false);
  useEffect(() => {
    if (reduce.current) return;
    const id = setInterval(() => {
      if (!heroPaused.current) setHeroIndex((i) => (i + 1) % HERO_SLIDES.length);
    }, 4400);
    return () => clearInterval(id);
  }, []);

  // ----- COUNT-UP + REVEAL on-scroll (IntersectionObserver) -----
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const animateCount = (el: Element) => {
      const target = parseInt(el.getAttribute("data-count") || "0", 10);
      const prefix = el.getAttribute("data-prefix") || "";
      if (reduce.current) {
        el.textContent = prefix + target.toLocaleString("pt-BR");
        return;
      }
      const dur = 1400;
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min((now - start) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = prefix + Math.round(target * eased).toLocaleString("pt-BR");
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          en.target.classList.add("in");
          en.target.querySelectorAll?.("[data-count]").forEach(animateCount);
          if (en.target.hasAttribute("data-count")) animateCount(en.target);
          io.unobserve(en.target);
        });
      },
      { threshold: 0.18, rootMargin: "0px 0px -8% 0px" },
    );

    root.querySelectorAll(".reveal").forEach((el) => io.observe(el));
    root.querySelectorAll("[data-count]").forEach((el) => {
      if (!el.closest(".reveal")) io.observe(el);
    });
    if (reduce.current) root.querySelectorAll(".reveal").forEach((el) => el.classList.add("in"));

    return () => io.disconnect();
  }, []);

  // ----- PALAVRA DO DIA (1x por dia por localStorage) -----
  const now = useRef(new Date());
  const dailyKey = (() => {
    const d = now.current;
    return `ifp-daily-${d.getFullYear()}-${("0" + (d.getMonth() + 1)).slice(-2)}-${("0" + d.getDate()).slice(-2)}`;
  })();
  const daily = (() => {
    const d = now.current;
    const start0 = new Date(d.getFullYear(), 0, 0);
    const day = Math.floor((d.getTime() - start0.getTime()) / 86400000);
    const pick = REFLECTIONS[day % REFLECTIONS.length];
    const dateLabel = `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
    return { ...pick, dateLabel };
  })();

  useEffect(() => {
    if (!splashGone) return;
    try {
      if (localStorage.getItem(dailyKey)) return;
    } catch {
      return;
    }
    const t = setTimeout(() => setDailyOpen(true), 450);
    return () => clearTimeout(t);
  }, [splashGone, dailyKey]);

  const closeDaily = useCallback(() => {
    setDailyOpen(false);
    try {
      localStorage.setItem(dailyKey, "1");
    } catch {
      /* ignore */
    }
  }, [dailyKey]);

  // Esc fecha dropdown e popup
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setAccessOpen(false);
      if (dailyOpen) closeDaily();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dailyOpen, closeDaily]);

  // ----- navegação com transição-leão -----
  const goWithLion = useCallback(
    (item: AcessoItem, el: HTMLElement) => {
      setAccessOpen(false);
      const href = `/login?unidade=${item.slug}`;
      const rect = el.getBoundingClientRect();
      const ox = ((rect.left + rect.width / 2) / window.innerWidth) * 100;
      const oy = ((rect.top + rect.height / 2) / window.innerHeight) * 100;
      if (reduce.current) {
        router.push(href);
        return;
      }
      setTransition({ phrase: item.phrase, u1: item.u1, u2: item.u2, ox, oy });
      setTimeout(() => router.push(href), 1150);
    },
    [router],
  );

  const current = HERO_SLIDES[heroIndex] ?? HERO_SLIDES[0]!;

  return (
    <div ref={rootRef} className="ifp-site">
      {/* ============ SPLASH ============ */}
      {!splashGone && (
        <div className="splash" id="splash">
          <div className="splash-inner">
            <div className="splash-medal">
              <span className="ring" />
              <span className="disc">
                <img className="lion" src={LION} alt="" />
              </span>
            </div>
            <div className="splash-word">
              <b>Instituto Família Pôncio</b>
              <span>Duque de Caxias · RJ</span>
            </div>
            <div className="splash-bar">
              <i />
            </div>
          </div>
        </div>
      )}

      {/* ============ NAV ============ */}
      <header className={`nav${navScrolled ? " scrolled" : ""}`} id="nav">
        <div className="wrap">
          <a className="brand-lock" href="#topo">
            <span className="sym">
              <img src={LION} alt="IFP" />
            </span>
            <span className="txt">
              <b className="brand-grad">Instituto Família Pôncio</b>
              <span>Duque de Caxias · RJ</span>
            </span>
          </a>
          <nav className="links">
            <a href="#unidades">Unidades</a>
            <a href="#quem-somos">Quem somos</a>
            <a href="#impacto">Impacto</a>
            <a href="#participe">Participe</a>
            <a href="#contato">Contato</a>
          </nav>
          <button
            className={`nav-cta${accessOpen ? " open" : ""}`}
            id="accessBtn"
            aria-haspopup="true"
            aria-expanded={accessOpen}
            onClick={(e) => {
              e.stopPropagation();
              setAccessOpen((o) => !o);
            }}
          >
            <LockIcon />
            Acesso ao Sistema
            <ChevronDown className="chev" />
          </button>
        </div>
      </header>

      {/* ============ ACESSO AO SISTEMA (dropdown) ============ */}
      <div className={`access-scrim${accessOpen ? " open" : ""}`} onClick={() => setAccessOpen(false)} />
      <div className={`access-menu${accessOpen ? " open" : ""}`} role="menu" aria-label="Acesso ao sistema">
        <div className="grp">Unidades de atendimento</div>
        {ACESSO_UNIDADES.map((item) => (
          <AccessItem key={item.unit} item={item} onGo={goWithLion} />
        ))}
        <div className="access-divider" />
        <div className="grp">Equipe interna</div>
        {ACESSO_INTERNO.map((item) => (
          <AccessItem key={item.unit} item={item} onGo={goWithLion} />
        ))}
        <div className="access-foot">
          Cada unidade tem seu próprio acesso. A equipe interna entra pelos canais de apoio e diretoria.
        </div>
      </div>

      {/* ============ HERO ============ */}
      <section
        className="hero"
        id="topo"
        onMouseEnter={() => (heroPaused.current = true)}
        onMouseLeave={() => (heroPaused.current = false)}
      >
        <div className="hero-bg" aria-hidden="true">
          {HERO_SLIDES.map((s, k) => (
            <div
              key={s.unit}
              className={`hero-slide${k === heroIndex ? " on" : ""}`}
              data-unit={s.unit}
              style={{ backgroundImage: `url('${s.bg}')` }}
            />
          ))}
        </div>
        <div className="hero-hue" id="heroHue" aria-hidden="true" style={{ backgroundColor: current.color }} />
        <div className="hero-tint" aria-hidden="true" />
        <div className="wrap">
          <div className="hero-copy">
            <span className="eyebrow reveal">Organização filantrópica · desde 2018</span>
            <h1 className="reveal d1">
              Mudar realidades com <span className="hl-saude">saúde</span>, <span className="hl-edu">educação</span> e{" "}
              <span className="hl-amor">amor</span>.
            </h1>
            <p className="hero-sub reveal d2">
              Cuidamos de famílias e crianças de Duque de Caxias em quatro frentes — saúde, capacitação, esporte e
              recreação. Acolhimento que transforma, com a fé em lugar de honra.
            </p>
            <div className="hero-cta reveal d3">
              <a href="#unidades" className="btn-lg btn-solid">
                Conheça nossas unidades
                <ArrowRightBig />
              </a>
              <a href="#contato" className="btn-lg btn-outline">
                Fale com a gente
              </a>
            </div>
            <div className="hero-now reveal d3">
              <span className="hn-dots">
                {HERO_SLIDES.map((s, k) => (
                  <i
                    key={s.unit}
                    className={k === heroIndex ? "on" : ""}
                    onClick={() => {
                      setHeroIndex(k);
                      heroPaused.current = false;
                    }}
                  />
                ))}
              </span>
              <span className="hn-label">
                Em destaque: <b id="hnLabel">{current.nome}</b>
              </span>
            </div>
          </div>

          <div className="hero-emblem">
            <div className="emblem-core">
              <span className="halo" />
              <span className="ring" />
              <span className="ring dashed" />
              <span className="disc">
                <img src={LION} alt="Leão · símbolo do Instituto Família Pôncio" />
              </span>
            </div>
            {HERO_SLIDES.map((s, k) => {
              const u2 = { medico: "#10c2bb", capacitacao: "#c24d0f", esportivo: "#752c05", recreativo: "#1a9d6b" }[s.unit];
              const active = k === heroIndex;
              return (
                <div
                  key={s.unit}
                  className={`orbit-medal m${k + 1}${active ? " active" : " dim"}`}
                  data-unit={s.unit}
                  style={{ "--u1": s.color, "--u2": u2 } as React.CSSProperties}
                >
                  <span className="om-disc">
                    <img src={LION} alt="" />
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="hero-scroll">
          <span>Role</span>
          <span className="mouse" />
        </div>
      </section>

      {/* ============ UNIDADES ============ */}
      <section className="section units" id="unidades">
        <div className="wrap">
          <div className="units-head">
            <span className="eyebrow reveal">Quatro frentes de cuidado</span>
            <h2 className="sec-title reveal d1">Nossas unidades</h2>
            <p className="sec-lead reveal d2">
              Cada unidade é uma frente de atendimento ao público — e tem o leão vestindo a sua causa. Conheça o cuidado
              que oferecemos em cada uma.
            </p>
          </div>

          <div className="units-grid">
            {UNIT_CARDS.map((c, k) => (
              <article
                key={c.nome}
                className={`unit-card reveal${k % 2 === 1 ? " d1" : ""}`}
                style={{ "--u1": c.u1, "--u2": c.u2 } as React.CSSProperties}
              >
                <span className="uc-photo">
                  <span className="uc-tag">{c.tag}</span>
                  <img src={c.img} alt={c.alt} loading="lazy" />
                </span>
                <span className="uc-body">
                  <span className="unit-medal">
                    <span className="ring" />
                    <span className="disc">
                      <img src={LION} alt="" />
                    </span>
                    <span className="prop">{c.prop}</span>
                  </span>
                  <h3>{c.nome}</h3>
                  <p>{c.desc}</p>
                  <span className="feats">
                    {c.feats.map((f) => (
                      <span key={f} className="feat">
                        {f}
                      </span>
                    ))}
                  </span>
                </span>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ============ BANNER AÉREO (drone) ============ */}
      <section className="aerial" id="nossa-casa">
        <div className="aerial-photo" style={{ backgroundImage: "url('/site/fotos/aerea-centro-medico.jpg')" }} />
        <div className="scrim" />
        <div className="wrap">
          <span className="eyebrow reveal">Duque de Caxias · RJ</span>
          <h2 className="reveal d1">Nossa casa é no coração da comunidade.</h2>
          <p className="reveal d2">
            Estamos onde o cuidado mais importa — de portas abertas para as famílias do nosso bairro, todos os dias.
          </p>
          <span className="hint reveal d3">
            <PinIcon /> Centro Médico · Instituto Família Pôncio
          </span>
        </div>
      </section>

      {/* ============ QUEM SOMOS ============ */}
      <section className="section about" id="quem-somos">
        <div className="wrap">
          <span className="eyebrow reveal">Quem somos</span>
          <h2 className="sec-title reveal d1" style={{ marginTop: 14 }}>
            Uma família que cuida de famílias.
          </h2>
          <p className="sec-lead reveal d2" style={{ marginTop: 16 }}>
            Nascemos de uma experiência espiritual e do desejo de cuidar da comunidade, com atenção especial às
            crianças. De base cristã, caminhamos lado a lado com a transformação social.
          </p>

          <div className="about-photo reveal">
            <img
              src="https://static.wixstatic.com/media/fb51a3_04c74674e98f42c7a194c2851f12aa62~mv2.jpg/v1/fill/w_1400,h_600,al_c,q_85,enc_avif,quality_auto/equipe.jpg"
              alt="Equipe do Instituto Família Pôncio"
              loading="lazy"
            />
            <figcaption className="cap">Nossa equipe — quem faz o cuidado acontecer</figcaption>
          </div>

          <div className="about-grid">
            <div className="mvv m1 reveal">
              <span className="ic">
                <HeartIcon />
              </span>
              <h3>Missão</h3>
              <p>Mudar realidades através de abrigo, amor, saúde, educação e capacitação profissional.</p>
            </div>
            <div className="mvv m2 reveal d1">
              <span className="ic">
                <EyeIcon />
              </span>
              <h3>Visão</h3>
              <p>Ser referência em todas as esferas de atendimento ao próximo.</p>
            </div>
            <div className="mvv m3 reveal d2">
              <span className="ic">
                <ShieldCheckIcon />
              </span>
              <h3>Valores</h3>
              <p>Familiares e direcionados pelos princípios da palavra de Deus.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ MOMENTOS ============ */}
      <section className="section moments" id="momentos">
        <div className="wrap">
          <span className="eyebrow reveal">Momentos</span>
          <h2 className="sec-title reveal d1" style={{ marginTop: 14 }}>
            O dia a dia do cuidado
          </h2>
          <p className="sec-lead reveal d2" style={{ marginTop: 16 }}>
            Saúde, educação, esporte e recreação — pessoas reais, histórias reais, todos os dias em Duque de Caxias.
          </p>
          <div className="gallery-grid reveal">
            {GALLERY.map((g) => (
              <figure key={g.src} className={`gphoto${g.cls ? " " + g.cls : ""}`}>
                <img src={g.src} alt={g.alt} loading="lazy" />
                <figcaption className="cap">
                  <span className="u">{g.u}</span>
                  {g.cap}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ============ IMPACTO ============ */}
      <section className="section impact" id="impacto">
        <div className="wrap">
          <span className="eyebrow reveal">Nosso alcance</span>
          <h2 className="sec-title reveal d1" style={{ marginTop: 14 }}>
            O cuidado em números
          </h2>
          <div className="impact-grid">
            <div className="stat reveal" style={{ "--s1": "#ff8a44", "--s2": "#c24d0f" } as React.CSSProperties}>
              <span className="ic">
                <GridIcon />
              </span>
              <div className="num" data-count="4">
                0
              </div>
              <div className="lbl">unidades de atendimento</div>
            </div>
            <div className="stat reveal d1" style={{ "--s1": "#10c2bb", "--s2": "#007571" } as React.CSSProperties}>
              <span className="ic">
                <UsersIcon />
              </span>
              <div className="num" data-count="500" data-prefix="+">
                0
              </div>
              <div className="lbl">famílias acolhidas</div>
              <span className="tbc">a confirmar</span>
            </div>
            <div className="stat reveal d2" style={{ "--s1": "#f0a23b", "--s2": "#c24d0f" } as React.CSSProperties}>
              <span className="ic">
                <ClockIcon />
              </span>
              <div className="num" data-count="8" data-prefix="+">
                0
              </div>
              <div className="lbl">anos de história</div>
              <span className="tbc">a confirmar</span>
            </div>
            <div className="stat reveal d3" style={{ "--s1": "#ff8a44", "--s2": "#e0590f" } as React.CSSProperties}>
              <span className="ic">
                <HeartIcon />
              </span>
              <div className="num">centenas</div>
              <div className="lbl">de crianças atendidas</div>
              <span className="tbc">a confirmar</span>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FAÇA PARTE ============ */}
      <section className="section join" id="participe">
        <div className="wrap">
          <span className="eyebrow reveal">Faça parte</span>
          <h2 className="sec-title reveal d1" style={{ marginTop: 14 }}>
            O Instituto é da nossa família — e da sua.
          </h2>
          <p className="sec-lead reveal d2" style={{ marginTop: 16 }}>
            Um projeto totalmente nosso, tocado pela própria Família Pôncio para a comunidade de Duque de Caxias. Não
            dependemos de ninguém — caminhamos com fé, trabalho e gente boa do nosso lado. Você também pode fazer parte:
            com tempo, talento e presença.
          </p>
          <div className="about-grid">
            <div className="mvv m1 reveal">
              <span className="ic">
                <HeartIcon />
              </span>
              <h3>Seja voluntário</h3>
              <p>Doe seu tempo e talento nas nossas unidades. Toda mão que ajuda transforma uma história.</p>
            </div>
            <div className="mvv m2 reveal d1">
              <span className="ic">
                <ShareIcon />
              </span>
              <h3>Compartilhe</h3>
              <p>Leve nossa história adiante nas redes e ajude mais famílias a encontrar o Instituto.</p>
            </div>
            <div className="mvv m3 reveal d2">
              <span className="ic">
                <UsersIcon />
              </span>
              <h3>Indique uma família</h3>
              <p>Conhece quem precisa de acolhimento? Conecte essa família ao cuidado do Instituto.</p>
            </div>
          </div>
          <div className="join-cta reveal">
            <h3>Quer caminhar com a gente?</h3>
            <p>
              Fale com a Família Pôncio e descubra como você pode fazer parte desse cuidado, do jeitinho que combina com
              você.
            </p>
            <div className="row">
              <a href="#contato" className="btn-lg btn-solid">
                Fale com a gente
              </a>
              <a
                href="https://instagram.com/institutofamiliaponcio"
                target="_blank"
                rel="noopener"
                className="btn-lg btn-outline"
              >
                Siga no Instagram
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ============ RODAPÉ / CONTATO ============ */}
      <footer className="foot" id="contato">
        <div className="wrap">
          <div className="foot-top">
            <div>
              <a className="brand-lock" href="#topo">
                <span className="sym">
                  <img src={LION} alt="IFP" />
                </span>
                <span className="txt">
                  <b>Família Pôncio</b>
                  <span>Instituto filantrópico</span>
                </span>
              </a>
              <p className="foot-about">
                Mudando realidades em Duque de Caxias através de abrigo, amor, saúde, educação e capacitação
                profissional.
              </p>
              <div className="socials">
                <a href="https://instagram.com/institutofamiliaponcio" target="_blank" rel="noopener" aria-label="Instagram">
                  <InstagramIcon />
                </a>
                <a href="https://youtube.com/@institutofamiliaponcio" target="_blank" rel="noopener" aria-label="YouTube">
                  <YoutubeIcon />
                </a>
              </div>
            </div>

            <div>
              <h4>Contato</h4>
              <ul>
                <li>
                  <PhoneIcon /> Telefone / WhatsApp <span className="tbc">a confirmar</span>
                </li>
                <li>
                  <MailIcon /> E-mail <span className="tbc">a confirmar</span>
                </li>
                <li>
                  <MapPinIcon /> Endereço <span className="tbc">a confirmar</span>
                </li>
              </ul>
            </div>

            <div>
              <h4>Navegar</h4>
              <ul>
                <li>
                  <a href="#unidades">Nossas unidades</a>
                </li>
                <li>
                  <a href="#quem-somos">Quem somos</a>
                </li>
                <li>
                  <a href="#impacto">Impacto</a>
                </li>
                <li>
                  <a href="#participe">Faça parte</a>
                </li>
                <li>
                  <a
                    href="#topo"
                    onClick={(e) => {
                      e.preventDefault();
                      window.scrollTo({ top: 0, behavior: reduce.current ? "auto" : "smooth" });
                      setAccessOpen(true);
                    }}
                  >
                    Acesso ao Sistema
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="foot-bottom">
            <span>© 2026 Instituto Família Pôncio · Duque de Caxias / RJ</span>
            <span>Feito com cuidado — @institutofamiliaponcio</span>
          </div>
        </div>
      </footer>

      {/* ============ PALAVRA DO DIA (popup) ============ */}
      <div
        className={`daily-scrim${dailyOpen ? " open" : ""}`}
        aria-hidden={!dailyOpen}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeDaily();
        }}
      >
        <div className="daily-card" role="dialog" aria-modal="true" aria-labelledby="dailyKicker">
          <button className="daily-close" aria-label="Fechar" onClick={closeDaily}>
            <CloseIcon />
          </button>
          <div className="daily-medal">
            <span className="ring" />
            <span className="disc">
              <img src={LION} alt="" />
            </span>
          </div>
          <div className="daily-kicker" id="dailyKicker">
            Palavra do Dia
          </div>
          <div className="daily-date">{daily.dateLabel}</div>
          <p className="daily-msg">{daily.m}</p>
          <cite className="daily-ref">{daily.r}</cite>
          <button className="daily-amem btn-lg" onClick={closeDaily}>
            Amém · começar a visita
          </button>
        </div>
      </div>

      {/* ============ TRANSIÇÃO (leão loader) ============ */}
      {transition && (
        <div
          className="page-transition show"
          style={
            {
              "--u1": transition.u1,
              "--u2": transition.u2,
              "--ox": `${transition.ox}%`,
              "--oy": `${transition.oy}%`,
            } as React.CSSProperties
          }
        >
          <div className="pt-inner">
            <div className="pt-medal">
              <span className="ring" />
              <img src={LION} alt="" />
            </div>
            <div className="pt-phrase">{transition.phrase}</div>
            <div className="pt-dots">
              <i />
              <i />
              <i />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Item do dropdown de acesso — navega ao login da unidade com transição-leão. */
function AccessItem({ item, onGo }: { item: AcessoItem; onGo: (item: AcessoItem, el: HTMLElement) => void }) {
  return (
    <a
      className="access-item"
      role="menuitem"
      href={`/login?unidade=${item.slug}`}
      style={{ "--u1": item.u1, "--u2": item.u2 } as React.CSSProperties}
      onClick={(e) => {
        e.preventDefault();
        onGo(item, e.currentTarget);
      }}
    >
      <span className="medal">
        <img src={LION} alt="" />
      </span>
      <span className="ai-txt">
        <b>{item.nome}</b>
        <span>{item.descricao}</span>
      </span>
      <ArrowRightIcon className="go" />
    </a>
  );
}
