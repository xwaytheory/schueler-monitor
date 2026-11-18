import crypto from 'node:crypto';

/**
 * Deduplikacja wpisow z roznych zrodel.
 * Te same artykuly wracaja z Google News, Bing News, X i feedow RSS.
 */

/** Wyciaga docelowy URL z przekierowania Bing (parametr "url="). */
function unwrapBing(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('bing.com')) {
      const t = u.searchParams.get('url');
      if (t) return t;
    }
  } catch { /* niepoprawny URL - uzywamy wersji oryginalnej */ }
  return url;
}

/** Przywraca "prawdziwy" URL z linku Google News (opcjonalnie). */
function unwrapGoogleNews(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('news.google.com') && u.pathname.startsWith('/rss/articles/')) {
      // Link jest zakodowany - zostawiamy id w identyfikatorze, ale do porownywania
      // uzywamy sluga z tytulu.
      return url;
    }
  } catch { /* ignoruj */ }
  return url;
}

/** Normalizuje URL do postaci porownawczej. */
export function canonicalUrl(url) {
  const raw = unwrapBing(unwrapGoogleNews(String(url || '')));
  try {
    const u = new URL(raw);
    u.hash = '';
    u.protocol = 'https:';
    u.hostname = u.hostname.replace(/^www\./, '').toLowerCase();
    // Usuwamy parametry śledzące.
    for (const p of [...u.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|mc_|ref|ref_src|oc$|ved$|usg$|sa$|ei$|cmpid|smid|soc|src$)/i.test(p)) {
        u.searchParams.delete(p);
      }
    }
    let s = u.toString();
    s = s.replace(/\/$/, '');
    // Ścieżka i parametry są wrażliwe na wielkość liter — normalizujemy tylko host.
    return s;
  } catch {
    return raw.trim();
  }
}

/** Normalizuje tekst do porównywania (bez limitu długości). */
function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N} ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Slug z tytułu - używany do wykrywania duplikatów o różnych URL-ach. */
export function titleKey(title) {
  return normalizeText(title).slice(0, 90);
}

/**
 * Klucz deduplikacji wpisu.
 * Priorytet ma znormalizowany URL — jest stabilny nawet gdy wydawca zmieni
 * tytuł. Tytuł służy tylko jako fallback dla wpisów bez poprawnego adresu
 * (np. linki względne z feedów).
 */
export function dedupKey(item) {
  const url = canonicalUrl(item.url);
  // Identyfikator Google News jest unikalny dla artykułu. Normalizujemy wielkość
  // liter — starsze wpisy w bazie mają klucze zapisane małymi literami.
  const gnews = /news\.google\.com\/rss\/articles\/([A-Za-z0-9_-]+)/i.exec(url);
  if (gnews) return 'gnews:' + gnews[1].toLowerCase();
  // Strony statyczne: rozrozniamy wersje po hashu tresci, zeby zmiana
  // na stronie (np. nowy komunikat ministra) byla nowym wpisem.
  if (item.source && item.sourceHash) return 'page:' + item.source + ':' + item.sourceHash;
  if (/^https?:\/\//i.test(url)) return 'url:' + url;
  return 'title:' + titleKey(item.title);
}

/**
 * Odcisk treści: tytuł + początek tekstu. Łapie identyczne posty X i
 * przedruki, które mają różne URL-e, ale dokładnie tę samą treść.
 * Strony oficjalne mają osobny klucz wersji, więc nie są tu grupowane.
 */
export function contentKey(item = {}) {
  const title = normalizeText(item.title);
  if (!title) return null;
  const body = normalizeText(item.text ?? item.rawText ?? '').slice(0, 1000);
  return crypto.createHash('sha256').update(`${title}\n${body}`).digest('hex').slice(0, 32);
}
