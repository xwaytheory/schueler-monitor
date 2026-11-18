import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DatabaseSync } from 'node:sqlite';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'schueler-migrate-'));
process.env.DATA_DIR = tmp;
process.env.DB_FILE = path.join(tmp, 'legacy.db');
process.env.AI_CACHE_FILE = path.join(tmp, 'ai-cache.json');

// Bardzo stara baza: bez dedup_key, suppressed, notify_attempts i consecutive_failures.
const legacy = new DatabaseSync(process.env.DB_FILE);
legacy.exec(`
CREATE TABLE items(
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  source_label TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  published_at INTEGER,
  first_seen_at INTEGER NOT NULL,
  raw_text TEXT,
  score INTEGER NOT NULL DEFAULT 0,
  matched_terms TEXT,
  summary_pl TEXT,
  summary_en TEXT,
  notified INTEGER NOT NULL DEFAULT 0,
  notified_at INTEGER
);
CREATE TABLE source_state(
  source TEXT PRIMARY KEY,
  last_ok_at INTEGER,
  last_error TEXT,
  last_count INTEGER
);
CREATE INDEX items_first_seen ON items(first_seen_at DESC);
CREATE INDEX items_source ON items(source, published_at DESC);
`);
legacy.prepare(`
  INSERT INTO items(id,source,source_label,title,url,first_seen_at,score,notified)
  VALUES(?,?,?,?,?,?,?,0)
`).run('old-item', 'rss', 'RSS', 'Stary wpis', 'https://example.com/old', Date.now(), 50);
legacy.close();

// Import musi przejść: indeks `items_dedup` powstaje dopiero po dodaniu kolumny.
const { db } = await import('../src/db.js');

test('migracja dodaje brakujace kolumny i indeks', () => {
  const itemCols = db.prepare('PRAGMA table_info(items)').all().map((c) => c.name);
  assert.ok(itemCols.includes('dedup_key'));
  assert.ok(itemCols.includes('suppressed'));
  assert.ok(itemCols.includes('notify_attempts'));
  const stateCols = db.prepare('PRAGMA table_info(source_state)').all().map((c) => c.name);
  assert.ok(stateCols.includes('consecutive_failures'));
  const indexes = db.prepare('PRAGMA index_list(items)').all().map((i) => i.name);
  assert.ok(indexes.includes('items_dedup'));
});

test('stare wpisy zostaja, a nowe kolumny maja domyslne wartosci', () => {
  const row = db.prepare("SELECT * FROM items WHERE id='old-item'").get();
  assert.equal(row.title, 'Stary wpis');
  assert.equal(row.dedup_key, null);
  assert.equal(row.suppressed, 0);
  assert.equal(row.notify_attempts, 0);
});

test('cleanup', () => {
  db.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});
