/**
 * Dzienny audyt zdrowia źródeł — uczciwa wersja „samoulepszania”.
 *
 * Nie przewiduje przyszłości i nie dodaje źródeł automatycznie. Sprawdza to,
 * co da się sprawdzić: które źródła milczą, które się psują, a które zniknęły
 * z konfiguracji. Raport trafia do data/source-health.json.
 *
 * Użycie:
 *   node src/cli-source-health.js [--json] [--stale-hours=24]
 */
import fs from 'node:fs';
import path from 'node:path';
import { allSources } from './sources.js';
import { listSourceState, db } from './db.js';
import { DATA_DIR } from './config.js';

const arg = (name, def) => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : def;
};
const asJson = process.argv.includes('--json');
const staleHours = Math.max(1, Number(arg('stale-hours', 24)) || 24);
const staleMs = staleHours * 3600_000;
const now = Date.now();

const sources = allSources();
const state = new Map(listSourceState().map((s) => [s.source, s]));

const issues = [];
let healthy = 0;
for (const src of sources) {
  const st = state.get(src.id);
  if (!st) {
    issues.push({ id: src.id, label: src.label, kind: src.kind, problem: 'never', detail: 'brak wpisu w source_state' });
    continue;
  }
  if (st.consecutive_failures >= 3) {
    issues.push({
      id: src.id, label: src.label, kind: src.kind, problem: 'failing',
      failures: st.consecutive_failures, error: st.last_error || null,
    });
    continue;
  }
  if (!st.last_ok_at || now - st.last_ok_at > staleMs) {
    issues.push({
      id: src.id, label: src.label, kind: src.kind, problem: 'stale',
      lastOkAt: st.last_ok_at ? new Date(st.last_ok_at).toISOString() : null,
      hours: st.last_ok_at ? Math.round((now - st.last_ok_at) / 3600_000) : null,
    });
    continue;
  }
  healthy += 1;
}

const known = new Set(sources.map((s) => s.id));
const retired = [...state.keys()].filter((id) => !known.has(id));

const report = {
  generatedAt: new Date(now).toISOString(),
  staleHours,
  totals: {
    sources: sources.length,
    healthy,
    issues: issues.length,
    failing: issues.filter((i) => i.problem === 'failing').length,
    stale: issues.filter((i) => i.problem === 'stale').length,
    never: issues.filter((i) => i.problem === 'never').length,
    retiredState: retired.length,
  },
  issues,
  retired,
};

fs.mkdirSync(DATA_DIR, { recursive: true });
const out = path.join(DATA_DIR, 'source-health.json');
fs.writeFileSync(out, JSON.stringify(report, null, 2));

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`źródła: ${report.totals.sources} · zdrowe: ${healthy} · problemy: ${issues.length}`);
  for (const i of issues) {
    const why = i.problem === 'failing'
      ? `błąd ${i.failures}×: ${i.error || '—'}`
      : i.problem === 'stale' ? `brak sukcesu od ${i.hours} h` : 'brak stanu';
    console.log(`- [${i.problem}] ${i.id} — ${why}`);
  }
  if (retired.length) console.log(`- stan po usuniętych źródłach: ${retired.length}`);
  console.log(`raport: ${out}`);
}

db.close();
