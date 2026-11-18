/** Narzedzie CLI: jednorazowy skan z raportem (do diagnostyki na serwerze). */
import { collectAll } from './collector.js';
import { evaluate } from './matcher.js';
import { CONFIG } from './config.js';

const only = process.argv.includes('--only')
  ? process.argv[process.argv.indexOf('--only') + 1].split(',')
  : null;

console.log(`[cli] skan zrodel${only ? ': ' + only.join(', ') : ''} ...\n`);
const results = await collectAll(only ? { only } : {});

let total = 0, matched = 0;
for (const { src, ok, items, error } of results) {
  const hits = items.filter((i) => evaluate(i.text, i.title).relevant);
  total += items.length;
  matched += hits.length;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${src.id.padEnd(22)} ${String(items.length).padStart(3)} pozycji, ${String(hits.length).padStart(2)} trafień${error ? '  -> ' + error : ''}`);
  for (const h of hits.slice(0, 6)) {
    const v = evaluate(h.text, h.title);
    console.log(`      [${v.score}] ${h.title.slice(0, 120)}`);
    console.log(`           ${h.url}`);
    console.log(`           trafienia: ${v.terms.slice(0, 8).join(', ')}`);
  }
}
console.log(`\n[cli] razem: ${total} pozycji, ${matched} trafień.`);
console.log(`[cli] discord: ${CONFIG.discord.webhookUrl ? 'skonfigurowany' : 'BRAK webhooka'}`);
console.log(`[cli] ai: ${CONFIG.ai.openrouterKey ? 'OpenRouter' : 'pollinations fallback'}`);
