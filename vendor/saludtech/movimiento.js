/* movimiento.js — capa de movimiento común de SaludTech (2026-11-14).
   Se carga como archivo (la CSP del portal no admite scripts en línea), después de GSAP (vendor/gsap/gsap.min.js).

   1. Aparición al hacer scroll: cada bloque sube y aparece UNA vez, en cascada con los que llegan a la vez.
      La llegada la detecta IntersectionObserver (nativo y fiable) y la animación la hace GSAP. Lo que ya está en
      pantalla al cargar entra como una sola secuencia. Red de seguridad: nada queda oculto más de 3 s.
   2. Botones magnéticos: el botón se inclina hacia el puntero (propiedad CSS «translate», así no choca con la
      pulsación «transform: scale(.97)» de los estilos).
   3. Brillo que sigue al puntero en las piezas de cristal (variables --sx/--sy; lo dibuja custom-pro.css).

   Respeta «reducir movimiento» y los punteros táctiles. Si GSAP no carga, no se oculta nada: la página se ve igual,
   solo que sin animación. Páginas con contenido que se redibuja (el centro) usan data-movimiento="manual" en <html>
   y llaman a window.stMovimiento.revelar(contenedor) cuando cambian de vista. */
(function () {
  "use strict";
  var reducir = window.matchMedia("(prefers-reduced-motion: reduce)");
  var fino = window.matchMedia("(hover: hover) and (pointer: fine)");
  var G = window.gsap;
  // Sin «suavizado de saltos»: si un cuadro se retrasa (laptop cargada con 5 VM), la animación termina a su
  // hora real en vez de frenarse; nunca queda contenido a medio aparecer.
  if (G) G.ticker.lagSmoothing(0);

  var BLOQUES = [
    "[data-revelar]", ".bento > *", ".titular-xl", ".heroe-lead", ".heroe-acciones", ".heroe-escena", ".seccion-cab",
    ".titulo-seccion", ".panel", ".kpi > div", ".lista-filas", ".stepper > li", ".accordion", ".tabla-cont", ".diagrama",
    ".cap-cab", ".capitulo > h2", ".idea", ".analogia", ".codigo", ".tabla-explica", ".banda-cta", ".banda-datos",
    ".login-caja", ".cab-app", ".lateral", ".tarjeta", ".lab-pasos > div", ".rejilla-ataques > *", ".portada-guia", ".lista-cursos"
  ].join(",");
  var vistos = new WeakSet();

  function visible(el) { return el.getClientRects().length > 0 && !el.closest("[hidden],[data-sin-revelar]"); }

  var FIN = "transform,opacity,visibility";
  function mostrar(lote) {
    G.to(lote, { autoAlpha: 1, y: 0, duration: 0.85, ease: "expo.out", stagger: 0.07, overwrite: true, clearProps: FIN });
    // pase lo que pase con el reloj de animación, a los 2,5 s el lote está visible
    setTimeout(function () { G.set(lote, { clearProps: FIN }); }, 2500);
  }
  function porPosicion(a, b) {
    var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    return Math.abs(ra.top - rb.top) > 8 ? ra.top - rb.top : ra.left - rb.left;
  }

  function revelar(raiz) {
    if (!G || reducir.matches || !("IntersectionObserver" in window)) return;
    raiz = raiz || document;
    var todos = Array.prototype.filter.call(raiz.querySelectorAll(BLOQUES), function (el) { return !vistos.has(el) && visible(el); });
    var conjunto = new Set(todos);
    // si un contenedor ya aparece, sus hijos no se animan por separado (evita dobles saltos)
    var lista = todos.filter(function (el) {
      for (var p = el.parentElement; p; p = p.parentElement) if (conjunto.has(p)) return false;
      return true;
    });
    if (!lista.length) return;
    lista.forEach(function (el) { vistos.add(el); });
    G.set(lista, { autoAlpha: 0, y: 26 });
    var cola = [], programado = false;
    var io = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); cola.push(e.target); } });
      if (cola.length && !programado) {
        programado = true;
        requestAnimationFrame(function () { var lote = cola.sort(porPosicion); cola = []; programado = false; mostrar(lote); });
      }
    }, { rootMargin: "0px 0px -6% 0px" });
    lista.forEach(function (el) { io.observe(el); });
    // red de seguridad: lo que esté a la vista y siga oculto a los 3 s, se muestra
    setTimeout(function () {
      var quedan = lista.filter(function (el) { return el.style.visibility === "hidden" && el.getBoundingClientRect().top < innerHeight; });
      if (quedan.length) { quedan.forEach(function (el) { io.unobserve(el); }); mostrar(quedan); }
    }, 3000);
  }

  /* ---- botones magnéticos ---------------------------------------------- */
  var IMAN = "[data-magnetico], .boton, .btn-lg, .btn-primary, .btn.prim, .hud-btn";
  document.addEventListener("pointermove", function (e) {
    if (!fino.matches || reducir.matches || !e.target.closest) return;
    var el = e.target.closest(IMAN);
    if (!el || el.disabled) return;
    var r = el.getBoundingClientRect();
    var dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    el.style.setProperty("--iman-x", (dx * Math.min(7, r.width * 0.04)).toFixed(2) + "px");
    el.style.setProperty("--iman-y", (dy * 4).toFixed(2) + "px");
    el.classList.add("iman-activo");
  }, { passive: true });
  document.addEventListener("pointerout", function (e) {
    if (!e.target.closest) return;
    var el = e.target.closest(IMAN);
    if (el && !el.contains(e.relatedTarget)) {
      el.style.setProperty("--iman-x", "0px"); el.style.setProperty("--iman-y", "0px");
      el.classList.remove("iman-activo");
    }
  }, { passive: true });

  /* ---- brillo que sigue al puntero en el cristal ------------------------- */
  var CRISTAL = ".tile, .vidrio, .accion, .tarjeta, .panel";
  document.addEventListener("pointermove", function (e) {
    if (!fino.matches || !e.target.closest) return;
    var el = e.target.closest(CRISTAL);
    if (!el) return;
    var r = el.getBoundingClientRect();
    el.style.setProperty("--sx", ((e.clientX - r.left) / r.width * 100).toFixed(1) + "%");
    el.style.setProperty("--sy", ((e.clientY - r.top) / r.height * 100).toFixed(1) + "%");
  }, { passive: true });

  window.stMovimiento = { revelar: revelar };

  function arrancar() {
    if (document.documentElement.dataset.movimiento !== "manual") revelar(document);
    // la guía muestra capítulos por #hash: los bloques del capítulo nuevo aparecen al llegar
    window.addEventListener("hashchange", function () { setTimeout(function () { revelar(document); }, 30); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar); else arrancar();
})();
