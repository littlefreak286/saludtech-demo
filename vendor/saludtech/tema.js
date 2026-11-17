// Tema claro/oscuro común (se carga en <head> para no parpadear). Recuerda la elección en este navegador si se puede.
(function () {
  var t = null;
  try { t = localStorage.getItem("st-tema-bs"); } catch (e) {}
  if (t !== "light" && t !== "dark") t = "dark";   // 2026-11-14 «Pulso»: oscuro por defecto; el botón de tema cambia a claro y se recuerda
  document.documentElement.setAttribute("data-bs-theme", t);
  window.stCambiarTema = function () {
    var n = document.documentElement.getAttribute("data-bs-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-bs-theme", n);
    try { localStorage.setItem("st-tema-bs", n); } catch (e) {}
    return n;
  };
})();
