import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'schueler-bootstrap-'));
process.env.DATA_DIR = tmp;
process.env.DB_FILE = path.join(tmp, 'bootstrap.db');
process.env.AI_CACHE_FILE = path.join(tmp, 'ai-cache.json');
process.env.DISCORD_WEBHOOK_URL = 'https://example.invalid/webhook';
process.env.MIN_NOTIFY_GAP_MS = '0';
process.env.BOOTSTRAP_NOTIFY_LIMIT = '10';

const { runScan } = await import('../src/scanner.js');
const { db, getKV } = await import('../src/db.js');

const now = Date.now();
const items = [1, 2, 3].map((n) => ({
  id: `test:${n}`,
  source: 'test',
  sourceLabel: 'Test',
  title: `Richard James Schueler detained in Istanbul ${n}`,
  url: `https://example.com/news/${n}`,
  publishedAt: now - n * 1000,
  text: `Richard James Schueler was detained in Istanbul. Report ${n}.`,
}));

const collect = async () => [{
  src: { id: 'test', kind: 'feed' },
  ok: true,
  items,
}];
const summarize = async () => ({ pl: 'Streszczenie testowe.', en: '' });

test('trzy bledy webhooka nie koncza bootstrapu', async () => {
  const res = await runScan({
    _io: {
      collect,
      summarize,
      notify: async () => ({ ok: false, error: 'webhook down' }),
    },
  });
  assert.equal(res.ok, true);
  assert.equal(res.bootstrap, true);
  assert.equal(res.notifyAborted, true);
  assert.equal(res.notified, 0);
  assert.equal(getKV('bootstrapped'), null, 'bootstrap nie moze byc oznaczony jako zakonczony');
});

test('kolejny skan konczy bootstrap i zapisuje flage', async () => {
  const res = await runScan({
    _io: {
      collect,
      summarize,
      notify: async () => ({ ok: true }),
    },
  });
  assert.equal(res.ok, true);
  assert.equal(res.bootstrap, true);
  assert.equal(res.notifyAborted, false);
  assert.ok(res.notified >= 1);
  assert.equal(getKV('bootstrapped'), '1');
});

test('po zakonczonym bootstrapie kolejny skan nie jest bootstrapem', async () => {
  const res = await runScan({
    _io: {
      collect,
      summarize,
      notify: async () => ({ ok: true }),
    },
  });
  assert.equal(res.bootstrap, false);
});

test('cleanup', () => {
  db.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});
