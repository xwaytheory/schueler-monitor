import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'schueler-web-'));
process.env.DATA_DIR = tmp;
process.env.DB_FILE = path.join(tmp, 'web.db');
process.env.AI_CACHE_FILE = path.join(tmp, 'ai-cache.json');
process.env.PORT = '0';
process.env.HOST = '127.0.0.1';
process.env.ADMIN_TOKEN = 'test-token-123';

const { startWeb } = await import('../src/web.js');
const { db, insertItem } = await import('../src/db.js');

const server = startWeb();
await new Promise((resolve, reject) => {
  if (server.listening) return resolve();
  server.once('listening', resolve);
  server.once('error', reject);
});
const base = `http://127.0.0.1:${server.address().port}`;

after(() => {
  server.close();
  db.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('strona publiczna ma naglowki bezpieczenstwa i sekcje redakcyjne', async () => {
  const res = await fetch(base + '/');
  assert.equal(res.status, 200);
  const csp = res.headers.get('content-security-policy') || '';
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /media-src 'self'/, 'własne nagranie nie może być blokowane przez CSP');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  const html = await res.text();
  assert.match(html, /Richard James/);
  assert.match(html, /Co wiemy/);
  assert.match(html, /Zastrzeżenie prawne/);
  assert.match(html, /Czego nie wiemy/);
  assert.ok(!html.includes('score '), 'strona publiczna nie pokazuje score');
});

test('API odrzuca niepoprawny limit i offset', async () => {
  for (const qs of ['limit=abc', 'limit=0', 'limit=101', 'offset=-5', 'offset=1.5']) {
    const res = await fetch(`${base}/api/items?${qs}`);
    assert.equal(res.status, 400, `oczekiwano 400 dla ${qs}`);
    const body = await res.json();
    assert.equal(body.ok, false);
  }
});

test('API items zwraca tylko publiczne pola', async () => {
  const res = await fetch(base + '/api/items?limit=5');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.ok(Array.isArray(body.items));
  for (const it of body.items) {
    assert.ok(!('score' in it));
    assert.ok(!('matched_terms' in it));
    assert.match(it.url, /^https?:\/\//);
  }
});

test('API latest zwraca nowe wpisy z oboma streszczeniami', async () => {
  const since = Date.now();
  insertItem({
    id: 'live-1',
    dedupKey: 'url:https://example.com/live',
    source: 'test-live',
    sourceLabel: 'Test Live',
    title: 'Newest report',
    url: 'https://example.com/live',
    publishedAt: since + 5,
    firstSeenAt: since + 5,
    rawText: 'Body',
    score: 150,
    matchedTerms: [],
  });
  db.prepare('UPDATE items SET summary_pl=?, summary_en=? WHERE id=?')
    .run('Streszczenie PL.', 'English summary.', 'live-1');

  const res = await fetch(`${base}/api/latest?since=${since}`);
  assert.equal(res.status, 200);
  const body = await res.json();
  const item = body.items.find((x) => x.id === 'live-1');
  assert.ok(item, 'nowy wpis jest w odpowiedzi');
  assert.equal(item.summaryPl, 'Streszczenie PL.');
  assert.equal(item.summaryEn, 'English summary.');
  assert.ok(item.firstSeenAtMs > since);
  assert.equal(item.details, '/item/live-1');

  assert.equal((await fetch(`${base}/api/latest`)).status, 400);
});

test('strona podaje skrypt live bez CDN i pozwala mu tylko na wlasne API', async () => {
  const res = await fetch(base + '/');
  assert.match(res.headers.get('content-security-policy') || '', /script-src 'self'/);
  assert.match(res.headers.get('content-security-policy') || '', /connect-src 'self'/);
  const html = await res.text();
  assert.match(html, /data-live-since="\d+"/);
  assert.match(html, /<script src="\/live\.js" defer><\/script>/);

  const js = await fetch(base + '/live.js');
  assert.equal(js.status, 200);
  assert.match(js.headers.get('content-type') || '', /javascript/);
  assert.match(await js.text(), /\/api\/latest/);
});

test('dane osoby prywatnej sa redagowane w HTML, API i nocie', async () => {
  insertItem({
    id: 'privacy-1',
    dedupKey: 'url:https://example.com/privacy',
    source: 'test',
    sourceLabel: 'Test',
    title: 'Alina Kara detained with Richard James Schueler',
    url: 'https://example.com/privacy',
    publishedAt: Date.now(),
    firstSeenAt: Date.now(),
    rawText: 'Police in Istanbul detained Alina Kara together with Richard James Schueler.',
    score: 150,
    matchedTerms: ['schueler'],
  });

  const home = await (await fetch(base + '/')).text();
  assert.ok(!home.includes('Alina Kara'), 'strona glowna nie moze ujawniac nazwiska');
  assert.match(home, /A\.K\./);

  const api = await (await fetch(base + '/api/items?q=detained')).text();
  assert.ok(!api.includes('Alina Kara'), 'API nie moze ujawniac nazwiska');
  assert.match(api, /A\.K\./);

  const note = await (await fetch(base + '/item/privacy-1')).text();
  assert.ok(!note.includes('Alina Kara'), 'nota nie moze ujawniac nazwiska');
  assert.match(note, /A\.K\./);
});

test('notatka wpisu zgrupowanego w zdarzeniu jest publiczna, a offtopic ukryta', async () => {
  const common = {
    source: 'test', sourceLabel: 'Test', publishedAt: Date.now(), firstSeenAt: Date.now(),
    rawText: 'Richard James Schueler court hearing in Helsinki.', score: 150, matchedTerms: [],
  };
  insertItem({
    ...common, id: 'story-visible', dedupKey: 'url:https://example.com/story-visible',
    title: 'Court hearing in Richard Heart case', url: 'https://example.com/story-visible',
    suppressed: 1, suppressedReason: 'story:court',
  });
  insertItem({
    ...common, id: 'offtopic-hidden', dedupKey: 'url:https://example.com/offtopic-hidden',
    title: 'Richard Heart price analysis', url: 'https://example.com/offtopic-hidden',
    suppressed: 1, suppressedReason: 'off-topic',
  });

  assert.equal((await fetch(base + '/item/story-visible')).status, 200);
  assert.equal((await fetch(base + '/item/offtopic-hidden')).status, 404);
});

test('nieudane proby Bearer sa limitowane per adres klienta', async () => {
  const headers = { Authorization: 'Bearer zly-token', 'X-Real-IP': '203.0.113.9' };
  for (let i = 0; i < 7; i++) {
    const res = await fetch(base + '/api/status', { headers });
    assert.equal(res.status, 401, `proba ${i + 1} powinna byc odrzucona`);
  }
  const blocked = await fetch(base + '/api/status', { headers });
  assert.equal(blocked.status, 429);
});

test('panel /ops wymaga tokena', async () => {
  const res = await fetch(base + '/ops');
  assert.equal(res.status, 401);
  const html = await res.text();
  assert.match(html, /Dostęp ograniczony/);
});

test('token w URL nie loguje i nie ustawia ciasteczka', async () => {
  const res = await fetch(base + '/ops?token=test-token-123', { redirect: 'manual' });
  assert.equal(res.status, 401);
  assert.equal(res.headers.get('set-cookie'), null);
});

test('logowanie POST ustawia podpisana sesje bez tokena', async () => {
  const wrongType = await fetch(base + '/ops/login', { method: 'POST', body: 'token=test-token-123' });
  assert.equal(wrongType.status, 415);

  const res = await fetch(base + '/ops/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'token=test-token-123',
    redirect: 'manual',
  });
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/ops');
  const cookie = res.headers.get('set-cookie') || '';
  assert.match(cookie, /mntr_session=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.ok(!cookie.includes('test-token-123'), 'token nie moze byc w ciasteczku');

  const session = cookie.split(';')[0];
  const panel = await fetch(base + '/ops', { headers: { Cookie: session } });
  assert.equal(panel.status, 200);
  assert.match(await panel.text(), /Operacje/);

  const tampered = session.slice(0, -1) + (session.endsWith('A') ? 'B' : 'A');
  const bad = await fetch(base + '/ops', { headers: { Cookie: tampered } });
  assert.equal(bad.status, 401);
});

test('panel /ops wpuszcza z Bearer tokenem', async () => {
  const res = await fetch(base + '/ops', { headers: { Authorization: 'Bearer test-token-123' } });
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /Operacje/);
  assert.match(html, /Uruchom skan/);
});

test('API status i powiadomienia sa za tokenem', async () => {
  assert.equal((await fetch(base + '/api/status')).status, 401);
  assert.equal((await fetch(base + '/api/notifications')).status, 401);
  const ok = await fetch(base + '/api/status', { headers: { Authorization: 'Bearer test-token-123' } });
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).ok, true);
});

test('healthz i robots sa publiczne, nieznany wpis daje 404', async () => {
  assert.equal((await fetch(base + '/healthz')).status, 200);
  assert.equal((await fetch(base + '/robots.txt')).status, 200);
  assert.equal((await fetch(base + '/item/nie-ma-takiego')).status, 404);
  assert.equal((await fetch(base + '/nie-ma-takiej-strony')).status, 404);
});

test('POST /scan bez tokena nie uruchamia skanu', async () => {
  const res = await fetch(base + '/scan', { method: 'POST', redirect: 'manual' });
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/ops');
});

test('limit nieudanych logowan blokuje kolejne proby', async () => {
  for (let i = 0; i < 8; i++) {
    const res = await fetch(base + '/ops/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'token=zly-token',
      redirect: 'manual',
    });
    assert.equal(res.status, 401, `proba ${i + 1} powinna byc odrzucona`);
  }
  const blocked = await fetch(base + '/ops/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'token=test-token-123',
    redirect: 'manual',
  });
  assert.equal(blocked.status, 429);
  assert.match(await blocked.text(), /Zbyt wiele prób/);
});

test('motyw spectrum jest dostepny i zapisuje sie w cookie', async () => {
  const res = await fetch(base + '/?theme=spectrum&lang=en');
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /data-theme="spectrum"/);
  assert.match(html, /theme=spectrum/);
  assert.match(res.headers.get('set-cookie') || '', /mntr_theme=spectrum/);
  assert.match(html, /data-live-lang="en"/);
});

test('motyw dossier podaje wlasny skrypt i nowe sekcje', async () => {
  const res = await fetch(base + '/?theme=dossier');
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /data-theme="dossier"/);
  assert.match(html, /id="scenariusze"/);
  assert.match(html, /<script src="\/dossier\.js" defer><\/script>/);
  const js = await fetch(base + '/dossier.js');
  assert.equal(js.status, 200);
  assert.match(js.headers.get('content-type') || '', /javascript/);
  assert.match(await js.text(), /IntersectionObserver/);
});

test('API latest zwraca 10 najnowszych wpisow z jednego milisekunda', async () => {
  const since = Date.now() + 20_000;
  for (let i = 1; i <= 12; i++) {
    insertItem({
      id: `burst-${i}`,
      dedupKey: `url:https://example.com/burst-${i}`,
      source: 'test-burst',
      sourceLabel: 'Test Burst',
      title: `Burst ${i}`,
      url: `https://example.com/burst-${i}`,
      publishedAt: since + 1000,
      firstSeenAt: since + 1000,
      rawText: 'Body',
      score: 150,
      matchedTerms: [],
    });
  }
  const res = await fetch(`${base}/api/latest?since=${since}`);
  const body = await res.json();
  const burst = body.items.filter((x) => String(x.id).startsWith('burst-'));
  assert.equal(burst.length, 10, 'limit nie gubi najnowszych wpisow');
  assert.ok(burst.some((x) => x.id === 'burst-12'), 'najnowszy wpis jest w odpowiedzi');
  assert.ok(!burst.some((x) => x.id === 'burst-1'), 'najstarszy wypada poza limit');
  const max = Math.max(...burst.map((x) => x.firstSeenAtMs));
  const next = await fetch(`${base}/api/latest?since=${max}`);
  const nextBody = await next.json();
  assert.equal(nextBody.items.filter((x) => String(x.id).startsWith('burst-')).length, 0);
});

test('przelaczniki jezyka i motywu czyszcza cookie', async () => {
  const res = await fetch(base + '/?lang=en&theme=spectrum');
  const html = await res.text();
  assert.match(html, /href="\/\?lang=pl&theme=spectrum"/);
  assert.match(html, /href="\/\?lang=en&theme=editorial"/);
  const back = await fetch(base + '/?lang=pl&theme=editorial', {
    headers: { Cookie: 'mntr_lang=en; mntr_theme=spectrum' },
  });
  const backHtml = await back.text();
  assert.match(backHtml, /<html lang="pl"/);
  assert.match(backHtml, /data-theme="editorial"/);
});

test('404 zachowuje wybrany motyw i jezyk', async () => {
  const res = await fetch(base + '/nie-ma-takiej-strony?lang=en&theme=spectrum');
  assert.equal(res.status, 404);
  const html = await res.text();
  assert.match(html, /<html lang="en"/);
  assert.match(html, /data-theme="spectrum"/);
});

test('tytuly PL/EN sa uzywane na stronie i w API', async () => {
  const now = Date.now();
  insertItem({
    id: 'title-test-1',
    dedupKey: 'url:https://example.com/title-test',
    source: 'test-title',
    sourceLabel: 'Test Title',
    title: 'Original publisher title',
    url: 'https://example.com/title-test',
    publishedAt: now,
    firstSeenAt: now,
    rawText: 'Body',
    score: 150,
    matchedTerms: [],
  });
  db.prepare("UPDATE items SET title_pl=?, title_en=? WHERE id='title-test-1'")
    .run('Polski tytul testowy', 'English test title');

  const en = await (await fetch(base + '/item/title-test-1?lang=en')).text();
  assert.match(en, /English test title/);
  const pl = await (await fetch(base + '/item/title-test-1?lang=pl')).text();
  assert.match(pl, /Polski tytul testowy/);
  const api = await (await fetch(base + '/api/items?limit=100')).json();
  const row = api.items.find((x) => x.id === 'title-test-1');
  assert.ok(row);
  assert.equal(row.titleEn, 'English test title');
  assert.equal(row.titlePl, 'Polski tytul testowy');
});
