/* Se carga en <head> (la CSP no admite scripts en línea): marca la página antes de pintarla para que lo que va a entrar animado no
   aparezca un instante antes de su entrada. Si el JavaScript de animación no llegara, el CSS lo muestra igual a los 3 s. */
(function () { try { if (!matchMedia("(prefers-reduced-motion: reduce)").matches) document.documentElement.classList.add("anim-pre"); } catch (e) {} })();
