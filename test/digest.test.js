import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'schueler-digest-'));
process.env.DATA_DIR = tmp;
process.env.DB_FILE = path.join(tmp, 'digest.db');

const { db, insertItem } = await import('../src/db.js');
const { buildDigest, formatDigest } = await import('../src/digest.js');

after(() => {
  db.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('digest liczy nowe wpisy, ciche zmiany i formatuje raport', () => {
  const now = Date.now();
  insertItem({
    id: 'digest-media', dedupKey: 'url:https://example.com/a', source: 'test-media',
    sourceLabel: 'Test Media', title: 'Original title', url: 'https://example.com/a',
    publishedAt: now, firstSeenAt: now, rawText: 'Body', score: 150, matchedTerms: [],
  });
  insertItem({
    id: 'digest-change', dedupKey: 'url:https://example.com/b', source: 'moj-tr',
    sourceLabel: 'Ministerstwo', title: 'Changed page', url: 'https://example.com/b',
    publishedAt: now, firstSeenAt: now, rawText: 'Body', score: 150, matchedTerms: [],
    changeDetected: true,
  });
  insertItem({
    id: 'digest-social', dedupKey: 'url:https://example.com/c', source: 'xprof-test',
    sourceLabel: 'X: test', title: 'Social post', url: 'https://example.com/c',
    publishedAt: now, firstSeenAt: now, rawText: 'Body', score: 150, matchedTerms: [],
  });
  db.prepare("UPDATE items SET title_pl=?, title_en=? WHERE id='digest-media'")
    .run('Polski tytuł', 'English title');

  const d = buildDigest({ hours: 24, now });
  assert.equal(d.items.length, 3);
  assert.equal(d.fresh.length, 3);
  assert.equal(d.redetected.length, 0);
  assert.equal(d.changes.length, 1);
  assert.equal(d.media.length, 2);
  assert.equal(d.social.length, 1);

  const text = formatDigest(d);
  assert.match(text, /Dzienny digest/);
  assert.match(text, /Nowe publikacje \(24 h\): 3/);
  assert.match(text, /Ciche zmiany źródeł: 1/);
  assert.match(text, /Polski tytuł/);
});

test('stary artykuł wykryty ponownie nie jest liczony jako nowa publikacja', () => {
  const now = Date.now() + 1000;
  insertItem({
    id: 'digest-old', dedupKey: 'url:https://example.com/old', source: 'test-media',
    sourceLabel: 'Test Media', title: 'Old article from October', url: 'https://example.com/old',
    publishedAt: now - 40 * 86400_000, firstSeenAt: now, rawText: 'Body', score: 150, matchedTerms: [],
  });

  const d = buildDigest({ hours: 24, now });
  assert.ok(!d.fresh.some((i) => i.id === 'digest-old'));
  assert.ok(d.redetected.some((i) => i.id === 'digest-old'));

  const text = formatDigest(d);
  assert.match(text, /Wykryte ponownie/);
  assert.match(text, /Old article from October/);
  assert.match(text, /nie nowe zdarzenia/);
});
