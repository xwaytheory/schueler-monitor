import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Izolowana baza danych dla testu.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'schueler-test-'));
process.env.DATA_DIR = tmp;
process.env.DB_FILE = path.join(tmp, 'test.db');
process.env.AI_CACHE_FILE = path.join(tmp, 'ai-cache.json');

const { db, insertItem, markNotifyFailed, markNotified, markSuppressed, listFailedNotifications, listPendingNotifications, countUnnotified, countSuppressed, countFailedNotifications } = await import('../src/db.js');

test('wpis z bledem wysylki trafia do kolejki ponowien', () => {
  insertItem({
    id: 'test:1', dedupKey: 'test:1', source: 't', sourceLabel: 'Test',
    title: 'Richard James Schueler arrested', url: 'https://example.com/1',
    publishedAt: Date.now(), firstSeenAt: Date.now(), rawText: 'x', score: 200, matchedTerms: [],
  });

  assert.equal(listFailedNotifications().length, 0, 'swiezy wpis nie jest do ponowien');

  markNotifyFailed('test:1', 'HTTP 500');
  const failed = listFailedNotifications();
  assert.equal(failed.length, 1, 'wpis z bledem jest do ponowien');
  assert.equal(failed[0].id, 'test:1');
  assert.match(failed[0].last_notify_error, /HTTP 500/);
});

test('oznaczenie jako wyslany usuwa wpis z kolejki', () => {
  markNotified('test:1');
  assert.equal(listFailedNotifications().length, 0, 'wyslany wpis nie wraca do kolejki');
});

test('po 5 probach wpis przestaje byc ponawiany', () => {
  insertItem({
    id: 'test:2', dedupKey: 'test:2', source: 't', sourceLabel: 'Test',
    title: 'Richard Heart detained', url: 'https://example.com/2',
    publishedAt: Date.now(), firstSeenAt: Date.now(), rawText: 'x', score: 150, matchedTerms: [],
  });
  for (let i = 0; i < 5; i++) markNotifyFailed('test:2', 'fail');
  assert.equal(listFailedNotifications().length, 0, 'po 5 probach wpis jest porzucony');
  assert.equal(countFailedNotifications(), 1, 'porzucony wpis jest liczony osobno');
});

test('wpis pominiety celowo nie wisi w kolejce', () => {
  insertItem({
    id: 'test:3', dedupKey: 'test:3', source: 't', sourceLabel: 'Test',
    title: 'Richard Heart duplicate', url: 'https://example.com/3',
    publishedAt: Date.now(), firstSeenAt: Date.now(), rawText: 'x', score: 100, matchedTerms: [],
  });
  markSuppressed('test:3', 'story:detention');
  assert.equal(countUnnotified(), 0, 'pominiety nie jest liczony jako oczekujacy');
  assert.equal(countSuppressed(), 1);
  assert.ok(!listPendingNotifications().some((i) => i.id === 'test:3'));
});

test('zwyklywpis wraca do kolejki i licznika', () => {
  insertItem({
    id: 'test:4', dedupKey: 'test:4', source: 't', sourceLabel: 'Test',
    title: 'Richard Heart new development', url: 'https://example.com/4',
    publishedAt: Date.now(), firstSeenAt: Date.now(), rawText: 'x', score: 120, matchedTerms: [],
  });
  assert.equal(countUnnotified(), 1);
  assert.ok(listPendingNotifications().some((i) => i.id === 'test:4'));
});

test('cleanup', () => {
  db.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});
