/**
 * Usuwa z archiwum wpisy, ktore nie przechodza aktualnej klasyfikacji
 * (np. nekrologi, ktore przemknely wczesniej).
 * Uzycie: node src/cli-clean-archive.js
 */
import { db } from './db.js';
import { evaluate } from './matcher.js';
import { storyKey, storyDetailLevel } from './story.js';

const rows = db.prepare('SELECT id, title, raw_text, source, notified FROM items').all();
const del = db.prepare('DELETE FROM items WHERE id=?');
const delNotif = db.prepare('DELETE FROM notifications WHERE item_id=?');

let removed = 0;
const removedTitles = [];
for (const r of rows) {
  const v = evaluate(`${r.title} ${r.raw_text || ''}`, r.title);
  if (v.relevant) continue;
  delNotif.run(r.id);
  del.run(r.id);
  removed++;
  if (removedTitles.length < 25) removedTitles.push(r.title.slice(0, 90));
}

console.log(`usunieto z archiwum: ${removed} z ${rows.length}`);
for (const t of removedTitles) console.log('  -', t);

// Zdarzenia: przeliczamy na podstawie aktualnych wpisow.
db.exec('DELETE FROM stories');
const storyRows = db.prepare(
  "SELECT id, title, raw_text FROM items WHERE summary_pl IS NOT NULL AND summary_pl != ''"
).all();
const markStory = db.prepare(`
  INSERT INTO stories(key,detail_level,first_seen_at,notified_at,item_id,title)
  VALUES(?,?,?,?,?,?)
  ON CONFLICT(key) DO UPDATE SET detail_level=MAX(stories.detail_level, excluded.detail_level)
`);
let s = 0;
for (const r of storyRows) {
  const key = storyKey(r.raw_text || '', r.title);
  if (!key) continue;
  const t = Date.now();
  markStory.run(key, storyDetailLevel(`${r.title} ${r.raw_text || ''}`), t, t, r.id, r.title.slice(0, 300));
  s++;
}
console.log(`zdarzen przeliczono: ${s}`);
db.close();
