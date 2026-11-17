/* Inicio v7 — intro «Pulso · encendido» (2026-11-16). La demo arranca como se enciende un clúster, en ≤ 4,5 s:
     0,0–0,3  oscuridad
     0,3–1,15 un latido dibujado con puntos LED (matriz de puntos que se enciende de izquierda a derecha)
     1,1–2,1  se encienden uno a uno los 5 nodos con su ESTADO REAL (primer «estado-lab» de inicio.js); sin datos, en ámbar «simulación»
     2,0–3,25 una chispa recorre los enlaces, baja y «escribe» la marca
     3,45–4,25 movimiento de cámara: la capa se acerca y se funde a oscuro (el texto se desenfoca al pasar)
     4,1–      el héroe entra con desenfoque y opacidad (inicio-mov.js, evento «intro-camara»)
   Se salta con clic, rueda, toque, cualquier tecla o el botón «Saltar intro». Sale una vez por sesión (sessionStorage), nunca con
   «reducir movimiento», con ?sin-intro, con un #ancla en la dirección ni sin JavaScript (lo decide inicio-temprano.js con html.intro-pre).
   Avisa con los eventos «intro-camara» (el contenido ya puede entrar) e «intro-fin». Canvas 2D propio: sin librerías nuevas. */
(() => {
  "use strict";
  const raiz = document.documentElement;
  if (!raiz.classList.contains("intro-pre")) return;
  const G = window.gsap;
  const avisar = (n) => document.dispatchEvent(new Event(n));
  const fuera = [document.getElementById("barra"), document.querySelector("main")].filter(Boolean);
  let soltada = false, terminada = false;
  function soltar() {                       // devuelve el contenido (una sola vez) y avisa a la capa de movimiento
    if (soltada) return; soltada = true;
    raiz.classList.remove("intro-pre");
    fuera.forEach((e) => { e.inert = false; });
    avisar("intro-camara");
  }
  if (!G || !document.body) { soltar(); avisar("intro-fin"); return; }
  try { sessionStorage.setItem("st-intro-v7", "1"); } catch (e) {}

  // estado real más reciente del laboratorio (inicio.js lo publica al leer api/acceso, normalmente en < 100 ms)
  let estado = null;
  const alEstado = (e) => { estado = e.detail; };
  document.addEventListener("estado-lab", alEstado);

  /* ------------------------------------------------------------------ capa */
  const capa = document.createElement("div");
  capa.className = "intro"; capa.id = "intro";
  capa.innerHTML = `<div class="intro-luz" aria-hidden="true"></div><canvas class="intro-lienzo" aria-hidden="true"></canvas>
    <div class="intro-texto" aria-hidden="true"><p class="intro-sobre">Proyecto Integrador · TECSUP</p><p class="intro-marca">SaludTech</p><p class="intro-estado">&nbsp;</p></div>
    <button class="intro-saltar" type="button">Saltar intro <kbd>Esc</kbd></button>`;
  document.body.appendChild(capa);
  fuera.forEach((e) => { e.inert = true; });
  const lienzo = capa.querySelector("canvas"), ctx = lienzo.getContext("2d");
  const btn = capa.querySelector(".intro-saltar"), marca = capa.querySelector(".intro-marca"), lineaEstado = capa.querySelector(".intro-estado");
  btn.focus({ preventScroll: true });
  const css = (n, d) => getComputedStyle(raiz).getPropertyValue(n).trim() || d;
  const C = { pulso: css("--pulso", "#3DDBA5"), falla: css("--falla", "#FF6B6B"), alerta: css("--alerta", "#FFB347"),
              texto: css("--texto", "#EAF0F6"), texto3: css("--texto-3", "#7D8B9C"), fondo: css("--fondo", "#06090E") };

  /* ------------------------------------------------------------------ geometría */
  const PASO = 10, FILAS = 17;
  const NODOS = [["cliente", -0.36, 0.30], ["web-dmz", -0.1, 0.12], ["nodo1", 0.04, 0.42], ["nodo2", 0.32, 0.30], ["almacen", 0.2, 0.62]];
  const ENLACES = [["cliente", "web-dmz"], ["web-dmz", "nodo1"], ["web-dmz", "nodo2"], ["nodo1", "nodo2"], ["nodo1", "almacen"], ["nodo2", "almacen"]];
  const RUTA = ["cliente", "web-dmz", "nodo1", "almacen", "nodo2"];
  let W = 0, H = 0, led = [], pos = {}, ruta = [], largos = [], total = 0, tramoRed = 0;

  // ECG normalizado: u (0..1 a lo ancho) → altura (−0,4..1), 3 latidos con onda P, complejo QRS y onda T
  function ecgY(u) {
    const f = (u * 3) % 1, g = (c, w, a) => a * Math.exp(-((f - c) ** 2) / (2 * w * w));
    return g(0.2, 0.035, 0.16) + g(0.37, 0.009, -0.2) + g(0.405, 0.012, 1) + g(0.44, 0.01, -0.4) + g(0.66, 0.055, 0.28);
  }
  function armarLed() {
    led = [];
    const ancho = Math.min(W * 0.8, 1100), cols = Math.floor(ancho / PASO), x0 = (W - cols * PASO) / 2, y0 = H * 0.46 - ((FILAS - 1) / 2) * PASO;
    const medio = (FILAS - 1) / 2;
    let prev = null;
    for (let c = 0; c <= cols; c++) {
      const u = c / cols, fila = Math.max(0, Math.min(FILAS - 1, Math.round(medio - ecgY(u) * 7)));
      const a = prev == null ? fila : Math.min(prev, fila), b = prev == null ? fila : Math.max(prev, fila);
      for (let r = 0; r < FILAS; r++) led.push({ x: x0 + c * PASO, y: y0 + r * PASO, on: r >= a && r <= b, u });
      prev = fila;
    }
  }
  function colocar() {
    const caja = Math.min(W, 1000), cx = W / 2, alto = Math.min(H * 0.44, 400), y0 = H * 0.12;
    NODOS.forEach(([n, x, y]) => { pos[n] = [cx + x * caja, y0 + y * alto]; });
    // ruta de la chispa: por la red, luego baja al inicio de la marca y la recorre de izquierda a derecha
    const r = marca.getBoundingClientRect(), ym = r.top + r.height * 0.55;
    ruta = RUTA.map((n) => pos[n]).concat([[r.left - 8, ym], [r.right + 6, ym]]);
    largos = []; total = 0;
    for (let i = 1; i < ruta.length; i++) { const l = Math.hypot(ruta[i][0] - ruta[i - 1][0], ruta[i][1] - ruta[i - 1][1]); largos.push(l); total += l; }
    tramoRed = largos.slice(0, RUTA.length - 1).reduce((a, b) => a + b, 0);
  }
  function medir() {
    const dpr = Math.min(1.5, devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    lienzo.width = Math.round(W * dpr); lienzo.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    armarLed(); colocar();
  }
  function enRuta(d) {                       // punto de la ruta a la distancia d (px)
    for (let i = 0; i < largos.length; i++) {
      if (d <= largos[i] || i === largos.length - 1) { const k = largos[i] ? Math.min(1, d / largos[i]) : 0, a = ruta[i], b = ruta[i + 1]; return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; }
      d -= largos[i];
    }
    return ruta[ruta.length - 1];
  }
  const colorDe = (n) => {
    const m = estado && !estado.sim ? estado.maquinas?.[n] : null;
    return m?.on === true ? C.pulso : m?.on === false ? C.falla : C.alerta;
  };

  /* ------------------------------------------------------------------ dibujo (un solo lienzo, ~60 fps durante ≤ 4,5 s) */
  const s = { led: 0, ledA: 1, nodos: 0, enlaces: 0, recorrido: 0, chispaA: 0 };
  function estrella(x, y, r, a) {
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha = a;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.6);
    g.addColorStop(0, "rgba(255,255,255,.85)"); g.addColorStop(0.22, "rgba(61,219,165,.32)"); g.addColorStop(1, "rgba(61,219,165,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 2.6, 0, 6.2832); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath();
    ctx.moveTo(0, -r * 1.7); ctx.quadraticCurveTo(r * 0.14, -r * 0.14, r * 1.7, 0); ctx.quadraticCurveTo(r * 0.14, r * 0.14, 0, r * 1.7);
    ctx.quadraticCurveTo(-r * 0.14, r * 0.14, -r * 1.7, 0); ctx.quadraticCurveTo(-r * 0.14, -r * 0.14, 0, -r * 1.7); ctx.fill();
    ctx.strokeStyle = C.pulso; ctx.lineWidth = 1.4; ctx.globalAlpha = a * 0.8; ctx.beginPath(); ctx.arc(0, 0, r * 0.95, 0, 6.2832); ctx.stroke();
    ctx.restore();
  }
  function dibujar() {
    ctx.clearRect(0, 0, W, H);
    // 1 · latido de puntos LED
    if (s.ledA > 0.01) {
      for (const p of led) {
        if (p.on && p.u <= s.led) {
          const cabeza = Math.max(0, 1 - (s.led - p.u) * 10);
          ctx.globalAlpha = s.ledA * (0.6 + 0.4 * cabeza); ctx.fillStyle = C.pulso; ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
          if (cabeza > 0.05) { ctx.globalAlpha = s.ledA * 0.16 * cabeza; ctx.fillRect(p.x - 6, p.y - 6, 12, 12); }
        } else { ctx.globalAlpha = s.ledA * 0.1; ctx.fillStyle = C.texto3; ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3); }
      }
    }
    // 2 · enlaces (y su tramo ya recorrido por la chispa, encendido)
    if (s.enlaces > 0) {
      ctx.lineWidth = 1; ctx.strokeStyle = C.texto3; ctx.globalAlpha = 0.35 * s.enlaces;
      ctx.beginPath(); ENLACES.forEach(([a, b]) => { ctx.moveTo(...pos[a]); ctx.lineTo(...pos[b]); }); ctx.stroke();
    }
    const dist = s.recorrido * total;
    if (dist > 0) {
      ctx.lineWidth = 1.6; ctx.strokeStyle = C.pulso; ctx.globalAlpha = 0.75; ctx.beginPath(); ctx.moveTo(...ruta[0]);
      let d = 0;
      for (let i = 0; i < largos.length && d < Math.min(dist, tramoRed); i++) {
        const k = Math.min(1, (Math.min(dist, tramoRed) - d) / largos[i]), a = ruta[i], b = ruta[i + 1];
        ctx.lineTo(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k); d += largos[i];
      }
      ctx.stroke();
    }
    // 3 · nodos con su estado real
    NODOS.forEach(([n], k) => {
      const a = Math.max(0, Math.min(1, s.nodos - k)); if (!a) return;
      const [x, y] = pos[n], c = colorDe(n), r = 7 + 4 * a;
      ctx.globalAlpha = 0.16 * a; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r * 3.2 * (1.4 - 0.4 * a), 0, 6.2832); ctx.fill();
      ctx.globalAlpha = a; ctx.strokeStyle = c; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, r + 5, 0, 6.2832); ctx.stroke();
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r * 0.6, 0, 6.2832); ctx.fill();
      ctx.globalAlpha = a * 0.9; ctx.fillStyle = C.texto; ctx.font = "500 13px 'Geist Mono', ui-monospace, monospace"; ctx.textAlign = "center";
      ctx.fillText(n, x, y + r + 22);
    });
    // 4 · la chispa
    if (s.chispaA > 0.01 && dist > 0) { const [x, y] = enRuta(dist); estrella(x, y, 12, s.chispaA); }
    ctx.globalAlpha = 1;
  }

  /* ------------------------------------------------------------------ línea de tiempo */
  medir();
  addEventListener("resize", medir);
  G.ticker.add(dibujar);
  const recorrerHasta = (k) => (tramoRed + k * (total - tramoRed)) / total;   // k = 0 al empezar la marca, 1 al terminarla
  const tl = G.timeline({ defaults: { ease: "power2.inOut" } })
    .to(s, { led: 1, duration: 0.85 }, 0.3)
    .to(".intro-luz", { autoAlpha: 1, duration: 1.4, ease: "power1.out" }, 0.9)
    .to(s, { ledA: 0, duration: 0.45, ease: "power2.in" }, 1.05)
    .to(s, { nodos: 5, duration: 0.95, ease: "none" }, 1.1)
    .to(s, { enlaces: 1, duration: 0.6 }, 1.5)
    .add(() => {
      const on = estado && !estado.sim ? estado.encendidas : null;
      lineaEstado.textContent = on === 5 ? "clúster encendido · 5/5" : on ? `${on}/5 máquinas encendidas` : "simulación · laboratorio apagado";
      lineaEstado.classList.toggle("sim", !on);
    }, 1.6)
    .to(s, { chispaA: 1, duration: 0.2, ease: "power1.out" }, 2.0)
    .to(s, { recorrido: () => recorrerHasta(0), duration: 0.8, ease: "power1.inOut" }, 2.0)
    .fromTo(".intro-sobre", { autoAlpha: 0, letterSpacing: "0.7em" }, { autoAlpha: 1, letterSpacing: "0.42em", duration: 0.7, ease: "expo.out" }, 2.45)
    .to(s, { recorrido: 1, duration: 0.45, ease: "power1.inOut" }, 2.8)
    .fromTo(marca, { clipPath: "inset(0% 100% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.45, ease: "power1.inOut" }, 2.8)
    .to(s, { chispaA: 0, duration: 0.3, ease: "power1.in" }, 3.2)
    .fromTo(lineaEstado, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.45, ease: "power2.out" }, 3.2)
    // movimiento de cámara: la capa se acerca, se desenfoca y se funde; detrás entra el héroe
    // (medido: desenfocar la capa entera bajaba a 30 fps sin GPU; se desenfoca solo el texto, que es lo que «pasa» junto a la cámara)
    // en la cámara el dibujo ya no cambia: se congela el lienzo y la capa va en su propia textura (mueve solo el compositor)
    .add(() => { dibujar(); G.ticker.remove(dibujar); capa.style.willChange = "transform, opacity"; }, 3.42)
    .to(capa, { scale: 1.3, autoAlpha: 0, duration: 0.8, ease: "expo.inOut" }, 3.45)
    .to(".intro-texto", { filter: "blur(6px)", yPercent: 18, duration: 0.8, ease: "expo.in" }, 3.45)
    // como en la referencia: primero funde a oscuro y DESPUÉS entra la web (superponer las dos cosas bajaba a 24–43 fps sin GPU)
    .add(soltar, 4.1)
    .add(cerrar);

  /* ------------------------------------------------------------------ saltar y cerrar */
  function saltar(e) {
    if (terminada) return;
    if (e?.type === "keydown" && ["Shift", "Control", "Alt", "Meta"].includes(e.key)) return;
    if (e?.type === "keydown") e.preventDefault();   // Espacio o flechas no deben mover la página escondida
    tl.kill();
    soltar();
    G.to(capa, { autoAlpha: 0, duration: 0.35, ease: "power2.out", onComplete: cerrar });
  }
  function cerrar() {
    if (terminada) return; terminada = true;
    soltar();
    G.ticker.remove(dibujar);
    removeEventListener("resize", medir);
    ["keydown", "wheel", "touchstart"].forEach((t) => removeEventListener(t, saltar, { capture: true }));
    document.removeEventListener("estado-lab", alEstado);
    const conFoco = document.activeElement === btn || document.activeElement === document.body;
    capa.remove();
    if (conFoco) { const m = document.querySelector("main"); m?.setAttribute("tabindex", "-1"); m?.focus({ preventScroll: true }); }
    avisar("intro-fin");
  }
  capa.addEventListener("click", saltar);
  ["keydown", "wheel", "touchstart"].forEach((t) => addEventListener(t, saltar, { capture: true, passive: t !== "keydown" }));
  setTimeout(() => { if (!terminada) saltar(); }, 6500);   // nunca se queda tapando la página
})();
