/**
 * Progresywne ulepszenia motywu „dossier".
 *
 * Bez tego skryptu strona jest w pełni czytelna: pasek scenariuszy ma pełną
 * szerokość, a sekcje są widoczne. Skrypt dokłada tylko cień przyklejonego
 * mastheadu, pasek postępu czytania, odsłanianie sekcji i animację prognozy.
 * CSP: brak CDN, brak eval, brak inline.
 */
(() => {
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.classList.add('js');

  const progress = document.createElement('div');
  progress.className = 'read-progress';
  progress.setAttribute('aria-hidden', 'true');
  document.body.appendChild(progress);

  let queued = false;
  const onScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      const y = window.scrollY || 0;
      const height = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.width = `${height > 0 ? Math.min(100, (y / height) * 100) : 0}%`;
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  onScroll();

  // Odsłanianie: tylko gdy IO działa i użytkownik nie prosi o mniej ruchu.
  const reveals = [...document.querySelectorAll('.reveal')];
  if (!('IntersectionObserver' in window) || reduce) {
    reveals.forEach((el) => el.classList.add('in'));
  } else {
    const revealObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('in');
        revealObserver.unobserve(entry.target);
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach((el) => revealObserver.observe(el));
  }

  // Pasek scenariuszy rośnie dopiero, gdy wchodzi w kadr.
  const bars = [...document.querySelectorAll('[data-scen-bar]')];
  if (!('IntersectionObserver' in window) || reduce) {
    bars.forEach((el) => el.classList.add('in'));
  } else {
    const barObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('in');
        barObserver.unobserve(entry.target);
      }
    }, { threshold: 0.35 });
    bars.forEach((el) => barObserver.observe(el));
  }
})();
