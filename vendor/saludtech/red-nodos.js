/* Red de nodos 3D — v2 «escenas» (2026-11-15). Canvas 2D con proyección en perspectiva propia: sin WebGL ni three.js (~10 KB).
   Las 5 máquinas, la IP flotante del portal y el anfitrión, coloreadas con el ESTADO REAL, y escenas para contar el proyecto:
     normal   paquetes por los enlaces            cableado  los enlaces se tienden uno a uno
     vlan     cada zona con su color              cluster   caída del nodo activo y recuperación en el otro (bucle de 7 s)
     web      escudo alrededor del servidor web   ataque    ataques que chocan contra el escudo
   Uso:  const red = RedNodos.montar(canvas, { intro: true, fondo: true, ip: false, zoom: 1.1 });
         red.estado({ maquinas: { nodo1: { on: true, nivel: "ok" } }, vip: true });   red.escena("cluster");
   Gira sola despacio, se arrastra (o flechas), se pausa fuera de pantalla y con la pestaña oculta. Con prefers-reduced-motion queda quieta
   y cada escena se muestra en su fotograma final (sin animar). Lo usan el inicio y la alternativa 2D de la consola. */
(() => {
  "use strict";
  const N = [
    { id: "nodo1", et: "nodo1", ip: "10.44.0.11", p: [-1.25, 0.15, 0.25], r: 1.15 },
    { id: "nodo2", et: "nodo2", ip: "10.44.0.12", p: [1.25, 0.15, 0.25], r: 1.15 },
    { id: "vip", et: "portal", ip: "10.44.0.100", p: [0, 0.95, 0.35], r: 0.8, vip: true },
    { id: "almacen", et: "almacen", ip: "10.44.0.30", p: [0, -0.55, -1.25], r: 1.1 },
    { id: "web-dmz", et: "web-dmz", ip: "10.44.0.40", p: [0, 1.0, 1.75], r: 1.05 },
    { id: "cliente", et: "cliente", ip: "10.44.0.50", p: [-1.8, -0.55, 1.2], r: 0.95 },
    { id: "anfitrion", et: "anfitrión", ip: "10.44.0.1", p: [1.9, -0.5, 0.95], r: 0.9, host: true },
  ];
  const E = [
    ["nodo1", "nodo2", "latido"], ["nodo1", "almacen", "iscsi"], ["nodo2", "almacen", "iscsi"],
    ["nodo1", "vip", "vip"], ["nodo2", "vip", "vip"], ["vip", "web-dmz", "proxy"], ["web-dmz", "cliente", "pacientes"],
    ["anfitrion", "nodo1", "gestion"], ["anfitrion", "nodo2", "gestion"], ["anfitrion", "almacen", "gestion"],
    ["anfitrion", "web-dmz", "gestion"], ["anfitrion", "cliente", "gestion"],
  ];
  const ZONA = { nodo1: "srv", nodo2: "srv", almacen: "srv", vip: "srv", "web-dmz": "dmz", cliente: "usr", anfitrion: "adm" };
  const COL_ZONA = { srv: "#6CC4FF", dmz: "#FF8A5B", usr: "#B794F6", adm: "#8A98A8" };
  const FOCO = { cluster: ["nodo1", "nodo2", "vip", "almacen"], web: ["web-dmz", "vip", "cliente"], ataque: ["web-dmz"] };
  const C = [0, 1, 2].map((k) => N.reduce((a, n) => a + n.p[k], 0) / N.length);
  const R = Math.max(...N.map((n) => Math.hypot(n.p[0] - C[0], n.p[1] - C[1], n.p[2] - C[2])));
  const css = (n, def) => (getComputedStyle(document.documentElement).getPropertyValue(n).trim() || def);
  const lerp = (a, b, k) => a + (b - a) * k, clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const suave = (k) => k * k * (3 - 2 * k);

  function montar(canvas, op = {}) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return { estado() {}, escena() {} };
    const reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const conIP = op.ip !== false, conEtiquetas = op.etiquetas !== false, zoom = op.zoom || 1;
    const est = { maquinas: {}, vip: null };
    let modo = "normal", tModo = 99, ti = op.intro && !reducido ? 0 : 1;
    let ang = op.angulo ?? 0.35, incl = 0.32, vel = reducido ? 0 : (op.giro ?? 0.07);
    let tiltX = 0, tiltY = 0, objX = 0, objY = 0;
    let arr = null, ancho = 0, alto = 0, visible = true, ult = performance.now(), raf = 0;
    const paq = E.filter((e) => e[2] !== "gestion").map((e, i) => ({ e, t: (i * 0.37) % 1 }));
    const polvo = op.fondo ? Array.from({ length: 110 }, (_, i) => {
      const u = Math.random() * 2 - 1, f = Math.random() * 6.283, rr = 2.6 + Math.random() * 3.2;
      return { p: [Math.sqrt(1 - u * u) * Math.cos(f) * rr + C[0], u * rr * 0.55 + C[1], Math.sqrt(1 - u * u) * Math.sin(f) * rr + C[2]], s: Math.random(), k: i };
    }) : [];
    // de dónde sale cada nodo en la intro (se arma desde partículas dispersas)
    const origen = Object.fromEntries(N.map((n) => [n.id, [n.p[0] * 3.2 + (Math.random() - 0.5) * 3, n.p[1] * 3 + (Math.random() - 0.5) * 3, n.p[2] * 2.5]]));
    let ataques = [], chispas = [], bloqueados = 0, proxAtaque = 0;
    const col = { pulso: css("--pulso", "#3DDBA5"), dato: css("--dato", "#6CC4FF"), falla: css("--falla", "#FF6B6B"), alerta: css("--alerta", "#FFB347"),
                  texto: css("--texto", "#EAF0F6"), texto3: css("--texto-3", "#7D8B9C"), fondo: css("--superficie", "#0C121A") };

    function medir() {
      const r = canvas.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
      ancho = r.width; alto = r.height;
      canvas.width = Math.round(ancho * dpr); canvas.height = Math.round(alto * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function proyectar([x0, y0, z0]) {
      const x = x0 - C[0], y = y0 - C[1], z = z0 - C[2];
      const a = ang + tiltX, b = incl + tiltY;
      const ca = Math.cos(a), sa = Math.sin(a), ci = Math.cos(b), si = Math.sin(b);
      const x1 = x * ca - z * sa, z1 = x * sa + z * ca;
      const y1 = y * ci - z1 * si, z2 = y * si + z1 * ci;
      const d = 6.2, f = d / (d - z2);
      const esc = zoom * Math.max(24, Math.min((ancho - 56) / 2 / (R * 1.1), (alto - 100) / 2 / (R * 0.95)));
      return { x: ancho / 2 + x1 * esc * f, y: alto / 2 - (op.subir ?? 28) - y1 * esc * f, f, z: z2, esc };
    }
    const posNodo = (n) => {                                     // intro: del polvo a su sitio
      if (ti >= 1) return n.p;
      const k = suave(clamp((ti * 1.6) - N.indexOf(n) * 0.09));
      return [0, 1, 2].map((i) => lerp(origen[n.id][i], n.p[i], k));
    };
    const aparicion = (n) => ti >= 1 ? 1 : suave(clamp((ti * 1.6) - N.indexOf(n) * 0.09));

    // ---------------------------------------------------------------- escena «cluster»: fase del bucle
    const T_CLUSTER = 7;
    function cluster() {
      const p = reducido ? 4.5 : tModo % T_CLUSTER;                // con movimiento reducido: el fotograma «recuperado»
      return { p, caido: p >= 1.5 && p < 6.2, buscando: p >= 1.6 && p < 3.3, enNodo2: p >= 3.3, vuelve: p >= 6.2,
               flash: p >= 1.5 && p < 1.85 ? 1 - (p - 1.5) / 0.35 : 0, crono: p < 1.6 ? 0 : p < 3.3 ? (p - 1.6) / 1.7 * 9.63 : 9.63 };
    }
    function colorNodo(n, cl) {
      if (modo === "vlan") return COL_ZONA[ZONA[n.id]];
      if (modo === "cluster" && cl) {
        if (n.id === "nodo1") return cl.caido ? col.falla : cl.vuelve ? col.texto3 : col.pulso;
        if (n.id === "nodo2") return cl.enNodo2 ? col.pulso : col.texto3;
        if (n.vip) return cl.buscando ? col.alerta : col.pulso;
      }
      if (modo === "ataque" && n.id === "web-dmz") return col.pulso;
      if (n.host) return col.dato;
      if (n.vip) return est.vip === false ? col.falla : est.vip ? col.pulso : col.texto3;
      const m = est.maquinas[n.id];
      if (!m || m.on == null) return col.texto3;
      if (!m.on) return col.falla;
      return m.nivel === "critico" ? col.falla : (m.nivel === "alerta" || m.nivel === "aviso") ? col.alerta : col.pulso;
    }
    const encendido = (id) => id === "anfitrion" || (id === "vip" ? est.vip !== false : est.maquinas[id]?.on !== false);
    const enFoco = (id) => !FOCO[modo] || FOCO[modo].includes(id);

    function enlaceActivo(a, b, cl) {
      if (modo !== "cluster" || !cl) return null;
      const par = [a, b].sort().join("|");
      if (par === "nodo1|vip") return cl.p < 1.5 ? "fuerte" : "roto";
      if (par === "nodo2|vip") return cl.enNodo2 ? "fuerte" : "debil";
      if (par === "almacen|nodo1") return cl.caido || cl.vuelve ? "debil" : "normal";
      return null;
    }

    function dibujar(dt) {
      ctx.clearRect(0, 0, ancho, alto);
      obstaculos = [];
      const cl = modo === "cluster" ? cluster() : null;
      const P = Object.fromEntries(N.map((n) => [n.id, proyectar(posNodo(n))]));
      // polvo de fondo (profundidad)
      for (const d of polvo) {
        const q = proyectar(d.p), a = clamp(0.08 + (q.z + 3) * 0.05, 0.03, 0.35) * (ti < 1 ? ti : 1);
        ctx.fillStyle = `rgba(148,170,196,${a.toFixed(3)})`;
        ctx.fillRect(q.x, q.y, 1.4 * q.f, 1.4 * q.f);
      }
      // halos de zona (VLAN)
      if (modo === "vlan") {
        const k = reducido ? 1 : suave(clamp(tModo / 0.8));
        for (const n of N) {
          const q = P[n.id], g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, 70 * q.f);
          g.addColorStop(0, COL_ZONA[ZONA[n.id]] + Math.round(0x38 * k).toString(16).padStart(2, "0")); g.addColorStop(1, "transparent");
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, 70 * q.f, 0, 7); ctx.fill();
        }
      }
      // enlaces
      const kCable = modo === "cableado" ? (reducido ? 1 : clamp(tModo / 2.4)) : 1;
      E.forEach(([a, b, tipo], i) => {
        const A = P[a], B = P[b];
        let k = Math.min(aparicion(N.find((n) => n.id === a)), aparicion(N.find((n) => n.id === b)));
        if (modo === "cableado") k = Math.min(k, clamp(kCable * E.length - i));     // se tienden en orden
        if (k <= 0) return;
        const x2 = lerp(A.x, B.x, k), y2 = lerp(A.y, B.y, k);
        const act = enlaceActivo(a, b, cl), vivo = encendido(a) && encendido(b);
        const foco = enFoco(a) && enFoco(b);
        ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(x2, y2);
        ctx.setLineDash(tipo === "gestion" ? [3, 5] : act === "roto" ? [2, 6] : []);
        ctx.lineWidth = act === "fuerte" ? 3 : tipo === "latido" ? 1.8 : 1.2;
        let c = tipo === "gestion" ? "rgba(148,170,196,.16)" : tipo === "latido" ? col.pulso + "88" : "rgba(148,170,196,.24)";
        if (modo === "vlan") c = ZONA[a] === ZONA[b] ? COL_ZONA[ZONA[a]] + "aa" : "rgba(148,170,196,.14)";
        if (act === "fuerte") c = col.pulso; else if (act === "roto") c = col.falla + "99"; else if (act === "debil") c = "rgba(148,170,196,.12)";
        if (!vivo && modo === "normal") c = "rgba(255,107,107,.3)";
        ctx.strokeStyle = c; ctx.globalAlpha = foco ? 1 : 0.25; ctx.stroke(); ctx.globalAlpha = 1;
        if (modo === "cableado" && k > 0 && k < 1) {                // cabeza brillante del cable que se tiende
          ctx.beginPath(); ctx.arc(x2, y2, 3.2, 0, 7); ctx.fillStyle = col.alerta; ctx.shadowColor = col.alerta; ctx.shadowBlur = 12; ctx.fill(); ctx.shadowBlur = 0;
        }
      });
      ctx.setLineDash([]);
      // paquetes
      if (modo === "normal" || modo === "vlan" || (modo === "cableado" && kCable >= 1)) {
        for (const p of paq) {
          const [a, b, tipo] = p.e;
          if (!encendido(a) || !encendido(b) || ti < 1) continue;
          if (!reducido) p.t = (p.t + dt * (tipo === "latido" ? 0.55 : 0.28)) % 1;
          const A = P[a], B = P[b];
          ctx.beginPath(); ctx.arc(lerp(A.x, B.x, p.t), lerp(A.y, B.y, p.t), 2.2 * (A.f + B.f) / 2, 0, 7);
          ctx.fillStyle = modo === "vlan" ? COL_ZONA[ZONA[a]] : tipo === "latido" ? col.pulso : col.dato; ctx.globalAlpha = 0.9; ctx.fill(); ctx.globalAlpha = 1;
        }
      }
      // escudo del servidor web (escenas web y ataque)
      if (modo === "web" || modo === "ataque") {
        const q = P["web-dmz"], rad = 34 * q.f * zoom, k = reducido ? 1 : suave(clamp(tModo / 0.7));
        ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(reducido ? 0 : tModo * 0.5);
        ctx.setLineDash([6, 7]); ctx.lineWidth = 2; ctx.strokeStyle = col.pulso; ctx.globalAlpha = 0.85 * k;
        ctx.beginPath(); ctx.arc(0, 0, rad * (0.7 + 0.3 * k), 0, 7); ctx.stroke(); ctx.restore(); ctx.setLineDash([]); ctx.globalAlpha = 1;
        const g = ctx.createRadialGradient(q.x, q.y, rad * 0.4, q.x, q.y, rad * 1.25);
        g.addColorStop(0, "transparent"); g.addColorStop(1, col.pulso + "22"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, rad * 1.25, 0, 7); ctx.fill();
      }
      if (modo === "ataque") {
        const q = P["web-dmz"], rad = 34 * q.f * zoom;
        if (!reducido) {
          proxAtaque -= dt;
          if (proxAtaque <= 0) {
            proxAtaque = 0.32 + Math.random() * 0.3;
            const lado = Math.random() < 0.5 ? -1 : 1;
            ataques.push({ x: lado < 0 ? -10 : ancho + 10, y: alto * (0.15 + Math.random() * 0.7), v: 220 + Math.random() * 120 });
          }
          for (const at of ataques) {
            const dx = q.x - at.x, dy = q.y - at.y, d = Math.hypot(dx, dy);
            if (d < rad * 1.05) { at.fin = true; bloqueados++; for (let i = 0; i < 7; i++) chispas.push({ x: at.x, y: at.y, a: Math.random() * 6.283, v: 60 + Math.random() * 90, t: 0 }); continue; }
            at.x += dx / d * at.v * dt; at.y += dy / d * at.v * dt;
            ctx.beginPath(); ctx.moveTo(at.x, at.y); ctx.lineTo(at.x - dx / d * 14, at.y - dy / d * 14);
            ctx.strokeStyle = col.falla; ctx.lineWidth = 2.2; ctx.stroke();
          }
          ataques = ataques.filter((a) => !a.fin);
        }
        for (const c of chispas) {
          c.t += dt;
          const r0 = c.v * c.t;
          ctx.beginPath(); ctx.moveTo(c.x + Math.cos(c.a) * r0, c.y + Math.sin(c.a) * r0); ctx.lineTo(c.x + Math.cos(c.a) * (r0 + 6), c.y + Math.sin(c.a) * (r0 + 6));
          ctx.strokeStyle = `rgba(255,179,71,${(1 - c.t / 0.45).toFixed(2)})`; ctx.lineWidth = 1.6; ctx.stroke();
        }
        chispas = chispas.filter((c) => c.t < 0.45);
        if (conEtiquetas) {
          const txt = reducido ? "6 de 6 ataques bloqueados" : `${bloqueados} bloqueados`;
          ctx.font = "600 12px 'Geist Mono', ui-monospace, monospace"; ctx.fillStyle = col.alerta; ctx.textAlign = "center";
          ctx.fillText(txt, q.x, q.y - rad - 12);
          const w = ctx.measureText(txt).width + 8; obstaculos.push({ x: q.x - w / 2, y: q.y - rad - 26, w, h: 18 });
        }
      }
      // nodos, del fondo al frente
      const orden = N.map((n) => ({ n, q: P[n.id] })).sort((u, v) => u.q.z - v.q.z);
      const rotulos = [], discos = [];
      for (const { n, q } of orden) {
        const ap = aparicion(n); if (ap <= 0) continue;
        const c = colorNodo(n, cl), rad = 11 * n.r * q.f * zoom * (0.4 + 0.6 * ap);
        const prof = Math.max(0.45, Math.min(1, 0.55 + q.z * 0.18)) * ap * (enFoco(n.id) ? 1 : 0.3);
        discos.push({ id: n.id, x: q.x - rad - 7, y: q.y - rad - 7, w: 2 * rad + 14, h: 2 * rad + 14 });
        ctx.globalAlpha = prof;
        const brillo = (modo === "cluster" && cl && ((n.id === "nodo2" && cl.enNodo2) || (n.id === "nodo1" && cl.p < 1.5))) || (modo === "ataque" && n.id === "web-dmz");
        if (brillo) { ctx.shadowColor = c; ctx.shadowBlur = 18; }
        ctx.beginPath(); ctx.arc(q.x, q.y, rad + 7, 0, 7); ctx.fillStyle = c + "1f"; ctx.fill();
        ctx.beginPath(); ctx.arc(q.x, q.y, rad, 0, 7); ctx.fillStyle = col.fondo; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = c; ctx.stroke(); ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.arc(q.x, q.y, rad * 0.38, 0, 7); ctx.fillStyle = c; ctx.fill();
        if (modo === "cluster" && cl && n.id === "nodo1" && cl.caido) {     // cruz sobre el nodo apagado
          ctx.strokeStyle = col.falla; ctx.lineWidth = 2.4; const s = rad * 0.9;
          ctx.beginPath(); ctx.moveTo(q.x - s, q.y - s); ctx.lineTo(q.x + s, q.y + s); ctx.moveTo(q.x + s, q.y - s); ctx.lineTo(q.x - s, q.y + s); ctx.stroke();
        }
        if (cl && n.id === "nodo1" && cl.flash > 0) {
          ctx.globalAlpha = cl.flash; ctx.beginPath(); ctx.arc(q.x, q.y, rad + 18 * (1 - cl.flash) + 6, 0, 7); ctx.strokeStyle = col.falla; ctx.lineWidth = 3; ctx.stroke();
        }
        if (conEtiquetas && ancho > 300) rotulos.push({ n, q, rad, prof });
        ctx.globalAlpha = 1;
      }
      if (rotulos.length) dibujarRotulos(rotulos, discos, cl, dt);
    }

    // ---------------------------------------------------------------- rótulos sin choques (2026-11-15)
    // Al girar, el rótulo de un nodo del fondo podía caer encima de otro rótulo o de otro nodo (p. ej. «almacen» bajo «nodo2»).
    // Ahora se colocan del frente al fondo: cada uno prueba debajo de su nodo, luego encima, y si no cabe en ningún lado se desvanece.
    // El cambio de sitio y la atenuación se suavizan para que no salten. canvas._rotulos guarda los visibles (lo usa el revisor).
    const estRot = new Map();
    let obstaculos = [];                                          // textos ya pintados en este cuadro (p. ej. «12 bloqueados»)
    function dibujarRotulos(rotulos, discos, cl, dt) {
      const puestos = obstaculos.slice(), k = reducido || !dt ? 1 : 1 - Math.exp(-dt * 9);
      const choca = (r, propio) => r.y < 2 || r.y + r.h > alto - 2 || r.x < 2 || r.x + r.w > ancho - 2
        || puestos.some((p) => r.x < p.x + p.w && r.x + r.w > p.x && r.y < p.y + p.h && r.y + r.h > p.y)
        || discos.some((d) => d.id !== propio && r.x < d.x + d.w && r.x + r.w > d.x && r.y < d.y + d.h && r.y + r.h > d.y);
      // el aviso del portal en la escena del clúster va primero: es lo que se está contando
      const vip = cl && rotulos.find((r) => r.n.vip);
      if (vip) {
        const { q, rad } = vip, txt = cl.p < 1.6 ? "atiende nodo1" : cl.buscando ? `${cl.crono.toFixed(2).replace(".", ",")} s` : cl.vuelve ? "sin segundo corte" : "volvió en 9,63 s";
        ctx.font = "600 12px 'Geist Mono', ui-monospace, monospace"; ctx.textAlign = "center";
        const w = ctx.measureText(txt).width + 8;
        ctx.globalAlpha = 1; ctx.fillStyle = cl.buscando ? col.alerta : col.pulso;
        ctx.fillText(txt, q.x, q.y - rad - 14);
        puestos.push({ x: q.x - w / 2, y: q.y - rad - 28, w, h: 18 });
      }
      for (const { n, q, rad, prof } of rotulos.slice().sort((u, v) => v.q.z - u.q.z)) {
        const fs = Math.round(12 * Math.min(1.15, q.f) * Math.min(1.2, zoom)), conIp = conIP && ancho > 480;
        ctx.font = `600 ${fs}px Geist, system-ui, sans-serif`;
        const w = ctx.measureText(n.et).width + 8, h = fs + 6 + (conIp ? 14 : 0);
        const abajo = { x: q.x - w / 2, y: q.y + rad + 18 - fs - 2, w, h };
        const arriba = { x: q.x - w / 2, y: q.y - rad - 12 - h, w, h };
        const libreAbajo = !choca(abajo, n.id), libreArriba = !(vip && vip.n === n) && !choca(arriba, n.id);
        const s = estRot.get(n.id) || { sube: 0, a: 1 };
        const quiere = libreAbajo ? 0 : libreArriba ? 1 : s.sube > 0.5 ? 1 : 0;
        s.sube += (quiere - s.sube) * k;
        s.a += ((libreAbajo || libreArriba ? 1 : 0) - s.a) * k;          // sin sitio: se desvanece del todo (reaparece al girar)
        estRot.set(n.id, s);
        const dy = (arriba.y - abajo.y) * s.sube, r = { ...abajo, y: abajo.y + dy };
        if (s.a > 0.5) puestos.push(r);
        ctx.globalAlpha = prof * s.a; ctx.fillStyle = col.texto; ctx.textAlign = "center";
        ctx.fillText(n.et, q.x, q.y + rad + 18 + dy);
        if (conIp) {
          ctx.font = `500 ${Math.round(10.5 * Math.min(1.1, q.f))}px "Geist Mono", ui-monospace, monospace`; ctx.fillStyle = col.texto3;
          ctx.fillText(n.ip, q.x, q.y + rad + 32 + dy);
        }
      }
      ctx.globalAlpha = 1;
      canvas._rotulos = puestos;
    }
    function bucle(t) {
      const dt = Math.min(0.05, (t - ult) / 1000); ult = t;
      if (ti < 1) ti = Math.min(1, ti + dt / 1.8);
      tModo += dt;
      if (!arr) ang += vel * dt;
      tiltX += (objX - tiltX) * Math.min(1, dt * 3); tiltY += (objY - tiltY) * Math.min(1, dt * 3);
      dibujar(dt);
      raf = visible && !document.hidden && !reducido ? requestAnimationFrame(bucle) : 0;
    }
    const seguir = () => { if (!raf && visible && !document.hidden && !reducido) { ult = performance.now(); raf = requestAnimationFrame(bucle); } };
    canvas.addEventListener("pointerdown", (e) => { arr = { x: e.clientX, y: e.clientY, a: ang, i: incl }; canvas.setPointerCapture(e.pointerId); canvas.classList.add("arrastrando"); });
    canvas.addEventListener("pointermove", (e) => { if (!arr) return; ang = arr.a + (e.clientX - arr.x) * 0.008; incl = clamp(arr.i + (e.clientY - arr.y) * 0.005, -0.2, 0.9); if (reducido) dibujar(0); });
    const soltar = () => { arr = null; canvas.classList.remove("arrastrando"); };
    canvas.addEventListener("pointerup", soltar); canvas.addEventListener("pointercancel", soltar);
    canvas.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") ang -= 0.2; else if (e.key === "ArrowRight") ang += 0.2; else return; e.preventDefault(); dibujar(0); });
    if (op.parallax && !reducido && matchMedia("(pointer: fine)").matches) {
      addEventListener("pointermove", (e) => { objX = (e.clientX / innerWidth - 0.5) * 0.35; objY = (e.clientY / innerHeight - 0.5) * 0.12; }, { passive: true });
    }
    new ResizeObserver(() => { medir(); dibujar(0); }).observe(canvas);
    if ("IntersectionObserver" in window) new IntersectionObserver(([en]) => { visible = en.isIntersecting; seguir(); }).observe(canvas);
    document.addEventListener("visibilitychange", seguir);
    medir(); dibujar(0); seguir();
    return {
      estado(d) { Object.assign(est, d); if (!raf) dibujar(0); },
      escena(m) { if (m === modo) return; modo = m; tModo = 0; ataques = []; chispas = []; bloqueados = 0; if (!raf) dibujar(0); },
    };
  }
  window.RedNodos = { montar };
})();
