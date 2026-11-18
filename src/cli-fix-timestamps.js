/**
 * Naprawa timestampow w archiwum: normalizuje do milisekund.
 * Wczesniejsza wersja zapisywala czasy w sekundach.
 * Uzycie: node src/cli-fix-timestamps.js
 */
import { db } from './db.js';

const MS_MIN = 1e11;        // wartosc ponizej = sekundy
const MIN_MS = 946684800000; // 2000-01-01
const MAX_MS = Date.now() + 86400000;

const rows = db.prepare(`
  SELECT id, published_at, first_seen_at FROM items
  WHERE published_at IS NOT NULL OR first_seen_at IS NOT NULL
`).all();

const upd = db.prepare('UPDATE items SET published_at=?, first_seen_at=? WHERE id=?');
let fixed = 0;
for (const r of rows) {
  let p = r.published_at;
  let f = r.first_seen_at;
  const origP = p, origF = f;

  // published_at: sekundy -> ms
  if (p != null && p > 0 && p < MS_MIN) p = Math.round(p * 1000);
  // first_seen_at: powinien byc zawsze ms (z Date.now()), ale zabezpieczamy.
  if (f != null && f > 0 && f < MS_MIN) f = Math.round(f * 1000);

  // Sanity check - data nie moze byc w przyszlosci ani przed 2000 rokiem.
  if (p != null && (p > MAX_MS || p < MIN_MS)) p = null;
  if (f != null && (f > MAX_MS || f < MIN_MS)) f = Date.now();

  if (p !== origP || f !== origF) {
    upd.run(p, f, r.id);
    fixed++;
  }
}
console.log(`poprawiono timestampy w ${fixed} wpisach`);

const bad = db.prepare('SELECT COUNT(*) c FROM items WHERE published_at IS NOT NULL AND (published_at < ? OR published_at > ?)').get(MS_MIN, MAX_MS).c;
console.log(`pozostalo blednych dat: ${bad}`);
const sample = db.prepare('SELECT title, published_at FROM items WHERE published_at IS NOT NULL ORDER BY published_at DESC LIMIT 3').all();
for (const s of sample) {
  console.log(`  ${new Date(s.published_at).toISOString().slice(0, 16)}  ${s.title.slice(0, 60)}`);
}
db.close();
