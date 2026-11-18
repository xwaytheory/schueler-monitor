import { CONFIG } from './config.js';
import {
  CASE_STATUS, CASE_DISCLAIMER, CONFIRMED_FACTS, CLAIMED_FACTS, UNKNOWNS,
  TIMELINE, CONTRADICTIONS, KNOWN_ERRORS, KEY_FACTS, LAST_CONFIRMED,
  LEGAL_ACTS, LEGAL_DEADLINES, LEGAL_ROADMAP, LEGAL_NOTES, daysUntil, caseDay,
  caseProgress, PROGRESS_MARKS, checkClaims, redactPrivate, REVIEWED_AT,
} from './facts.js';
import { FACTS_EN } from './facts-i18n.js';
import {
  esc, safeLink, safeUrl, hostOf, money, fmtDate, fmtDateTime, relTime, page, cleanTitle,
} from './web-ui.js';
import { t, pick, normalizeLang, normalizeTheme, pluralFor } from './i18n.js';
import { localizeSourceLabel } from './sources.js';
import { SCENARIOS, windowStates } from './outlook.js';

/** Tłumaczenie pola z zewnętrznej mapy EN (facts-i18n.js). */
const fen = (group, id, field) => FACTS_EN?.[group]?.[id]?.[field];
/** To samo dla grup płaskich (CASE_STATUS, LAST_CONFIRMED). */
const fenFlat = (group, field) => FACTS_EN?.[group]?.[field];
/** Wybór PL/EN dla pola, które nie ma własnego obiektu dwujęzycznego. */
const L = (lang, pl, en) => (lang === 'en' && en ? en : pl);
/** Tytuł w języku strony; oryginał wydawcy zostaje fallbackiem. */
const titleOf = (it, lang) => (lang === 'en' ? (it.title_en || it.title) : (it.title_pl || it.title));

/** Streszczenia AI zawsze dostają jawną etykietę. */
function gloss(text, lang) {
  if (!text) return '';
  return `<p class="gloss"><span class="ai-tag">${esc(t(lang, 'label.ai'))}</span>${esc(redactPrivate(text))}</p>`;
}

function sectionHead(kicker, title, note) {
  return `<div class="section-head">
    <div><p class="kicker">${esc(kicker)}</p><h2>${esc(title)}</h2></div>
    ${note ? `<p class="section-note">${esc(note)}</p>` : ''}
  </div>`;
}

/** Przypisy aktów prawnych: klikalny skrót prowadzi do tekstu aktu. */
function actChips(ids, lang) {
  if (!Array.isArray(ids) || !ids.length) return '';
  const items = ids.map((id) => LEGAL_ACTS[id]).filter(Boolean)
    .map((a) => safeLink(a.url, L(lang, a.label, a.en), 'act')).join('');
  return items ? `<div class="acts">${items}</div>` : '';
}

const LEGAL_ACT_IDS = ['ece', 'law6706', 'cmk', 'act456', 'act621', 'vuk', 'constitution', 'cets98', 'echr'];

/** Wpisy z X/Reddita to relacje społecznościowe, nie ustalenia monitora. */
const SOCIAL_SOURCE_RE = /^(x-|xprof-|reddit-)/i;
const isSocial = (it) => SOCIAL_SOURCE_RE.test(String(it?.source || ''));

/** Link wewnątrzstronicowy (#sekcja) nie może dostawać target="_blank". */
const factLink = (url, label, cls = '') => (
  String(url || '').startsWith('#')
    ? `<a${cls ? ` class="${esc(cls)}"` : ''} href="${esc(url)}">${esc(label)}</a>`
    : safeLink(url, label, cls)
);

function renderDossier(lang) {
  const cs = CASE_STATUS;
  return `
  <aside class="dossier" aria-label="${esc(t(lang, 'dossier.aria'))}">
    <div class="dossier-head"><b>${esc(t(lang, 'dossier.title'))}</b><span>${esc(cs.redNotice)}</span></div>
    <dl>
      <div class="row"><dt>${esc(t(lang, 'dossier.status'))}</dt><dd>${esc(t(lang, 'dossier.status_value'))}
        <span class="fine">${esc(t(lang, 'dossier.status_fine', { date: cs.publicConfirmation }))}</span></dd></div>
      <div class="row"><dt>${esc(t(lang, 'dossier.basis'))}</dt><dd>${esc(t(lang, 'dossier.basis_value'))}
        <span class="fine">${esc(t(lang, 'dossier.basis_fine', { date: cs.redNoticeDate }))}</span></dd></div>
      <div class="row"><dt>${esc(t(lang, 'dossier.charge'))}</dt><dd>${esc(L(lang, cs.charge, cs.chargeEn))}
        <span class="fine">${esc(L(lang, cs.chargeShort, fenFlat('CASE_STATUS', 'chargeShort')))} · ${esc(t(lang, 'dossier.charge_fine'))}</span></dd></div>
      <div class="row"><dt>${esc(t(lang, 'dossier.fi'))}</dt><dd>${esc(L(lang, cs.courtShort, fenFlat('CASE_STATUS', 'courtShort')))}
        <span class="fine">${esc(L(lang, cs.court, fenFlat('CASE_STATUS', 'court')))} · ${esc(cs.arrestWarrantDate)} · ${esc(t(lang, 'dossier.fi_fine'))}</span></dd></div>
      <div class="row"><dt>${esc(t(lang, 'dossier.extradition'))}</dt><dd>${esc(t(lang, 'dossier.extradition_value'))}
        <span class="fine">${esc(t(lang, 'dossier.extradition_fine'))}</span></dd></div>
    </dl>
    <p class="dossier-note">${esc(t(lang, 'dossier.tax', {
      rank: cs.taxRank, income: cs.taxIncome, rate: cs.taxRate,
    }))}</p>
  </aside>`;
}

/** Nagłówek aktowy: numer noty i data redakcyjna — tylko w motywie dossier. */
function renderFiling(lang) {
  const cs = CASE_STATUS;
  return `<div class="filing">
    <span class="f-no">${esc(t(lang, 'filing.caption', { notice: cs.redNotice }))}</span>
    <span class="f-ed">${esc(t(lang, 'filing.edition', { date: REVIEWED_AT }))}</span>
  </div>`;
}

/**
 * „Przegląd monitora” — liczony z bazy przy każdym renderze, więc zawsze świeży.
 * Nie zawiera twierdzeń o sprawie: tylko to, co monitor faktycznie zobaczył.
 */
function renderReview(review, lang) {
  const r = review || {};
  const gen = Number(r.generatedAt) || Date.now();
  const latest = r.latestMedia;
  const latestDated = Number(latest?.published_at) > 0;
  const latestDate = latest
    ? fmtDate(latestDated ? latest.published_at : latest.first_seen_at, lang)
    : '';
  const latestLink = latest
    ? safeLink(latest.url, cleanTitle(titleOf(latest, lang), lang))
    : '';
  return `
<section class="wrap section" id="przeglad">
  ${sectionHead(t(lang, 'review.kicker'), t(lang, 'review.title'), t(lang, 'review.note'))}
  <div class="review">
    <div class="rev-main">
      <p class="rev-status"><b>${esc(t(lang, 'review.status'))}</b> ${esc(t(lang, 'review.status_text', { date: LAST_CONFIRMED.date }))}</p>
      <p>${esc(t(lang, 'review.counts', { days: 7, media: r.media ?? 0, social: r.social ?? 0 }))}</p>
      ${latestLink ? `<p class="rev-latest">${esc(t(lang, latestDated ? 'review.latest' : 'review.latest_reference'))} ${latestLink}
        <span class="fine">${esc(latestDated ? latestDate : t(lang, 'review.checked', { date: latestDate }))} · ${esc(t(lang, latestDated ? 'review.social_note' : 'review.reference_note'))}</span></p>` : ''}
    </div>
    <dl class="rev-meta">
      <div><dt>${esc(t(lang, 'review.generated'))}</dt><dd>${esc(fmtDateTime(gen, lang))}</dd></div>
      <div><dt>${esc(t(lang, 'method.last_scan'))}</dt><dd>${r.lastRunAt ? esc(relTime(r.lastRunAt, lang)) : '—'}</dd></div>
      <div><dt>${esc(t(lang, 'review.sources'))}</dt><dd>${r.sourcesOk ?? 0}/${r.sourcesTotal ?? 0}</dd></div>
      <div><dt>${esc(t(lang, 'method.archive_total'))}</dt><dd>${r.archiveTotal ?? 0}</dd></div>
      <div><dt>${esc(t(lang, 'review.editorial'))}</dt><dd>${esc(r.editorialAt || REVIEWED_AT)}</dd></div>
    </dl>
  </div>
</section>`;
}

/** Dwa okna ustawowe liczone z dat — stan zmienia się sam, bez ręcznej edycji. */
function renderWindow(lang) {
  const cells = windowStates().map((d) => {
    const label = L(lang, d.label, fen('LEGAL_DEADLINES', d.id, 'label'));
    const body = t(lang, d.id === 'docs-18' ? 'window.docs_expired_body' : 'window.max_body');
    const count = d.left < 0
      ? t(lang, 'window.ago', { n: Math.abs(d.left), unit: dayUnit(lang, d.left) })
      : countdown(d.date, lang);
    return `<div class="wcell">
      <div class="wcell-top">
        <span class="wcell-label">${esc(label)}</span>
        <span class="wchip ${esc(d.state)}">${esc(t(lang, d.id === 'docs-18' && d.state === 'expired' ? 'window.after18' : `window.${d.state}`))}</span>
      </div>
      <p class="wcell-date">${esc(fmtDate(Date.parse(`${d.date}T00:00:00Z`), lang))}</p>
      <p class="wcell-count">${esc(count)}</p>
      <p class="wcell-body">${esc(body)}</p>
      <p class="wcell-basis">${esc(L(lang, d.basis, fen('LEGAL_DEADLINES', d.id, 'basis')))} · ${esc(t(lang, 'badge.calculated'))}</p>
      ${actChips(d.acts, lang)}
    </div>`;
  }).join('');
  return `
<section class="wrap section reveal" id="okno">
  ${sectionHead(t(lang, 'window.kicker'), t(lang, 'window.title'))}
  <div class="window">
    <div class="window-grid">${cells}</div>
    <p class="window-note">${esc(t(lang, 'window.note'))}</p>
  </div>
</section>`;
}

/** Prognoza: pasek prawdopodobieństw + karty scenariuszy. Hipoteza, nie fakt. */
function renderScenarios(lang) {
  const segs = SCENARIOS.map((s) => {
    const c = s[lang] || s.pl;
    return `<span class="scen-seg${s.prob < 8 ? ' tiny' : ''}" style="--w:${s.prob}%;background:${s.color}"
      title="${esc(`${s.prob}% — ${c.title}`)}"><span>${s.prob}%</span></span>`;
  }).join('');
  const legend = SCENARIOS.map((s) => {
    const c = s[lang] || s.pl;
    return `<span><i style="background:${s.color}" aria-hidden="true"></i>${esc(c.title)}</span>`;
  }).join('');
  const cards = SCENARIOS.map((s, i) => {
    const c = s[lang] || s.pl;
    return `<article class="scen-card reveal" style="--sc:${s.color}">
      <div class="scen-head">
        <div>
          <p class="scen-rank">${String(i + 1).padStart(2, '0')} / ${String(SCENARIOS.length).padStart(2, '0')}</p>
          <h3>${esc(c.title)}</h3>
        </div>
        <p class="scen-prob"><b>${s.prob}%</b><small>${esc(t(lang, 'scen.prob'))}</small></p>
      </div>
      <span class="scen-hyp">${esc(t(lang, 'scen.hypothesis'))}</span>
      <p class="scen-desc">${esc(c.desc)}</p>
      <div class="scen-meta">
        <div><h4>${esc(t(lang, 'scen.signals'))}</h4><p>${esc(c.signals)}</p></div>
        <div><h4>${esc(t(lang, 'scen.basis'))}</h4><p class="basis">${esc(c.basis)}</p>${actChips(s.acts, lang)}</div>
        <div class="span2"><h4>${esc(t(lang, 'scen.meaning'))}</h4><p>${esc(c.meaning)}</p></div>
      </div>
    </article>`;
  }).join('');
  return `
<section class="wrap section" id="scenariusze">
  ${sectionHead(t(lang, 'scen.kicker'), t(lang, 'scen.title'), t(lang, 'scen.note'))}
  <div class="scen-bar" data-scen-bar role="img" aria-label="${esc(t(lang, 'scen.title'))}">${segs}</div>
  <p class="scen-legend">${legend}</p>
  <div class="scen-grid">${cards}</div>
  <div class="scen-foot">
    <div><h3>${esc(t(lang, 'scen.watch'))}</h3><p>${esc(t(lang, 'scen.watch_text'))}</p></div>
    <div><h3>${esc(t(lang, 'scen.method'))}</h3><p>${esc(t(lang, 'scen.method_text'))}</p></div>
  </div>
</section>`;
}

/** Kluczowe fakty — bilans wiedzy, niżej niż nowe wpisy i oś czasu. */
function renderKeyFacts(lang) {
  const facts = KEY_FACTS.map((f) => `
    <div class="sfact">
      <div class="sfact-top">
        <span class="sfact-label">${esc(L(lang, f.label, fen('KEY_FACTS', f.id, 'label')))}</span>
        <span class="vbadge ${esc(f.badge)}">${esc(t(lang, `badge.${f.badge}`))}</span>
      </div>
      <p class="sfact-value">${esc(L(lang, f.value, fen('KEY_FACTS', f.id, 'value')))}</p>
      <p class="sfact-note">${esc(L(lang, f.note, fen('KEY_FACTS', f.id, 'note')))}</p>
      <p class="sfact-src">${factLink(f.url, L(lang, f.source, fen('KEY_FACTS', f.id, 'source')))}</p>
    </div>`).join('');
  return `<div class="wrap keyfacts-wrap"><div class="keyfacts">${facts}</div></div>`;
}

/** Cztery karty-„akta” z kamieniami milowymi — w osi czasu, poza pierwszym ekranem. */
function renderClips(lang) {
  const rot = [-1.1, 0.8, -0.6, 1.0];
  return `<div class="tl-clips">${PROGRESS_MARKS.map((m, i) => `
    <article class="tl-clip" style="--rot:${rot[i]}deg;--i:${i}">
      <p class="clip-kicker"><i aria-hidden="true"></i>${esc(t(lang, `tl.press.${m.id}.k`))}</p>
      <h3 class="clip-h">${esc(t(lang, `tl.press.${m.id}.h`))}</h3>
      <p class="clip-p">${esc(t(lang, `tl.press.${m.id}.p`))}</p>
      <span class="clip-stamp" aria-hidden="true">${esc(t(lang, 'tl.press.stamp'))}</span>
    </article>`).join('')}</div>`;
}

function renderHero({ lastRunAt, latest = [] } = {}, lang) {
  const cs = CASE_STATUS;
  // Pozycja ostatniego potwierdzonego ustalenia (21.10 = dzień 8 → 17,5 % okna).
  const lastConfirmedPct = (() => {
    const [dd, mm, yyyy] = String(LAST_CONFIRMED.date).split('.');
    const days = Math.round(
      (Date.parse(`${yyyy}-${mm}-${dd}T00:00:00Z`) - Date.parse('2026-10-14T00:00:00Z')) / 86_400_000,
    );
    return Math.min(100, Math.max(0, (days / 40) * 100)).toFixed(1);
  })();

  const marks = PROGRESS_MARKS.map((m) => `
    <span class="tl-mark${m.at / 40 * 100 <= caseProgress() ? ' hit' : ''}" style="left:${(m.at / 40 * 100).toFixed(1)}%"
      title="${esc(m.label)} — ${esc(L(lang, m.note, fen('PROGRESS_MARKS', m.id, 'note')))}"></span>`).join('');
  // Etykiety stoją dokładnie pod swoim znacznikiem; gdy dwa znaczniki są blisko
  // (mniej niż 12 % osi), druga etykieta schodzi do drugiego rzędu, żeby się nie nachodziły.
  let labelRow = 0;
  let prevPct = -100;
  const labels = PROGRESS_MARKS.map((m) => {
    const pct = (m.at / 40) * 100;
    labelRow = pct - prevPct < 12 ? 1 - labelRow : 0;
    prevPct = pct;
    return `
    <span data-row="${labelRow}" style="--at:${pct.toFixed(1)}%"><b>${esc(m.label)}</b>${esc(L(lang, m.note, fen('PROGRESS_MARKS', m.id, 'note')))}</span>`;
  }).join('');

  // Najnowszy wpis społecznościowy w oknie sprawy — osobny, przerywany znacznik.
  const social = (latest || [])
    .filter((it) => isSocial(it) && (it.published_at || it.first_seen_at))
    .map((it) => ({
      ts: it.published_at || it.first_seen_at,
      title: titleOf(it, lang),
      day: caseDay(new Date(it.published_at || it.first_seen_at)),
    }))
    .filter((it) => it.day >= 1 && it.day <= 41)
    .sort((a, b) => b.ts - a.ts)[0];
  // Wpis z dzisiaj stoi dokładnie na kropce „dziś” (jego znacznik czasu bywa datą
  // bez godziny, co dawało przesunięcie). Starsze wpisy zostają na swoim dniu.
  // Wpis z dziś lub z ostatniej doby stoi na kropce „dziś” — znacznik czasu bywa datą
  // bez godziny, a strefa sprawy (Stambuł) przechodzi na nowy dzień wcześniej niż UTC,
  // co dawało przesunięcie o dobę. Starsze wpisy zostają na swoim dniu.
  const socialPct = social
    ? (caseDay() - caseDay(new Date(social.ts)) <= 1
      ? caseProgress()
      : Math.min(100, Math.max(0, caseProgress(new Date(social.ts)))))
    : null;

  return `
<section class="wrap shero" id="sprawa">
  ${renderFiling(lang)}
  <div class="statusbar" aria-label="${esc(t(lang, 'status.aria'))}">
    <div class="statusbar-main">
      <span class="sdot" aria-hidden="true"></span>
      <span class="s-main">${esc(t(lang, 'status.detained'))}</span>
      <span class="s-sep" aria-hidden="true">·</span>
      <span class="s-loc">${esc(t(lang, 'status.location'))}</span>
      <span class="s-sep" aria-hidden="true">·</span>
      <span class="s-day">${esc(t(lang, 'status.day', { day: cs.day }))}</span>
      <span class="s-status">${esc(t(lang, 'status.court_unknown'))}</span>
    </div>
    <div class="statusbar-meta">
      ${LEGAL_DEADLINES.map((d) => `
      <span class="s-dl"><b>${esc(L(lang, d.label, fen('LEGAL_DEADLINES', d.id, 'label')))}:</b> ${esc(fmtDate(Date.parse(`${d.date}T00:00:00Z`), lang))} · ${esc(countdown(d.date, lang))} <span class="calc">${esc(t(lang, 'badge.calculated'))}</span></span>`).join('')}
      <span class="s-ok">${esc(t(lang, 'status.no_verdict'))}</span>
      <span class="s-asof">${esc(t(lang, 'status.asof', {
        date: cs.statusAsOf,
        scan: lastRunAt ? t(lang, 'status.scan', { time: relTime(lastRunAt, lang) }) : '',
      }))}</span>
    </div>
  </div>
  <div class="shero-grid">
    <div class="shero-main">
      <h1>Richard James Schueler</h1>
      <p class="alias">Richard Heart · HEX · PulseChain</p>
      <p class="dek">${esc(t(lang, 'hero.dek'))}</p>
      <div class="hero-actions">
        <a class="btn" href="#co-nowego">${esc(t(lang, 'hero.btn_latest'))}</a>
        <a class="btn ghost" href="#wiemy">${esc(t(lang, 'hero.btn_know'))}</a>
        <a class="btn ghost" href="#os-czasu">${esc(t(lang, 'hero.btn_timeline'))}</a>
      </div>
      ${renderCountdown(lang)}
    </div>
    <div class="hero-side">
      ${renderHeroShot(lang)}
    <div class="lastc">
      <p class="kicker">${esc(t(lang, 'lastc.kicker'))}</p>
      <p class="lastc-date">${esc(LAST_CONFIRMED.date)}</p>
      <p class="lastc-text">${esc(L(lang, LAST_CONFIRMED.text, fenFlat('LAST_CONFIRMED', 'text')))}</p>
      <p class="lastc-note">${esc(t(lang, 'lastc.note'))}</p>
    </div>
    </div>
  </div>
  <div class="tl-bar">
    <div class="tl-head">
      <span>${esc(t(lang, 'tl.window'))}</span>
      <span>${esc(t(lang, 'tl.today', { day: cs.day }))}</span>
    </div>
    <div class="tl-track" role="progressbar" aria-label="${esc(t(lang, 'tl.aria'))}"
         aria-valuemin="0" aria-valuemax="40" aria-valuenow="${cs.day}"
         aria-valuetext="${esc(t(lang, 'tl.today', { day: cs.day }))}">
      <div class="tl-fill" style="width:${caseProgress().toFixed(1)}%"></div>
      ${marks}
      <span class="tl-event" style="left:${lastConfirmedPct}%"
        title="${esc(t(lang, 'tl.last_confirmed', { date: LAST_CONFIRMED.date }))}"></span>
      <span class="tl-now" style="left:${caseProgress().toFixed(1)}%" title="${esc(t(lang, 'tl.today', { day: cs.day }))}"></span>
      ${socialPct != null ? `<span class="tl-social" style="left:${socialPct.toFixed(1)}%"
        title="${esc(t(lang, 'tl.social_mark', { title: social.title }))}"></span>` : ''}
    </div>
    <div class="tl-labels">${labels}</div>
    <p class="tl-note">${esc(t(lang, 'tl.note'))}</p>
  </div>
</section>`;
}

/**
 * Odliczanie do ustawowego limitu 40 dni (23.11.2026, 23:59 czasu Stambułu).
 * Wartości liczy serwer, więc działają też bez JS; /countdown.js je odświeża.
 */
function renderCountdown(lang) {
  const deadline = Date.parse('2026-11-23T23:59:59+03:00');
  const left = Math.max(0, deadline - Date.now());
  const pad = (n) => String(n).padStart(2, '0');
  const days = Math.floor(left / 86_400_000);
  const clock = `${pad(Math.floor(left / 3_600_000) % 24)}:${pad(Math.floor(left / 60_000) % 60)}:${pad(Math.floor(left / 1_000) % 60)}`;
  const day = Math.min(40, Math.max(0, CASE_STATUS.day));
  const ticks = Array.from({ length: 40 }, (_, i) => `<span${i < day ? ' class="on"' : ''}></span>`).join('');
  return `
  <div class="cd${left ? '' : ' past'}" data-cd="${deadline}" aria-label="${esc(t(lang, 'cd.aria'))}">
    <div class="cd-head">
      <p class="kicker">${esc(t(lang, 'cd.kicker'))}</p>
      <span class="cd-live"><i aria-hidden="true"></i>${esc(t(lang, 'cd.live'))}</span>
    </div>
    <p class="cd-clock">
      <span class="cd-days"><b data-cd-days>${days}</b><i>${esc(t(lang, days === 1 ? 'cd.day' : 'cd.days'))}</i></span>
      <span class="cd-time" data-cd-time>${clock}</span>
    </p>
    <div class="cd-ticks" role="img" aria-label="${esc(t(lang, 'cd.progress', { day }))}">${ticks}</div>
    <p class="cd-meta">${esc(t(lang, 'cd.meta'))}</p>
    <p class="cd-note">${esc(t(lang, 'cd.note'))}</p>
  </div>`;
}

/** Główne zdjęcie sprawy — kadr z zatrzymania, tuż obok nazwiska. */
function renderHeroShot(lang) {
  return `
    <figure class="hero-shot">
      <a href="/press/fotel-oryginal.jpg" target="_blank" rel="noopener">
        <img src="/press/fotel.jpg" alt="${esc(t(lang, 'press.cap.chair'))}" width="800" height="450" decoding="async">
      </a>
      <figcaption>${esc(t(lang, 'press.cap.chair'))}</figcaption>
    </figure>`;
}

/** Majątek: zajęte pojazdy i zdjęcie z mediów — w sekcji „Co wiemy”. */
function renderAssets(lang) {
  const items = [
    ['auto-maybach-s.jpg', 1280, 960, 'maybach_s'],
    ['auto-maybach-gls.jpg', 1600, 1200, 'maybach_gls'],
    ['auto-g.jpg', 1600, 1200, 'g'],
    ['auto-g-tyl.jpg', 1400, 923, 'g_rear'],
    ['auto-porsche.jpg', 1355, 955, 'porsche'],
    ['auto-porsche-vin.jpg', 1600, 1200, 'porsche_vin'],
    ['auto-vito.jpg', 1280, 960, 'vito'],
    ['auto-vito-tyl.jpg', 1280, 720, 'vito_rear'],
  ];
  const figs = items.map(([file, w, h, id]) => `
      <figure class="asset">
        <a href="/press/${file}" target="_blank" rel="noopener">
          <img src="/press/${file}" alt="${esc(t(lang, `assets.cap.${id}`))}" width="${w}" height="${h}" loading="lazy" decoding="async">
        </a>
        <figcaption>${esc(t(lang, `assets.cap.${id}`))}</figcaption>
      </figure>`).join('');
  return `
  <section class="wrap">
  <div class="assets" id="majatek">
    <p class="kicker">${esc(t(lang, 'assets.kicker'))}</p>
    <h2>${esc(t(lang, 'assets.title'))}</h2>
    <p class="assets-lead">${esc(t(lang, 'assets.lead'))}</p>
    <div class="assets-grid">${figs}</div>
    <p class="pg-note">${esc(t(lang, 'assets.note'))}</p>
  </div>
  </section>`;
}

/** Zdjęcia agencyjne z zatrzymania — kadry z materiału DHA z podpisami i linkiem do źródła. */
function renderPressGallery(lang) {
  const shots = [
    { id: 'kitchen', file: 'kuchnia-wyspa.jpg', w: 2000, h: 1500 },
    { id: 'kitchen_back', file: 'kuchnia-zaplecze.jpg', w: 2000, h: 1500 },
    { id: 'kitchen_top', file: 'kuchnia-blat.jpg', w: 1500, h: 2000 },
    { id: 'kitchen_wide', file: 'kuchnia-szeroko.jpg', w: 2000, h: 1500 },
    { id: 'server_wide', file: 'serwerownia-szeroko.jpg', w: 1200, h: 1600 },
    { id: 'server_rigs', file: 'serwerownia-rigi.jpg', w: 1200, h: 1600 },
    { id: 'server_rigs_2', file: 'serwerownia-rigi-2.jpg', w: 1200, h: 1101 },
    { id: 'server_shelves', file: 'serwerownia-polki.jpg', w: 1200, h: 1600 },
    { id: 'counters', file: 'serwerownia-liczniki.jpg', w: 1200, h: 1200 },
    { id: 'safe_inner', file: 'sejf-wnetrze.jpg', w: 1200, h: 1600 },
    { id: 'safe_wardrobe', file: 'sejf-szafa.jpg', w: 1200, h: 1600 },
    { id: 'strongbox', file: 'kasa-portfel.jpg', w: 1500, h: 2000 },
    { id: 'keys', file: 'sejf-klucze.jpg', w: 1500, h: 2000 },
    { id: 'watches_tray', file: 'zegarki-taca.jpg', w: 1500, h: 2000 },
    { id: 'watches_glass', file: 'zegarki-gablota.jpg', w: 1500, h: 2000 },
    { id: 'watches_case', file: 'witryna-zegarki.jpg', w: 1500, h: 2000 },
    { id: 'jewels', file: 'bizuteria-stol.jpg', w: 1599, h: 1181 },
    { id: 'cash', file: 'gotowka-torba.jpg', w: 1500, h: 2000 },
    { id: 'counter', file: 'licznik-gotowki.jpg', w: 900, h: 1600 },
    { id: 'guns', file: 'bron-dluga.jpg', w: 1200, h: 1600 },
    { id: 'pistol', file: 'bron.jpg', w: 950, h: 1267 },
    { id: 'id_finland', file: 'dowod-finlandia.jpg', w: 1500, h: 1500 },
    { id: 'gun_licence', file: 'pozwolenie-bron-odatv.jpg', w: 525, h: 700 },
    { id: 'passport', file: 'paszport-usa-hd.jpg', w: 1280, h: 1707 },
  ];
  const figs = shots.map((s, i) => `
    <figure class="pg-item${i === 0 ? ' pg-lead' : ''}">
      <a href="/press/${s.file}" target="_blank" rel="noopener">
        <img src="/press/${s.file}" alt="${esc(t(lang, `press.cap.${s.id}`))}" width="${s.w}" height="${s.h}"
          loading="${i === 0 ? 'eager' : 'lazy'}" decoding="async">
      </a>
      ${s.noCap ? '' : `<figcaption>${esc(t(lang, `press.cap.${s.id}`))}</figcaption>`}
    </figure>`).join('');
  return `
<div class="pressgal" id="dokumentacja">
  <div class="pg-head">
    <p class="kicker">${esc(t(lang, 'press.kicker'))}</p>
    <h2>${esc(t(lang, 'press.title'))}</h2>
    <p class="pg-lead-text">${esc(t(lang, 'press.lead'))}</p>
  </div>
  <figure class="pg-video">
    <video controls preload="metadata" playsinline poster="/press/zatrzymanie-klatka.jpg" width="1920" height="1080">
      <source src="/media/balina-james-zatrzymanie-1080p.mp4" type="video/mp4">
      <a href="/media/balina-james-zatrzymanie-1080p.mp4">${esc(t(lang, 'press.cap.video'))}</a>
    </video>
    <figcaption>${esc(t(lang, 'press.cap.video'))}</figcaption>
  </figure>
  <figure class="pg-video">
    <video controls preload="metadata" playsinline poster="/press/ahaber-klatka.jpg" width="1920" height="1080">
      <source src="/media/balina-james-ahaber-1080p.mp4" type="video/mp4">
      <a href="/media/balina-james-ahaber-1080p.mp4">${esc(t(lang, 'press.cap.video2'))}</a>
    </video>
    <figcaption>${esc(t(lang, 'press.cap.video2'))}</figcaption>
  </figure>
  <figure class="pg-video">
    <video controls preload="metadata" playsinline poster="/press/ahaber-operasyon-klatka.jpg" width="1920" height="1080">
      <source src="/media/balina-james-ahaber-operasyon-1080p.mp4" type="video/mp4">
      <a href="/media/balina-james-ahaber-operasyon-1080p.mp4">${esc(t(lang, 'press.cap.video3'))}</a>
    </video>
    <figcaption>${esc(t(lang, 'press.cap.video3'))}</figcaption>
  </figure>
  <figure class="pg-video">
    <video controls preload="metadata" playsinline poster="/press/ahaber-araclar-klatka.jpg" width="1920" height="1080">
      <source src="/media/balina-james-ahaber-araclar-1080p.mp4" type="video/mp4">
      <a href="/media/balina-james-ahaber-araclar-1080p.mp4">${esc(t(lang, 'press.cap.video4'))}</a>
    </video>
    <figcaption>${esc(t(lang, 'press.cap.video4'))}</figcaption>
  </figure>
  <div class="pg-grid">${figs}</div>
  <p class="pg-credit">${esc(t(lang, 'press.credit'))} ·
    <a href="https://www.sabah.com.tr/trend/galeri/yasam/son-dakika-mitten-tarihi-operasyon-milyarder-kriptocu-balina-james-kiskivrak-yakalandi-evinden-cikanlar-soke-etti" target="_blank" rel="noopener noreferrer">Sabah</a> ·
    <a href="https://www.dha.com.tr/yerel-haberler/istanbul/kirmizi-bultenle-aranan-kripto-dolandiricisinin-2964206" target="_blank" rel="noopener noreferrer">DHA</a></p>
  <p class="pg-note">${esc(t(lang, 'press.note'))}</p>
</div>`;
}

function renderDisclaimer(lang) {
  return `<div class="wrap"><div class="disclaimer"><strong>${esc(t(lang, 'label.disclaimer'))}</strong>${esc(L(lang, CASE_DISCLAIMER, fenFlat('CASE_DISCLAIMER', 'text')))}</div></div>`;
}

function storyMeta(it, lang) {
  const social = isSocial(it);
  const parts = [
    `<span class="src-badge ${social ? 'social' : 'media'}">${esc(t(lang, social ? 'label.social' : 'label.media'))}</span>`,
    `<span>${esc(localizeSourceLabel(it.source_label, lang))}</span>`,
  ];
  if (it.change_detected) parts.push(`<span class="src-badge change">${esc(t(lang, 'label.changed'))}</span>`);
  const host = hostOf(it.url);
  if (host) parts.push(`<span>${esc(host)}</span>`);
  parts.push(`<a href="/item/${encodeURIComponent(it.id)}">${esc(t(lang, 'label.note'))}</a>`);
  return parts.join('');
}

function renderLatest(latest, lang) {
  if (!latest.length) {
    return `<section class="wrap section" id="co-nowego">
      ${sectionHead(t(lang, 'latest.kicker'), t(lang, 'latest.title'), t(lang, 'latest.note'))}
      <p class="nonews"><b>${esc(t(lang, 'latest.none', { date: LAST_CONFIRMED.date }))}</b>
      ${esc(t(lang, 'latest.none_body'))}</p>
      <p class="empty">${esc(t(lang, 'latest.empty'))}</p>
    </section>`;
  }
  const [main] = latest;
  const mainHasDate = Number(main.published_at) > 0;
  const mainDate = fmtDate(mainHasDate ? main.published_at : main.first_seen_at, lang);
  const mainSocial = isSocial(main);
  // Kolumna obok leadu: potwierdzone zdarzenia z osi czasu (nie kolejne wpisy z X),
  // żeby pierwszy ekran nie zamienił się w strumień jednego konta.
  // Te same zdarzenia są niżej w pełnej osi czasu — tutaj tylko zajawka,
  // żeby ten sam akapit nie pojawiał się na stronie dwa razy.
  const brief = (s) => {
    const txt = String(s || '').replace(/\s+/g, ' ').trim();
    return txt.length <= 110 ? txt : `${txt.slice(0, 110).replace(/\s+\S*$/, '')}…`;
  };
  const events = [...TIMELINE].reverse()
    .filter((ev) => ev.level === 'confirmed' && !ev.kind && ev.date !== '22–30.10')
    .slice(0, 3)
    .map((ev) => `<li><b>${esc(L(lang, ev.date, fen('TIMELINE', ev.date, 'date')))}</b><span>${esc(brief(pick(ev, lang)))}</span></li>`)
    .join('');
  const community = latest.filter((it) => isSocial(it) && it.id !== main.id).slice(0, 3)
    .map((it) => {
      const ts = it.published_at || it.first_seen_at;
      return `<li><a href="${esc(safeUrl(it.url))}" target="_blank" rel="noopener noreferrer">${esc(cleanTitle(titleOf(it, lang), lang))}</a>
        <span class="cmeta">${esc(fmtDate(ts, lang))} · ${esc(localizeSourceLabel(it.source_label, lang))} · ${esc(t(lang, 'latest.unverified'))}</span></li>`;
    }).join('');

  return `
<section class="wrap section" id="co-nowego">
  ${sectionHead(t(lang, 'latest.kicker'), t(lang, 'latest.title'), t(lang, 'latest.note_full'))}
  <p class="nonews"><b>${esc(t(lang, 'latest.none', { date: LAST_CONFIRMED.date }))}</b>
  ${esc(t(lang, 'latest.none_body_full'))}</p>
  <div class="lead${mainSocial ? ' social' : ''}">
    <div class="lead-main">
      <div class="lead-kicker">${esc(mainHasDate
        ? t(lang, 'latest.last_report', {
          date: mainDate, social: mainSocial ? t(lang, 'latest.social_suffix') : '',
        })
        : t(lang, 'latest.last_reference', { date: mainDate }))}</div>
      <h3><a href="${esc(safeUrl(main.url))}" target="_blank" rel="noopener noreferrer">${esc(cleanTitle(titleOf(main, lang), lang))}</a></h3>
      ${mainSocial ? `<p class="lead-warn">${esc(t(lang, 'latest.social_warn'))}</p>` : ''}
      ${mainSocial ? '' : gloss(lang === 'en' ? (main.summary_en || '') : (main.summary_pl || main.summary_en || ''), lang)}
      <div class="lead-meta">${storyMeta(main, lang)}</div>
    </div>
    <div class="lead-side">
      <div class="side-block">
        <h4>${esc(t(lang, 'latest.events'))}</h4>
        <ul class="evlist">${events || `<li><span>${esc(t(lang, 'latest.no_events'))}</span></li>`}</ul>
        <p class="side-link"><a href="/#os-czasu">${esc(t(lang, 'latest.full_timeline'))}</a>
        <a href="/?src=social#archiwum">${esc(t(lang, 'latest.x_posts'))}</a></p>
      </div>
    </div>
  </div>
  ${community ? `<div class="community">
    <div class="community-head">
      <h3>${esc(t(lang, 'latest.community'))}</h3>
      <p>${esc(t(lang, 'latest.community_note'))}</p>
    </div>
    <ul>${community}</ul>
  </div>` : ''}
</section>`;
}

function dayUnit(lang, n) {
  return pluralFor(lang, Math.abs(n), {
    one: t(lang, 'label.day'), few: t(lang, 'label.days'), many: t(lang, 'label.days'),
  });
}

function countdown(isoDate, lang) {
  const n = daysUntil(isoDate);
  if (n === 0) return t(lang, 'label.today');
  const unit = dayUnit(lang, n);
  if (n < 0) return t(lang, 'label.after_deadline', { n: -n, unit });
  return t(lang, 'label.in_days', { n, unit });
}

function renderProcedure(lang) {
  const steps = LEGAL_ROADMAP.map((s) => {
    const due = s.id === 'docs' ? '2026-11-01' : s.id === 'max40' ? '2026-11-23' : null;
    const status = due && daysUntil(due) < 0 ? 'expired' : s.status;
    return `
    <li class="rm ${esc(status)}">
      <div class="rm-when">${esc(L(lang, s.when, fen('LEGAL_ROADMAP', s.id, 'when')))}</div>
      <div class="rm-body">
        <h3>${esc(L(lang, s.title, fen('LEGAL_ROADMAP', s.id, 'title')))} <span class="rm-badge ${esc(status)}">${esc(t(lang, `rm.${status}`))}</span></h3>
        <p>${esc(L(lang, s.pl, fen('LEGAL_ROADMAP', s.id, 'text')))}</p>
        <p class="rm-basis">${esc(L(lang, s.basis, fen('LEGAL_ROADMAP', s.id, 'basis')))}${s.url
          ? ` · ${safeLink(s.url, L(lang, s.src, fen('LEGAL_ROADMAP', s.id, 'src')) || '')}`
          : s.src ? ` · ${esc(L(lang, s.src, fen('LEGAL_ROADMAP', s.id, 'src')))}` : ''}</p>
        ${actChips(s.acts, lang)}
      </div>
    </li>`;
  }).join('');

  const notes = LEGAL_NOTES.map((n, i) => `<li>${esc(L(lang, n, FACTS_EN?.LEGAL_NOTES?.[i]))}</li>`).join('');

  return `
<section class="wrap section" id="procedura">
  ${sectionHead(t(lang, 'proc.kicker'), t(lang, 'proc.title'), t(lang, 'proc.note'))}
  <ol class="roadmap">${steps}</ol>
  <div class="legal-notes">
    <h3>${esc(t(lang, 'proc.notes'))}</h3>
    <ul>${notes}</ul>
    <p class="acts-label">${esc(t(lang, 'acts.legal'))}</p>
    ${actChips(LEGAL_ACT_IDS, lang)}
  </div>
</section>`;
}

function renderFacts(lang) {
  const facts = CONFIRMED_FACTS.map((f) => {
    const links = (f.links || []).map((l, i) => safeLink(
      l.url,
      L(lang, l.label, fen('CONFIRMED_FACTS', f.id, 'links')?.[i]),
    )).join('');
    const src = links || (f.source ? `<span>${esc(f.source)}</span>` : '');
    return `<li><p>${esc(lang === 'en' ? (f.en || f.pl) : (f.short || f.pl))}</p><div class="sources">${src}</div></li>`;
  }).join('');

  const claims = CLAIMED_FACTS.map((f) => {
    const src = L(lang, f.source, fen('CLAIMED_FACTS', f.id, 'source'));
    const srcHtml = f.url ? safeLink(f.url, src, 'src-link') : esc(src);
    return `
    <li>${esc(pick(f, lang))}<span class="src">${srcHtml}</span></li>`;
  }).join('');

  const unknowns = UNKNOWNS.map((u) => `
    <div class="unknown"><div class="q">${esc(pick(u, lang))}</div><div class="d">${esc(L(lang, u.detail || '', fen('UNKNOWNS', u.id, 'detail')))}</div></div>`).join('');

  return `
<section class="wrap section" id="wiemy">
  ${sectionHead(t(lang, 'facts.kicker'), t(lang, 'facts.title'), t(lang, 'facts.note'))}
  <div class="split">
    <div>
      <ol class="fact-list">${facts}</ol>
      <div class="claims">
        <h3>${esc(t(lang, 'facts.claims'))}</h3>
        <p>${esc(t(lang, 'facts.claims_note'))}</p>
        <ul>${claims}</ul>
      </div>
    </div>
    <div class="aside-col">
      ${renderDossier(lang)}
      <div class="aside-card">
        <h3>${esc(t(lang, 'facts.unknowns'))}</h3>
        ${unknowns}
      </div>
      <div class="aside-card">
        <h3>${esc(t(lang, 'facts.legend'))}</h3>
        <div class="legend">
          <div><span class="dot ok"></span><span><b>${esc(t(lang, 'facts.legend_ok'))}</b>${esc(t(lang, 'facts.legend_ok_text'))}</span></div>
          <div><span class="dot warn"></span><span><b>${esc(t(lang, 'facts.legend_warn'))}</b>${esc(t(lang, 'facts.legend_warn_text'))}</span></div>
          <div><span class="dot"></span><span><b>${esc(t(lang, 'facts.legend_err'))}</b>${esc(t(lang, 'facts.legend_err_text'))}</span></div>
        </div>
      </div>
    </div>
  </div>
</section>`;
}

/** Dzień bieżącego przeglądu w strefie sprawy — dla wpisów z `auto: true`. */
function reviewDayLabel() {
  return new Intl.DateTimeFormat('pl-PL', {
    timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit',
  }).format(new Date());
}

function renderTimeline(lang) {
  // Najnowsze zdarzenia na górze, najstarsze na dole.
  const rows = [...TIMELINE].reverse().map((ev) => {
    const dateLabel = ev.auto
      ? reviewDayLabel()
      : L(lang, ev.date, fen('TIMELINE', ev.date, 'date'));
    const [day, ...rest] = String(dateLabel || '').split(' ');
    const srcLabel = L(lang, ev.src, fen('TIMELINE', ev.date, 'src'));
    const src = ev.url
      ? safeLink(ev.url, srcLabel || t(lang, 'label.source_fallback'))
      : esc(srcLabel || '');
    const badge = ev.kind === 'calc'
      ? `<span class="tl-badge b-calc">${esc(t(lang, 'timeline.calc'))}</span>`
      : (ev.kind === 'review' || ev.auto)
        ? `<span class="tl-badge b-review">${esc(t(lang, 'timeline.review'))}</span>`
        : ev.level === 'claimed'
          ? `<span class="tl-badge b-claimed">${esc(t(lang, 'timeline.claimed'))}</span>`
          : '';
    return `
    <li class="tl${ev.level === 'claimed' ? ' claimed' : ''}">
      <div class="tl-date"><b>${esc(day)}</b>${rest.length ? `<span>${esc(rest.join(' '))}</span>` : ''}</div>
      <div class="tl-body">${esc(pick(ev, lang))}
        ${badge}
        <span class="tl-src">${src}</span>
      </div>
    </li>`;
  }).join('');

  return `
<section class="wrap section" id="os-czasu">
  ${sectionHead(t(lang, 'timeline.kicker'), t(lang, 'timeline.title'), t(lang, 'timeline.note'))}
  ${renderClips(lang)}
  <ol class="timeline">${rows}</ol>
</section>`;
}

function delta(v, lang) {
  if (v == null || !Number.isFinite(Number(v))) return '<span>—</span>';
  const n = Number(v);
  const cls = n > 0 ? 'up' : n < 0 ? 'down' : '';
  const num = n.toFixed(1);
  return `<span class="${cls}">${n > 0 ? '+' : ''}${lang === 'en' ? num : num.replace('.', ',')}%</span>`;
}


function renderMarket(market, lang) {
  if (!market?.rows?.length) {
    return `
<section class="wrap section" id="rynek">
  ${sectionHead(t(lang, 'market.kicker'), t(lang, 'market.title'), t(lang, 'market.note'))}
  <p class="empty">${esc(t(lang, 'market.empty'))}</p>
</section>`;
  }
  const order = ['hex', 'hex-pulsechain', 'pulsechain', 'pulsex', 'dai-on-pulsechain', 'pulsechain-peacock', 'prvx'];
  const LOGOS = {
    hex: 'hex.png', 'hex-pulsechain': 'hex-pulsechain.png', pulsechain: 'pulsechain.png',
    pulsex: 'pulsex.jpg', 'dai-on-pulsechain': 'dai-on-pulsechain.png',
    'pulsechain-peacock': 'pulsechain-peacock.png', prvx: 'prvx.png',
  };
  const coins = [...market.rows]
    .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
    .map((r) => `
    <div class="coin">
      <div class="coin-top">
        ${LOGOS[r.id] ? `<img class="coin-logo" src="/logos/${LOGOS[r.id]}" alt="" width="22" height="22" loading="lazy" decoding="async">` : ''}
        <div class="name">${esc(r.name || r.id)}</div>
      </div>
      <div class="price">${money(r.price, lang)}</div>
      <div class="delta"><span>24 h ${delta(r.d24, lang)}</span><span>7 d ${delta(r.d7, lang)}</span><span>30 d ${delta(r.d30, lang)}</span></div>
    </div>`).join('');

  return `
<section class="wrap section" id="rynek">
  ${sectionHead(t(lang, 'market.kicker'), t(lang, 'market.title'), t(lang, 'market.note_full'))}
  <div class="market-grid">${coins}</div>
  <p class="market-note">${esc(t(lang, 'market.foot', {
    dex: market.rows.some((r) => r.id === 'prvx') ? t(lang, 'market.dex') : '',
    updated: market.updatedAtMs ? t(lang, 'market.updated', { date: fmtDateTime(market.updatedAtMs, lang) }) : '',
  }))}</p>
</section>`;
}

function renderStory(it, lang) {
  const ts = it.published_at || it.first_seen_at;
  const label = it.published_at ? t(lang, 'label.published') : t(lang, 'label.detected');
  return `
  <article class="story">
    <div class="story-date"><span>${fmtDate(ts, lang)}</span><span class="h">${esc(label)}</span></div>
    <div>
      <h3><a href="${esc(safeUrl(it.url))}" target="_blank" rel="noopener noreferrer">${esc(cleanTitle(titleOf(it, lang), lang))}</a></h3>
      ${isSocial(it) ? '' : gloss(lang === 'en' ? (it.summary_en || '') : (it.summary_pl || it.summary_en || ''), lang)}
      <div class="meta">${storyMeta(it, lang)}</div>
    </div>
  </article>`;
}

function renderArchive({ items, total, pageNo, pageCount, q, src = '' }, lang) {
  const rows = items.map((it) => renderStory(it, lang)).join('')
    || `<p class="empty">${esc(t(lang, 'archive.empty'))}</p>`;
  const query = new URLSearchParams();
  if (q) query.set('q', q);
  if (src) query.set('src', src);
  const qs = query.toString();
  const urlFor = (n) => `/?${qs ? `${qs}&` : ''}page=${n}#archiwum`;
  const filterFor = (value, label) => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (value) p.set('src', value);
    const s = p.toString();
    return `<a class="${(src || '') === value ? 'on' : ''}" href="/${s ? `?${s}` : ''}#archiwum">${label}</a>`;
  };
  const nav = pageCount > 1
    ? `<nav class="pager" aria-label="${esc(t(lang, 'archive.pagination'))}">
        ${pageNo > 1 ? `<a href="${esc(urlFor(pageNo - 1))}" rel="prev">${esc(t(lang, 'archive.newer'))}</a>` : `<span class="dis">${esc(t(lang, 'archive.newer'))}</span>`}
        <span>${esc(t(lang, 'archive.page', { page: pageNo, count: pageCount }))}</span>
        ${pageNo < pageCount ? `<a href="${esc(urlFor(pageNo + 1))}" rel="next">${esc(t(lang, 'archive.older'))}</a>` : `<span class="dis">${esc(t(lang, 'archive.older'))}</span>`}
      </nav>`
    : '';

  const unit = pluralFor(lang, total, {
    one: t(lang, 'archive.one'), few: t(lang, 'archive.few'), many: t(lang, 'archive.many'),
  });

  return `
<section class="wrap section" id="archiwum">
  ${sectionHead(t(lang, 'archive.kicker'), t(lang, 'archive.title'), t(lang, 'archive.note'))}
  <form class="filters" method="get" action="/#archiwum" role="search">
    <input type="search" name="q" value="${esc(q)}" placeholder="${esc(t(lang, 'archive.search_ph'))}" aria-label="${esc(t(lang, 'archive.search_aria'))}">
    ${src ? `<input type="hidden" name="src" value="${esc(src)}">` : ''}
    <button class="btn" type="submit">${esc(t(lang, 'archive.search'))}</button>
    ${q ? `<a class="btn ghost" href="/#archiwum">${esc(t(lang, 'archive.clear'))}</a>` : ''}
  </form>
  <div class="arch-filter" aria-label="${esc(t(lang, 'archive.filter_aria'))}">
    <span>${esc(t(lang, 'archive.sources'))}</span>
    ${filterFor('', esc(t(lang, 'archive.all')))}
    ${filterFor('media', esc(t(lang, 'archive.media')))}
    ${filterFor('social', esc(t(lang, 'archive.social')))}
  </div>
  <p class="results-meta">${esc(t(lang, 'archive.results', {
    n: total,
    unit,
    q: q ? t(lang, 'archive.for', { q }) : '',
    src: src === 'social' ? t(lang, 'archive.from_social') : src === 'media' ? t(lang, 'archive.from_media') : '',
  }))}</p>
  ${rows}
  ${nav}
</section>`;
}

/** Patronat: niezależne wsparcie w dotarciu do czytelników. */
function renderPatron(lang) {
  return `
<section class="wrap patron" id="patronat">
  <div class="patron-box">
    <div class="patron-mark" aria-hidden="true">K</div>
    <div class="patron-copy">
      <p class="kicker">${esc(t(lang, 'patron.kicker'))}</p>
      <h3>${esc(t(lang, 'patron.title'))}</h3>
      <p>${esc(t(lang, 'patron.text'))}</p>
      <p class="patron-note">${esc(t(lang, 'patron.note'))}</p>
    </div>
    <div class="patron-links">
      ${safeLink('https://t.me/mojakryptosfera', t(lang, 'patron.tg'), 'btn ghost')}
      ${safeLink('https://youtu.be/yDn3beKTolY?t=447', t(lang, 'patron.yt'), 'btn ghost')}
    </div>
  </div>
</section>`;
}

function renderMethodology({ sourceCount, archiveTotal, lastRunAt, review }, lang) {
  return `
<section class="wrap section" id="metodologia">
  <div class="stats-line" id="statystyki">
    <span><b>${sourceCount}</b> ${esc(t(lang, 'method.sources'))}</span>
    <span><b>${archiveTotal}</b> ${esc(t(lang, 'method.archive_total'))}</span>
    <span>${esc(t(lang, 'method.last_scan'))} <b>${lastRunAt ? relTime(lastRunAt, lang) : '—'}</b></span>
    <span>${esc(t(lang, 'method.last_confirmed'))} <b>${esc(LAST_CONFIRMED.date)}</b></span>
    <span>${esc(t(lang, 'method.reviewed'))} <b>${esc(REVIEWED_AT)}</b></span>
  </div>
</section>`;
}

export function renderHome(data) {
  const lang = normalizeLang(data.lang);
  const theme = normalizeTheme(data.theme);
  return page({
    lang,
    theme,
    live: true,
    title: t(lang, 'meta.home_title'),
    description: t(lang, 'meta.home_desc', { date: CASE_STATUS.statusAsOf }),
    body: renderHero({ lastRunAt: data.methodology?.lastRunAt, latest: data.latest }, lang)
      + renderLatest(data.latest, lang)
      + renderWindow(lang)
      + renderReview(data.review, lang)
      + renderTimeline(lang)
      + renderKeyFacts(lang)
      + renderFacts(lang)
      + renderProcedure(lang)
      + renderScenarios(lang)
      + renderMarket(data.market, lang)
      + renderArchive(data.archive, lang)
      + renderAssets(lang)
      + renderPressGallery(lang)
      + renderMethodology(data.methodology, lang)
      + renderPatron(lang)
      + renderDisclaimer(lang),
  });
}

export function renderItemPage(it, { lang = 'pl', theme = 'editorial' } = {}) {
  const l = normalizeLang(lang);
  const ts = it.published_at || it.first_seen_at;
  const title = cleanTitle(titleOf(it, l), l);
  const check = checkClaims(`${title}. ${it.raw_text || ''}`, l);
  const host = hostOf(it.url);
  const excerpt = redactPrivate(String(it.raw_text || '').replace(/\s+/g, ' ').trim().slice(0, 1600));

  const flags = check.flags.length
    ? `<ul>${check.flags.map((f) => `<li><b>${esc(f.label)}</b><span class="note">${esc(f.note)}</span></li>`).join('')}</ul>`
    : `<p class="clean">${esc(t(l, 'item.clean', { n: KNOWN_ERRORS.length }))}</p>`;

  const summaries = isSocial(it) ? '' : [
    it.summary_pl ? `<p class="summary"><span class="tag">${esc(t(l, 'item.summary_pl'))}</span>${esc(redactPrivate(it.summary_pl))}</p>` : '',
    it.summary_en ? `<p class="summary"><span class="tag">${esc(t(l, 'item.summary_en'))}</span>${esc(redactPrivate(it.summary_en))}</p>` : '',
  ].join('');

  return page({
    lang: l,
    theme,
    title: t(l, 'meta.item_title', { title }),
    description: t(l, 'meta.item_desc', { title, source: localizeSourceLabel(it.source_label, l) }),
    noIndex: true,
    body: `
<article class="wrap detail">
  <a class="back" href="/#archiwum">${esc(t(l, 'item.back'))}</a>
  <p class="detail-kind ${isSocial(it) ? 'social' : ''}">${esc(t(l, isSocial(it) ? 'item.kind_social' : 'item.kind_media'))}${it.change_detected ? ` · <span class="change">${esc(t(l, 'label.changed'))}</span>` : ''}</p>
  <h1>${esc(title)}</h1>
  <div class="detail-meta">
    <span>${esc(localizeSourceLabel(it.source_label, l))}</span>
    ${host ? `<span>${esc(host)}</span>` : ''}
    <span>${esc(t(l, it.published_at ? 'label.published' : 'label.detected'))}: ${fmtDateTime(ts, l)}</span>
    <a href="${esc(safeUrl(it.url))}" target="_blank" rel="noopener noreferrer">${esc(t(l, 'item.open'))}</a>
  </div>
  ${summaries}
  <h2>${esc(t(l, 'item.excerpt'))}</h2>
  <p class="excerpt-label">${esc(t(l, 'item.excerpt_note'))}</p>
  ${excerpt.length > 800
    ? `<details class="excerpt-fold"><summary>${esc(t(l, 'item.show_excerpt', { n: excerpt.length }))}</summary>
        <div class="excerpt">${esc(excerpt)}</div></details>`
    : `<div class="excerpt">${esc(excerpt || t(l, 'item.no_excerpt'))}</div>`}
  <div class="checks">
    <h2>${esc(t(l, 'item.checks'))}</h2>
    <p>${esc(t(l, 'item.checks_note'))}</p>
    ${flags}
  </div>
  <div class="disclaimer" style="margin-top:26px"><strong>${esc(t(l, 'label.disclaimer'))}</strong>${esc(L(l, CASE_DISCLAIMER, fenFlat('CASE_DISCLAIMER', 'text')))}</div>
</article>`,
  });
}
