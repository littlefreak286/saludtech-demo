/* Inicio v7 (2026-11-16) — se carga en <head> (la CSP no admite scripts en línea). Reemplaza a vendor/saludtech/temprano.js SOLO en el
   inicio, para no tocar el archivo compartido. Marca la página antes de pintarla:
   · html.anim-pre   → lo que entra animado no se ve un instante antes de su entrada (igual que temprano.js);
   · html.intro-pre  → va a salir la intro «Pulso · encendido»: el contenido espera oculto detrás de ella.
   La intro sale una sola vez por sesión, nunca con «reducir movimiento» ni con ?sin-intro. Si sessionStorage falla, no sale (es más
   seguro que repetirla). Si el JavaScript de la intro no llegara, el CSS muestra todo a los 6 s. */
(function () {
  try {
    var r = document.documentElement;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    r.classList.add("anim-pre");
    if (/[?&]sin-intro(=|&|$)/.test(location.search)) return;
    if (location.hash.length > 1 && location.hash !== "#inicio") return;   // entra directo a una sección: sin intro
    var vista = true;
    try { vista = sessionStorage.getItem("st-intro-v7") === "1"; } catch (e) { vista = true; }
    if (!vista) r.classList.add("intro-pre");
  } catch (e) {}
})();
