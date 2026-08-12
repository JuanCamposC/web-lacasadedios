// Reveal en scroll + contadores animados.
// Se re-inicializa en `astro:page-load` para funcionar con View Transitions.

function reduceMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function initReveal() {
  const els = Array.from(
    document.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-visible)'),
  );
  if (!els.length) return;

  if (reduceMotion()) {
    els.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const io = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target as HTMLElement;
        const delay = el.dataset.revealDelay;
        if (delay) el.style.transitionDelay = `${delay}ms`;
        el.classList.add('is-visible');
        obs.unobserve(el);
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
  );

  els.forEach((el) => io.observe(el));
}

function animateCount(el: HTMLElement, target: number) {
  const dur = 1200;
  const start = performance.now();
  const suffix = el.dataset.countSuffix ?? '';

  // Red de seguridad: si el navegador congela los fotogramas (pestaña en
  // segundo plano, equipo lento, captura automatizada), la cifra se quedaría a
  // medias mostrando un dato FALSO. Pasado el tiempo previsto se fija el valor
  // real, pase lo que pase.
  const cierre = window.setTimeout(() => {
    el.textContent = target.toString() + suffix;
  }, dur + 120);

  function tick(now: number) {
    const p = Math.min((now - start) / dur, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(eased * target).toString() + suffix;
    if (p < 1) requestAnimationFrame(tick);
    else window.clearTimeout(cierre);
  }
  requestAnimationFrame(tick);
}

function initCounters() {
  const els = Array.from(
    document.querySelectorAll<HTMLElement>('[data-count]:not([data-counted])'),
  );
  if (!els.length) return;

  els.forEach((el) => {
    const target = Number(el.dataset.count || '0');
    if (reduceMotion()) {
      el.textContent = target.toString() + (el.dataset.countSuffix ?? '');
      el.setAttribute('data-counted', '');
      return;
    }
    const io = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          el.setAttribute('data-counted', '');
          animateCount(el, target);
          obs.unobserve(el);
        });
      },
      { threshold: 0.5 },
    );
    io.observe(el);
  });
}

function init() {
  initReveal();
  initCounters();
}

// Astro View Transitions: se dispara en la carga inicial y tras cada navegación.
document.addEventListener('astro:page-load', init);
// Fallback si no hay View Transitions activas en la página.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
