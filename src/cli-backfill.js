/**
 * Backfill streszczen AI dla wpisow, ktore nie maja jeszcze podsumowania.
 * Uzycie: node src/cli-backfill.js [limit]
 */
import { db } from './db.js';
import { summarize } from './summarizer.js';

const limit = Number(process.argv[2] || 60);
const rows = db.prepare(`
  SELECT id,title,raw_text FROM items
  WHERE (summary_pl IS NULL OR summary_pl = '' OR title_pl IS NULL OR title_pl = '')
  ORDER BY COALESCE(published_at, first_seen_at) DESC
  LIMIT ?
`).all(limit);

console.log(`[backfill] wpisow do streszczenia: ${rows.length}`);

const upd = db.prepare("UPDATE items SET summary_pl=?, summary_en=?, title_pl=COALESCE(NULLIF(?,''), title_pl), title_en=COALESCE(NULLIF(?,''), title_en) WHERE id=?");
let ok = 0;
for (const r of rows) {
  try {
    const s = await summarize(r.title, r.raw_text || '');
    if (s.pl || s.en) {
      upd.run(s.pl, s.en, s.titlePl || '', s.titleEn || '', r.id);
      ok++;
      console.log(`  [${ok}] ${r.title.slice(0, 80)}`);
    }
  } catch (e) {
    console.error('  blad:', e.message);
  }
}
console.log(`[backfill] gotowe: ${ok}/${rows.length}`);
db.close();
