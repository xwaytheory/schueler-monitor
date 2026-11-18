/**
 * Reset stanu powiadomien (nie usuwa archiwum wpisow).
 * Uzycie: node src/cli-reset-notify.js [--all]
 *   --all  - resetuje flage bootstrap (nastepny skan znowu wysle powiadomienia)
 */
import { db } from './db.js';

const all = process.argv.includes('--all');

const n1 = db.prepare('DELETE FROM notifications').run().changes;
const n2 = db.prepare('DELETE FROM stories').run().changes;
const n3 = db.prepare('UPDATE items SET notified=0, notified_at=NULL, notify_attempts=0, last_notify_error=NULL').run().changes;
let n4 = 0;
if (all) {
  db.prepare("DELETE FROM kv WHERE k='bootstrapped'").run();
  n4 = 1;
}

console.log(`wyczyszczono: powiadomien=${n1}, zdarzen=${n2}, flag notified=${n3}, bootstrap reset=${n4}`);
db.close();
