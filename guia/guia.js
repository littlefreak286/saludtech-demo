// Guía de la demo SaludTech (2026-11-14). Un capítulo por pantalla (#id), menú lateral, buscador, copiar comandos.
"use strict";
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const caps = $$("section.capitulo");
  const id = s => s.id.replace(/^cap-/, "");
  const vistos = new Set();
  try { JSON.parse(localStorage.getItem("st-guia-vistos") || "[]").forEach(x => vistos.add(x)); } catch (e) {}

  // ---- menú lateral, generado a partir de los capítulos
  const lista = $("#lista-caps");
  let grupo = null;
  caps.forEach(s => {
    if (s.dataset.grupo !== grupo) {
      grupo = s.dataset.grupo;
      const g = document.createElement("div");
      g.className = "grupo";
      g.innerHTML = (s.dataset.color ? `<i class="bi bi-circle-fill" style="color:var(--st-${s.dataset.color})"></i>` : "") + grupo;
      lista.appendChild(g);
    }
    const a = document.createElement("a");
    a.className = "cap"; a.href = "#" + id(s);
    a.innerHTML = `<i class="bi ${s.dataset.icono}"></i><span>${s.dataset.titulo}</span>`;
    a.addEventListener("click", () => { const oc = bootstrap.Offcanvas.getInstance($("#lateral")); if (oc) oc.hide(); });
    lista.appendChild(a);
  });

  // ---- índice del buscador (antes de añadir la navegación del pie; textContent incluye pestañas ocultas)
  const idx = caps.map(s => ({ id: id(s), titulo: s.dataset.titulo, texto: s.textContent.replace(/\s+/g, " ").trim() }));

  // ---- anterior / siguiente al pie de cada capítulo
  caps.forEach((s, i) => {
    const n = document.createElement("nav"); n.className = "navcap"; n.setAttribute("aria-label", "Anterior y siguiente");
    const ant = caps[i - 1], sig = caps[i + 1];
    n.innerHTML = (ant ? `<a href="#${id(ant)}"><small><i class="bi bi-arrow-left"></i> Anterior</small><b>${ant.dataset.titulo}</b></a>` : "<span></span>") +
                  (sig ? `<a class="sig" href="#${id(sig)}"><small>Siguiente <i class="bi bi-arrow-right"></i></small><b>${sig.dataset.titulo}</b></a>` : "");
    s.appendChild(n);
  });

  // ---- mostrar el capítulo del #hash
  function mostrar() {
    const h = (location.hash || "#inicio").slice(1);
    const s = $("#cap-" + h) || caps[0];
    caps.forEach(x => { x.hidden = x !== s; });
    $$("#lista-caps a.cap").forEach(a => a.classList.toggle("active", a.getAttribute("href") === "#" + id(s)));
    document.title = (id(s) === "inicio" ? "" : s.dataset.titulo + " · ") + "Guía de la demo SaludTech";
    vistos.add(id(s));
    try { localStorage.setItem("st-guia-vistos", JSON.stringify([...vistos])); } catch (e) {}
    $("#progreso span").style.width = Math.round(100 * vistos.size / caps.length) + "%";
    $("#progreso-txt").textContent = `${vistos.size} de ${caps.length} capítulos vistos`;
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }
  window.addEventListener("hashchange", mostrar);
  mostrar();

  // ---- botón «Copiar» en cada bloque de comandos
  const aviso = $("#aviso-copia");
  $$(".codigo").forEach(c => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "btn btn-outline-light copiar"; b.innerHTML = '<i class="bi bi-clipboard"></i> Copiar';
    $(".codigo-cab", c).appendChild(b);
    b.addEventListener("click", () => {
      const txt = $("pre", c).innerText.split("\n").map(l => l.replace(/\s+#\s.*$/, "").replace(/\s+$/, "")).join("\n").trim();
      const ok = () => { b.innerHTML = '<i class="bi bi-check2"></i> Copiado'; aviso.hidden = false; setTimeout(() => { b.innerHTML = '<i class="bi bi-clipboard"></i> Copiar'; aviso.hidden = true; }, 1500); };
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(ok, () => seleccionar($("pre", c)));
      else seleccionar($("pre", c));
    });
  });
  function seleccionar(el) { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }

  // ---- términos con explicación al pasar el ratón
  $$(".termino").forEach(t => new bootstrap.Tooltip(t));

  // ---- buscador
  const inp = $("#buscar"), res = $("#resultados");
  const norm = t => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const esc = t => t.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let sel = 0, hall = [];
  function buscar() {
    const q = norm(inp.value.trim());
    if (q.length < 2) { res.hidden = true; return; }
    hall = [];
    idx.forEach(c => {
      const t = norm(c.texto), i = t.indexOf(q), enTit = norm(c.titulo).includes(q);
      if (i >= 0 || enTit) {
        const a = Math.max(0, i - 50), frag = i >= 0 ? c.texto.substr(a, 140) : c.texto.substr(0, 140);
        const j = norm(frag).indexOf(q);
        const resaltado = j >= 0 ? esc(frag.slice(0, j)) + "<mark>" + esc(frag.substr(j, q.length)) + "</mark>" + esc(frag.slice(j + q.length)) : esc(frag);
        hall.push({ c, puntos: (enTit ? 10 : 0) + (t.split(q).length - 1), html: (a > 0 ? "…" : "") + resaltado + "…" });
      }
    });
    hall.sort((x, y) => y.puntos - x.puntos); sel = 0;
    res.innerHTML = hall.length ? hall.slice(0, 8).map((h, k) => `<a href="#${h.c.id}" class="${k === 0 ? "activo" : ""}"><b>${esc(h.c.titulo)}</b><small>${h.html}</small></a>`).join("")
                                : `<div class="p-3 small text-body-secondary">Sin resultados para «${esc(inp.value)}».</div>`;
    res.hidden = false;
  }
  inp.addEventListener("input", buscar);
  inp.addEventListener("keydown", e => {
    const items = $$("a", res);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (!items.length) return; sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length; items.forEach((x, k) => x.classList.toggle("activo", k === sel)); }
    else if (e.key === "Enter" && items[sel]) { location.hash = items[sel].getAttribute("href"); res.hidden = true; inp.blur(); }
    else if (e.key === "Escape") { res.hidden = true; inp.blur(); }
  });
  res.addEventListener("click", e => { if (e.target.closest("a")) { res.hidden = true; inp.value = ""; } });
  document.addEventListener("click", e => { if (!e.target.closest(".buscador")) res.hidden = true; });
  document.addEventListener("keydown", e => { if (e.key === "/" && document.activeElement !== inp && !/input|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); inp.focus(); } });

  // ---- tema
  $("#btn-tema").addEventListener("click", () => { const t = window.stCambiarTema(); $("#btn-tema i").className = t === "dark" ? "bi bi-sun" : "bi bi-moon-stars"; });
  $("#btn-tema i").className = document.documentElement.getAttribute("data-bs-theme") === "dark" ? "bi bi-sun" : "bi bi-moon-stars";

  // ---- enlace «Volver a la demo»: solo tiene sentido si la guía la sirve el centro (no abierta como archivo)
  if (location.protocol === "file:") $$(".solo-servidor").forEach(x => x.remove());
})();
