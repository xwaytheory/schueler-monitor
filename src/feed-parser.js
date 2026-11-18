/** Parsery RSS 2.0 / Atom / RDF z regex - bez zaleznosci. */

/** Bezpieczne dekodowanie encji numerycznych — zły kod nie może wywalić parsera. */
const fromCodePoint = (n) => {
  const cp = Number(n);
  if (!Number.isInteger(cp) || cp < 0 || cp > 0x10ffff) return '';
  if (cp >= 0xd800 && cp <= 0xdfff) return '';
  return String.fromCodePoint(cp);
};

const decodeEntities = (s) =>
  String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => fromCodePoint(d))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => fromCodePoint(parseInt(h, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');

const stripTags = (s) =>
  decodeEntities(String(s || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

// Twarde limity tekstu z niezaufanych feedów — chronią pamięć, UI iDiscorda.
const MAX_TITLE = 300;
const MAX_TEXT = 6000;
const MAX_ITEMS = 100;
const cap = (s, n) => String(s || '').slice(0, n);

const tag = (block, name) => {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i').exec(block);
  return m ? decodeEntities(m[1]).trim() : '';
};

const attr = (block, name, attrName) => {
  const m = new RegExp(`<${name}\\s[^>]*\\b${attrName}=["']([^"']+)["']`, 'i').exec(block);
  return m ? decodeEntities(m[1]) : '';
};

// Sensowne okno dat: od 2000 r. do 2 dni w przód. Feedy podają czasem śmieci
// (np. rok 1970 albo 2099), które wypaczały kolejność i kolejkę powiadomień.
const MIN_FEED_TS = Date.parse('2000-01-01T00:00:00Z');
const MAX_FEED_FUTURE_MS = 2 * 86_400_000;

function clampDate(t) {
  if (!Number.isFinite(t)) return null;
  if (t < MIN_FEED_TS || t > Date.now() + MAX_FEED_FUTURE_MS) return null;
  return t;
}

function parseDate(s) {
  if (!s) return null;
  const t = Date.parse(s);
  if (Number.isFinite(t)) return clampDate(t);
  // "Mon, 21 Oct 2026 20:05:16 +0300" (z dodatkowa spacja) - wyczysc
  const t2 = Date.parse(String(s).replace(/\s+/g, ' ').trim());
  return Number.isFinite(t2) ? clampDate(t2) : null;
}

/**
 * Normalizuje znacznik czasu do milisekund.
 * Date.parse() zwraca ms, ale niektore zrodla (naglowki HTTP, X) podaja
 * czas w sekundach - bez tej normalizacji daty sa przesuniete o ~50 000 lat.
 */
export function normalizeTimestamp(ts) {
  if (ts == null) return null;
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return null;
  // Sekundy (10 cyfr) -> milisekundy.
  if (n < 1e11) return Math.round(n * 1000);
  // Juz milisekundy.
  if (n < 1e14) return Math.round(n);
  // Cos zupełnie innego - odrzucamy.
  return null;
}

/**
 * Bing News RSS opakowuje każdy link w `apiclick.aspx?url=...` — wyciągamy
 * adres artykułu, żeby strona i Discord linkowały do wydawcy, nie do Binga.
 */
export function directFeedUrl(link) {
  const raw = String(link || '');
  if (!/bing\.com\/news\/apiclick\.aspx/i.test(raw)) return raw;
  try {
    const target = new URL(raw).searchParams.get('url');
    if (target && /^https?:\/\//i.test(target)) return target;
  } catch { /* niepoprawny URL — zostawiamy oryginał */ }
  return raw;
}

/**
 * @param {string} xml
 * @param {{label?:string, source:string, maxItems?:number}} opts
 * @returns {{title:string,url:string,publishedAt:number|null,text:string,id:string}[]}
 */
export function parseFeed(xml, opts) {
  const { source, label = source } = opts;
  const maxItems = Math.min(MAX_ITEMS, Math.max(1, Number(opts.maxItems) || 40));
  const items = [];

  // RSS 2.0 <item>
  const rssItems = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || [];
  for (const block of rssItems) {
    const title = cap(stripTags(tag(block, 'title')), MAX_TITLE);
    const link = directFeedUrl((tag(block, 'link') || attr(block, 'link', 'href') || '').trim()).slice(0, 2048);
    const desc = cap(stripTags(tag(block, 'description') || tag(block, 'content:encoded') || tag(block, 'content')), MAX_TEXT);
    const pub = parseDate(tag(block, 'pubDate') || tag(block, 'dc:date') || tag(block, 'published') || tag(block, 'updated'));
    const guid = cap(tag(block, 'guid') || link || title, 500);
    if (!title && !link) continue;
    items.push({
      source, sourceLabel: label, title, url: link,
      publishedAt: pub, text: cap(`${title} ${desc}`.trim(), MAX_TEXT), id: `${source}:${guid}`,
    });
  }

  // Atom <entry>
  if (!items.length) {
    const atomItems = xml.match(/<entry(?:\s[^>]*)?>[\s\S]*?<\/entry>/gi) || [];
    for (const block of atomItems) {
      const title = cap(stripTags(tag(block, 'title')), MAX_TITLE);
      let link = '';
      const linkTag = /<link\b[^>]*>/i.exec(block);
      if (linkTag) {
        const href = /href=["']([^"']+)["']/i.exec(linkTag[0]);
        const rel = /rel=["']([^"']+)["']/i.exec(linkTag[0]);
        if (href && (!rel || rel[1] === 'alternate')) link = decodeEntities(href[1]).slice(0, 2048);
      }
      const desc = cap(stripTags(tag(block, 'content') || tag(block, 'summary')), MAX_TEXT);
      const pub = parseDate(tag(block, 'published') || tag(block, 'updated'));
      const guid = cap(tag(block, 'id') || link || title, 500);
      if (!title && !link) continue;
      items.push({
        source, sourceLabel: label, title, url: link,
        publishedAt: pub, text: cap(`${title} ${desc}`.trim(), MAX_TEXT), id: `${source}:${guid}`,
      });
    }
  }

  // RDF (RSS 1.0) <item rdf:about=...>
  if (!items.length) {
    const rdfItems = xml.match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) || [];
    for (const block of rdfItems) {
      const title = cap(stripTags(tag(block, 'title')), MAX_TITLE);
      const link = cap(stripTags(tag(block, 'link')) || attr(block, 'item', 'rdf:about'), 2048);
      const desc = cap(stripTags(tag(block, 'description')), MAX_TEXT);
      const pub = parseDate(tag(block, 'dc:date'));
      if (!title && !link) continue;
      items.push({
        source, sourceLabel: label, title, url: link,
        publishedAt: pub, text: cap(`${title} ${desc}`.trim(), MAX_TEXT), id: `${source}:${cap(link || title, 500)}`,
      });
    }
  }

  // Sortowanie chronologiczne malejaco, potem limit.
  items.sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));
  return items.slice(0, maxItems);
}
