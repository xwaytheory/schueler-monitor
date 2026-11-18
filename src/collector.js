import { CONFIG } from './config.js';
import { parseFeed } from './feed-parser.js';
import { allSources, bingNewsUrl, googleNewsUrl } from './sources.js';
import { setKV, getKV } from './db.js';

// Twardy limit odpowiedzi (ochrona pamieci przed ogromnym HTML/JSON).
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;

async function readLimited(res) {
  const declared = Number(res.headers.get('content-length') || 0);
  if (declared > MAX_RESPONSE_BYTES) throw new Error('odpowiedź przekracza 8 MB');
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error('odpowiedź przekracza 8 MB');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function fetchText(url, opts = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CONFIG.requestTimeoutMs);
  try {
    // Euronews (i część innych redakcji) zwraca 406 na `Accept: */*` — feed
    // RSS musi być wprost dopuszczony, inaczej źródło wygląda na zepsute.
    const headers = { Accept: 'application/rss+xml, application/xml, text/xml, application/json, text/html, */*' };
    // r.jina.ai odrzuca przegladarkowe User-Agent (403) - zostawiamy domyslny.
    if (!opts.noUserAgent) headers['User-Agent'] = opts.userAgent || CONFIG.userAgent;
    if (opts.returnFormat) headers['X-Return-Format'] = opts.returnFormat;
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow', headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await readLimited(res);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Wyciega tweety z markdownu r.jina.ai (profil X).
 *
 * r.jina.ai zwraca strukture:
 *   *   [](https://x.com/handle/status/ID)[img](...)  [Handle](https://x.com/handle)  [1h](https://x.com/handle/status/ID)   tresc tweeta  ![Image N](...)
 */
function parseJinaXProfile(md, source, label) {
  const out = [];
  const seen = new Set();
  // Niezaufany markdown: twardy limit pamięci zanim ruszy parsowanie.
  md = String(md || '').slice(0, 30_000);
  // Rozdzielamy wypisy na bloki tweetow.
  // Kazdy wypis zaczyna sie od "*   [](https://x.com/handle/status/ID)"
  const blocks = md.split(/\*\s+\[\]\(/).slice(1);

  for (const block of blocks) {
    const idMatch = /^(https:\/\/x\.com\/[A-Za-z0-9_]+\/status\/(\d+))/.exec(block);
    if (!idMatch) continue;
    const url = idMatch[1];
    const statusId = idMatch[2];
    if (seen.has(statusId)) continue;
    seen.add(statusId);

    // Tresc zaczyna sie po PIERWSZYM linku do statusu w naglowku (znacznik czasu).
    // Pozniejsze linki do statusow moga wystepowac w samej tresci tweeta.
    const timeLink = /\]\(https:\/\/x\.com\/[A-Za-z0-9_]+\/status\/\d+\)\s*/.exec(block);
    let body = timeLink ? block.slice(timeLink.index + timeLink[0].length) : block;

    // Obcinamy obrazki, "Show more" i kolejne linki nawigacyjne.
    body = body.split(/!\[Image/)[0];
    body = body.split(/Show more/)[0];
    body = body.replace(/\[[^\]]*\]\([^)]*\)/g, ' ');
    body = body.replace(/\s+/g, ' ').trim();
    body = body.replace(/[\[({]+$/, '').trim();
    if (body.length < 20) continue;

    // Czas wzgledny ("1h", "3d", "Jan 5") -> timestamp.
    let publishedAt = null;
    const rel = /\[(\d+)\s?([smhdw])\]\(https:\/\/x\.com\/[A-Za-z0-9_]+\/status\/\d+\)/.exec(block);
    if (rel) {
      const n = Number(rel[1]);
      const unit = { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 }[rel[2]];
      if (unit) publishedAt = Date.now() - n * unit;
    }

    out.push({
      source, sourceLabel: label, title: body.slice(0, 280), url,
      publishedAt, text: body.slice(0, 6000), id: `${source}:${statusId}`,
    });
  }
  return out.slice(0, Math.min(100, CONFIG.maxItemsPerSource || 40));
}

/**
 * Ten sam profil X przez lustro RSS (xitter.cf).
 * r.jina.ai pokazuje bez logowania tylko 5 postow, przez co dalsze wpisy
 * (np. "Day 14") wypadaja z okna. Lustro zwraca ~20 pozycji z pelna data.
 */
function parseMirrorXProfile(xml, source, label, handle) {
  const items = parseFeed(xml, { source, label, maxItems: CONFIG.maxItemsPerSource || 40 });
  return items.map((it) => {
    const m = /status\/(\d+)/.exec(it.url || '') || /status\/(\d+)/.exec(it.id || '');
    if (!m) return null;
    const clean = (s) => String(s || '').replace(/^Pinned:\s*/i, '');
    return {
      ...it,
      // Lustro przepisuje linki na własną domenę — przywracamy kanoniczny adres X.
      url: handle ? `https://x.com/${handle}/status/${m[1]}` : it.url,
      id: `${source}:${m[1]}`,
      title: clean(it.title).slice(0, 280),
      text: clean(it.text),
    };
  }).filter(Boolean);
}

/** Buduje tytul z danych cenowych. */
function parsePrices(json, source, label) {
  const rows = Object.entries(json || {}).map(([coin, d]) => {
    const price = d?.usd;
    const chg = d?.usd_24h_change;
    return `- ${coin.toUpperCase()}: $${price ?? '?'} (24h: ${chg == null ? '?' : (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%'})`;
  });
  if (!rows.length) return [];
  return [{
    source, sourceLabel: label,
    title: `Ceny rynkowe: ${rows.join(' | ')}`,
    url: 'https://www.coingecko.com/',
    publishedAt: null,
    text: rows.join('\n'),
    id: `${source}:${Date.now()}`,
  }];
}

/**
 * Pelne dane rynkowe (HEX na Ethereum, HEX na PulseChain, PLS, PLSX) z wyliczeniami 24h/7d/30d.
 * Zapisujemy je w kv, zeby panel mial je nawet gdy API chwilowo nie odpowiada.
 */
const MARKET_IDS = [
  { id: 'hex', name: 'HEX (Ethereum)' },
  { id: 'hex-pulsechain', name: 'HEX (PulseChain)' },
  { id: 'pulsechain', name: 'PLS' },
  { id: 'pulsex', name: 'PLSX' },
  { id: 'dai-on-pulsechain', name: 'pDAI (PulseChain)' },
  { id: 'pulsechain-peacock', name: 'pCOCK (Peacock)' },
];

// PRVX (ProveX) nie ma rekordu w CoinGecko — cenę bierzemy z DexScreener.
const DEX_TOKENS = [
  { id: 'prvx', name: 'PRVX (ProveX)', chain: 'pulsechain', address: '0xF6f8Db0aBa00007681F8fAF16A0FDa1c9B030b11' },
];

/** Najpłynniejsza para tokenu z DexScreener (cena + zmiana 24 h). */
async function fetchDexToken(token) {
  const body = await fetchText(`https://api.dexscreener.com/latest/dex/tokens/${token.address}`);
  const pairs = (JSON.parse(body).pairs || []).filter((p) => p.chainId === token.chain);
  if (!pairs.length) return null;
  const best = pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
  const price = Number(best.priceUsd);
  if (!Number.isFinite(price)) return null;
  return {
    id: token.id, name: token.name, price,
    d24: Number.isFinite(Number(best.priceChange?.h24)) ? Number(best.priceChange.h24) : null,
    d7: null, d30: null,
    dex: true,
  };
}

async function fetchMarketData() {
  const url = 'https://api.coingecko.com/api/v3/coins/markets'
    + '?vs_currency=usd&ids=' + MARKET_IDS.map((m) => m.id).join(',')
    + '&price_change_percentage=24h,7d,30d';
  const body = await fetchText(url);
  const json = JSON.parse(body);
  const byId = new Map(json.map((c) => [c.id, c]));
  const rows = MARKET_IDS
    .map((m) => byId.get(m.id))
    .filter(Boolean)
    .map((c) => ({
      id: c.id,
      name: MARKET_IDS.find((m) => m.id === c.id)?.name || c.id,
      price: c.current_price,
      d24: c.price_change_percentage_24h,
      d7: c.price_change_percentage_7d_in_currency,
      d30: c.price_change_percentage_30d_in_currency,
    }));
  // Tokeny bez rekordu w CoinGecko (np. PRVX) — z DexScreener.
  for (const token of DEX_TOKENS) {
    try {
      const row = await fetchDexToken(token);
      if (row) rows.push(row);
    } catch (e) {
      console.error(`[collector] ${token.id}: DexScreener niedostępny: ${String(e?.message || e).slice(0, 100)}`);
    }
  }

  const updated = new Date();
  return {
    rows,
    updatedAt: updated.toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
    updatedAtMs: updated.getTime(),
  };
}

/**
 * Wyciaga tekst z HTML (do wykrywania zmian na stronach statycznych).
 */
function htmlToText(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Wyciaga date publikacji ze strony HTML (meta tagi, JSON-LD, znacznik <time>).
 * Strony oficjalne nie maja kanału RSS, wiec data musi byc odczytana z HTML.
 */
function extractPublishedAt(html) {
  // 1. Meta tagi (najczestsze: article:published_time, date, og:updated_time).
  const metaPatterns = [
    /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']article:published_time["']/i,
    /<meta[^>]+name=["'](?:date|pubdate|publish-date|dc\.date|citation_publication_date)["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["'](?:date|pubdate|publish-date|dc\.date)["']/i,
    /<meta[^>]+property=["']og:updated_time["'][^>]+content=["']([^"']+)["']/i,
  ];
  for (const p of metaPatterns) {
    const m = p.exec(html);
    if (!m) continue;
    const t = Date.parse(m[1]);
    if (Number.isFinite(t) && t > 946684800000 && t < Date.now() + 86400000) return t;
  }

  // 2. JSON-LD (schema.org datePublished).
  const ld = /"datePublished"\s*:\s*"([^"]+)"/i.exec(html);
  if (ld) {
    const t = Date.parse(ld[1]);
    if (Number.isFinite(t) && t > 946684800000 && t < Date.now() + 86400000) return t;
  }
  const ldMod = /"dateModified"\s*:\s*"([^"]+)"/i.exec(html);
  if (ldMod) {
    const t = Date.parse(ldMod[1]);
    if (Number.isFinite(t) && t > 946684800000 && t < Date.now() + 86400000) return t;
  }

  // 3. Znacznik <time datetime="...">.
  const time = /<time[^>]+datetime=["']([^"']+)["']/i.exec(html);
  if (time) {
    const t = Date.parse(time[1]);
    if (Number.isFinite(t) && t > 946684800000 && t < Date.now() + 86400000) return t;
  }

  // 4. Data w widocznej tresci (np. "17.10.2026" obok tytulu).
  const text = htmlToText(html);
  const dm = /\b(\d{1,2})[.\s](\d{1,2})[.\s](20\d{2})\b(?:\s*\|\s*(\d{1,2}):(\d{2}))?/.exec(text.slice(0, 3000));
  if (dm) {
    const [, dd, mm, yyyy, hh, mi] = dm;
    const t = Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd),
      hh ? Number(hh) : 0, mi ? Number(mi) : 0);
    if (t > 946684800000 && t < Date.now() + 86400000) return t;
  }

  return null;
}

/**
 * Strona statyczna - zwracamy jeden wpis z cala trescia,
 * zeby skaner mogl wykryc zmiane (hash tresci).
 */
function parsePage(html, source, label, url) {
  const text = htmlToText(html);
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = titleMatch
    ? htmlToText(titleMatch[1]).slice(0, 250)
    : label;
  return [{
    source, sourceLabel: label, title, url,
    publishedAt: extractPublishedAt(html),
    text: text.slice(0, 20000),
    id: `${source}:${url}`,
  }];
}

/**
 * Publiczny rejestr Interpolu przez r.jina.ai (bezpośrednie API blokuje 403).
 * Jeden wpis = jedna nota; zmiana treści (np. wycofanie) zmienia hash źródła.
 */
function parseInterpol(body, src) {
  const start = body.indexOf('{');
  if (start < 0) throw new Error('brak JSON w odpowiedzi Interpolu');
  const data = JSON.parse(body.slice(start));
  const notices = data?._embedded?.notices || [];
  const total = Number(data?.total ?? notices.length);
  if (!notices.length) {
    return [{
      source: src.id,
      sourceLabel: src.label,
      title: 'Interpol: brak publicznej noty dla „Schueler”',
      url: 'https://ws-public.interpol.int/notices/v1/red?name=Schueler',
      publishedAt: undefined,
      text: `Publiczny rejestr Interpolu nie zwraca żadnej noty dla nazwiska Schueler (total=${total}). `
        + 'To może oznaczać wycofanie noty albo zmianę danych w rejestrze.',
      id: `${src.id}:none`,
    }];
  }
  return notices.map((n) => {
    const name = [n.forename, n.name].filter(Boolean).join(' ');
    const href = n._links?.self?.href || 'https://ws-public.interpol.int/notices/v1/red?name=Schueler';
    return {
      source: src.id,
      sourceLabel: src.label,
      title: `Interpol Red Notice ${n.entity_id || '—'} — ${name}`,
      url: href,
      publishedAt: undefined,
      text: [
        `Publiczny rejestr Interpolu (API): total=${total}`,
        `entity_id=${n.entity_id || '—'}`,
        `name=${name || '—'}`,
        `date_of_birth=${n.date_of_birth || '—'}`,
        `nationalities=${(n.nationalities || []).join(', ') || '—'}`,
        `record=${href}`,
      ].join('; '),
      id: `${src.id}:${n.entity_id || 'unknown'}`,
    };
  });
}

/**
 * Pobiera jedno zrodlo i zwraca znormalizowane pozycje.
 * @returns {Promise<{ok:boolean, items:any[], error?:string}>}
 */
export async function collectSource(src) {
  try {
    if (src.kind === 'interpol') {
      const cacheMs = Number(src.refreshMs || 300_000);
      const cachedAt = Number(getKV('interpol_at') || 0);
      const cached = getKV('interpol_cache');
      if (cached && Date.now() - cachedAt < cacheMs) {
        return { ok: true, items: JSON.parse(cached) };
      }
      const body = await fetchText(src.url, { noUserAgent: true });
      const items = parseInterpol(body, src);
      setKV('interpol_cache', JSON.stringify(items));
      setKV('interpol_at', String(Date.now()));
      return { ok: true, items };
    }

    if (src.kind === 'json') {
      const body = await fetchText(src.url);
      const items = parsePrices(JSON.parse(body), src.id, src.label);
      return { ok: true, items };
    }

    if (src.kind === 'jina') {
      const handle = src.url.split('/x.com/')[1] || 'unknown';

      // Lustro RSS daje ~20 postow z dokladna data; r.jina.ai bez logowania
      // tylko 5, przez co dalsze wpisy (np. "Day 14") wypadaja z okna.
      let items = [];
      try {
        const xml = await fetchText(`https://xitter.cf/${handle}/rss`);
        items = parseMirrorXProfile(xml, src.id, src.label, handle);
      } catch (e) {
        console.error(`[collector] ${src.id}: lustro RSS niedostepne: ${String(e?.message || e).slice(0, 120)}`);
      }

      if (!items.length) {
        // r.jina.ai blokuje przegladarkowe User-Agent; markdown wymaga naglowka X-Return-Format.
        const body = await fetchText(src.url, { noUserAgent: true, returnFormat: 'markdown' });
        items = parseJinaXProfile(body, src.id, src.label, handle);
      }

      return { ok: true, items: items.slice(0, Math.min(100, CONFIG.maxItemsPerSource || 40)) };
    }

    // Zrodla referencyjne (akta, archiwa, dane podatkowe) - pobieramy i
    // oznaczamy jako kontekst, nie jako nowa wiadomosc.
    if (src.kind === 'reference') {
      const body = await fetchText(src.url, { userAgent: src.userAgent });
      const text = htmlToText(body);
      const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(body);
      const title = titleMatch ? htmlToText(titleMatch[1]).slice(0, 200) : src.label;
      return {
        ok: true,
        items: [{
          source: src.id, sourceLabel: src.label, title, url: src.url,
          publishedAt: extractPublishedAt(body),
          text: `${src.note || ''} ${text}`.slice(0, 20000),
          id: `${src.id}:${src.url}`,
          isReference: true,
        }],
      };
    }

    // Zapytania wyszukiwarki: Bing podstawowo, Google jako zapas. Odpowiedź
    // musi być RSS-em — strona „Sorry…” Google wraca czasem z kodem 200
    // i bez tego sprawdzenia wyglądałaby jak pusty, zdrowy feed.
    if (src.kind === 'gnews' || src.kind === 'xsite') {
      let lastError = 'brak odpowiedzi';
      for (const url of [src.url, ...(src.fallbacks || [])]) {
        try {
          const body = await fetchText(url);
          if (!/<(rss|feed|rdf:RDF)\b/i.test(body)) throw new Error('odpowiedź nie jest RSS');
          const items = parseFeed(body, {
            source: src.id, label: src.label, maxItems: CONFIG.maxItemsPerSource,
          });
          return { ok: true, items };
        } catch (e) {
          lastError = String(e?.message || e).slice(0, 200);
        }
      }
      throw new Error(lastError);
    }

    const body = await fetchText(src.url);

    if (src.kind === 'page') {
      return { ok: true, items: parsePage(body, src.id, src.label, src.url) };
    }

    const items = parseFeed(body, {
      source: src.id,
      label: src.label,
      maxItems: CONFIG.maxItemsPerSource,
    });
    return { ok: true, items };
  } catch (e) {
    return { ok: false, items: [], error: String(e?.message || e).slice(0, 200) };
  }
}

/**
 * Skanuje wszystkie zrodla (lub podzbior) i zwraca wszystkie pozycje.
 * @param {{only?:string[]}} opts
 */
export async function collectAll(opts = {}) {
  const sources = allSources().filter((s) => !opts.only || opts.only.includes(s.id));
  const results = [];

  // Dane rynkowe - zapisujemy do kv, panel je wyswietla. Odswiezamy najwyzej
  // raz na 5 minut, zeby przy skanie co 10 s nie dobijac CoinGecko/DexScreener.
  const MARKET_REFRESH_MS = 5 * 60 * 1000;
  const lastMarket = Number(getKV('market_at') || 0);
  if (!opts.only && Date.now() - lastMarket > MARKET_REFRESH_MS) {
    try {
      const market = await fetchMarketData();
      setKV('market', JSON.stringify(market));
      setKV('market_at', String(Date.now()));
    } catch (e) {
      console.error('[collector] dane rynkowe niedostepne:', e.message);
    }
  }

  /**
   * Jedno źródło + fallbacki. Wszystkie źródła (także konta X) idą przez wspólną
   * pulę workerów — przy skanie co 10 s sekwencyjne pobieranie się nie mieści.
   */
  const collectOne = async (src) => {
    const out = [{ src, ...(await collectSource(src)) }];
    const first = out[0];

    // Fallback dla zrodel z limitami IP (Reddit 403/429): to samo przez Google News.
    if (!first.ok && /40[39]|429/.test(first.error || '') && src.kind === 'rss' && src.id.includes('reddit')) {
      const sub = src.url.match(/reddit\.com\/r\/([^/]+)/i)?.[1] || 'pulsechain';
      const q = `site:reddit.com ${sub}`;
      const fb = {
        id: `${src.id}-fb`,
        label: `${src.label} (site:reddit.com)`,
        kind: 'gnews',
        url: bingNewsUrl(q),
        fallbacks: [googleNewsUrl(q)],
      };
      out.push({ src: fb, ...(await collectSource(fb)) });
      console.error(`[collector] ${src.id}: ${first.error} -> fallback ${fb.id} (${out[1].items.length} pozycji)`);
    }

    // Fallback: gdy lustro/r.jina.ai zablokuje dostęp do konta X (403/429),
    // pobieramy to samo konto przez Google News (`site:x.com`).
    if (!first.ok && /40[39]|429/.test(first.error || '') && src.kind === 'jina' && src.url.includes('/x.com/')) {
      const handle = src.url.split('/x.com/')[1];
      const q = `site:x.com "${handle}"`;
      const fb = {
        id: `xprof-${handle.toLowerCase()}`,
        label: `X (site:x.com): @${handle}`,
        kind: 'gnews',
        url: bingNewsUrl(q),
        fallbacks: [googleNewsUrl(q)],
      };
      out.push({ src: fb, ...(await collectSource(fb)) });
      console.error(`[collector] ${src.id}: 403 -> fallback ${fb.id} (${out[1].items.length} pozycji)`);
    }

    return out;
  };

  /** Pula workerów: maksymalnie `limit` równoległych pobrań, wynik w kolejności wejścia. */
  const pool = async (list, limit, fn) => {
    const out = new Array(list.length);
    let next = 0;
    const worker = async () => {
      while (next < list.length) {
        const i = next++;
        out[i] = await fn(list[i]);
      }
    };
    await Promise.all(Array.from({ length: Math.min(limit, list.length) }, worker));
    return out;
  };

  // Konta X przez r.jina.ai idą osobno i pojedynczo: równoległy burst 33 żądań
  // kończy się HTTP 429 dla większości profili. Reszta źródeł — normalna pula.
  const jinaSources = sources.filter((s) => s.kind === 'jina');
  const otherSources = sources.filter((s) => s.kind !== 'jina');

  for (const group of await pool(otherSources, CONFIG.maxFetchConcurrency, collectOne)) {
    results.push(...group);
  }
  for (const src of jinaSources) {
    results.push(...(await collectOne(src)));
    await new Promise((r) => setTimeout(r, CONFIG.jinaSpacingMs));
  }

  return results;
}
