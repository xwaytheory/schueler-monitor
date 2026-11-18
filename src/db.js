import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import { DB_FILE, DATA_DIR } from './config.js';
import { contentKey, dedupKey } from './dedup.js';

fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(DB_FILE);

db.exec('PRAGMA journal_mode=WAL');
db.exec('PRAGMA busy_timeout=5000');

/**
 * Dodaje kolumne, jesli ich brak (migracja bez zewnetznych narzedzi).
 */
function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

db.exec(`
CREATE TABLE IF NOT EXISTS kv(
  k TEXT PRIMARY KEY,
  v TEXT
);
CREATE TABLE IF NOT EXISTS stories(
  key         TEXT PRIMARY KEY,
  detail_level INTEGER NOT NULL DEFAULT 1,
  first_seen_at INTEGER NOT NULL,
  notified_at  INTEGER,
  item_id     TEXT,
  title       TEXT
);
CREATE TABLE IF NOT EXISTS items(
  id            TEXT PRIMARY KEY,
  dedup_key     TEXT UNIQUE,
  content_key   TEXT,
  source        TEXT NOT NULL,
  source_label  TEXT NOT NULL,
  title         TEXT NOT NULL,
  title_pl      TEXT,
  title_en      TEXT,
  url           TEXT NOT NULL,
  published_at  INTEGER,
  first_seen_at  INTEGER NOT NULL,
  raw_text      TEXT,
  score         INTEGER NOT NULL DEFAULT 0,
  matched_terms TEXT,
  change_detected INTEGER NOT NULL DEFAULT 0,
  summary_pl    TEXT,
  summary_en    TEXT,
  notified      INTEGER NOT NULL DEFAULT 0,
  notified_at   INTEGER,
  notify_attempts INTEGER NOT NULL DEFAULT 0,
  last_notify_error TEXT,
  suppressed    INTEGER NOT NULL DEFAULT 0,
  suppressed_reason TEXT
);
CREATE INDEX IF NOT EXISTS items_first_seen ON items(first_seen_at DESC);
CREATE INDEX IF NOT EXISTS items_source ON items(source, published_at DESC);
CREATE TABLE IF NOT EXISTS source_state(
  source      TEXT PRIMARY KEY,
  last_ok_at  INTEGER,
  last_error  TEXT,
  last_count  INTEGER,
  content_hash TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS notifications(
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id     TEXT NOT NULL,
  channel     TEXT NOT NULL,
  status      TEXT NOT NULL,
  detail      TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS notifications_created ON notifications(created_at DESC);
`);

// Migracje schematu dla baz utworzonych w poprzednich wersjach.
ensureColumn('items', 'notify_attempts', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('items', 'last_notify_error', 'TEXT');
ensureColumn('items', 'dedup_key', 'TEXT');
ensureColumn('items', 'content_key', 'TEXT');
ensureColumn('items', 'title_pl', 'TEXT');
ensureColumn('items', 'title_en', 'TEXT');
ensureColumn('items', 'change_detected', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('items', 'suppressed', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('items', 'suppressed_reason', 'TEXT');
ensureColumn('source_state', 'content_hash', 'TEXT');
ensureColumn('source_state', 'consecutive_failures', 'INTEGER NOT NULL DEFAULT 0');

// Indeks dopiero po migracji kolumny — stare bazy nie mają `dedup_key`.
db.exec('CREATE INDEX IF NOT EXISTS items_dedup ON items(dedup_key)');
db.exec('CREATE INDEX IF NOT EXISTS items_content ON items(content_key)');

// Poprawka etykiety źródła zapisanej w starszych wpisach (diakrytyki).
db.prepare(`
  UPDATE items SET source_label = replace(source_label,
    'agregator - nie zrodlo oficjalne', 'agregator — nie źródło oficjalne')
  WHERE instr(source_label, 'agregator - nie zrodlo oficjalne') > 0
`).run();

/**
 * Migracja starych kluczy `title:` na klucze URL oraz kluczy Google News na
 * `gnews:<id>` (małymi literami — tak zapisane są wpisy z wcześniejszych wersji).
 * Konflikt (ten sam klucz już w bazie) pomijamy — wpis zostaje bez zmian.
 */
function migrateDedupKeys() {
  const rows = db.prepare(`
    SELECT id, url, title, dedup_key FROM items
    WHERE dedup_key LIKE 'title:%'
       OR (dedup_key LIKE 'url:%' AND url LIKE '%news.google.com/rss/articles/%')
  `).all();
  const exists = db.prepare('SELECT 1 FROM items WHERE dedup_key=?');
  const update = db.prepare('UPDATE items SET dedup_key=? WHERE id=?');
  for (const row of rows) {
    const key = dedupKey({ url: row.url, title: row.title });
    if (!key.startsWith('url:http') && !key.startsWith('gnews:')) continue;
    if (exists.get(key)) continue;
    update.run(key, row.id);
  }
}

/** Uzupełnia odcisk treści w starszych bazach (poza wersjami stron). */
function backfillContentKeys() {
  const rows = db.prepare(`
    SELECT id, title, raw_text FROM items
    WHERE (content_key IS NULL OR content_key = '')
      AND (dedup_key IS NULL OR dedup_key NOT LIKE 'page:%')
  `).all();
  const update = db.prepare('UPDATE items SET content_key=? WHERE id=?');
  for (const row of rows) {
    const key = contentKey({ title: row.title, rawText: row.raw_text });
    if (key) update.run(key, row.id);
  }
}

migrateDedupKeys();
backfillContentKeys();

export function insertItem(item) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO items(id,dedup_key,content_key,source,source_label,title,url,published_at,first_seen_at,raw_text,score,matched_terms,change_detected,suppressed,suppressed_reason)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  const r = stmt.run(
    item.id, item.dedupKey ?? null, item.contentKey ?? null, item.source, item.sourceLabel, item.title, item.url,
    item.publishedAt ?? null, item.firstSeenAt, item.rawText ?? '',
    item.score ?? 0, JSON.stringify(item.matchedTerms ?? []),
    item.changeDetected ? 1 : 0, item.suppressed ? 1 : 0, item.suppressedReason ?? null,
  );
  return r.changes > 0;
}

export function getItem(id) {
  return db.prepare('SELECT * FROM items WHERE id=?').get(id);
}

/** Prosty magazyn klucz-wartosc (trwaly miedzy restartami). */
export function getKV(key) {
  const r = db.prepare('SELECT v FROM kv WHERE k=?').get(key);
  return r ? r.v : null;
}

export function setKV(key, value) {
  db.prepare('INSERT INTO kv(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v')
    .run(key, String(value));
}

/** Czy zdarzenie (grupę wpisow) juz zostalo powiadomione i na jakim poziomie szczegolowosci. */
export function getStory(key) {
  if (!key) return null;
  return db.prepare('SELECT * FROM stories WHERE key=?').get(key) ?? null;
}

/** Rejestruje zdarzenie po powiadomieniu (podnosi poziom szczegolowosci). */
export function markStoryNotified(key, itemId, title, detailLevel = 1) {
  if (!key) return;
  db.prepare(`
    INSERT INTO stories(key,detail_level,first_seen_at,notified_at,item_id,title)
    VALUES(?,?,?,?,?,?)
    ON CONFLICT(key) DO UPDATE SET
      detail_level=MAX(stories.detail_level, excluded.detail_level),
      notified_at=excluded.notified_at,
      item_id=excluded.item_id,
      title=excluded.title
  `).run(key, detailLevel, Date.now(), Date.now(), itemId, String(title || '').slice(0, 300));
}

export function getItemByDedup(dedupKey) {
  return db.prepare('SELECT id FROM items WHERE dedup_key=?').get(dedupKey);
}

/** Czy dokładnie ta sama treść (tytuł + początek tekstu) już jest w bazie. */
export function getItemByContentKey(key) {
  if (!key) return null;
  return db.prepare('SELECT id FROM items WHERE content_key=? LIMIT 1').get(key);
}

export function setSummary(id, pl, en, titlePl = '', titleEn = '') {
  db.prepare("UPDATE items SET summary_pl=?, summary_en=?, title_pl=COALESCE(NULLIF(?,''), title_pl), title_en=COALESCE(NULLIF(?,''), title_en) WHERE id=?")
    .run(pl, en, titlePl, titleEn, id);
}

export function markNotified(id) {
  db.prepare('UPDATE items SET notified=1, notified_at=?, notify_attempts=notify_attempts+1, last_notify_error=NULL WHERE id=?')
    .run(Date.now(), id);
}

/**
 * Wpis celowo pominięty (duplikat zdarzenia, stary wpis z bootstrapu).
 * Nie jest błędem wysyłki i nie powinien wisieć w kolejce.
 */
export function markSuppressed(id, reason = 'duplicate') {
  db.prepare('UPDATE items SET suppressed=1, suppressed_reason=? WHERE id=?')
    .run(String(reason || '').slice(0, 160), id);
}

/** Wpisy, które nie udało się wysłać - do ponowienia przy następnym skanie. */
export function markNotifyFailed(id, error) {
  db.prepare('UPDATE items SET notify_attempts=notify_attempts+1, last_notify_error=? WHERE id=?')
    .run(String(error || '').slice(0, 300), id);
}

/** Wpisy oczekujące na ponowne wysłanie (błędy wysyłki, max 5 prób). */
export function listFailedNotifications(maxAttempts = 5) {
  return db.prepare(`
    SELECT id,source,source_label,title,title_pl,title_en,url,published_at,first_seen_at,score,matched_terms,raw_text,change_detected,last_notify_error
    FROM items WHERE notified=0 AND suppressed=0 AND notify_attempts > 0 AND notify_attempts < ?
    ORDER BY first_seen_at ASC
  `).all(maxAttempts);
}

/**
 * Wszystkie wpisy, które nie zostały jeszcze powiadomione - niezależnie od tego,
 * czy świeże (dodane w tym skanie) czy pominięte wcześniej (limit, błąd, reset).
 * To jest źródło prawdy dla kolejki powiadomień.
 */
export function listPendingNotifications(limit = 300) {
  return db.prepare(`
    SELECT id,dedup_key,source,source_label,title,title_pl,title_en,url,published_at,first_seen_at,score,matched_terms,raw_text,change_detected,notify_attempts
    FROM items WHERE notified=0 AND suppressed=0 AND notify_attempts < 5
    ORDER BY COALESCE(published_at, first_seen_at) DESC
    LIMIT ?
  `).all(limit);
}

export function listItems({ limit = 100, offset = 0, onlyUnnotified = false } = {}) {
  const where = onlyUnnotified ? 'WHERE notified=0 AND suppressed=0' : '';
  return db.prepare(`
    SELECT id,source,source_label,title,title_pl,title_en,url,published_at,first_seen_at,score,matched_terms,change_detected,summary_pl,summary_en,notified,notified_at,notify_attempts,suppressed,raw_text
    FROM items ${where} ORDER BY COALESCE(published_at, first_seen_at) DESC LIMIT ? OFFSET ?
  `).all(limit, offset);
}

export function countItems() {
  return db.prepare('SELECT COUNT(*) AS c FROM items').get().c;
}

/**
 * Powody wyciszenia, które nie chowają wpisu przed publicznym archiwum:
 * duplikaty zdarzeń (w tym `story:*`), limity/bootstrap, wpisy sprzed sprawy
 * i niski sygnał. Reszta (np. `off-topic`, `duplicate-content`) zostaje ukryta.
 */
export const PUBLIC_SUPPRESSIONS = [
  'bootstrap-page', 'bootstrap-limit', 'bootstrap-old',
  'before-case', 'stale', 'low-signal',
];

export function isPublicSuppression(reason) {
  if (!reason) return true;
  return PUBLIC_SUPPRESSIONS.includes(reason) || String(reason).startsWith('story:');
}

/**
 * Publiczne archiwum: bez duplikatów artykułów i bez starych wpisów z bootstrapu.
 * Snapshoty stron oficjalnych zostają — to materiał źródłowy, nie duplikat.
 */
const PUBLIC_WHERE = `(suppressed=0 OR suppressed_reason IN ('${PUBLIC_SUPPRESSIONS.join("','")}') OR suppressed_reason LIKE 'story:%')`;

/** Wpisy społecznościowe (X, Reddit) — osobny strumień w archiwum. */
const SOCIAL_WHERE = `(source LIKE 'x-%' OR source LIKE 'xprof-%' OR source LIKE 'reddit-%')`;

function archiveWhere(q, src, fresh) {
  let where = PUBLIC_WHERE;
  if (fresh) where += ' AND suppressed=0';
  if (src === 'social') where += ` AND ${SOCIAL_WHERE}`;
  else if (src === 'media') where += ` AND NOT ${SOCIAL_WHERE}`;
  const needle = String(q || '').trim();
  const params = [];
  if (needle) {
    where += " AND (instr(lower(title), lower(?)) > 0 OR instr(lower(title_pl), lower(?)) > 0 OR instr(lower(title_en), lower(?)) > 0 OR instr(lower(source_label), lower(?)) > 0 OR instr(lower(summary_pl), lower(?)) > 0)";
    params.push(needle, needle, needle, needle, needle);
  }
  return { where, params };
}

export function searchItems({ limit = 12, offset = 0, q = '', src = '', fresh = false } = {}) {
  const { where, params } = archiveWhere(q, src, fresh);
  params.push(limit, offset);
  return db.prepare(`
    WITH ranked AS (
      SELECT id,source,source_label,title,title_pl,title_en,url,published_at,first_seen_at,summary_pl,summary_en,change_detected,
             ROW_NUMBER() OVER (
               PARTITION BY url
               ORDER BY COALESCE(published_at, first_seen_at) DESC, first_seen_at DESC
             ) AS rn
      FROM items WHERE ${where}
    )
    SELECT id,source,source_label,title,title_pl,title_en,url,published_at,first_seen_at,summary_pl,summary_en,change_detected
    FROM ranked WHERE rn = 1
    ORDER BY COALESCE(published_at, first_seen_at) DESC, id DESC
    LIMIT ? OFFSET ?
  `).all(...params);
}

export function countSearchItems(q = '', src = '', fresh = false) {
  const { where, params } = archiveWhere(q, src, fresh);
  return db.prepare(`
    SELECT COUNT(*) AS c FROM (SELECT 1 FROM items WHERE ${where} GROUP BY url)
  `).get(...params).c;
}

/**
 * Wpisy wykryte po danym czasie — dla lekkiego odświeżania na żywo.
 * Tylko widoczne publicznie i niesupresjonowane (czyli faktycznie nowe).
 */
export function listNewItems(sinceMs, limit = 10) {
  return db.prepare(`
    SELECT id,source,source_label,title,title_pl,title_en,url,published_at,first_seen_at,summary_pl,summary_en,change_detected
    FROM items
    WHERE first_seen_at > ? AND suppressed=0 AND ${PUBLIC_WHERE}
    ORDER BY first_seen_at DESC, id DESC
    LIMIT ?
  `).all(sinceMs, limit);
}

/**
 * Liczby do automatycznego „Przeglądu monitora” na stronie głównej.
 * Liczone przy każdym wejściu — bez ręcznej edycji i bez zapisu w bazie.
 */
export function reviewSnapshot(sinceMs) {
  const row = db.prepare(`
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN ${SOCIAL_WHERE} THEN 1 ELSE 0 END) AS social
    FROM items WHERE first_seen_at >= ? AND suppressed=0
  `).get(sinceMs);
  const total = Number(row?.total || 0);
  const social = Number(row?.social || 0);
  const latestMedia = db.prepare(`
    SELECT id,source,source_label,title,title_pl,title_en,url,published_at,first_seen_at
    FROM items
    WHERE suppressed=0 AND NOT ${SOCIAL_WHERE}
    ORDER BY COALESCE(published_at, first_seen_at) DESC, id DESC
    LIMIT 1
  `).get() || null;
  return { total, social, media: total - social, latestMedia };
}

/** Wpisy z ostatnich N ms — do dziennego digestu (publiczne, bez offtopic). */
export function listItemsSince(sinceMs, limit = 300) {
  return db.prepare(`
    SELECT id,source,source_label,title,title_pl,title_en,url,published_at,first_seen_at,summary_pl,summary_en,change_detected
    FROM items
    WHERE first_seen_at >= ? AND ${PUBLIC_WHERE}
    ORDER BY first_seen_at DESC, id DESC
    LIMIT ?
  `).all(sinceMs, limit);
}

export function countUnnotified() {
  return db.prepare('SELECT COUNT(*) AS c FROM items WHERE notified=0 AND suppressed=0 AND notify_attempts < 5').get().c;
}

/** Wpisy celowo pominięte jako duplikaty zdarzeń / stare wpisy z bootstrapu. */
export function countSuppressed() {
  return db.prepare('SELECT COUNT(*) AS c FROM items WHERE suppressed=1').get().c;
}

/** Wpisy, których wysyłka nie powiodła się 5 razy (porzucone). */
export function countFailedNotifications() {
  return db.prepare('SELECT COUNT(*) AS c FROM items WHERE notified=0 AND suppressed=0 AND notify_attempts >= 5').get().c;
}

export function upsertSourceState(source, { ok, error = null, count = 0, contentHash = null }) {
  db.prepare(`
    INSERT INTO source_state(source,last_ok_at,last_error,last_count,content_hash,consecutive_failures)
    VALUES(?,?,?,?,?,?)
    ON CONFLICT(source) DO UPDATE SET
      last_ok_at=COALESCE(excluded.last_ok_at, source_state.last_ok_at),
      last_error=excluded.last_error,
      last_count=CASE WHEN excluded.last_ok_at IS NOT NULL THEN excluded.last_count ELSE source_state.last_count END,
      content_hash=COALESCE(excluded.content_hash, source_state.content_hash),
      consecutive_failures=CASE WHEN excluded.last_ok_at IS NOT NULL THEN 0 ELSE source_state.consecutive_failures + 1 END
  `).run(source, ok ? Date.now() : null, error, count, contentHash, ok ? 0 : 1);
}

export function getContentHash(source) {
  const r = db.prepare('SELECT content_hash FROM source_state WHERE source=?').get(source);
  return r?.content_hash ?? null;
}

export function listSourceState() {
  return db.prepare('SELECT * FROM source_state ORDER BY source').all();
}

export function logNotification(itemId, channel, status, detail = null) {
  db.prepare('INSERT INTO notifications(item_id,channel,status,detail,created_at) VALUES(?,?,?,?,?)')
    .run(itemId, channel, status, detail, Date.now());
}

export function listNotifications(limit = 50) {
  return db.prepare(`
    SELECT n.*, i.title AS item_title, i.suppressed AS item_suppressed
    FROM notifications n LEFT JOIN items i ON i.id = n.item_id
    ORDER BY n.created_at DESC LIMIT ?
  `).all(limit);
}

export function countNotifications(status) {
  if (status) return db.prepare('SELECT COUNT(*) AS c FROM notifications WHERE status=?').get(status).c;
  return db.prepare('SELECT COUNT(*) AS c FROM notifications').get().c;
}

/** Liczba udanych wysylek od polnocy (do limitu dobowego). */
export function countSentToday() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return db.prepare("SELECT COUNT(*) AS c FROM notifications WHERE status='sent' AND created_at>=?")
    .get(start.getTime()).c;
}
