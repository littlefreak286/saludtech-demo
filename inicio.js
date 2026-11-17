// Inicio de la demo SaludTech — v7 «Pulso · encendido» (2026-11-16): DATOS EN VIVO. El movimiento está en inicio-mov.js y la intro en
// inicio-intro.js. v7: el chip vivo del héroe dice «Laboratorio en vivo · 5/5» o «Simulación…» (ámbar) y el evento lleva además el nodo
// que atiende el portal (telemetría: servicios_rol.saludtech-app = active) y si el héroe debe mostrarse en simulación.
//  - api/acceso cada 3 s (pausa con la pestaña oculta): máquinas encendidas, túnel, modo presentador.
//  - api/telemetria/stream (SSE): CPU, RAM y red reales de cada máquina; si un proxy la retiene, api/telemetria cada 3 s.
//  - Cada cambio se publica como evento «estado-lab» en document:
//    { maquinas: {nombre: {on, nivel}}, vip, cpuMedia, encendidas, activo: "nodo1"|"nodo2"|null, sim: bool, conectado: bool }.
//    inicio-mov.js lo usa para colorear las redes de nodos, el electrocardiograma y la curva de CPU.
//  - Rutas RELATIVAS (igual en local y por ngrok). La clave de presentador solo llega a esta laptop y se ve solo al pulsar «Mostrar».
"use strict";
const MAQUINAS = [
  ["almacen", "Disco compartido, árbitro de quórum y enrutador", "Ubuntu"],
  ["nodo1", "Nodo del clúster: portal y app", "Ubuntu"],
  ["nodo2", "Toma el servicio si el otro nodo cae", "Ubuntu"],
  ["cliente", "Pruebas de red y ataques simulados", "Ubuntu"],
  ["web-dmz", "Servidor web de la zona pública", "RHEL 10.2"],
];
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const PARAM = new URLSearchParams(location.search);
// 2026-11-16: «edición pública» (GitHub Pages, 11-sitio-publico/construir.py marca <html data-edicion="publica">). No hay servidor: no se
// piden datos (evita 404 cada 3 s), el héroe queda en su simulación rotulada y los botones llevan al centro en vivo por ngrok.
const PUBLICA = document.documentElement.dataset.edicion === "publica";
const TELE = {}, ESTADO = {};
let fallos = 0, conectado = null;

/* ---- aviso flotante y copiar ---- */
let tAviso = null;
function aviso(txt) { const a = $("#aviso"); $("#aviso-txt").textContent = txt; a.hidden = false; clearTimeout(tAviso); tAviso = setTimeout(() => { a.hidden = true; }, 2200); }
async function copiar(txt) { try { await navigator.clipboard.writeText(txt); aviso("Dirección copiada"); } catch (e) { aviso("Seleccione y copie la dirección"); } }
function qrSVG(m) {
  if (!Array.isArray(m) || !m.length) return "";
  const n = m[0].length, r = [];
  m.forEach((f, y) => { for (let x = 0; x < n; x++) if (f[x] === "1") r.push(`M${x} ${y}h1v1h-1z`); });
  return `<div class="qr"><svg viewBox="-1 -1 ${n + 2} ${m.length + 2}" role="img" aria-label="Código QR de la dirección"><rect x="-1" y="-1" width="${n + 2}" height="${m.length + 2}" fill="#fff"/><path d="${r.join("")}" fill="#000"/></svg><span>Escanee con el celular</span></div>`;
}
// cifra y unidad unidas con espacio duro: «13,6 kB/s» nunca se parte en dos renglones
const kbps = (b) => b == null ? "—" : b >= 1e6 ? (b / 1e6).toFixed(1).replace(".", ",") + "\u00a0MB/s" : b >= 1e3 ? (b / 1e3).toFixed(b >= 1e5 ? 0 : 1).replace(".", ",") + "\u00a0kB/s" : Math.round(b) + "\u00a0B/s";
// v7: conserva las clases de tamaño del chip (chip-mini, chip-vivo); antes se perdían al repintarlo
const chip = (el, clase, txt, late) => { if (!el) return; el.className = ["chip", ...[...el.classList].filter((c) => c === "chip-mini" || c === "chip-vivo"), clase].join(" "); el.querySelector(".punto").className = "punto" + (late ? " late" : ""); el.querySelector("span:last-child").textContent = txt; };

/* ---- publicar el estado para la capa de movimiento ---- */
function publicar() {
  const maquinas = {}; let on = 0;
  MAQUINAS.forEach(([n]) => { const x = ESTADO.maquinas?.[n] || {}; maquinas[n] = { on: x.encendida ?? null, nivel: TELE[n]?.nivel || "ok" }; if (x.encendida) on++; });
  const cpus = Object.values(TELE).map((r) => r.cpu).filter((v) => v != null);
  // nodo que atiende el portal: el que tiene la app del clúster activa (la mueve Pacemaker al conmutar)
  const activo = ["nodo1", "nodo2"].find((n) => maquinas[n].on && TELE[n]?.servicios_rol?.["saludtech-app"] === "active") || null;
  const sim = conectado === false || (conectado === true && on === 0);
  document.dispatchEvent(new CustomEvent("estado-lab", { detail: { maquinas, vip: ESTADO.portal_ok ?? null, encendidas: on, activo, sim,
    conectado, cpuMedia: cpus.length ? cpus.reduce((a, b) => a + b, 0) / cpus.length : null } }));
}

/* ---- ficha de las 5 máquinas ----
   v6.2: cabecera (punto, nombre, sistema) · CPU y RAM con su barrita · una línea de texto (rol o tráfico de red) que puede ocupar
   dos renglones en vez de cortarse. Antes el nombre se montaba sobre la CPU y el texto de red salía cortado con «…». */
function filaMaquina(n, rol, so) {
  const met = (t, et) => `<span class="maq-m"><i>${et}</i><b data-t="${t}">—</b><span class="maq-barra" aria-hidden="true"><span data-b="${t}"></span></span></span>`;
  return `<li class="maq" data-m="${n}" data-est="nd">
    <span class="maq-cab"><span class="punto"></span><span class="maq-nombre">${n}</span><small class="maq-so">${so}</small></span>
    <span class="maq-met">${met("cpu", "CPU")}${met("ram", "RAM")}</span>
    <span class="maq-rol" data-t="rol">${esc(rol)}</span></li>`;
}
function barra(li, t, v) {
  const b = li.querySelector(`[data-b="${t}"]`); if (!b) return;
  b.style.setProperty("--v", v == null ? "0" : String(Math.max(0, Math.min(100, v)) / 100));
  if (v != null && v >= 85) b.dataset.nivel = "alto"; else delete b.dataset.nivel;
}
function pintarTele(n) {
  const li = document.querySelector(`.maq[data-m="${n}"]`), r = TELE[n];
  if (!li) return;
  li.dataset.nivel = !r ? "sin-datos" : r.senal === "sin-agente" ? "sin-agente" : (r.nivel || "ok");
  const rol = li.querySelector('[data-t="rol"]'), base = (MAQUINAS.find(([x]) => x === n) || [])[1];
  if (!r || r.cpu == null) { rol.textContent = r?.senal === "sin-agente" ? "sin agente de telemetría" : base; rol.removeAttribute("title"); return; }
  const ram = r.ram?.uso || 0;
  li.querySelector('[data-t="cpu"]').textContent = `${Math.round(r.cpu)} %`;
  li.querySelector('[data-t="ram"]').textContent = `${Math.round(ram)} %`;
  barra(li, "cpu", r.cpu); barra(li, "ram", ram);
  const red = `red ↓ ${kbps(r.red?.rx_bps)} · ↑ ${kbps(r.red?.tx_bps)}`;
  rol.textContent = r.senal === "sin-senal" ? `sin señal hace ${Math.round(r.edad || 0)} s` : r.alertas?.length ? r.alertas[0] : red;
  rol.title = `red: entra ${kbps(r.red?.rx_bps)} · sale ${kbps(r.red?.tx_bps)}`;
}

function pintar(d) {
  Object.assign(ESTADO, d);
  const m = d.maquinas || {};
  const on = MAQUINAS.filter(([n]) => (m[n] || {}).encendida).length;
  chip($("#vivo"), on === 5 ? "chip-ok" : on ? "chip-alerta" : "chip-falla", on === 5 ? "En vivo" : on ? `En vivo · ${on}/5` : "Laboratorio apagado", on > 0);
  chip($("#chip-maquinas"), "chip-vivo " + (on === 5 ? "chip-ok" : "chip-alerta"), on ? `Laboratorio en vivo · ${on}/5` : "Simulación · laboratorio apagado", on > 0);
  chip($("#chip-portal"), d.portal_ok ? "chip-ok" : "chip-falla", d.portal_ok ? "portal respondiendo" : on ? "portal sin respuesta" : "sin laboratorio", d.portal_ok);
  $("#estado-titulo").textContent = on === 5 ? "Las 5 máquinas están encendidas." : on ? `${on} de 5 máquinas encendidas.` : "El laboratorio está apagado.";
  $("#contador").textContent = `${on}/5`;
  $("#barra-maquinas").style.setProperty("--v", String(on / 5));
  $("#barra-wrap").setAttribute("aria-valuenow", on);
  $("#estado-sub").textContent = (d.portal_ok ? "Portal respondiendo por HTTPS" : on ? "El portal aún no responde" : "Las páginas siguen disponibles; los datos vuelven al encender. La consola 3D tiene modo simulación.")
    + " · " + new Date(d.ahora * 1000).toLocaleTimeString("es-PE").replace(/\s/g, " ");   // «a. m.» no se parte en dos renglones
  const lista = $("#maquinas");
  if (!lista.querySelector(".maq[data-m]")) lista.innerHTML = MAQUINAS.map(([n, rol, so]) => filaMaquina(n, rol, so)).join("");
  MAQUINAS.forEach(([n]) => {
    const li = lista.querySelector(`.maq[data-m="${n}"]`), x = m[n] || {};
    const st = x.encendida === true ? "on" : x.encendida === false ? "off" : "nd";
    li.dataset.est = st;
    li.querySelector(".punto").className = "punto " + (st === "on" ? "ok" : st === "off" ? "mal" : "");
    pintarTele(n);
  });
  publicar();
  const ir = d.portal_ok ? "Abrir el portal" : on ? "Abrir el portal (aún no responde)" : "Abrir el portal (laboratorio apagado)";
  const sp = $("#ir-portal span"); if (sp && sp.textContent !== ir) sp.textContent = ir;

  const modo = $("#modo"); modo.hidden = false;
  const mt = !d.remoto ? "Presentador · esta laptop" : d.presentador ? "Presentador" : "Espectador";
  if (modo.textContent !== mt) { modo.textContent = mt; modo.className = "chip " + (d.remoto && !d.presentador ? "" : "chip-dato"); }

  const t = d.internet || {};
  let h;
  if (t.estado === "activo" && t.url) h = `<div class="linea-estado"><span class="punto ok late"></span>Activo con ${esc(t.proveedor)}</div>
      <div class="url-caja"><a href="${esc(t.url)}" target="_blank" rel="noopener">${esc(t.url)}</a><button class="boton boton-mini" data-copiar="${esc(t.url)}" type="button">Copiar</button></div>${qrSVG(t.qr)}
      <p class="nota" style="margin-top:12px">${/ngrok/.test(t.proveedor || "") ? "Dirección fija. La primera vez, ngrok (plan gratis) muestra su propio aviso: pulsar «Visit Site». Funciona mientras esta laptop esté encendida." : "La dirección cambia en cada arranque y funciona mientras la laptop esté encendida."}</p>`;
  else if (t.estado === "conectando" || t.estado === "reconectando") h = `<div class="linea-estado"><span class="girando" aria-hidden="true"></span>Abriendo el túnel (${esc(t.proveedor || "")})…</div>`;
  else if (t.estado === "error" || t.estado === "sin-programa") h = `<div class="nota-caja alerta"><span>No se pudo abrir el túnel: ${esc(t.detalle)}</span></div>`;
  else h = `<div class="nota-caja"><span><b>Túnel apagado.</b> Se abre solo con el ícono «Levantar demo». Mientras tanto, todo funciona en esta laptop.</span></div>`;
  const inet = $("#internet");
  if (inet.dataset.h !== h) { inet.dataset.h = h; inet.innerHTML = h; }

  const p = $("#presentador");
  const clave = !d.remoto ? "pc" : d.presentador ? "pres" : "esp";
  if (p.dataset.k !== clave) {
    p.dataset.k = clave;
    if (!d.remoto) p.innerHTML = `<p class="nota">Desde esta laptop se puede hacer todo. Para presentar desde otro dispositivo hace falta la clave de 6 cifras; no se muestra sola para que no salga en el proyector.</p>
      <div class="clave-caja"><span class="clave" id="clave-txt" aria-live="polite">••••••</span><button class="boton boton-mini" id="ver-clave" type="button" aria-pressed="false">Mostrar 15 s</button></div>`;
    else if (d.presentador) p.innerHTML = `<div class="nota-caja ok"><span>Modo presentador activo en este navegador.</span></div><div class="acciones" style="margin-top:12px"><button class="boton boton-secundario" id="salir-pres" type="button">Salir del modo presentador</button></div>`;
    else p.innerHTML = `<p class="nota">Está en <b>modo espectador</b>: ve todo en vivo pero no cambia nada. Si usted presenta, escriba la clave de 6 cifras:</p>
      <form class="form-clave" id="form-clave"><input id="in-clave" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" autocomplete="off" placeholder="••••••" aria-label="Clave de presentador" required><button class="boton boton-primario" type="submit">Entrar</button></form><div class="msg-clave" id="msg-clave" role="status"></div>`;
    const f = $("#form-clave");
    if (f) f.onsubmit = async (ev) => {
      ev.preventDefault();
      const r = await fetch("api/presentador", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clave: $("#in-clave").value }) });
      const j = await r.json().catch(() => ({}));
      const mm = $("#msg-clave"); mm.className = "msg-clave " + (r.ok ? "ok" : "mal"); mm.textContent = r.ok ? "Listo." : (j.error || "No se pudo.");
      if (r.ok) refrescar();
    };
    const s = $("#salir-pres");
    if (s) s.onclick = async () => { await fetch("api/presentador/salir", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); refrescar(); };
    const vc = $("#ver-clave");
    if (vc) vc.onclick = () => {
      const txt = $("#clave-txt"), ver = vc.getAttribute("aria-pressed") !== "true";
      txt.textContent = ver ? (ESTADO.clave || "?") : "••••••"; vc.setAttribute("aria-pressed", String(ver)); vc.textContent = ver ? "Ocultar" : "Mostrar 15 s";
      clearTimeout(vc._t); if (ver) vc._t = setTimeout(() => vc.click(), 15000);
    };
  }
}

async function refrescar() {
  try {
    const r = await fetch("api/acceso", { cache: "no-store" });
    if (!r.ok) throw new Error(r.status);
    fallos = 0; conectado = true; pintar(await r.json());
  } catch (e) {
    if (++fallos >= 2) {
      conectado = false;
      chip($("#vivo"), "chip-falla", "Sin conexión", false);
      chip($("#chip-maquinas"), "chip-vivo chip-alerta", "Simulación · sin conexión con la laptop", false);
      chip($("#chip-portal"), "chip-falla", "sin conexión", false);
      $("#estado-titulo").textContent = "Sin conexión con la laptop de la demo.";
      $("#estado-sub").textContent = "Puede que se haya apagado o que el túnel se haya cerrado. Reintentando…";
      publicar();
    }
  }
}

/* ---- telemetría en vivo ---- */
function recibir(r) { if (r && r.maquina) { TELE[r.maquina] = r; pintarTele(r.maquina); publicar(); } }
let tSondeo = null;
function sondear() {
  if (tSondeo) return;
  const paso = async () => { if (document.hidden) return; try { const r = await fetch("api/telemetria", { cache: "no-store" }); if (r.ok) Object.values((await r.json()).maquinas || {}).forEach(recibir); } catch (e) {} };
  paso(); tSondeo = setInterval(paso, 3000);
}
function conectar() {
  if (PARAM.get("tele") === "sondeo" || !("EventSource" in window)) return sondear();
  const es = new EventSource("api/telemetria/stream");
  let vivo = false;
  es.addEventListener("instantanea", (ev) => { vivo = true; try { Object.values(JSON.parse(ev.data).maquinas || {}).forEach(recibir); } catch (e) {} });
  es.addEventListener("telemetria", (ev) => { vivo = true; try { recibir(JSON.parse(ev.data)); } catch (e) {} });
  es.onerror = () => { if (es.readyState === EventSource.CLOSED) sondear(); };
  setTimeout(() => { if (!vivo) { es.close(); sondear(); } }, 8000);
}

document.addEventListener("click", (e) => { const b = e.target.closest("[data-copiar]"); if (b) copiar(b.dataset.copiar); });
function modoPublico() {
  conectado = false;
  const txt = (sel, t) => { const el = $(sel); if (el) el.textContent = t; };
  chip($("#vivo"), "chip-alerta", "Edición pública", false);
  chip($("#chip-maquinas"), "chip-vivo chip-alerta", "Simulación · el laboratorio vive en la laptop del equipo", false);
  chip($("#chip-portal"), "chip-alerta", "solo en vivo", false);
  txt("#estado-titulo", "Versión pública de la demo.");
  txt("#estado-sub", "Las 5 máquinas corren en la laptop del equipo. El centro y el portal en vivo abren cuando esa laptop está encendida.");
  publicar();
}
if (PUBLICA) modoPublico();
else {
  refrescar();
  setInterval(() => { if (!document.hidden) refrescar(); }, 3000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refrescar(); });
  conectar();
}
