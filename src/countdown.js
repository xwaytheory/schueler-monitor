/**
 * Odliczanie do ustawowego limitu 40 dni.
 *
 * Serwer renderuje wartości startowe (działają bez JS), a ten plik tylko je
 * odświeża co sekundę. Osobny plik, bo CSP strony pozwala wyłącznie na
 * skrypty z własnej domeny (script-src 'self').
 */
(() => {
  const el = document.querySelector('.cd[data-cd]');
  if (!el) return;
  const end = Number(el.dataset.cd);
  if (!end) return;
  const daysEl = el.querySelector('[data-cd-days]');
  const timeEl = el.querySelector('[data-cd-time]');
  const pad = (n) => String(n).padStart(2, '0');

  function tick() {
    const left = Math.max(0, end - Date.now());
    if (daysEl) daysEl.textContent = String(Math.floor(left / 86_400_000));
    if (timeEl) {
      timeEl.textContent = `${pad(Math.floor(left / 3_600_000) % 24)}:${pad(Math.floor(left / 60_000) % 60)}:${pad(Math.floor(left / 1_000) % 60)}`;
    }
    if (!left) el.classList.add('past');
  }

  tick();
  const timer = setInterval(tick, 1000);
  window.addEventListener('pagehide', () => clearInterval(timer));
})();
