import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'schueler-cutoff-'));
process.env.DATA_DIR = tmp;
process.env.DB_FILE = path.join(tmp, 'cutoff.db');
process.env.AI_CACHE_FILE = path.join(tmp, 'ai-cache.json');
process.env.DISCORD_WEBHOOK_URL = 'https://example.invalid/webhook';
process.env.MIN_NOTIFY_GAP_MS = '0';
process.env.CASE_START = '2026-10-14';
process.env.NOTIFY_MAX_AGE_HOURS = '24';

const { runScan } = await import('../src/scanner.js');
const { db, insertItem, getItem, searchItems } = await import('../src/db.js');

const oldAt = Date.parse('2024-12-23T12:00:00Z');
const newAt = Date.now();
const insert = (id, title, text, publishedAt) => insertItem({
  id, dedupKey: id, source: 'test', sourceLabel: 'Test', title,
  url: `https://example.com/${id}`, publishedAt, firstSeenAt: publishedAt,
  rawText: text, score: 180, matchedTerms: [],
});

insert(
  'test:old', 'Interpol issues Red Notice for Hex founder Richard Heart',
  'Interpol issued a red notice for Richard Heart in December 2024.', oldAt,
);
insert(
  'test:new', 'Richard James Schueler detained in Istanbul',
  'Richard James Schueler was detained in Istanbul on 14 October 2026.', newAt,
);
insert(
  'test:stale', 'Richard Heart court hearing set for December',
  'A Turkish court set a hearing in the Richard Heart case.', newAt - 3 * 24 * 3600 * 1000,
);

test('wpisy przed 14.10.2026 i stare wpisy nie trafiaja do alertow, ale zostaja w archiwum', async () => {
  const sent = [];
  const res = await runScan({
    _io: {
      collect: async () => [],
      summarize: async () => ({ pl: '', en: '' }),
      notify: async (item) => { sent.push(item.id); return { ok: true }; },
    },
  });
  assert.equal(res.ok, true);
  assert.deepEqual(sent, ['test:new'], 'alert tylko o świeżym wydarzeniu po dacie sprawy');
  const old = getItem('test:old');
  assert.equal(old.suppressed, 1);
  assert.equal(old.suppressed_reason, 'before-case');
  assert.ok(searchItems({ q: 'Interpol' }).some((i) => i.id === 'test:old'), 'stary wpis zostaje jako kontekst');
  const stale = getItem('test:stale');
  assert.equal(stale.suppressed, 1);
  assert.equal(stale.suppressed_reason, 'stale');
});

test('cleanup', () => {
  db.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});
