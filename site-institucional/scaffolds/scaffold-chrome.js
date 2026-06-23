/* Chrome compartilhado dos scaffolds — NÃO faz parte do kit Next.js.
   1) Tema claro/escuro persistente (localStorage 'ifp-theme').
   2) Injeta a pílula flutuante "← Design Kit". */
(function () {
  var html = document.documentElement;
  var saved = localStorage.getItem("ifp-theme");
  if (saved) html.setAttribute("data-theme", saved);

  function syncLabels() {
    var dark = html.getAttribute("data-theme") === "dark";
    document.querySelectorAll("[data-theme-label]").forEach(function (el) {
      el.textContent = dark ? "Escuro" : "Claro";
    });
  }
  syncLabels();

  document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var dark = html.getAttribute("data-theme") === "dark";
      html.setAttribute("data-theme", dark ? "light" : "dark");
      localStorage.setItem("ifp-theme", dark ? "light" : "dark");
      syncLabels();
    });
  });

  // pílula de volta ao kit
  var a = document.createElement("a");
  a.className = "kit-back";
  a.href = "../index.html";
  a.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m15 18-6-6 6-6"/></svg> Design Kit';
  document.body.appendChild(a);
})();
