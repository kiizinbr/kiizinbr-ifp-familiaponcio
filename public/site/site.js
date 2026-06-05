/* ============================================================================
   IFP · Site institucional — interações
   Splash · nav scroll · dropdown de acesso · transição de leão · count-up · reveal
   ============================================================================ */
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- SPLASH de entrada (uma vez por sessão) ---- */
  var splash = document.getElementById("splash");
  var splashDone = false;
  function signalSplashDone() {
    if (splashDone) return;
    splashDone = true;
    window.dispatchEvent(new Event("ifp-splash-done"));
  }
  function hideSplash() {
    splash.classList.add("gone");
    document.body.classList.remove("locked");
    setTimeout(function () {
      if (splash && splash.parentNode) splash.parentNode.removeChild(splash);
    }, 800);
    signalSplashDone();
  }
  if (sessionStorage.getItem("ifp-splash-seen")) {
    // já viu nesta sessão: remove rápido
    splash.style.transition = "none";
    hideSplash();
  } else {
    sessionStorage.setItem("ifp-splash-seen", "1");
    setTimeout(hideSplash, reduce ? 250 : 2000);
  }

  /* ---- NAV: sombra ao rolar ---- */
  var nav = document.getElementById("nav");
  function onScroll() {
    nav.classList.toggle("scrolled", window.scrollY > 24);
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---- DROPDOWN "Acesso ao Sistema" ---- */
  var accessBtn = document.getElementById("accessBtn");
  var accessMenu = document.getElementById("accessMenu");
  var accessScrim = document.getElementById("accessScrim");
  function openAccess() {
    accessMenu.classList.add("open");
    accessScrim.classList.add("open");
    accessBtn.classList.add("open");
    accessBtn.setAttribute("aria-expanded", "true");
  }
  function closeAccess() {
    accessMenu.classList.remove("open");
    accessScrim.classList.remove("open");
    accessBtn.classList.remove("open");
    accessBtn.setAttribute("aria-expanded", "false");
  }
  accessBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    accessMenu.classList.contains("open") ? closeAccess() : openAccess();
  });
  accessScrim.addEventListener("click", closeAccess);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeAccess();
  });
  // links do rodapé que abrem o menu
  document.querySelectorAll("[data-open-access]").forEach(function (el) {
    el.addEventListener("click", function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
      openAccess();
    });
  });

  /* ---- TRANSIÇÃO de leão → navega p/ login da unidade ---- */
  var pt = document.getElementById("pageTransition");
  var ptPhrase = document.getElementById("ptPhrase");
  var UNIT = {
    medico: { u1: "#007571", u2: "#10c2bb" },
    capacitacao: { u1: "#ff772e", u2: "#c24d0f" },
    esportivo: { u1: "#c24d0f", u2: "#752c05" },
    recreativo: { u1: "#10c2bb", u2: "#1a9d6b" },
    social: { u1: "#4a4a49", u2: "#6b6b6b" },
    poncio: { u1: "#752c05", u2: "#4a4a49" },
  };
  function goWithLion(href, unit, phrase, ox, oy) {
    var c = UNIT[unit] || UNIT.medico;
    pt.style.setProperty("--u1", c.u1);
    pt.style.setProperty("--u2", c.u2);
    pt.style.setProperty("--ox", (ox || 80) + "%");
    pt.style.setProperty("--oy", (oy || 8) + "%");
    ptPhrase.textContent = phrase || "Carregando…";
    if (reduce) {
      window.location.href = href;
      return;
    }
    pt.classList.add("show");
    document.body.classList.add("locked");
    setTimeout(function () {
      window.location.href = href;
    }, 1150);
  }
  // intercepta cliques em qualquer elemento com data-go
  document.querySelectorAll("[data-go]").forEach(function (el) {
    el.addEventListener("click", function (e) {
      e.preventDefault();
      closeAccess();
      var rect = el.getBoundingClientRect();
      var ox = ((rect.left + rect.width / 2) / window.innerWidth) * 100;
      var oy = ((rect.top + rect.height / 2) / window.innerHeight) * 100;
      goWithLion(
        el.getAttribute("data-go"),
        el.getAttribute("data-unit"),
        el.getAttribute("data-phrase"),
        ox,
        oy,
      );
    });
  });

  /* ---- COUNT-UP dos números (ao entrar na viewport) ---- */
  function animateCount(el) {
    var target = parseInt(el.getAttribute("data-count"), 10);
    var prefix = el.getAttribute("data-prefix") || "";
    if (reduce) {
      el.textContent = prefix + target.toLocaleString("pt-BR");
      return;
    }
    var dur = 1400,
      start = performance.now();
    function tick(now) {
      var p = Math.min((now - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = prefix + Math.round(target * eased).toLocaleString("pt-BR");
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ---- REVEAL on scroll + dispara count-up ---- */
  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add("in");
        en.target.querySelectorAll &&
          en.target.querySelectorAll("[data-count]").forEach(animateCount);
        if (en.target.hasAttribute && en.target.hasAttribute("data-count")) animateCount(en.target);
        io.unobserve(en.target);
      });
    },
    { threshold: 0.18, rootMargin: "0px 0px -8% 0px" },
  );

  document.querySelectorAll(".reveal").forEach(function (el) {
    io.observe(el);
  });
  // observa também stats que tenham count mas não a classe reveal direta
  document.querySelectorAll("[data-count]").forEach(function (el) {
    if (!el.closest(".reveal")) io.observe(el);
  });

  // se já viu o splash (carregamento instantâneo), garante reveal do que está visível
  if (reduce)
    document.querySelectorAll(".reveal").forEach(function (el) {
      el.classList.add("in");
    });

  /* ---- HERO: slideshow institucional sincronizado com os medalhões ---- */
  (function () {
    var hero = document.querySelector(".hero");
    if (!hero) return;
    var slides = [].slice.call(hero.querySelectorAll(".hero-slide"));
    var medals = [].slice.call(hero.querySelectorAll(".orbit-medal"));
    var dots = [].slice.call(hero.querySelectorAll(".hn-dots i"));
    var hue = document.getElementById("heroHue");
    var label = document.getElementById("hnLabel");
    if (slides.length < 2) return;
    var order = ["medico", "capacitacao", "esportivo", "recreativo"];
    var names = {
      medico: "Centro Médico",
      capacitacao: "Centro de Capacitação",
      esportivo: "Centro Esportivo",
      recreativo: "Centro Recreativo",
    };
    var colors = {
      medico: "#007571",
      capacitacao: "#ff772e",
      esportivo: "#c24d0f",
      recreativo: "#10c2bb",
    };
    var i = 0,
      timer = null;
    function show(n) {
      i = (n + slides.length) % slides.length;
      var u = order[i];
      slides.forEach(function (s, k) {
        s.classList.toggle("on", k === i);
      });
      medals.forEach(function (m) {
        var on = m.getAttribute("data-unit") === u;
        m.classList.toggle("active", on);
        m.classList.toggle("dim", !on);
      });
      dots.forEach(function (d, k) {
        d.classList.toggle("on", k === i);
      });
      if (hue) hue.style.backgroundColor = colors[u];
      if (label) label.textContent = names[u];
    }
    function next() {
      show(i + 1);
    }
    function start() {
      stop();
      if (!reduce) timer = setInterval(next, 4400);
    }
    function stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }
    dots.forEach(function (d) {
      d.addEventListener("click", function () {
        show(parseInt(d.getAttribute("data-i"), 10));
        start();
      });
    });
    hero.addEventListener("mouseenter", stop);
    hero.addEventListener("mouseleave", start);
    show(0);
    start();
  })();

  /* ---- PALAVRA DO DIA (popup de boas-vindas, 1x por dia) ---- */
  (function () {
    var scrim = document.getElementById("dailyScrim");
    if (!scrim) return;
    var reflections = [
      {
        m: "“O generoso prosperará; quem dá alívio aos outros, alívio receberá.”",
        r: "Provérbios 11:25",
      },
      { m: "Acolher uma criança é acolher o próprio amor de Deus.", r: "Inspirado em Mateus 18:5" },
      { m: "“Não nos cansemos de fazer o bem, pois no tempo certo colheremos.”", r: "Gálatas 6:9" },
      {
        m: "Cada gesto de cuidado planta uma semente que floresce além do que se vê.",
        r: "Reflexão do dia",
      },
      {
        m: "“Tudo o que fizerem, façam de todo o coração, como para o Senhor.”",
        r: "Colossenses 3:23",
      },
      { m: "“Levem as cargas uns dos outros; assim cumprirão a lei de Cristo.”", r: "Gálatas 6:2" },
      { m: "“Sede fortes e corajosos; o Senhor caminha com vocês.”", r: "Josué 1:9" },
      {
        m: "Onde há uma família que cuida, há sempre um lar para recomeçar.",
        r: "Reflexão do dia",
      },
      {
        m: "“O amor é paciente, o amor é bondoso. Tudo suporta, tudo espera.”",
        r: "1 Coríntios 13:4-7",
      },
      { m: "“Deem, e será dado a vocês: uma boa medida, transbordante.”", r: "Lucas 6:38" },
      {
        m: "“A esperança não decepciona, porque o amor de Deus foi derramado em nós.”",
        r: "Romanos 5:5",
      },
      {
        m: "“A fé é a certeza daquilo que esperamos e a prova do que não vemos.”",
        r: "Hebreus 11:1",
      },
      {
        m: "Servir ao próximo com amor é a forma mais bonita de mudar realidades.",
        r: "Reflexão do dia",
      },
      { m: "“O Senhor é bom, um refúgio em tempos de angústia.”", r: "Naum 1:7" },
    ];
    var now = new Date();
    var start0 = new Date(now.getFullYear(), 0, 0);
    var day = Math.floor((now - start0) / 86400000);
    var pick = reflections[day % reflections.length];
    var meses = [
      "janeiro",
      "fevereiro",
      "março",
      "abril",
      "maio",
      "junho",
      "julho",
      "agosto",
      "setembro",
      "outubro",
      "novembro",
      "dezembro",
    ];
    document.getElementById("dailyMsg").textContent = pick.m;
    document.getElementById("dailyRef").textContent = pick.r;
    document.getElementById("dailyDate").textContent =
      now.getDate() + " de " + meses[now.getMonth()] + " de " + now.getFullYear();

    var key =
      "ifp-daily-" +
      now.getFullYear() +
      "-" +
      ("0" + (now.getMonth() + 1)).slice(-2) +
      "-" +
      ("0" + now.getDate()).slice(-2);
    function open() {
      if (localStorage.getItem(key)) return;
      scrim.classList.add("open");
      scrim.setAttribute("aria-hidden", "false");
      document.body.classList.add("locked");
    }
    function close() {
      scrim.classList.remove("open");
      scrim.setAttribute("aria-hidden", "true");
      document.body.classList.remove("locked");
      try {
        localStorage.setItem(key, "1");
      } catch (e) {}
    }
    document.getElementById("dailyClose").addEventListener("click", close);
    document.getElementById("dailyAmem").addEventListener("click", close);
    scrim.addEventListener("click", function (e) {
      if (e.target === scrim) close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && scrim.classList.contains("open")) close();
    });

    if (localStorage.getItem(key)) return; // já viu hoje
    function trigger() {
      setTimeout(open, 450);
    }
    if (splashDone) trigger();
    else window.addEventListener("ifp-splash-done", trigger, { once: true });
  })();
})();
