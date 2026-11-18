/**
 * Dzienny digest „co się zmieniło”. Użycie:
 *   node src/cli-digest.js [--hours=24] [--discord]
 */
import { buildDigest, formatDigest, saveDigest } from './digest.js';
import { sendDigest } from './discord.js';

const arg = (name, def) => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : def;
};
const hours = Math.max(1, Number(arg('hours', 24)) || 24);
const d = buildDigest({ hours });
const text = formatDigest(d);
saveDigest(text);
console.log(text);

if (process.argv.includes('--discord')) {
  const r = await sendDigest(text);
  if (!r.ok) {
    console.error('[digest] Discord:', r.error);
    process.exitCode = 1;
  } else {
    console.log('[digest] wysłano na Discord');
  }
}
