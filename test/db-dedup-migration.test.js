import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DatabaseSync } from 'node:sqlite';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'schueler-dedup-'));
process.env.DATA_DIR = tmp;
process.env.DB_FILE = path.join(tmp, 'legacy.db');
process.env.AI_CACHE_FILE = path.join(tmp, 'ai-cache.json');

// Baza, w której kolumna dedup_key już istnieje, ale klucze są stare.
const legacy = new DatabaseSync(process.env.DB_FILE);
legacy.exec(`
CREATE TABLE items(
  id TEXT PRIMARY KEY,
  dedup_key TEXT UNIQUE,
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
  notified_at INTEGER,
  notify_attempts INTEGER NOT NULL DEFAULT 0,
  last_notify_error TEXT,
  suppressed INTEGER NOT NULL DEFAULT 0,
  suppressed_reason TEXT
);
`);
const insert = legacy.prepare(`
  INSERT INTO items(id,dedup_key,source,source_label,title,url,first_seen_at,score,notified)
  VALUES(?,?,?,?,?,?,?,?,0)
`);
insert.run(
  'gnews-title', 'title:stary klucz', 'gn', 'Google News',
  'Richard Schueler zatrzymany',
  'https://news.google.com/rss/articles/CBMiABC_def-123?oc=5',
  Date.now(), 100,
);
insert.run(
  'gnews-url', 'url:https://news.google.com/rss/articles/cbmIxyz_UVW-456?oc=5', 'gn', 'Google News',
  'Kolejny material',
  'https://news.google.com/rss/articles/cbmIxyz_UVW-456?oc=5',
  Date.now(), 90,
);
insert.run(
  'normal-title', 'title:zwykly artykul', 'rss', 'RSS',
  'Zwykly artykul',
  'https://www.example.com/a?utm_source=x',
  Date.now(), 80,
);
legacy.close();

const { db } = await import('../src/db.js');

test('klucze Google News przechodza na gnews: malymi literami', () => {
  const titleRow = db.prepare("SELECT dedup_key FROM items WHERE id='gnews-title'").get();
  assert.equal(titleRow.dedup_key, 'gnews:cbmiabc_def-123');
  const urlRow = db.prepare("SELECT dedup_key FROM items WHERE id='gnews-url'").get();
  assert.equal(urlRow.dedup_key, 'gnews:cbmixyz_uvw-456');
});

test('zwykly klucz tytulowy przechodzi na URL', () => {
  const row = db.prepare("SELECT dedup_key FROM items WHERE id='normal-title'").get();
  assert.equal(row.dedup_key, 'url:https://example.com/a');
});

test('cleanup', () => {
  db.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});
