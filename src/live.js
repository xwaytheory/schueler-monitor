/**
 * Odświeżanie „na żywo” bez frameworka i bez CDN.
 *
 * Serwer renderuje stronę w PL albo EN i podaje znacznik czasu w
 * data-live-since. Skrypt co 15 s pyta /api/latest i pokazuje nowy wpis
 * (tytuł w języku wydawcy + streszczenia PL i EN) w nieinwazyjnym panelu.
 * Nie podmienia treści strony, więc nie przerywa czytania.
 */
(() => {
  const body = document.body;
  if (!body) return;
  const since0 = Number(body.dataset.liveSince || 0);
  if (!since0) return;

  const d = body.dataset;
  const lang = d.liveLang === 'en' ? 'en' : 'pl';
  const labels = {
    new: d.liveNew || 'Nowa relacja',
    more: d.liveMore || '+%n więcej',
    open: d.liveOpen || 'Otwórz notatkę',
    close: d.liveClose || 'Zamknij',
    pl: d.livePl || 'Streszczenie PL',
    en: d.liveEn || 'Streszczenie EN',
    social: d.liveSocial || 'Wpis społecznościowy',
  };

  let since = since0;
  let queue = [];
  const seen = new Set();
  let busy = false;
  let closedAt = 0;
  let box = null;
  let pollTimer = null;

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function close() {
    if (box) box.remove();
    box = null;
    queue = [];
    closedAt = Date.now();
  }

  function ensureBox() {
    if (box) return box;
    box = el('aside', 'livebox');
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');

    const closeBtn = el('button', 'lb-close', '×');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', labels.close);
    closeBtn.addEventListener('click', close);
    box.append(closeBtn);
    document.body.append(box);
    return box;
  }

  function render(item, extra) {
    const root = ensureBox();
    root.querySelectorAll('.lb-body').forEach((n) => n.remove());
    root.dataset.shownAt = String(Date.now());

    const wrap = el('div', 'lb-body');
    const kicker = el('p', 'lb-kicker', labels.new + (extra ? ` · ${labels.more.replace('%n', extra)}` : ''));
    wrap.append(kicker);

    const title = el('h3', 'lb-title');
    const shownTitle = lang === 'en' ? (item.titleEn || item.title) : (item.titlePl || item.title);
    const link = el('a', null, shownTitle);
    link.href = item.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    title.append(link);
    wrap.append(title);

    if (item.social) {
      wrap.append(el('p', 'lb-sum lb-social', labels.social));
    } else {
      // Czytelnik widzi swój język pierwszy, ale oba są zawsze obecne.
      const pairs = [
        [labels.pl, item.summaryPl],
        [labels.en, item.summaryEn],
      ];
      if (lang === 'en') pairs.reverse();
      for (const [tag, text] of pairs) {
        if (!text) continue;
        wrap.append(el('p', 'lb-tag', tag));
        wrap.append(el('p', 'lb-sum', text));
      }
    }

    const foot = el('p', 'lb-foot');
    const note = el('a', null, labels.open);
    note.href = item.details;
    foot.append(note);
    wrap.append(foot);
    root.append(wrap);
  }

  function showNewest() {
    if (!queue.length) return;
    // Spóźniona odpowiedź nie może otworzyć panelu, który czytelnik właśnie zamknął.
    if (!box && Date.now() - closedAt < 30_000) { queue = []; return; }
    const latest = queue[queue.length - 1];
    const extra = queue.length - 1;
    queue = [];
    render(latest, extra);
  }

  async function poll() {
    if (busy) return;
    busy = true;
    try {
      const res = await fetch(`/api/latest?since=${encodeURIComponent(since)}`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(10_000) : undefined,
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!data || !Array.isArray(data.items) || !data.items.length) return;
      let max = since;
      for (const item of data.items) {
        const ts = Number(item.firstSeenAtMs) || 0;
        if (ts > max) max = ts;
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        queue.push(item);
      }
      if (seen.size > 500) seen.clear();
      since = max;
      queue.sort((a, b) => (Number(a.firstSeenAtMs) || 0) - (Number(b.firstSeenAtMs) || 0));
      showNewest();
    } catch { /* sieć chwilowo niedostępna — następna próba */ }
    finally { busy = false; }
  }

  // Panel znika po 60 s, żeby nie zasłaniał treści; nowy wpis pokaże go ponownie.
  function tick() {
    poll();
    if (box && Date.now() - Number(box.dataset.shownAt || 0) > 60_000) close();
  }
  pollTimer = setInterval(tick, 15_000);
  // Pierwsze sprawdzenie po krótkiej chwili, gdy strona jest już widoczna.
  setTimeout(poll, 3_000);
  window.addEventListener('pagehide', () => clearInterval(pollTimer));
  // Powrót z bfcache: strona wygląda na gotową, ale interwał został wyczyszczony.
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    clearInterval(pollTimer);
    pollTimer = setInterval(tick, 15_000);
    poll();
  });
})();
