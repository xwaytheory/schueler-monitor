import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'schueler-offtopic-'));
process.env.DATA_DIR = tmp;
process.env.DB_FILE = path.join(tmp, 'offtopic.db');
process.env.AI_CACHE_FILE = path.join(tmp, 'ai-cache.json');
process.env.DISCORD_WEBHOOK_URL = 'https://example.invalid/webhook';
process.env.MIN_NOTIFY_GAP_MS = '0';

const { runScan } = await import('../src/scanner.js');
const { db, insertItem, getItem, listPendingNotifications } = await import('../src/db.js');

const now = Date.now();
const insert = (id, title, text) => insertItem({
  id, dedupKey: id, source: 'test', sourceLabel: 'Test', title,
  url: `https://example.com/${id}`, publishedAt: now, firstSeenAt: now,
  rawText: text, score: 160, matchedTerms: [],
});

insert('test:offtopic', 'Stephanie M. Schueler | Angelcrest Inc. | Valparaiso IN USA',
  'Stephanie M. Schueler is a businesswoman from Valparaiso.');
insert('test:relevant', 'Richard James Schueler detained in Istanbul',
  'Richard James Schueler was detained in Istanbul on 14 October.');

test('kolejka odsiewa homonimy nazwiska przed wysylka', async () => {
  const sent = [];
  const res = await runScan({
    _io: {
      collect: async () => [],
      summarize: async () => ({ pl: '', en: '' }),
      notify: async (item) => { sent.push(item.id); return { ok: true }; },
    },
  });
  assert.equal(res.ok, true);
  assert.deepEqual(sent, ['test:relevant'], 'wysylany jest tylko wpis o sprawie');
  const off = getItem('test:offtopic');
  assert.equal(off.suppressed, 1);
  assert.equal(off.suppressed_reason, 'off-topic');
  assert.ok(!listPendingNotifications().some((i) => i.id === 'test:offtopic'));
});

test('cleanup', () => {
  db.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});
