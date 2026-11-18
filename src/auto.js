/**
 * Automatyczne odświeżanie danych strony — bez przeładowania i bez frameworka.
 *
 * Co 90 s pobiera tę samą stronę i podmienia tylko sekcje, które naprawdę się
 * zmieniły (status sprawy, przegląd monitora, rynek, archiwum, liczniki).
 * Czytelnik nie traci pozycji przewinięcia ani otwartego panelu „na żywo”.
 */
(() => {
  const ids = ['sprawa', 'przeglad', 'rynek', 'archiwum'];
  const INTERVAL_MS = 90_000;
  let busy = false;

  function swap(doc) {
    for (const id of ids) {
      // Archiwum ma wyszukiwarkę i stronicowanie — nie ruszamy, gdy ktoś w nim
      // pisze albo gdy adres pokazuje wyniki wyszukiwania / inną stronę.
      if (id === 'archiwum' && (location.search || document.activeElement?.closest?.('#archiwum'))) continue;
      const fresh = doc.getElementById(id);
      const cur = document.getElementById(id);
      if (!fresh || !cur || fresh.innerHTML === cur.innerHTML) continue;
      cur.innerHTML = fresh.innerHTML;
      // Motyw dossier ukrywa sekcje do chwili wejścia w widok — po podmianie
      // musimy od razu przywrócić stan widoczny, inaczej sekcja zniknie.
      cur.querySelectorAll('.reveal').forEach((n) => n.classList.add('in'));
    }
    const freshStats = doc.getElementById('statystyki');
    const curStats = document.getElementById('statystyki');
    if (freshStats && curStats && freshStats.innerHTML !== curStats.innerHTML) {
      curStats.innerHTML = freshStats.innerHTML;
    }
  }

  async function refresh() {
    if (busy || document.hidden) return;
    busy = true;
    try {
      const res = await fetch(location.href, {
        headers: { Accept: 'text/html' },
        cache: 'no-store',
        signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(15_000) : undefined,
      });
      if (!res.ok) return;
      const html = await res.text();
      if (!html.includes('id="przeglad"')) return;
      swap(new DOMParser().parseFromString(html, 'text/html'));
    } catch { /* sieć chwilowo niedostępna — następna próba */ }
    finally { busy = false; }
  }

  const timer = setInterval(refresh, INTERVAL_MS);
  window.addEventListener('pagehide', () => clearInterval(timer));
  // Powrót z bfcache: interwał został wyczyszczony, a dane mogły się zmienić.
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    clearInterval(timer);
    setInterval(refresh, INTERVAL_MS);
    refresh();
  });
  // Karta w tle nie pobiera strony; po powrocie od razu wyrównujemy dane.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refresh();
  });
})();
