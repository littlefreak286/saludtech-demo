/* Pulso — microinteracciones comunes de la demo SaludTech (2026-11-14). Sin dependencias.
   - [data-aparece]: entra al verse (IntersectionObserver). Sin JS o con movimiento reducido, todo se ve desde el principio.
   - .tile: luz que sigue al cursor (variables --x / --y).
   - [data-cuenta="9.63"] (+ data-decimales, data-sufijo): contador que sube una vez al verse.
   - .barra: gana fondo al bajar; botón .barra-boton abre el menú en móvil.
   Expone window.Pulso = { cuenta(el, valor), reducido }. */
(() => {
  "use strict";
  const reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const raiz = document.documentElement;
  if (!reducido && "IntersectionObserver" in window) raiz.classList.add("js-mov");

  const fmt = (v, dec) => v.toFixed(dec).replace(".", ",");   // coma decimal, como en el informe (9,63 s)
  function cuenta(el, valor) {
    const dec = +(el.dataset.decimales || 0);
    const fin = valor ?? parseFloat(el.dataset.cuenta);
    if (!isFinite(fin)) return;
    const pinta = (v) => { el.firstChild && el.firstChild.nodeType === 3 ? (el.firstChild.nodeValue = fmt(v, dec)) : el.prepend(document.createTextNode(fmt(v, dec))); };
    if (reducido) { pinta(fin); return; }
    const t0 = performance.now(), dur = 900, ini = 0;
    const paso = (t) => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); pinta(ini + (fin - ini) * e); if (k < 1) requestAnimationFrame(paso); };
    requestAnimationFrame(paso);
  }

  function iniciar() {
    // aparición en cascada
    const vistos = document.querySelectorAll("[data-aparece]");
    if (raiz.classList.contains("js-mov")) {
      const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("visto"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" });
      vistos.forEach((el) => io.observe(el));
    }
    // contadores
    const cs = document.querySelectorAll("[data-cuenta]");
    if ("IntersectionObserver" in window) {
      const io2 = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { cuenta(e.target); io2.unobserve(e.target); } }), { threshold: .4 });
      cs.forEach((el) => io2.observe(el));
    } else cs.forEach((el) => cuenta(el));
    // luz que sigue al cursor en las tarjetas
    document.addEventListener("pointermove", (ev) => {
      const t = ev.target.closest && ev.target.closest(".tile");
      if (!t) return;
      const r = t.getBoundingClientRect();
      t.style.setProperty("--x", `${ev.clientX - r.left}px`); t.style.setProperty("--y", `${ev.clientY - r.top}px`);
    }, { passive: true });
    // barra superior y menú móvil
    const barra = document.querySelector(".barra");
    if (barra) {
      const fondo = () => barra.classList.toggle("con-fondo", scrollY > 16);
      addEventListener("scroll", fondo, { passive: true }); fondo();
      const b = barra.querySelector(".barra-boton");
      if (b) {
        b.addEventListener("click", () => { const a = barra.classList.toggle("abierta"); b.setAttribute("aria-expanded", String(a)); });
        barra.querySelectorAll(".barra-enlaces a").forEach((a) => a.addEventListener("click", () => { barra.classList.remove("abierta"); b.setAttribute("aria-expanded", "false"); }));
        addEventListener("keydown", (e) => { if (e.key === "Escape" && barra.classList.contains("abierta")) { barra.classList.remove("abierta"); b.setAttribute("aria-expanded", "false"); b.focus(); } });
      }
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar); else iniciar();
  window.Pulso = { cuenta, reducido };
})();
