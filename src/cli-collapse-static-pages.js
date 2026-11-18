/**
 * Scala historyczne wersje statycznych stron artykułów w jeden wpis.
 *
 * Strony z `versioned: true` (oficjalne komunikaty, akta, rejestr) zachowują
 * historię zmian. Zwykłe artykuły dostają jeden wpis po URL, więc stare
 * snapshoty są ukrywane.
 *
 *   node src/cli-collapse-static-pages.js
 *   node src/cli-collapse-static-pages.js --apply
 */
import { db, markSuppressed, isPublicSuppression } from './db.js';
import { contentKey, dedupKey } from './dedup.js';
import { PAGE_SOURCES } from './sources.js';

const apply = process.argv.includes('--apply');
const staticIds = PAGE_SOURCES.filter((p) => !p.versioned).map((p) => p.id);
if (!staticIds.length) {
  console.log('Brak statycznych stron do scalenia.');
  process.exit(0);
}

const marks = staticIds.map(() => '?').join(',');
const rows = db.prepare(`
  SELECT id, source, title, url, dedup_key, raw_text, first_seen_at,
         suppressed, suppressed_reason
  FROM items
  WHERE dedup_key LIKE 'page:%' AND source IN (${marks})
  ORDER BY source, first_seen_at DESC
`).all(...staticIds);

const groups = new Map();
for (const row of rows) {
  if (!groups.has(row.source)) groups.set(row.source, []);
  groups.get(row.source).push(row);
}

function rank(row) {
  const visible = !row.suppressed || isPublicSuppression(row.suppressed_reason);
  return [visible ? 1 : 0, row.first_seen_at || 0];
}

let collapsed = 0;
let hidden = 0;
for (const group of groups.values()) {
  group.sort((a, b) => {
    const [av, at] = rank(a);
    const [bv, bt] = rank(b);
    return (bv - av) || (bt - at);
  });
  const keep = group[0];
  const urlKey = dedupKey({ url: keep.url });
  const existing = db.prepare('SELECT id FROM items WHERE dedup_key=?').get(urlKey);
  const canKeep = !existing || existing.id === keep.id;
  if (canKeep) {
    if (apply) {
      db.prepare('UPDATE items SET dedup_key=?, content_key=? WHERE id=?')
        .run(urlKey, contentKey({ title: keep.title, rawText: keep.raw_text }), keep.id);
    }
    collapsed++;
  }
  for (const row of group) {
    if (canKeep && row.id === keep.id) continue;
    if (row.suppressed_reason === 'duplicate-content') continue;
    if (apply) markSuppressed(row.id, 'duplicate-content');
    hidden++;
  }
}

console.log(`${apply ? 'Scalono' : 'Do scalenia'}: ${groups.size} źródeł, ${collapsed} wpisów zachowanych, ${hidden} ukrytych.`);
if (!apply) console.log('Uruchom z --apply, aby zapisać zmiany.');
db.close();
