import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { CONFIG } from './config.js';
import {
  getItem, countItems, countUnnotified, countSuppressed, countFailedNotifications,
  listSourceState, listNotifications, countNotifications, getKV,
  searchItems, countSearchItems, listPendingNotifications, isPublicSuppression, listNewItems,
  reviewSnapshot,
} from './db.js';
import { getState, runScan } from './scanner.js';
import { allSources } from './sources.js';
import { renderHome, renderItemPage } from './web-public.js';
import { renderOps, renderOpsLogin } from './web-ops.js';
import { notFoundPage, safeUrl, cleanTitle } from './web-ui.js';
import { redactPrivate } from './facts.js';
import {
  LANG_COOKIE, THEME_COOKIE, THEMES, normalizeLang, normalizeTheme,
} from './i18n.js';

const SEC_HEADERS = {
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'unsafe-inline'; img-src 'self' https: data:; media-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

let LIVE_JS = null;
try {
  LIVE_JS = fs.readFileSync(new URL('./live.js', import.meta.url));
} catch { /* panel na żywo jest opcjonalny */ }

let AUTO_JS = null;
try {
  AUTO_JS = fs.readFileSync(new URL('./auto.js', import.meta.url));
} catch { /* automatyczne odświeżanie jest opcjonalne */ }

let COUNTDOWN_JS = null;
try {
  COUNTDOWN_JS = fs.readFileSync(new URL('./countdown.js', import.meta.url));
} catch { /* odliczanie działa też bez JS */ }

let DOSSIER_JS = null;
try {
  DOSSIER_JS = fs.readFileSync(new URL('./dossier.js', import.meta.url));
} catch { /* skrypt motywu dossier jest opcjonalny */ }

/**
 * Statyczne obrazy (zdjęcia sprawy, logo tokenów) wczytywane raz do pamięci.
 * Tylko bezpieczne nazwy plików — ścieżka z URL-a nigdy nie trafia do systemu plików.
 */
function loadImages(dir, re) {
  const out = new Map();
  try {
    for (const name of fs.readdirSync(dir)) {
      if (!re.test(name)) continue;
      out.set(name, {
        body: fs.readFileSync(new URL(name, dir)),
        type: name.endsWith('.png') ? 'image/png' : 'image/jpeg',
      });
    }
  } catch { /* katalog opcjonalny */ }
  return out;
}
const IMAGE_NAME = /^[a-z0-9-]+\.(jpg|png)$/;
const PRESS_IMAGES = loadImages(new URL('../public/press/', import.meta.url), IMAGE_NAME);
const TOKEN_LOGOS = loadImages(new URL('../public/logos/', import.meta.url), IMAGE_NAME);

const html = (res, body, code = 200) => {
  res.writeHead(code, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
};

const json = (res, obj, code = 200) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj, null, 2));
};

const redirect = (res, location, cookie) => {
  const headers = { Location: location, 'Cache-Control': 'no-store' };
  if (cookie) headers['Set-Cookie'] = cookie;
  res.writeHead(303, headers);
  res.end();
};

function intParam(raw, def, min, max) {
  if (raw == null || raw === '') return def;
  if (!/^\d+$/.test(String(raw))) return null;
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n < min || n > max) return null;
  return n;
}

function safeEqual(a, b) {
  const A = Buffer.from(String(a || ''));
  const B = Buffer.from(String(b || ''));
  if (!A.length || A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

function cookieValue(req, name) {
  const raw = req.headers.cookie || '';
  const m = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(raw);
  if (!m) return '';
  try { return decodeURIComponent(m[1]); } catch { return ''; }
}

/**
 * Adres klienta do limitów. Za nginx połączenie przychodzi z loopbacku, więc
 * tylko wtedy ufamy nagłówkom proxy; bezpośredni klient nie może ich podszyć.
 */
function clientIp(req) {
  const remote = String(req.socket.remoteAddress || '');
  const loopback = remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1';
  if (loopback) {
    const real = String(req.headers['x-real-ip'] || '').trim();
    if (real) return real.slice(0, 64);
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (forwarded) return forwarded.slice(0, 64);
  }
  return remote || 'unknown';
}

const SESSION_COOKIE = 'mntr_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_MAX_FAILURES = 8;
const loginFailures = new Map();

function sessionSignature(exp) {
  return crypto.createHmac('sha256', CONFIG.adminToken)
    .update(`ops-session:${exp}`)
    .digest('base64url');
}

function validSession(req) {
  const m = /^(\d{13})\.([A-Za-z0-9_-]{16,})$/.exec(cookieValue(req, SESSION_COOKIE));
  if (!m) return false;
  const exp = Number(m[1]);
  if (!Number.isSafeInteger(exp) || exp < Date.now()) return false;
  return safeEqual(m[2], sessionSignature(exp));
}

function sessionCookie(req) {
  const exp = Date.now() + SESSION_TTL_MS;
  const value = `${exp}.${sessionSignature(exp)}`;
  const secure = req.headers['x-forwarded-proto'] === 'https' || Boolean(req.socket.encrypted);
  return `${SESSION_COOKIE}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}${secure ? '; Secure' : ''}`;
}

function clearSessionCookie(req) {
  const secure = req.headers['x-forwarded-proto'] === 'https' || Boolean(req.socket.encrypted);
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure ? '; Secure' : ''}`;
}

function bearerToken(req) {
  const auth = req.headers.authorization || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : '';
}

function bearerKey(req) {
  return 'bearer:' + clientIp(req);
}

function isAdmin(req) {
  if (!CONFIG.adminToken) return false;
  const bearer = bearerToken(req);
  if (bearer) {
    const key = bearerKey(req);
    if (loginBlocked(key)) return false;
    if (safeEqual(bearer, CONFIG.adminToken)) {
      loginFailures.delete(key);
      return true;
    }
    recordLoginFailure(key);
    return false;
  }
  return validSession(req);
}

function loginBlocked(ip) {
  const entry = loginFailures.get(ip);
  if (!entry || Date.now() > entry.resetAt) return false;
  return entry.count >= LOGIN_MAX_FAILURES;
}

function recordLoginFailure(ip) {
  const now = Date.now();
  const entry = loginFailures.get(ip);
  if (!entry || now > entry.resetAt) {
    loginFailures.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
  } else {
    entry.count++;
  }
  // Ograniczamy pamięć: przy dużym ruchu czyścimy wygasłe wpisy.
  if (loginFailures.size > 1000) {
    for (const [key, val] of loginFailures) if (now > val.resetAt) loginFailures.delete(key);
  }
}

function readForm(req, maxBytes = 4096) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error('formularz jest za duży'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// Prosty limit akcji ręcznych (globalny — panel ma jednego operatora).
let lastScanRequest = 0;
let lastTestRequest = 0;
const SCAN_COOLDOWN_MS = 60_000;
const TEST_COOLDOWN_MS = 30_000;

function jsonUnauthorized(res, req) {
  if (req && bearerToken(req) && loginBlocked(bearerKey(req))) {
    return json(res, { ok: false, error: 'zbyt wiele nieudanych prób — spróbuj później' }, 429);
  }
  return json(res, { ok: false, error: 'unauthorized — wymagany nagłówek Authorization: Bearer <ADMIN_TOKEN>' }, 401);
}

function loadStats() {
  const ids = new Set(allSources().map((s) => s.id));
  // source_state może zawierać wycofane źródła (np. stare fallbacki) — liczymy tylko aktualne.
  const srcState = listSourceState().filter((s) => ids.has(s.source));
  return {
    srcState,
    stats: {
      total: countItems(),
      unnotified: countUnnotified(),
      sent: countNotifications('sent'),
      failed: countFailedNotifications(),
      suppressed: countSuppressed(),
      // Licznik publiczny ma tę samą definicję co dzienny raport health:
      // pojedynczy, przejściowy błąd (np. 429/406) nie oznacza źródła jako „złego”.
      sourcesOk: srcState.filter((s) => s.last_ok_at && Number(s.consecutive_failures) < 3).length,
      sourcesTotal: allSources().length,
    },
  };
}

function loadMarket() {
  const raw = getKV('market');
  if (!raw) return null;
  try {
    const m = JSON.parse(raw);
    // Starsze snapshoty mają tylko tekst UTC — wyliczamy znacznik czasu,
    // żeby publiczna strona i panel pokazywały datę w strefie warszawskiej.
    if (m && !m.updatedAtMs && typeof m.updatedAt === 'string') {
      const t = Date.parse(m.updatedAt.replace(/\s*UTC$/i, 'Z').replace(' ', 'T'));
      if (Number.isFinite(t)) m.updatedAtMs = t;
    }
    return m;
  } catch { return null; }
}

export function startWeb() {
  const server = http.createServer(async (req, res) => {
    for (const [k, v] of Object.entries(SEC_HEADERS)) res.setHeader(k, v);

    try {
      const url = new URL(req.url || '/', 'http://localhost');
      const p = url.pathname;

      // Preferencje czytelnika: parametr ustawia cookie, kolejne wejścia go dziedziczą.
      const langParam = url.searchParams.get('lang');
      const themeParam = url.searchParams.get('theme');
      const lang = normalizeLang(langParam || cookieValue(req, LANG_COOKIE));
      const theme = normalizeTheme(themeParam || cookieValue(req, THEME_COOKIE));
      const prefCookies = [];
      if (langParam === 'pl' || langParam === 'en') {
        prefCookies.push(`${LANG_COOKIE}=${lang}; Path=/; Max-Age=31536000; SameSite=Lax`);
      }
      if (THEMES.includes(themeParam)) {
        prefCookies.push(`${THEME_COOKIE}=${theme}; Path=/; Max-Age=31536000; SameSite=Lax`);
      }
      if (prefCookies.length) res.setHeader('Set-Cookie', prefCookies);

      if (p === '/healthz') {
        const state = getState();
        return json(res, { ok: true, uptime: Math.round(process.uptime()), lastRunAt: state.lastRunAt });
      }

      if (p === '/robots.txt') {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
        return res.end('User-agent: *\nAllow: /\nDisallow: /ops\nDisallow: /api/\nDisallow: /item/\n');
      }

      if (p === '/live.js') {
        if (!LIVE_JS) return html(res, notFoundPage(lang, theme), 404);
        res.writeHead(200, {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
        });
        return res.end(LIVE_JS);
      }

      if (p === '/auto.js') {
        if (!AUTO_JS) return html(res, notFoundPage(lang, theme), 404);
        res.writeHead(200, {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
        });
        return res.end(AUTO_JS);
      }

      if (p === '/countdown.js') {
        if (!COUNTDOWN_JS) return html(res, notFoundPage(lang, theme), 404);
        res.writeHead(200, {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
        });
        return res.end(COUNTDOWN_JS);
      }

      if (p === '/dossier.js') {
        if (!DOSSIER_JS) return html(res, notFoundPage(lang, theme), 404);
        res.writeHead(200, {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
        });
        return res.end(DOSSIER_JS);
      }

      for (const [prefix, images] of [['/press/', PRESS_IMAGES], ['/logos/', TOKEN_LOGOS]]) {
        if (!p.startsWith(prefix)) continue;
        const img = images.get(p.slice(prefix.length));
        if (!img) return html(res, notFoundPage(lang, theme), 404);
        res.writeHead(200, {
          'Content-Type': img.type,
          'Content-Length': img.body.length,
          'Cache-Control': 'public, max-age=2592000',
        });
        return res.end(img.body);
      }

      // Wideo sprawy: Range, żeby przeglądarka mogła przewijać bez pobierania całości.
      if (p.startsWith('/media/')) {
        const name = p.slice('/media/'.length);
        if (!/^[a-z0-9-]+\.mp4$/.test(name)) return html(res, notFoundPage(lang, theme), 404);
        const file = new URL(`../public/media/${name}`, import.meta.url);
        let size;
        try { size = fs.statSync(file).size; } catch { return html(res, notFoundPage(lang, theme), 404); }
        const m = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || '').trim());
        const start = m && m[1] ? Number(m[1]) : 0;
        const end = m && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
        if (start >= size || start > end) {
          res.writeHead(416, { 'Content-Range': `bytes */${size}`, 'Cache-Control': 'no-store' });
          return res.end();
        }
        res.writeHead(m ? 206 : 200, {
          'Content-Type': 'video/mp4',
          'Content-Length': end - start + 1,
          'Accept-Ranges': 'bytes',
          ...(m ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}),
          'Cache-Control': 'public, max-age=2592000',
        });
        const stream = fs.createReadStream(file, { start, end });
        stream.on('error', () => res.destroy());
        return stream.pipe(res);
      }

      if (p === '/api/items') {
        if (req.method !== 'GET') return json(res, { ok: false, error: 'method not allowed' }, 405);
        const limit = intParam(url.searchParams.get('limit'), 50, 1, 100);
        const offset = intParam(url.searchParams.get('offset'), 0, 0, 100_000);
        if (limit == null || offset == null) {
          return json(res, { ok: false, error: 'limit: 1–100, offset: 0–100000 (liczby całkowite)' }, 400);
        }
        const q = (url.searchParams.get('q') || '').trim().slice(0, 120);
        const rows = searchItems({ limit, offset, q });
        return json(res, {
          ok: true,
          limit,
          offset,
          total: countSearchItems(q),
          items: rows.map((it) => ({
            id: it.id,
            title: cleanTitle(it.title),
            titlePl: it.title_pl ? cleanTitle(it.title_pl) : '',
            titleEn: it.title_en ? cleanTitle(it.title_en) : '',
            url: safeUrl(it.url),
            source: it.source_label,
            publishedAt: it.published_at ? new Date(it.published_at).toISOString() : null,
            firstSeenAt: it.first_seen_at ? new Date(it.first_seen_at).toISOString() : null,
            details: `/item/${encodeURIComponent(it.id)}`,
          })),
        });
      }

      if (p === '/api/latest') {
        if (req.method !== 'GET') return json(res, { ok: false, error: 'method not allowed' }, 405);
        const since = intParam(url.searchParams.get('since'), null, 1, Date.now() + 60_000);
        if (since == null) return json(res, { ok: false, error: 'since: liczba milisekund' }, 400);
        const rows = listNewItems(since, 10);
        return json(res, {
          ok: true,
          since,
          items: rows.map((it) => ({
            id: it.id,
            title: cleanTitle(it.title),
            titlePl: it.title_pl ? cleanTitle(it.title_pl) : '',
            titleEn: it.title_en ? cleanTitle(it.title_en) : '',
            url: safeUrl(it.url),
            source: it.source_label,
            publishedAt: it.published_at ? new Date(it.published_at).toISOString() : null,
            firstSeenAt: it.first_seen_at ? new Date(it.first_seen_at).toISOString() : null,
            firstSeenAtMs: it.first_seen_at,
            summaryPl: it.summary_pl ? redactPrivate(it.summary_pl) : '',
            summaryEn: it.summary_en ? redactPrivate(it.summary_en) : '',
            social: /^(x-|xprof-|reddit-)/i.test(String(it.source || '')),
            details: `/item/${encodeURIComponent(it.id)}`,
          })),
        });
      }

      if (p === '/api/status') {
        if (!isAdmin(req)) return jsonUnauthorized(res, req);
        const { srcState, stats } = loadStats();
        return json(res, {
          ok: true,
          state: getState(),
          config: {
            scanIntervalSec: CONFIG.scanIntervalSec,
            discordConfigured: Boolean(CONFIG.discord.webhookUrl),
            ai: CONFIG.ai.openrouterKey ? 'openrouter' : 'pollinations',
            sourceCount: allSources().length,
          },
          stats,
          sources: srcState,
        });
      }

      if (p === '/api/notifications') {
        if (!isAdmin(req)) return jsonUnauthorized(res, req);
        return json(res, { ok: true, notifications: listNotifications(50) });
      }

      if (p === '/api/scan') {
        if (req.method !== 'POST') return json(res, { ok: false, error: 'method not allowed' }, 405);
        if (!isAdmin(req)) return jsonUnauthorized(res, req);
        const now = Date.now();
        if (now - lastScanRequest < SCAN_COOLDOWN_MS) {
          return json(res, { ok: false, error: 'skan ręczny dostępny raz na 60 s', retryAfterMs: SCAN_COOLDOWN_MS - (now - lastScanRequest) }, 429);
        }
        lastScanRequest = now;
        runScan().catch((e) => console.error('[web] scan error:', e.message));
        return json(res, { ok: true, started: true, message: 'skan uruchomiony w tle' }, 202);
      }

      if (p === '/ops/login' && req.method === 'POST') {
        if (!CONFIG.adminToken) return redirect(res, '/ops');
        const ip = clientIp(req);
        if (loginBlocked(ip)) {
          return html(res, renderOpsLogin({ error: 'Zbyt wiele prób. Spróbuj ponownie za kilka minut.' }), 429);
        }
        const type = String(req.headers['content-type'] || '');
        if (!type.startsWith('application/x-www-form-urlencoded')) {
          return html(res, renderOpsLogin({ error: 'Nieobsługiwany format formularza.' }), 415);
        }
        let token = '';
        try {
          const body = await readForm(req);
          token = new URLSearchParams(body).get('token') || '';
        } catch {
          return html(res, renderOpsLogin({ error: 'Nie udało się odczytać formularza.' }), 400);
        }
        if (!safeEqual(token, CONFIG.adminToken)) {
          recordLoginFailure(ip);
          return html(res, renderOpsLogin({ error: 'Nieprawidłowy token.' }), 401);
        }
        loginFailures.delete(ip);
        return redirect(res, '/ops', sessionCookie(req));
      }

      if (p === '/ops/logout' && req.method === 'POST') {
        return redirect(res, '/ops', clearSessionCookie(req));
      }

      if (p === '/ops') {
        if (!CONFIG.adminToken) return html(res, renderOpsLogin(), 200);
        if (!isAdmin(req)) {
          const expired = cookieValue(req, SESSION_COOKIE)
            ? 'Sesja wygasła lub jest nieprawidłowa. Zaloguj się ponownie.'
            : '';
          return html(res, renderOpsLogin({ error: expired }), 401);
        }

        const { srcState, stats } = loadStats();
        return html(res, renderOps({
          state: getState(),
          srcState,
          stats,
          market: loadMarket(),
          notifications: listNotifications(20),
          pending: listPendingNotifications(15),
          flash: url.searchParams.get('flash'),
          flashError: url.searchParams.get('flashError') === '1',
        }));
      }

      if (p === '/scan' && req.method === 'POST') {
        if (!isAdmin(req)) return redirect(res, '/ops');
        const now = Date.now();
        if (now - lastScanRequest < SCAN_COOLDOWN_MS) {
          return redirect(res, `/ops?flash=${encodeURIComponent('Skan ręczny dostępny raz na 60 s.')}&flashError=1`);
        }
        lastScanRequest = now;
        runScan().catch((e) => console.error('[web] scan error:', e.message));
        return redirect(res, `/ops?flash=${encodeURIComponent('Skan uruchomiony w tle — odśwież panel za chwilę.')}`);
      }

      if (p === '/test' && req.method === 'POST') {
        if (!isAdmin(req)) return redirect(res, '/ops');
        const now = Date.now();
        if (now - lastTestRequest < TEST_COOLDOWN_MS) {
          return redirect(res, `/ops?flash=${encodeURIComponent('Test Discorda dostępny raz na 30 s.')}&flashError=1`);
        }
        lastTestRequest = now;
        const { sendTest } = await import('./discord.js');
        const r = await sendTest();
        const msg = r.ok ? 'Test wysłany na Discorda.' : `Test nieudany: ${r.error || 'nieznany błąd'}`;
        return redirect(res, `/ops?flash=${encodeURIComponent(msg)}&flashError=${r.ok ? 0 : 1}`);
      }

      if (p.startsWith('/item/')) {
        let id = '';
        try { id = decodeURIComponent(p.slice('/item/'.length)); } catch { /* zły encoding */ }
        const it = id ? getItem(id) : null;
        const visible = it && (!it.suppressed || isPublicSuppression(it.suppressed_reason));
        if (!visible) return html(res, notFoundPage(lang, theme), 404);
        return html(res, renderItemPage(it, { lang, theme }));
      }

      if (p === '/' && (req.method === 'GET' || req.method === 'HEAD')) {
        const q = (url.searchParams.get('q') || '').trim().slice(0, 120);
        const src = ['media', 'social'].includes(url.searchParams.get('src')) ? url.searchParams.get('src') : '';
        const pageNo = intParam(url.searchParams.get('page'), 1, 1, 100_000) || 1;
        const pageSize = 10;
        const total = countSearchItems(q, src);
        const pageCount = Math.max(1, Math.ceil(total / pageSize));
        const current = Math.min(pageNo, pageCount);
        // „Co nowego” to nie duplikaty zdarzeń z suppression story:* — tylko realne, świeże wpisy.
        const latest = searchItems({ limit: 1, fresh: true });
        let archiveItems = searchItems({ limit: pageSize, offset: (current - 1) * pageSize, q, src });
        // Ten sam wpis stoi nad archiwum jako lead — nie powtarzamy go w pierwszej dziesiątce.
        // Stronicowanie zostaje bez zmian (offset liczony od pełnej listy), więc nic nie wypada.
        if (!q && !src && current === 1 && latest[0]) {
          archiveItems = archiveItems.filter((it) => it.id !== latest[0].id);
        }
        const state = getState();
        const sourceCount = allSources().length;
        const { stats } = loadStats();
        const archiveTotal = countSearchItems('');
        // „Przegląd monitora” liczy się z bazy przy każdym wejściu — nigdy nie jest
        // ręcznie przepisywany, więc nie może się zestarzeć jak wpis w osi czasu.
        const review = {
          ...reviewSnapshot(Date.now() - 7 * 86_400_000),
          generatedAt: Date.now(),
          lastRunAt: state.lastRunAt,
          sourcesOk: stats.sourcesOk,
          sourcesTotal: stats.sourcesTotal,
          archiveTotal,
        };

        return html(res, renderHome({
          latest,
          archive: { items: archiveItems, total, pageNo: current, pageCount, q, src },
          market: loadMarket(),
          review,
          methodology: { sourceCount, archiveTotal, lastRunAt: state.lastRunAt, review },
          lang,
          theme,
        }));
      }

      return html(res, notFoundPage(lang, theme), 404);
    } catch (e) {
      console.error('[web] error:', e);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      }
      res.end('Błąd serwera.');
    }
  });

  server.listen(CONFIG.port, CONFIG.host, () => {
    console.log(`[web] panel na http://${CONFIG.host}:${CONFIG.port}`);
  });
  return server;
}
