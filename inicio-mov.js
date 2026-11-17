/* Inicio de la demo — v7 «Pulso · encendido» (2026-11-16). v7 añade: menú en píldora (grupos + indicador deslizante), tablero vivo del
   héroe (nodo activo, simulación rotulada, reloj de Lima), entrada del héroe tras la intro (evento «intro-camara»), cabeceras con
   desenfoque al llegar, líneas de tiempo con puntos (ejes y fases), entrada del equipo y pausas de todo lo continuo fuera de pantalla.
   SplitText espera a las fuentes. Lo que sigue describe la base de v6.1, que se conserva:

   v6.1 «Presentación» (2026-11-15): MOVIMIENTO POR SECCIONES. Los datos están en inicio.js (evento «estado-lab»).
   Pedido del usuario: que no se vea «animarse mientras bajas». Cada sección es una diapositiva de una pantalla; el scroll encaja de una en
   una (CSS scroll-snap) y lo de dentro se ARMA AL LLEGAR, en un instante. Nada va atado a la rueda.
   GSAP 3.13 local: SplitText (titulares por palabra/línea) y DrawSVG (electrocardiogramas). Coreografía (skill choreograph): un protagonista
   por diapositiva, escalonados no uniformes, nada bloquea un clic. Con «reducir movimiento» no se anima nada: estados finales del HTML.

   héroe: titular por palabras + red que se arma desde partículas + ECG que se dibuja y late en vivo
   problema: las palabras se encienden de una pasada            antes → después: las cifras se recodifican una tras otra
   cinco ejes: gráfico fijo; en cada paso la red actúa el eje   prueba de fuego: demostración automática (ECG plano, cronómetro, fases)
   resultados: anillo, matriz, escudos, curva y barras           herramientas: tarjetas que se inclinan, botones magnéticos */
(async () => {
  "use strict";
  const reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fino = matchMedia("(pointer: fine)").matches;
  const G = window.gsap, SPL = window.SplitText, DRAW = window.DrawSVGPlugin;
  const animar = !!(G && SPL && DRAW) && !reducido;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const coma = (v, d = 2) => v.toFixed(d).replace(".", ",");
  const raiz = document.documentElement;
  const css = (n) => getComputedStyle(raiz).getPropertyValue(n).trim();

  /* ------------------------------------------------------------------ electrocardiograma (trazo en SVG) */
  function ecg(ancho, base, alto, latidos, plano) {
    const L = ancho / latidos, d = [`M0 ${base}`];
    for (let i = 0; i < latidos; i++) {
      const x0 = i * L, mitad = (x0 + L * 0.5) / ancho;
      if (plano && mitad > plano[0] && mitad < plano[1]) { d.push(`L${x0 + L} ${base}`); continue; }
      const p = (f, y) => d.push(`L${(x0 + L * f).toFixed(1)} ${(base - y * alto).toFixed(1)}`);
      p(0.30, 0); p(0.36, 0.08); p(0.42, 0); p(0.46, 0); p(0.48, -0.12); p(0.51, 1); p(0.54, -0.32); p(0.57, 0); p(0.66, 0); p(0.74, 0.18); p(0.82, 0); p(1, 0);
    }
    return d.join(" ");
  }
  const dHeroe = ecg(600, 62, 50, 4);
  $$("#ecg-heroe .ecg-traza, #ecg-heroe .ecg-viajero").forEach((p) => p.setAttribute("d", dHeroe));
  $("#ecg-caida .ecg-traza").setAttribute("d", ecg(2400, 120, 92, 14, [0.36, 0.70]));
  $("#spark-rto")?.setAttribute("d", "M0 30 L118 30 L124 30 L128 70 L160 70 L164 30 L300 30");
  $(".k-spark-meta")?.setAttribute("d", "M0 70 H300");
  const matriz = $("#matriz"); if (matriz && !matriz.children.length) matriz.innerHTML = "<i></i>".repeat(37);

  /* ------------------------------------------------------------------ redes de nodos */
  const redes = {
    heroe: window.RedNodos?.montar($("#red-heroe"), { intro: true, fondo: false, ip: false, zoom: innerWidth < 600 ? 1.05 : 1.2, giro: 0.05, parallax: true, subir: 2 }),
    historia: window.RedNodos?.montar($("#red-historia"), { ip: false, zoom: 1.12, subir: 6 }),   // el canvas ya va entre el título y el chip (inicio.css)
    mini: window.RedNodos?.montar($("#red-mini"), { ip: false, etiquetas: false, zoom: 1.08, giro: 0.12 }),
  };

  /* ------------------------------------------------------------------ estado en vivo (de inicio.js) */
  const cpuSerie = [];
  // sin laboratorio (apagado o sin conexión) el tablero del héroe muestra una SIMULACIÓN rotulada en ámbar; las demás redes y la ficha
  // «En vivo» siguen mostrando el estado real (apagado), que también es información honesta
  const SIM = { maquinas: Object.fromEntries(["almacen", "nodo1", "nodo2", "cliente", "web-dmz"].map((n) => [n, { on: true, nivel: "ok" }])), vip: true };
  const vActivo = $(".v-activo"), nodoActivo = $("#nodo-activo"), nodoActivoEt = $("#nodo-activo-et");
  document.addEventListener("estado-lab", (e) => {
    const d = e.detail;
    redes.heroe?.estado(d.sim ? SIM : { maquinas: d.maquinas, vip: d.vip });
    redes.historia?.estado({ maquinas: d.maquinas, vip: d.vip }); redes.mini?.estado({ maquinas: d.maquinas, vip: d.vip });
    $("#sim-heroe") && ($("#sim-heroe").hidden = !d.sim);
    $(".v-red")?.classList.toggle("sim", !!d.sim);
    const caido = !d.sim && (d.vip === false || d.encendidas === 0);
    $(".heroe-ecg")?.classList.toggle("caido", caido);
    $(".heroe-ecg")?.classList.toggle("sim", !!d.sim);
    const rot = $(".ecg-rotulo");
    if (rot) rot.textContent = d.sim ? "simulación · sin laboratorio" : caido ? "sin latido · el portal no responde" : "Corosync · en vivo";
    if (vActivo) {
      const [est, val, et] = d.sim ? ["sim", "nodo1", "simulado: el laboratorio no está encendido"]
        : d.activo ? ["ok", d.activo, "atiende el portal ahora"]
        : !d.maquinas.nodo1?.on && !d.maquinas.nodo2?.on ? ["mal", "ninguno", "los dos nodos están apagados"]
        : d.maquinas.nodo1?.on == null ? ["", "—", document.documentElement.dataset.edicion === "publica" ? "el clúster corre en la laptop del equipo" : "leyendo el clúster…"] : ["buscando", "buscando…", "el clúster está moviendo el servicio"];
      vActivo.dataset.est = est;
      if (nodoActivo.textContent !== val) nodoActivo.textContent = val;
      nodoActivoEt.textContent = et;
      $$("#par-nodos li").forEach((li) => {
        const n = li.dataset.n, on = d.maquinas[n]?.on;
        const [e2, txt, punto] = d.sim ? ["sim", n === "nodo1" ? "atiende" : "espera", "alerta"]
          : on === false ? ["apagado", "apagado", "mal"] : d.activo === n ? ["atiende", "atiende", "ok late"]
          : on ? ["espera", "en espera", "ok"] : ["", "—", ""];
        li.dataset.est = e2; li.lastElementChild.textContent = txt; li.querySelector(".punto").className = "punto " + punto;
      });
    }
    if (d.cpuMedia != null) {
      cpuSerie.push(d.cpuMedia); if (cpuSerie.length > 40) cpuSerie.shift();
      const max = Math.max(20, ...cpuSerie), pts = cpuSerie.map((v, i) => `${(i / 39 * 200).toFixed(1)} ${(44 - v / max * 38).toFixed(1)}`);
      $("#spark-cpu")?.setAttribute("d", "M" + pts.join(" L"));
      const et = $("#spark-et"); if (et) et.textContent = `CPU media en vivo: ${Math.round(d.cpuMedia)} %`;
    }
  });

  /* ------------------------------------------------------------------ diapositivas: menú en píldora, progreso y la activa */
  // v7: el índice ya no son puntos sueltos; son los 7 grupos del menú en píldora (enlaces reales: funcionan sin JS). Cada diapositiva
  // dice a qué grupo pertenece (data-grupo) y el indicador se desliza al enlace de ese grupo.
  const diapos = $$(".diapositiva"), indice = $("#indice-diapos"), pasos = $$(".paso");
  const enlaces = $$("#indice-diapos a"), indicador = $(".pildora-indicador"), actual = $("#seccion-actual"), barraSup = $("#barra");
  const primerPaso = diapos.indexOf(pasos[0]);
  function moverIndicador() {
    const a = enlaces.find((x) => x.getAttribute("aria-current") === "true");
    if (!a || !indicador || !a.offsetWidth) return;
    indicador.style.setProperty("--ind-x", a.offsetLeft + "px");
    indicador.style.setProperty("--ind-w", a.offsetWidth + "px");
    indice.classList.add("listo");
  }
  if ("ResizeObserver" in window && indice) new ResizeObserver(moverIndicador).observe(indice);
  document.fonts?.ready.then(moverIndicador);
  // en la hoja del celular: al elegir una sección se cierra (pulso.js abre/cierra con el botón y con Escape)
  $("#menu")?.addEventListener("click", (e) => {
    if (!e.target.closest("a") || !barraSup?.classList.contains("abierta")) return;
    barraSup.classList.remove("abierta"); $(".barra-boton")?.setAttribute("aria-expanded", "false");
  });
  const entradas = new Map();          // diapositiva → función que la arma al llegar
  let activa = -1;
  function activar(i) {
    if (i === activa) return;
    activa = i;
    const d = diapos[i], g = d.dataset.grupo;
    diapos.forEach((x, k) => x.classList.toggle("activa", k === i));
    enlaces.forEach((a) => a.setAttribute("aria-current", String(a.dataset.grupo === g)));
    const a = enlaces.find((x) => x.dataset.grupo === g); if (actual && a) actual.textContent = a.textContent;
    moverIndicador();
    const barra = $("#progreso-lectura"); if (barra) barra.style.transform = `scaleX(${(i + 1) / diapos.length})`;
    if (d.classList.contains("paso")) activarPaso(d); else if (i < primerPaso) activarPaso(null);
    entradas.get(d)?.(d);
    document.dispatchEvent(new CustomEvent("diapo-activa", { detail: { i, d } }));
  }
  // la activa es la que cruza la línea media de la pantalla (sirve para diapositivas de cualquier alto)
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) activar(diapos.indexOf(en.target)); }), { rootMargin: "-50% 0px -50% 0px" });
    diapos.forEach((d) => io.observe(d));
  }

  /* ------------------------------------------------------------------ pasos de los cinco ejes */
  const hud = $("#hud-eje"), leyenda = $("#leyenda-zonas");
  let pasoActivo = null;
  function activarPaso(p) {
    if (p === pasoActivo) return;
    pasoActivo = p;
    pasos.forEach((x) => x.classList.toggle("activo", x === p));
    redes.historia?.escena(p ? p.dataset.modo : "normal");
    if (leyenda) leyenda.hidden = !p || p.dataset.modo !== "vlan";
    // línea de tiempo de los 5 ejes: los anteriores quedan hechos y el actual se marca
    const k = p ? pasos.indexOf(p) : -1;
    $$("#ejes-linea li").forEach((li, j) => { li.classList.toggle("hecho", j <= k); li.classList.toggle("actual", j === k); });
    $("#ejes-linea")?.style.setProperty("--av", String(Math.max(0, k) / 4));
    if (hud && p) {
      hud.querySelector("span:last-child").textContent = p.dataset.et;
      if (animar) G.fromTo(hud, { y: 8, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.45, ease: "power3.out", overwrite: true });
    }
  }

  /* ------------------------------------------------------------------ prueba de fuego: estado según el avance (0..1) */
  const fases = $$(".fase-txt"), lis = $$(".fases-lista li"), crono = $("#crono-num"), cronoEt = $("#crono-et"), caida = $(".caida"), repetir = $("#repetir-caida");
  let faseAct = -1;
  function estadoCaida(p) {
    const f = p < 0.36 ? 0 : p < 0.70 ? 1 : 2;
    if (f !== faseAct) { faseAct = f; fases.forEach((x) => x.classList.toggle("activa", +x.dataset.fase === f)); caida.classList.toggle("rojo", f === 1); }
    crono.textContent = coma(f === 0 ? 0 : f === 1 ? (p - 0.36) / 0.34 * 9.63 : 9.63);
    cronoEt.textContent = f === 0 ? "el portal responde normalmente" : f === 1 ? "sin servicio… el clúster está reaccionando (cámara rápida)" : "sin servicio, de media (5 cortes reales)";
    [0.36, 0.50, 0.60, 0.67].forEach((u, i) => lis[i]?.classList.toggle("hecha", p >= u));
    // la línea que une los puntos de las fases se llena hasta la última fase hecha
    const hechas = [0.36, 0.50, 0.60, 0.67].filter((u) => p >= u).length;
    $("#fases-lista")?.style.setProperty("--av", String(Math.max(0, hechas - 1) / 3));
  }

  /* ------------------------------------------------------------------ reloj de Lima (tarjeta del héroe): solo corre con el héroe a la vista */
  const reloj = $("#reloj"), horaLima = $("#hora-lima");
  const fmtHora = new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  if (reloj) {
    $(".reloj-marcas", reloj).innerHTML = Array.from({ length: 12 }, (_, k) => `<line x1="50" y1="${k % 3 ? 9 : 7}" x2="50" y2="13" transform="rotate(${k * 30} 50 50)"/>`).join("");
    if (reducido) $(".reloj-s", reloj).style.display = "none";
  }
  function pintarReloj() {
    const p = Object.fromEntries(fmtHora.formatToParts(new Date()).map((x) => [x.type, +x.value || x.value]));
    const h = p.hour % 24, m = p.minute, sg = p.second;
    if (horaLima) horaLima.textContent = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}${reducido ? "" : ":" + String(sg).padStart(2, "0")}`;
    if (!reloj) return;
    $(".reloj-h", reloj).style.transform = `rotate(${(h % 12) * 30 + m * 0.5}deg)`;
    $(".reloj-m", reloj).style.transform = `rotate(${m * 6 + sg * 0.1}deg)`;
    $(".reloj-s", reloj).style.transform = `rotate(${sg * 6}deg)`;
  }
  let tReloj = 0;
  function seguirReloj() {
    const correr = !document.hidden && diapos[0].classList.contains("activa");
    if (correr && !tReloj) { pintarReloj(); tReloj = setInterval(pintarReloj, reducido ? 30000 : 1000); }
    else if (!correr && tReloj) { clearInterval(tReloj); tReloj = 0; }
  }
  pintarReloj();
  document.addEventListener("visibilitychange", seguirReloj);
  document.addEventListener("diapo-activa", seguirReloj);

  if (!animar) return;                  // sin animación: el HTML ya trae los estados finales; las escenas cambian igual

  /* ================================================================== con animación */
  // SplitText mide las líneas: si la fuente llega después, los cortes quedan mal (v6 avisaba «SplitText called before fonts loaded»)
  await Promise.race([document.fonts?.ready || Promise.resolve(), new Promise((r) => setTimeout(r, 1500))]);
  raiz.classList.add("js-anim");
  G.registerPlugin(SPL, DRAW);
  const una = (d, fn) => entradas.set(d, (el) => { if (el.dataset.armada) return; el.dataset.armada = "1"; fn(el); });

  // ---------------------------------------------------------------- héroe: entra al cargar, o cuando la intro hace su movimiento de cámara
  let viajero = null;
  function entradaHeroe() {
    const tit = SPL.create("#titular", { type: "words,lines", mask: "lines", linesClass: "linea-mascara", wordsClass: "palabra", aria: "auto" });
    G.set([".heroe-titular", ".mov-apoyo", ".mov-deco"], { visibility: "visible" });
    const desenf = { filter: "blur(6px)", clearProps: "filter" };
    G.timeline({ defaults: { ease: "expo.out" } })
      .from("#chip-maquinas", { autoAlpha: 0, y: 10, duration: 0.6 }, 0)
      .from(tit.words, { yPercent: 115, rotate: 4, duration: 1.05, stagger: { each: 0.06, ease: "power1.in" } }, 0.05)
      .from(".heroe-lead", { autoAlpha: 0, y: 16, duration: 0.85, ...desenf }, 0.4)
      .from(".heroe-acciones > *", { autoAlpha: 0, y: 12, duration: 0.75, stagger: 0.1 }, 0.55)
      .from(".heroe-meta", { autoAlpha: 0, duration: 0.6, ease: "power2.out" }, 0.9)
      .from(".heroe-bento .vivo", { autoAlpha: 0, y: 22, scale: 0.98, duration: 0.95, stagger: { each: 0.075, ease: "power1.in" }, ...desenf }, 0.2)
      .fromTo("#ecg-heroe .ecg-traza", { drawSVG: "0% 0%" }, { drawSVG: "0% 100%", duration: 1.5, ease: "power2.inOut" }, 0.75)
      .from(".indicador-scroll", { autoAlpha: 0, y: -6, duration: 0.7 }, 1.3)
      .add(() => {
        G.set("#ecg-heroe .ecg-viajero", { autoAlpha: 1 });
        viajero = G.fromTo("#ecg-heroe .ecg-viajero", { drawSVG: "0% 4%" }, { drawSVG: "96% 100%", duration: 2.6, ease: "none", repeat: -1 });
        viajero.paused(activa !== 0 || document.hidden);
      }, 2);
  }
  // el viajero del ECG solo corre con el héroe a la vista (la laptop mueve 5 VM)
  const pausarViajero = () => viajero?.paused(activa !== 0 || document.hidden);
  document.addEventListener("diapo-activa", pausarViajero);
  document.addEventListener("visibilitychange", pausarViajero);
  if (raiz.classList.contains("intro-pre")) {
    let hecha = false;
    const ir = () => { if (!hecha) { hecha = true; entradaHeroe(); } };
    document.addEventListener("intro-camara", ir, { once: true });
    setTimeout(ir, 7000);   // por si la intro fallara
  } else entradaHeroe();
  entradas.set(diapos[0], () => {});

  // ---------------------------------------------------------------- v7: cabeceras de cada diapositiva con «blur-in» (desenfoque + opacidad)
  // Solo la cabecera (≤ 2 elementos por diapositiva) usa filter; lo de dentro tiene su propia coreografía, distinta en cada una.
  const cabeceras = new Map();
  $$(".entra").forEach((el) => { const d = el.closest(".diapositiva"); if (!cabeceras.has(d)) cabeceras.set(d, []); cabeceras.get(d).push(el); });
  G.set(".entra", { autoAlpha: 0, y: 14, filter: "blur(10px)" });
  const subirTitulo = (d) => { const l = cabeceras.get(d); if (l) G.to(l, { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 0.9, ease: "expo.out", stagger: 0.09, clearProps: "filter" }); };

  // ---------------------------------------------------------------- el problema: las palabras se encienden de una pasada
  const man = SPL.create("#manifiesto", { type: "words", wordsClass: "palabra", aria: "auto" });
  const rem = SPL.create("#remate", { type: "lines", mask: "lines", linesClass: "linea-mascara", aria: "auto" });
  G.set(rem.lines, { yPercent: 110 });
  una($(".manifiesto"), () => {
    G.timeline()
      .to(man.words, { color: css("--texto") || "#EAF0F6", duration: 0.35, ease: "power1.out", stagger: { each: 0.045, ease: "power1.in" } })
      .to(rem.lines, { yPercent: 0, duration: 0.9, ease: "expo.out" }, "-=0.25");
  });

  // ---------------------------------------------------------------- antes → después: aparecen en rojo y se recodifican una tras otra
  const GLIFOS = "0123456789%#·/<>";
  function recodificar(el, texto, dur = 0.65) {
    const o = { p: 0 }, largo = Math.max(texto.length, el.textContent.length);
    G.to(o, { p: 1, duration: dur, ease: "power2.out", onUpdate() {
      const fijos = Math.floor(o.p * largo); let s = "";
      for (let i = 0; i < texto.length; i++) s += i < fijos || texto[i] === " " ? texto[i] : GLIFOS[(Math.random() * GLIFOS.length) | 0];
      el.textContent = s;
    }, onComplete() { el.textContent = texto; } });
  }
  const metricas = $$(".metrica");
  metricas.forEach((c) => { c.classList.add("es-antes"); $(".metrica-valor", c).textContent = c.dataset.antes; });
  G.set(metricas, { autoAlpha: 0, y: 24 }); G.set("#riel-avance", { scaleX: 0 });
  una($(".cambio"), (d) => {
    subirTitulo(d);
    const tl = G.timeline({ delay: 0.15 });
    tl.to(metricas, { autoAlpha: 1, y: 0, duration: 0.6, ease: "power3.out", stagger: 0.07 }, 0)
      .to("#riel-avance", { scaleX: 1, duration: 0.3 * metricas.length + 0.6, ease: "power1.inOut" }, 0.6);
    metricas.forEach((c, i) => tl.add(() => {
      c.classList.remove("es-antes");
      recodificar($(".metrica-valor", c), c.dataset.despues);
      G.fromTo(c, { rotateX: -18, scale: 0.97 }, { rotateX: 0, scale: 1, duration: 0.8, ease: "back.out(1.7)" });
    }, 0.75 + i * 0.3));
  });

  // ---------------------------------------------------------------- cinco ejes: el texto del paso entra; la red cambia de escena
  pasos.forEach((p) => {
    const b = $(".paso-kpi b", p), final = b.textContent, m = final.match(/^([\d,]+)(.*)$/);
    const cont = [...p.children];
    entradas.set(p, () => {
      G.fromTo(cont, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: "power3.out", stagger: { each: 0.05, ease: "power1.in" }, overwrite: true });
      if (m && !p.dataset.contado) {
        p.dataset.contado = "1";
        const n = parseFloat(m[1].replace(",", ".")), dec = (m[1].split(",")[1] || "").length, o = { v: 0 };
        G.to(o, { v: n, duration: 1.1, ease: "power3.out", onUpdate: () => { b.textContent = coma(o.v, dec) + m[2]; }, onComplete: () => { b.textContent = final; } });
      }
    });
  });

  // ---------------------------------------------------------------- prueba de fuego: se reproduce sola al llegar (y con «Repetir»)
  const trazo = $("#ecg-caida .ecg-traza");
  let tlCaida = null;
  function jugarCaida() {
    tlCaida?.kill();
    repetir.hidden = true;
    estadoCaida(0);
    const o = { p: 0 };
    tlCaida = G.timeline()
      .fromTo(trazo, { drawSVG: "0% 0%" }, { drawSVG: "0% 100%", duration: 7, ease: "none" }, 0)
      .to(o, { p: 1, duration: 7, ease: "none", onUpdate: () => estadoCaida(o.p) }, 0)
      .add(() => { repetir.hidden = false; G.from(repetir, { autoAlpha: 0, y: 8, duration: 0.4 }); });
  }
  lis.forEach((l) => l.classList.remove("hecha"));
  estadoCaida(0); G.set(trazo, { drawSVG: "0% 0%" });
  entradas.set(caida, () => { if (!tlCaida || !tlCaida.isActive()) jugarCaida(); });
  repetir?.addEventListener("click", jugarCaida);

  // ---------------------------------------------------------------- resultados
  const cuentas = $$(".kpi-tile .cuenta").map((c) => ({ c, a: parseFloat(c.dataset.a), dec: +(c.dataset.dec || 0), final: c.textContent }));
  cuentas.forEach((x) => { x.c.textContent = coma(0, x.dec); });
  G.set("#spark-rto", { drawSVG: "0% 0%" }); G.set("#anillo-cis", { strokeDashoffset: 314.16 });
  G.set("#matriz i", { scale: 0, autoAlpha: 0 }); G.set(".k-escudos svg", { scale: 1.8, autoAlpha: 0, y: -8 });
  G.set(".k-barras i", { scaleY: 0 }); G.set(".k-barras em", { scaleX: 0, transformOrigin: "0 50%" });
  G.set(".kpi-tile", { autoAlpha: 0, y: 20 });
  una($(".kpis"), (d) => {
    subirTitulo(d);
    G.to(".kpi-tile", { autoAlpha: 1, y: 0, duration: 0.6, ease: "power3.out", stagger: { each: 0.06, ease: "power1.in" } });
    cuentas.forEach((x) => { const o = { v: 0 }; G.to(o, { v: x.a, duration: 1.4, delay: 0.25, ease: "power3.out", onUpdate: () => { x.c.textContent = coma(o.v, x.dec); }, onComplete: () => { x.c.textContent = x.final; } }); });
    G.to("#spark-rto", { drawSVG: "0% 100%", duration: 1.5, delay: 0.3, ease: "power2.inOut" });
    G.to("#anillo-cis", { strokeDashoffset: 6.1, duration: 1.5, delay: 0.3, ease: "power3.out" });
    G.to("#matriz i", { scale: 1, autoAlpha: 1, duration: 0.45, delay: 0.35, ease: "back.out(2)", stagger: { each: 0.018, from: "random" } });
    G.to(".k-escudos svg", { scale: 1, autoAlpha: 1, y: 0, duration: 0.5, delay: 0.4, ease: "back.out(2.2)", stagger: { each: 0.1, ease: "power1.in" } });
    G.to(".k-barras i", { scaleY: 1, duration: 0.9, delay: 0.4, ease: "power3.out", stagger: 0.08 });
    G.to(".k-barras em", { scaleX: 1, duration: 1.1, delay: 0.5, ease: "power2.inOut" });
  });

  // ---------------------------------------------------------------- herramientas, en vivo, compartir y cierre
  G.set(".herramientas .tile", { autoAlpha: 0, y: 18 });
  una($("#herramientas"), (d) => { subirTitulo(d); G.to(".herramientas .tile", { autoAlpha: 1, y: 0, duration: 0.6, ease: "power3.out", stagger: { each: 0.06, ease: "power1.in" }, delay: 0.1 }); });
  G.set(".ficha", { autoAlpha: 0, y: 18 });
  una($("#en-vivo"), (d) => { subirTitulo(d); G.to(".ficha", { autoAlpha: 1, y: 0, duration: 0.7, ease: "power3.out", delay: 0.12 }); });
  G.set("#acceso .tarjeta", { autoAlpha: 0, y: 18 });
  una($("#acceso"), (d) => { subirTitulo(d); G.to("#acceso .tarjeta", { autoAlpha: 1, y: 0, duration: 0.6, ease: "power3.out", stagger: 0.08, delay: 0.1 }); });
  // equipo: cada nombre sube desde su máscara y su línea se dibuja, uno tras otro
  G.set(".equipo-nombre", { yPercent: 110 }); G.set(".equipo li", { "--trazo": 0 });
  una($("#equipo"), (d) => {
    subirTitulo(d);
    G.to(".equipo-nombre", { yPercent: 0, duration: 1.0, ease: "expo.out", stagger: { each: 0.12, ease: "power1.in" }, delay: 0.25 });
    G.to(".equipo li", { "--trazo": 1, duration: 0.9, ease: "power3.inOut", stagger: 0.12, delay: 0.15 });
  });
  G.set(".cierre .acciones > *", { autoAlpha: 0, y: 12 });
  una($(".cierre"), (d) => { subirTitulo(d); G.to(".cierre .acciones > *", { autoAlpha: 1, y: 0, duration: 0.6, ease: "power3.out", stagger: 0.1, delay: 0.35 }); });

  // si al cargar ya hay una diapositiva activa (recarga a mitad de página), se arma ahora
  if (activa >= 0) entradas.get(diapos[activa])?.(diapos[activa]);

  // ---------------------------------------------------------------- microinteracciones (solo puntero fino)
  if (fino) {
    $$(".inclinable").forEach((t) => {
      const rx = G.quickTo(t, "rotationX", { duration: 0.5, ease: "power3.out" }), ry = G.quickTo(t, "rotationY", { duration: 0.5, ease: "power3.out" });
      G.set(t, { transformPerspective: 900 });
      t.addEventListener("pointermove", (e) => { const r = t.getBoundingClientRect(); ry(((e.clientX - r.left) / r.width - 0.5) * 7); rx(-((e.clientY - r.top) / r.height - 0.5) * 7); });
      t.addEventListener("pointerleave", () => { rx(0); ry(0); });
    });
    $$(".magnetico").forEach((b) => {
      const x = G.quickTo(b, "x", { duration: 0.4, ease: "power3.out" }), y = G.quickTo(b, "y", { duration: 0.4, ease: "power3.out" });
      b.addEventListener("pointermove", (e) => { const r = b.getBoundingClientRect(); x((e.clientX - r.left - r.width / 2) * 0.22); y((e.clientY - r.top - r.height / 2) * 0.3); });
      b.addEventListener("pointerleave", () => { G.to(b, { x: 0, y: 0, duration: 0.7, ease: "elastic.out(1, .4)" }); });
    });
  }
})();
