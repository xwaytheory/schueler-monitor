import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'schueler-alert-queue-'));
process.env.DATA_DIR = tmp;
process.env.DB_FILE = path.join(tmp, 'alert-queue.db');
process.env.AI_CACHE_FILE = path.join(tmp, 'ai-cache.json');
process.env.DISCORD_WEBHOOK_URL = 'https://example.invalid/webhook';
process.env.MIN_NOTIFY_GAP_MS = '0';
process.env.BOOTSTRAP_NOTIFY_LIMIT = '10';
process.env.ALERT_POLICY = 'important';

const { runScan } = await import('../src/scanner.js');
const { db, insertItem, getItem, searchItems, countItems } = await import('../src/db.js');

const now = Date.now();
const summarize = async () => ({ pl: '', en: '' });

function insert(id, source, title, text) {
  insertItem({
    id, dedupKey: `url:https://example.com/${id}`, source, sourceLabel: source,
    title, url: `https://example.com/${id}`, publishedAt: now, firstSeenAt: now,
    rawText: text, score: 160, matchedTerms: [],
  });
}

test('kolejka wysyła oficjalny komunikat, a komentarz zostawia w archiwum', async () => {
  insert('test:comment', 'x-heart', 'Richard James Schueler discusses HEX community',
    'Richard James Schueler spoke about HEX at a community event.');
  insert('test:official', 'moj-tr', 'Richard James Schueler case update',
    'Ministerstwo Sprawiedliwości opublikowało komunikat w sprawie Richard James Schueler.');

  const sent = [];
  const res = await runScan({
    _io: {
      collect: async () => [],
      summarize,
      notify: async (item) => { sent.push(item.id); return { ok: true }; },
    },
  });

  assert.equal(res.ok, true);
  assert.deepEqual(sent, ['test:official']);
  assert.equal(getItem('test:comment').suppressed_reason, 'low-signal');
  assert.equal(getItem('test:comment').suppressed, 1);
  assert.ok(searchItems({ q: 'community' }).some((it) => it.id === 'test:comment'),
    'komentarz zostaje w publicznym archiwum');
  assert.equal(searchItems({ q: 'case update' }).length, 1);
});

test('alert nie czeka na streszczenie AI (tryb natychmiastowy)', async () => {
  insert('test:fast-alert', 'moj-tr', 'Richard James Schueler: nowy komunikat sądu',
    'Sąd przekazał informację w sprawie Richard James Schueler.');
  const sent = [];
  const started = Date.now();
  const res = await runScan({
    _io: {
      collect: async () => [],
      // Model „wisi” 5 s — powiadomienie nie może na to czekać, bo ma iść w sekundach.
      summarize: () => new Promise((r) => setTimeout(() => r({ pl: 'x', en: '' }), 5000)),
      notify: async (item) => { sent.push(item.id); return { ok: true }; },
    },
  });
  assert.equal(res.ok, true);
  assert.ok(sent.includes('test:fast-alert'), 'alert wysłany mimo braku streszczenia');
  assert.ok(Date.now() - started < 3000, 'skan nie czekał na AI');
  assert.equal(getItem('test:fast-alert').notified, 1);
});

test('ten sam etap sprawy trafia do archiwum, ale nie powtarza alertu', async () => {
  insert('test:court-a', 'news-page', 'Helsinki court starts trial of Richard James Schueler',
    'The court hearing began. Richard James Schueler was detained in Istanbul earlier.');
  const sent = [];
  const run = () => runScan({
    _io: {
      collect: async () => [],
      summarize,
      notify: async (item) => { sent.push(item.id); return { ok: true }; },
    },
  });

  const first = await run();
  assert.equal(first.ok, true);
  assert.ok(sent.includes('test:court-a'));
  assert.equal(getItem('test:court-a').suppressed, 0);

  insert('test:court-b', 'news-page', 'Court hearing continues in Richard Heart case',
    'Richard James Schueler, detained in Istanbul, appeared at the hearing.');
  const second = await run();
  assert.equal(second.ok, true);
  assert.ok(!sent.includes('test:court-b'), 'drugi wpis nie moze powtorzyc alertu');
  assert.equal(getItem('test:court-b').suppressed_reason, 'story:court');
  assert.ok(searchItems({ q: 'hearing continues' }).some((it) => it.id === 'test:court-b'),
    'wpis story:* zostaje w publicznym archiwum');
});

test('po STORY_REALERT_HOURS nowa wzmianka znowu alertuje', async () => {
  db.prepare("UPDATE stories SET notified_at=? WHERE key='court'")
    .run(Date.now() - 25 * 3600 * 1000);

  insert('test:court-c', 'news-page', 'Court sets date for Richard Heart hearing',
    'The court scheduled the next hearing. Richard James Schueler remains detained.');

  const sent = [];
  const res = await runScan({
    _io: {
      collect: async () => [],
      summarize,
      notify: async (item) => { sent.push(item.id); return { ok: true }; },
    },
  });
  assert.equal(res.ok, true);
  assert.ok(sent.includes('test:court-c'), 'po oknie cooldownu nowy rozwoj musi zaalarmowac');
});

test('identyczna treść z dwóch URL-i tworzy jeden wpis', async () => {
  const before = countItems();
  const text = 'Turkish police detained Richard James Schueler in Istanbul.';
  const items = [
    {
      id: 'test:dup-a', source: 'x-heart', sourceLabel: 'X',
      title: 'Richard James Schueler detained in Istanbul', url: 'https://a.example.com/post',
      publishedAt: now, text,
    },
    {
      id: 'test:dup-b', source: 'x-heart', sourceLabel: 'X',
      title: 'Richard James Schueler detained in Istanbul', url: 'https://b.example.com/post',
      publishedAt: now, text,
    },
  ];

  const sent = [];
  const res = await runScan({
    _io: {
      collect: async () => [{ src: { id: 'x-heart', kind: 'feed' }, ok: true, items }],
      summarize,
      notify: async (item) => { sent.push(item.id); return { ok: true }; },
    },
  });

  assert.equal(res.ok, true);
  assert.equal(res.newItems, 1);
  assert.equal(res.duplicates, 1);
  assert.equal(sent.length, 1);
  assert.equal(countItems(), before + 1);
});

test('statyczna strona artykułu nie tworzy wersji przy każdym szumie', async () => {
  const before = countItems();
  const item = (text) => ({
    id: 'news-page:https://example.com/article',
    source: 'news-page', sourceLabel: 'News page',
    title: 'Richard James Schueler detained in Istanbul',
    url: 'https://example.com/article',
    publishedAt: now, text,
  });
  const collect = (text) => async () => [{
    src: { id: 'news-page', kind: 'page' },
    ok: true,
    items: [item(text)],
  }];

  const first = await runScan({
    _io: {
      collect: collect('Turkish police detained Richard James Schueler. Version one.'),
      summarize,
      notify: async () => ({ ok: true }),
    },
  });
  assert.equal(first.newItems, 1);

  const second = await runScan({
    _io: {
      collect: collect('Turkish police detained Richard James Schueler. Version two with a changed timestamp.'),
      summarize,
      notify: async () => ({ ok: true }),
    },
  });
  assert.equal(second.newItems, 0);
  assert.equal(second.duplicates, 1);
  assert.equal(countItems(), before + 1);
});

test('cleanup', () => {
  db.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});
