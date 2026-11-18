/**
 * Odtwarza historię powiadomien (tabela `notifications`) z archiwum wpisów.
 * Uzycie: node src/cli-rebuild-notifications.js
 *
 * Historia wysylek jest zrodlem prawdy dla odtwarzania kanalu - flagi
 * `items.notified` daja sie zresetowac, historia nie.
 */
import { db } from './db.js';
import { storyKey, storyDetailLevel } from './story.js';

const rows = db.prepare(`
  SELECT id, title, url, published_at, first_seen_at, raw_text, summary_pl
  FROM items
  ORDER BY COALESCE(published_at, first_seen_at) ASC
`).all();

console.log(`wpisow w archiwum: ${rows.length}`);

const del = db.prepare("DELETE FROM notifications WHERE status='sent'");
const ins = db.prepare(
  "INSERT INTO notifications(item_id,channel,status,detail,created_at) VALUES(?,'discord','sent',NULL,?)"
);
const notif = db.prepare('UPDATE items SET notified=1, notified_at=? WHERE id=?');

del.run();

let n = 0;
for (const r of rows) {
  // Wpisowi odpowiada powiadomienie, jesli ma kompletne streszczenie
  // (oznacza to, ze byl przetworzony przez AI i wyslany).
  if (!r.summary_pl) continue;
  const t = r.published_at || r.first_seen_at;
  ins.run(r.id, t);
  notif.run(t, r.id);
  n++;
}

console.log(`odtworzono powiadomien: ${n}`);

// Zdarzenia: odtwarzamy z wpisow z kompletnym streszczeniem.
const storyRows = db.prepare(`
  SELECT id, title, raw_text FROM items WHERE summary_pl IS NOT NULL AND summary_pl != ''
`).all();
const markStory = db.prepare(`
  INSERT INTO stories(key,detail_level,first_seen_at,notified_at,item_id,title)
  VALUES(?,?,?,?,?,?)
  ON CONFLICT(key) DO UPDATE SET detail_level=MAX(stories.detail_level, excluded.detail_level)
`);
let s = 0;
for (const r of storyRows) {
  const key = storyKey(r.raw_text || '', r.title);
  if (!key) continue;
  const level = storyDetailLevel(`${r.title} ${r.raw_text || ''}`);
  const t = Date.now();
  markStory.run(key, level, t, t, r.id, r.title.slice(0, 300));
  s++;
}
console.log(`zdarzen zarejestrowano: ${s}`);

db.close();
