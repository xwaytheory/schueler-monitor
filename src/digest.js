import fs from 'node:fs';
import path from 'node:path';
import { listItemsSince, listSourceState } from './db.js';
import { LEGAL_DEADLINES, daysUntil, CASE_STATUS } from './facts.js';
import { allSources, localizeSourceLabel } from './sources.js';
import { DATA_DIR } from './config.js';

const SOCIAL_RE = /^(x-|xprof-|reddit-)/i;
const fmtDay = (ts) => new Intl.DateTimeFormat('pl-PL', {
  timeZone: 'Europe/Warsaw', day: '2-digit', month: '2-digit', year: 'numeric',
}).format(new Date(ts));
const fmtTime = (ts) => new Intl.DateTimeFormat('pl-PL', {
  timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit',
}).format(new Date(ts));

/** Zbiera zmiany z ostatnich `hours` godzin. Nie woła AI i nie wysyła nic. */
export function buildDigest({ hours = 24, now = Date.now() } = {}) {
  const since = now - hours * 3600_000;
  const detected = listItemsSince(since, 300);
  const publishedMs = (i) => Number(i.published_at) || Number(i.first_seen_at) || 0;
  // Wpis „wykryty ponownie” ma first_seen_at w oknie, ale został opublikowany
  // wcześniej. Nie jest nowym zdarzeniem i nie może być liczony jako news.
  const isOld = (i) => Number(i.published_at) > 0 && Number(i.published_at) < since;
  const redetected = detected.filter(isOld).sort((a, b) => publishedMs(b) - publishedMs(a));
  const fresh = detected.filter((i) => !isOld(i)).sort((a, b) => publishedMs(b) - publishedMs(a));
  const changes = detected.filter((i) => i.change_detected);
  const social = fresh.filter((i) => SOCIAL_RE.test(String(i.source || '')));
  const media = fresh.filter((i) => !SOCIAL_RE.test(String(i.source || '')));
  const known = new Set(allSources().map((s) => s.id));
  const stateMap = new Map(listSourceState().map((s) => [s.source, s]));
  const states = [...known].map((id) => stateMap.get(id) || { source: id, consecutive_failures: 0, last_ok_at: null });
  const problems = states.filter((s) => {
    if (Number(s.consecutive_failures || 0) >= 3) return true;
    return !s.last_ok_at || now - Number(s.last_ok_at) > 24 * 3600_000;
  });
  const deadlines = LEGAL_DEADLINES.map((d) => ({
    label: d.label,
    date: d.date,
    days: daysUntil(d.date, new Date(now)),
  }));
  return {
    generatedAt: now, hours, since,
    items: detected, fresh, redetected,
    changes, social, media, states, problems, deadlines,
  };
}

export function formatDigest(d) {
  const lines = [];
  lines.push(`📊 Dzienny digest — ${fmtDay(d.generatedAt)}`);
  lines.push(`Sprawa: ${CASE_STATUS.statusShort}`);
  lines.push('');
  lines.push(`Nowe publikacje (${d.hours} h): ${d.fresh.length} — media ${d.media.length}, X/social ${d.social.length}`);
  if (d.redetected.length) lines.push(`Wykryte ponownie — starsze publikacje: ${d.redetected.length}`);
  lines.push(`Ciche zmiany źródeł: ${d.changes.length}`);
  lines.push(`Źródła: ${d.states.length - d.problems.length}/${d.states.length} bez problemów`);
  if (d.problems.length) {
    lines.push('Problemy: ' + d.problems.slice(0, 5).map((s) => `${s.source} (${s.consecutive_failures || 0} bł.)`).join(', '));
  }
  if (d.deadlines.length) {
    lines.push('Terminy: ' + d.deadlines.map((x) => `${x.label} — ${x.days < 0 ? `${-x.days} dni po` : `za ${x.days} dni`}`).join(' · '));
  }
  lines.push('');
  if (!d.fresh.length) {
    lines.push('Brak nowych publikacji w tym oknie.');
    if (d.redetected.length) {
      lines.push('(Wpisy w archiwum to starsze artykuły wykryte ponownie — nie nowe zdarzenia.)');
    }
  } else {
    lines.push('Najnowsze publikacje:');
    for (const it of d.fresh.slice(0, 8)) {
      const title = (it.title_pl || it.title || '').replace(/\s+/g, ' ').slice(0, 160);
      lines.push(`• ${fmtTime(it.published_at || it.first_seen_at)} — ${title} (${localizeSourceLabel(it.source_label || it.source, 'pl')})`);
    }
    if (d.fresh.length > 8) lines.push(`… i ${d.fresh.length - 8} więcej w archiwum.`);
  }
  if (d.redetected.length) {
    lines.push('');
    lines.push('Wykryte ponownie (starsze publikacje — nie nowe zdarzenia):');
    for (const it of d.redetected.slice(0, 5)) {
      const title = (it.title_pl || it.title || '').replace(/\s+/g, ' ').slice(0, 160);
      const pub = it.published_at ? fmtDay(it.published_at) : 'data nieznana';
      lines.push(`• ${pub} — ${title} (${localizeSourceLabel(it.source_label || it.source, 'pl')})`);
    }
    if (d.redetected.length > 5) lines.push(`… i ${d.redetected.length - 5} więcej w archiwum.`);
  }
  if (d.changes.length) {
    lines.push('');
    lines.push('Zmienione źródła:');
    for (const it of d.changes.slice(0, 5)) {
      lines.push(`• ${(it.title_pl || it.title || '').slice(0, 140)} (${localizeSourceLabel(it.source_label || it.source, 'pl')})`);
    }
  }
  return lines.join('\n');
}

/** Zapis ostatniego digestu do pliku (podgląd w /ops i audyt). */
export function saveDigest(text) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(path.join(DATA_DIR, 'digest-last.txt'), text + '\n');
  } catch { /* brak zapisu nie blokuje wysyłki */ }
}
