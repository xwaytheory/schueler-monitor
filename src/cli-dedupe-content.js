/**
 * Scala istniejące wpisy o identycznej treści (tytuł + początek tekstu).
 *
 * Domyślnie tylko pokazuje plan. `--apply` oznacza duplikaty jako
 * `duplicate-content`; jeden wpis z każdej grupy zostaje w archiwum.
 *
 *   node src/cli-dedupe-content.js
 *   node src/cli-dedupe-content.js --apply
 */
import { db, markSuppressed, isPublicSuppression } from './db.js';

const apply = process.argv.includes('--apply');

const rows = db.prepare(`
  SELECT id, dedup_key, title, content_key, notified, suppressed, suppressed_reason,
         first_seen_at, score, LENGTH(COALESCE(raw_text, '')) AS len
  FROM items
  WHERE content_key IS NOT NULL AND content_key <> ''
    AND (dedup_key IS NULL OR dedup_key NOT LIKE 'page:%')
  ORDER BY content_key, first_seen_at DESC
`).all();

const groups = new Map();
for (const row of rows) {
  if (!groups.has(row.content_key)) groups.set(row.content_key, []);
  groups.get(row.content_key).push(row);
}

function visibility(row) {
  if (!row.suppressed) return 3;
  return isPublicSuppression(row.suppressed_reason) ? 2 : 1;
}

function better(a, b) {
  return (visibility(a) - visibility(b))
    || ((a.notified ? 1 : 0) - (b.notified ? 1 : 0))
    || (a.len - b.len)
    || ((a.first_seen_at || 0) - (b.first_seen_at || 0));
}

let duplicateGroups = 0;
let duplicateRows = 0;
let marked = 0;
for (const group of groups.values()) {
  if (group.length < 2) continue;
  duplicateGroups++;
  duplicateRows += group.length - 1;
  group.sort((a, b) => better(b, a));
  const keeper = group[0];
  const others = group.slice(1);
  if (!apply) {
    console.log(`[dry-run] ${keeper.title.slice(0, 100)} (${others.length + 1} wpisów, zostaje ${keeper.id})`);
    continue;
  }
  for (const row of others) {
    if (row.suppressed_reason === 'duplicate-content') continue;
    markSuppressed(row.id, 'duplicate-content');
    marked++;
  }
}

console.log(`${apply ? 'Oznaczono' : 'Do oznaczenia'}: ${duplicateGroups} grup, ${apply ? marked : duplicateRows} duplikatów.`);
if (!apply) console.log('Uruchom z --apply, aby ukryć duplikaty (zostaje po jednym wpisie z grupy).');
db.close();
