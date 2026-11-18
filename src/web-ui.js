/**
 * Wspólne elementy interfejsu: escapowanie, bezpieczne linki, formaty dat,
 * arkusz stylów i szkielet strony. Bez JavaScriptu — CSP może zostać ostre.
 */

import { redactPrivate } from './facts.js';
import { t, normalizeLang, normalizeTheme } from './i18n.js';

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

const DATE_LOCALE = { pl: 'pl-PL', en: 'en-GB' };
const dateFmt = (lang) => new Intl.DateTimeFormat(DATE_LOCALE[normalizeLang(lang)], {
  timeZone: 'Europe/Warsaw', day: '2-digit', month: '2-digit', year: 'numeric',
});
const dateTimeFmt = (lang) => new Intl.DateTimeFormat(DATE_LOCALE[normalizeLang(lang)], {
  timeZone: 'Europe/Warsaw', day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit',
});

export const fmtDate = (ts, lang = 'pl') => (ts ? dateFmt(lang).format(new Date(ts)) : '—');
export const fmtDateTime = (ts, lang = 'pl') => (ts ? dateTimeFmt(lang).format(new Date(ts)) : '—');

export const relTime = (ts, lang = 'pl') => {
  if (!ts) return '—';
  const en = normalizeLang(lang) === 'en';
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return en ? 'just now' : `${s} s temu`;
  if (s < 3600) return en ? `${Math.floor(s / 60)} min ago` : `${Math.floor(s / 60)} min temu`;
  if (s < 86400) return en ? `${Math.floor(s / 3600)} h ago` : `${Math.floor(s / 3600)} godz. temu`;
  const days = Math.floor(s / 86400);
  if (en) return days === 1 ? '1 day ago' : `${days} days ago`;
  return days === 1 ? '1 dzień temu' : `${days} dni temu`;
};

/** Polska liczba mnoga: 1 relacja, 2 relacje, 5 relacji. */
export function plural(n, one, few, many) {
  const abs = Math.abs(Number(n) || 0);
  if (abs === 1) return one;
  const last = abs % 10;
  const lastTwo = abs % 100;
  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return few;
  return many;
}

/** Tylko http/https. Wszystko inne (javascript:, data:, vbscript:) => '#'. */
export function safeUrl(raw) {
  try {
    const u = new URL(String(raw || ''));
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.toString();
  } catch { /* niepoprawny URL */ }
  return '#';
}

export function hostOf(raw) {
  try { return new URL(String(raw || '')).hostname.replace(/^www\./, ''); } catch { return ''; }
}

/** Tytuły z X/feedów potrafią kończyć się osieroconą klamrą otwierającą. */
export function cleanTitle(raw, lang = 'pl') {
  let t = String(raw ?? '').replace(/\s+/g, ' ').trim();
  t = t.replace(/[\[({]+$/, '').trim();
  return redactPrivate(t || (normalizeLang(lang) === 'en' ? '(untitled)' : '(bez tytułu)'));
}

export function safeLink(url, label, cls = '') {
  const klass = cls ? ` class="${esc(cls)}"` : '';
  return `<a${klass} href="${esc(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
}

export function money(v, lang = 'pl') {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const n = Number(v);
  const en = normalizeLang(lang) === 'en';
  if (n >= 1) return '$' + n.toLocaleString(en ? 'en-US' : 'pl-PL', { maximumFractionDigits: 2 });
  const fmt = en ? (s) => s : (s) => s.replace('.', ',');
  if (n >= 0.01) return '$' + fmt(n.toFixed(4));
  return '$' + fmt(n.toFixed(6));
}

export const PAGE_CSS = `
:root{
  --ink:#0b0c0e;--paper:#0e1013;--panel:#14171c;--panel2:#181c22;--line:#272b33;
  --fg:#eeeae3;--body:#d6d1c8;--muted:#a09b91;--dim:#8a857c;
  --amber:#ffc23a;--amber2:#ffe08a;--ok:#34f090;--warn:#ffd633;--bad:#ff5757;
  --amber-rgb:255,194,58;--ok-rgb:52,240,144;--warn-rgb:255,214,51;--bad-rgb:255,87,87;
  --amber-deep:#7a5216;--track:#101318;--body2:#ddd8cf;--body3:#d6d1c8;
}
/* Drugi motyw: ekosystem PulseChain, wyciszony — bez neonu. */
html[data-theme="pulse"]{
  --ink:#120e15;--paper:#16111a;--panel:#1c1621;--panel2:#241b2b;--line:#352a3c;
  --fg:#f0e8ee;--body:#d8ccd4;--muted:#aa9ba6;--dim:#8e808a;
  --amber:#d494ab;--amber2:#f2d0a2;--ok:#5ee6b2;--warn:#ffd166;--bad:#ff6b6b;
  --amber-rgb:212,148,171;--ok-rgb:94,230,178;--warn-rgb:255,209,102;--bad-rgb:255,107,107;
  --amber-deep:#7a4f60;--track:#221a28;--body2:#d3c6ce;--body3:#d3c6ce;
}
html[data-theme="pulse"] body:before{
  background:radial-gradient(900px 520px at 88% -12%,rgba(199,143,163,.10),transparent 62%),
             radial-gradient(700px 420px at -5% 0,rgba(120,90,150,.10),transparent 58%)
}
html[data-theme="pulse"] .btn:not(.ghost),
html[data-theme="pulse"] .skip{color:#1a1018}
html[data-theme="pulse"] .dossier{background:linear-gradient(180deg,#221a27,#19131d)}
html[data-theme="pulse"] .dossier .row,
html[data-theme="pulse"] .evlist li{border-color:rgba(53,42,60,.75)}
html[data-theme="pulse"] .vbadge.calculated,
html[data-theme="pulse"] .tl-badge.b-claimed,html[data-theme="pulse"] .tl-badge.b-calc{border-color:rgba(var(--warn-rgb),.42)}
html[data-theme="pulse"] .src-badge.social,
html[data-theme="pulse"] .detail-kind .change{color:var(--warn)}
.detail-kind.social{border-color:rgba(var(--warn-rgb),.50)}
html[data-theme="pulse"] .lead-warn{border-left-color:rgba(var(--warn-rgb),.50)}

/* Trzeci motyw: spektrum PulseChain (fiolet → magenta → cyan), wyciszone — bez neonu. */
html[data-theme="spectrum"]{
  --ink:#120d1a;--paper:#171121;--panel:#1d1628;--panel2:#251d33;--line:#392d4b;
  --fg:#f3ecf5;--body:#dad2de;--muted:#b3a7bc;--dim:#988aa1;
  --amber:#b79ae0;--amber2:#d494af;--ok:#5fe6cf;--warn:#ffcf6b;--bad:#ff5f6d;
  --amber-rgb:183,154,224;--ok-rgb:95,230,207;--warn-rgb:255,207,107;--bad-rgb:255,95,109;
  --amber-deep:#4a3a63;--track:#1b1424;--body2:#d6cddb;--body3:#d6cddb;
}
html[data-theme="spectrum"] body:before{
  background:radial-gradient(900px 520px at 88% -12%,rgba(169,139,208,.11),transparent 62%),
             radial-gradient(760px 460px at -6% 4%,rgba(201,138,166,.09),transparent 58%),
             radial-gradient(520px 300px at 50% 106%,rgba(143,189,184,.045),transparent 70%)
}
html[data-theme="spectrum"] .dossier{background:linear-gradient(180deg,#211a2e,#191322)}
html[data-theme="spectrum"] .dossier .row,
html[data-theme="spectrum"] .evlist li{border-color:rgba(57,45,75,.75)}
html[data-theme="spectrum"] .vbadge.calculated,
html[data-theme="spectrum"] .tl-badge.b-claimed,html[data-theme="spectrum"] .tl-badge.b-calc{border-color:rgba(var(--warn-rgb),.42)}
html[data-theme="spectrum"] .src-badge.social,
html[data-theme="spectrum"] .detail-kind.social{border-color:rgba(var(--warn-rgb),.50)}
html[data-theme="spectrum"] .lead-warn{border-left-color:rgba(var(--warn-rgb),.50)}
html[data-theme="spectrum"] .livebox{
  box-shadow:0 22px 60px rgba(0,0,0,.65),0 0 0 1px rgba(169,139,208,.12)
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--ink);color:var(--body);
  font:16px/1.65 system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  -webkit-font-smoothing:antialiased;overflow-x:hidden}
body:before{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;
  background:radial-gradient(900px 520px at 88% -12%,rgba(var(--amber-rgb),.10),transparent 62%),
             radial-gradient(700px 420px at -5% 0,rgba(88,116,160,.07),transparent 58%)}
a{color:inherit}
img{max-width:100%;height:auto}
.wrap{max-width:1180px;margin:0 auto;padding:0 28px}
.skip{position:absolute;left:-9999px;top:0;background:var(--amber);color:#15110a;padding:10px 14px;z-index:99}
.skip:focus{left:12px;top:12px}
.masthead{display:flex;align-items:center;justify-content:space-between;gap:26px;
  padding-block:20px;border-bottom:1px solid var(--line);flex-wrap:wrap}
.brand{display:flex;gap:12px;align-items:center;text-decoration:none;flex:0 0 auto}
.brand-mark{width:40px;height:40px;border:1px solid var(--amber);color:var(--amber);
  display:grid;place-items:center;font-family:Georgia,"Times New Roman",serif;font-size:21px}
.brand-name{font-size:12px;letter-spacing:.18em;text-transform:uppercase;line-height:1.35;color:var(--fg)}
.brand-name small{display:block;color:var(--muted);letter-spacing:.05em;font-size:11px;text-transform:none}
.nav-wrap{display:contents}
.nav{display:flex;gap:20px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);
  overflow-x:auto;scrollbar-width:none}
.nav::-webkit-scrollbar{display:none}
.nav a{text-decoration:none;white-space:nowrap;padding:6px 0;border-bottom:1px solid transparent}
.nav a:hover{color:var(--amber);border-color:var(--amber)}
.ops-link{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);
  text-decoration:none;border:1px solid var(--line);padding:9px 12px;flex:0 0 auto}
.ops-link:hover{color:var(--amber);border-color:var(--amber)}
.switches{display:flex;gap:8px;align-items:center;flex:0 0 auto;flex-wrap:wrap;justify-content:flex-end}
.switch{display:flex;border:1px solid var(--line);background:var(--panel)}
.switch a{padding:7px 9px;min-height:24px;display:inline-flex;align-items:center;font-size:10px;letter-spacing:.08em;text-transform:uppercase;
  color:var(--dim);text-decoration:none;line-height:1}
.switch a:hover{color:var(--amber)}
.switch a.on{background:var(--panel2);color:var(--amber)}
.alias{margin:16px 0 0;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--dim)}
.dek{font-size:clamp(17px,1.55vw,20px);line-height:1.6;color:var(--body2);max-width:660px;margin:24px 0 0}
.btn{display:inline-block;background:var(--amber);color:#16120b;border:1px solid var(--amber);
  padding:11px 18px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;text-decoration:none;
  cursor:pointer;font-weight:700}
.btn:hover{background:var(--amber2)}
.btn.ghost{background:transparent;color:var(--fg);border-color:var(--line);font-weight:600}
.btn.ghost:hover{border-color:var(--amber);color:var(--amber)}
.hero-actions{display:flex;gap:10px;flex-wrap:wrap}
.dossier{border:1px solid var(--line);background:linear-gradient(180deg,#15181e,#101216);position:relative}
.dossier:before{content:"";position:absolute;top:-1px;left:-1px;width:70px;height:2px;background:var(--amber)}
.dossier-head{display:flex;justify-content:space-between;gap:10px;padding:16px 18px;
  border-bottom:1px solid var(--line);font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--muted)}
.dossier-head b{color:var(--fg);font-weight:600;letter-spacing:.1em}
.dossier dl{margin:0;padding:4px 18px 10px}
.dossier .row{display:grid;grid-template-columns:104px 1fr;gap:14px;padding:11px 0;
  border-bottom:1px solid rgba(39,43,51,.65);font-size:13px;line-height:1.5}
.dossier .row:last-child{border-bottom:0}
.dossier dt{color:var(--dim);font-size:10px;text-transform:uppercase;letter-spacing:.08em;padding-top:3px}
.dossier dd{margin:0;color:var(--fg)}
.fine{display:block;color:var(--muted);font-size:11px;margin-top:2px}
.dossier-note{margin:0;padding:12px 18px 15px;border-top:1px solid var(--line);
  color:var(--muted);font-size:11px;line-height:1.55}
.disclaimer{border-left:2px solid var(--amber);background:rgba(var(--amber-rgb),.05);
  padding:16px 20px;font-size:13px;line-height:1.65;color:var(--body3);margin-bottom:8px}
.disclaimer strong{color:var(--amber);text-transform:uppercase;font-size:10px;
  letter-spacing:.14em;display:block;margin-bottom:5px;font-weight:700}
/* Pasek statusu i kluczowe fakty — pierwszy ekran */
.shero{padding-block:24px 34px}
.statusbar{display:block;border:1px solid var(--line);background:var(--panel);
  padding:12px 15px;font-size:11px;letter-spacing:.05em;color:var(--muted)}
.statusbar-main{display:flex;align-items:center;gap:9px;flex-wrap:wrap;text-transform:uppercase}
.statusbar-meta{display:flex;align-items:center;gap:6px 16px;flex-wrap:wrap;margin-top:9px;
  padding-top:9px;border-top:1px solid var(--line);font-size:10.5px;color:var(--dim)}
.statusbar-meta .s-dl{border:0;padding:0;border-radius:0;white-space:normal;font-size:10.5px;color:var(--dim)}
.statusbar-meta .s-dl b{color:var(--muted);font-weight:600}
.calc{font-size:9px;letter-spacing:.09em;text-transform:uppercase;color:var(--warn);
  border:1px solid rgba(var(--warn-rgb),.45);border-radius:999px;padding:1px 6px;margin-left:4px;white-space:nowrap}
.sdot{width:7px;height:7px;border-radius:50%;background:var(--amber);flex:0 0 auto;
  box-shadow:0 0 0 4px rgba(var(--amber-rgb),.12)}
.s-main{color:var(--fg);font-weight:700;letter-spacing:.1em}
.s-sep{color:var(--dim)}
.s-day{color:var(--amber);font-weight:600}
.s-dl{color:var(--muted);border:1px solid var(--line);padding:3px 9px;border-radius:999px;white-space:nowrap;
  font-size:10px}
/* Animowany pasek postępu okna ustawowego (14.10 → 23.11) */
.tl-bar{margin-top:14px}
.tl-head{display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap;
  font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);margin-bottom:26px}
.tl-track{position:relative;height:14px;border-radius:999px;border:1px solid var(--line);
  background:linear-gradient(180deg,#080a0d,var(--track) 55%,#1b2028);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.05),inset 0 -5px 12px rgba(0,0,0,.6),
    0 0 0 1px rgba(0,0,0,.35),0 12px 30px rgba(0,0,0,.4)}
.tl-track:after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;
  background:repeating-linear-gradient(90deg,rgba(255,255,255,.12) 0 1px,transparent 1px 2.5%);
  opacity:.55;mix-blend-mode:overlay}
.tl-fill{position:relative;height:100%;border-radius:999px;overflow:hidden;
  background:linear-gradient(90deg,var(--amber-deep),var(--amber) 50%,var(--amber2));
  box-shadow:0 0 16px rgba(var(--amber-rgb),.65),0 0 44px rgba(var(--amber-rgb),.32),
    inset 0 1px 0 rgba(255,255,255,.55),inset 0 -2px 6px rgba(0,0,0,.28);
  animation:tlGrow 1.8s cubic-bezier(.2,.75,.25,1) both}
.tl-fill:before{content:"";position:absolute;top:-4px;bottom:-4px;width:56px;left:0;
  background:radial-gradient(circle,rgba(255,255,255,.95),rgba(255,255,255,.22) 45%,transparent 72%);
  filter:blur(1px);animation:tlComet 3.6s linear 1.4s infinite;opacity:0}
.tl-fill:after{content:"";position:absolute;top:0;bottom:0;width:42%;
  background:linear-gradient(100deg,transparent,rgba(255,255,255,.92) 44%,rgba(255,255,255,.2) 60%,transparent);
  transform:translateX(-160%);animation:tlSheen 4.4s cubic-bezier(.45,0,.55,1) 1.1s infinite}
.tl-mark{position:absolute;top:50%;width:2px;height:26px;margin-top:-13px;transform:translateX(-50%);
  border-radius:2px;background:linear-gradient(180deg,transparent,var(--line) 28%,var(--line) 72%,transparent)}
.tl-mark:after{content:"";position:absolute;left:1px;top:50%;width:7px;height:7px;margin:-3.5px 0 0 -3.5px;
  border-radius:50%;background:var(--panel2);border:1px solid var(--line);
  box-shadow:0 0 0 2px rgba(11,12,14,.9);transition:transform .25s ease,box-shadow .25s ease}
.tl-mark.hit{background:linear-gradient(180deg,transparent,rgba(var(--amber-rgb),.9) 28%,rgba(var(--amber-rgb),.9) 72%,transparent)}
.tl-mark.hit:after{background:var(--amber);border-color:var(--amber2);
  box-shadow:0 0 0 2px rgba(11,12,14,.9),0 0 12px rgba(var(--amber-rgb),.95),0 0 28px rgba(var(--amber-rgb),.45)}
.tl-mark:hover:after{transform:scale(1.5)}
.tl-event{position:absolute;top:50%;width:9px;height:9px;margin:-4.5px 0 0 -4.5px;background:var(--fg);
  transform:rotate(45deg);box-shadow:0 0 0 2px rgba(11,12,14,.85),0 0 14px rgba(238,234,227,.75)}
.tl-now{position:absolute;top:50%;width:15px;height:15px;margin:-7.5px 0 0 -7.5px;border-radius:50%;
  background:radial-gradient(circle at 34% 28%,#fff,var(--ok) 52%,#0b7a4d);
  box-shadow:0 0 0 2px rgba(11,12,14,.9),0 0 16px rgba(var(--ok-rgb),.95),0 0 38px rgba(var(--ok-rgb),.45);
  animation:tlPulse 2.6s ease-in-out infinite}
.tl-now:before,.tl-now:after{content:"";position:absolute;inset:-5px;border-radius:50%;
  border:1px solid rgba(var(--ok-rgb),.6);animation:tlRing 2.8s ease-out infinite}
.tl-now:after{animation-delay:1.4s}
.tl-labels{position:relative;height:31px;margin-top:9px;
  font-size:10px;color:var(--dim);letter-spacing:.05em;text-transform:uppercase}
.tl-labels span{position:absolute;top:0;left:var(--at);transform:translateX(-50%);
  white-space:nowrap;max-width:44%;overflow:hidden;text-overflow:ellipsis}
.tl-labels span[data-row="1"]{top:16px}
.tl-labels span:first-child{left:0;transform:none}
.tl-labels span:last-child{left:auto;right:0;transform:none;text-align:right}
.tl-labels b{color:var(--muted);font-weight:600;margin-right:5px}
.tl-note{margin:8px 0 0;font-size:10.5px;line-height:1.55;color:var(--dim);text-align:center}
.tl-social{position:absolute;top:-22px;width:14px;height:14px;margin:0 0 0 -7px;border-radius:50%;
  border:1.5px dashed var(--warn);background:rgba(var(--warn-rgb),.18);
  box-shadow:0 0 0 2px var(--ink);z-index:3}
.tl-social:after{content:"";position:absolute;left:50%;top:14px;width:1px;height:8px;
  background:var(--warn);opacity:.55}
/* Głosy społeczności pod leadem */
.community{margin-top:18px;border:1px solid rgba(var(--warn-rgb),.4);background:rgba(var(--warn-rgb),.04);padding:16px 20px}
.community-head h3{font-family:Georgia,serif;font-size:19px;font-weight:400;margin:0 0 3px;color:var(--warn)}
.community-head p{margin:0 0 8px;font-size:11px;color:var(--muted)}
.community ul{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.community li{border-top:1px solid rgba(var(--warn-rgb),.2);padding:9px 0 0;min-width:0}
.community a{font-size:13px;line-height:1.45;color:var(--fg);text-decoration:none}
.community a:hover{color:var(--amber)}
.cmeta{display:block;margin-top:5px;font-size:10px;color:var(--dim)}
@media(max-width:760px){.community ul{grid-template-columns:1fr}}
/* Wycinki prasowe pod osią — papier, rastr, pieczątka */
.tl-clips{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:18px 0 28px}
.tl-clip{position:relative;padding:11px 12px 13px;border-radius:2px;color:#191510;
  background:radial-gradient(circle at 10% -10%,#fffdf4,transparent 55%),
    linear-gradient(176deg,#f8f3e5,#ece4d0 62%,#ded3b8);
  box-shadow:0 12px 26px rgba(0,0,0,.5),0 1px 0 rgba(255,255,255,.6) inset,0 -1px 0 rgba(0,0,0,.12) inset;
  transform:rotate(var(--rot));
  animation:clipIn .8s cubic-bezier(.2,.8,.25,1) both;
  animation-delay:calc(.5s + var(--i)*.13s);
  transition:transform .3s cubic-bezier(.2,.8,.25,1),box-shadow .3s ease}
.tl-clip:before{content:"";position:absolute;inset:0;pointer-events:none;opacity:.55;border-radius:inherit;
  background-image:radial-gradient(circle,rgba(38,28,14,.32) .5px,transparent .6px);
  background-size:3px 3px;mix-blend-mode:multiply}
.tl-clip:after{content:"";position:absolute;left:0;right:0;top:0;height:2px;border-radius:2px 2px 0 0;
  background:#b3251b;opacity:.9}
.tl-clip:hover{transform:rotate(0) translateY(-4px);
  box-shadow:0 20px 40px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.18),0 1px 0 rgba(255,255,255,.6) inset}
.clip-kicker{display:flex;align-items:center;gap:5px;margin:4px 0 0;padding-right:46px;
  font:700 8px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.14em;
  text-transform:uppercase;color:#8d2a1e}
.clip-kicker i{width:5px;height:5px;background:#b3251b;border-radius:1px;flex:0 0 auto}
.clip-h{margin:6px 0 0;font-family:Georgia,"Times New Roman",serif;font-weight:700;
  font-size:15px;line-height:1.1;letter-spacing:-.015em;text-transform:uppercase;color:#17130c;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.clip-p{margin:5px 0 0;font-size:10.5px;line-height:1.45;color:#453b2c;
  display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.clip-stamp{position:absolute;top:7px;right:7px;padding:2px 4px;border:1.5px solid rgba(179,37,27,.8);
  border-radius:2px;color:#b3251b;font:700 7px/1 ui-monospace,SFMono-Regular,Menlo,monospace;
  letter-spacing:.16em;transform:rotate(-9deg);opacity:.9}
@media(max-width:900px){
  .tl-clips{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;
    padding:2px 2px 8px;margin-inline:-2px;scrollbar-width:none}
  .tl-clips::-webkit-scrollbar{display:none}
  .tl-clip{flex:0 0 min(78%,300px);scroll-snap-align:start}
}
@keyframes tlGrow{from{width:0}}
@keyframes tlSheen{0%{transform:translateX(-160%)}55%,100%{transform:translateX(260%)}}
@keyframes tlComet{0%{left:-6%;opacity:0}12%{opacity:.95}88%{opacity:.95}100%{left:100%;opacity:0}}
@keyframes tlPulse{
  0%,100%{box-shadow:0 0 0 2px rgba(11,12,14,.9),0 0 16px rgba(var(--ok-rgb),.95),0 0 38px rgba(var(--ok-rgb),.45)}
  50%{box-shadow:0 0 0 2px rgba(11,12,14,.9),0 0 24px rgba(var(--ok-rgb),1),0 0 60px rgba(var(--ok-rgb),.6)}}
@keyframes tlRing{0%{transform:scale(.55);opacity:.85}70%,100%{transform:scale(2.6);opacity:0}}
@keyframes clipIn{from{opacity:0;transform:translateY(12px) rotate(calc(var(--rot) * 2)) scale(.94)}}
@media(prefers-reduced-motion:reduce){
  .tl-fill{animation:none}
  .tl-fill:after,.tl-fill:before{animation:none;opacity:0}
  .tl-now{animation:none}
  .tl-now:before,.tl-now:after{animation:none;display:none}
  .tl-clip{animation:none}
  .cd:before,.cd-live i{animation:none}
  html{scroll-behavior:auto}
}
.s-status{color:var(--amber);border:1px solid rgba(var(--amber-rgb),.45);
  padding:3px 9px;border-radius:999px;white-space:nowrap}
.s-ok{margin-left:auto;color:var(--muted);border:1px solid var(--line);
  padding:3px 9px;border-radius:999px;white-space:nowrap}
.s-asof{color:var(--dim);font-size:10px;white-space:nowrap}
.shero-grid{display:grid;grid-template-columns:1.35fr 1fr;gap:40px;align-items:stretch;
  padding-block:32px 30px}
.shero-main{display:flex;flex-direction:column;min-width:0}
.hero-side{display:flex;flex-direction:column;min-width:0}
.shero h1{font-family:Georgia,"Times New Roman",serif;font-weight:400;
  font-size:clamp(32px,4.6vw,54px);line-height:1.04;letter-spacing:-.02em;margin:0;color:var(--fg)}
.shero .dek{font-size:clamp(15px,1.35vw,17px);line-height:1.6;color:var(--body2);max-width:620px;margin:16px 0 0}
.shero .hero-actions{margin-top:22px;margin-bottom:26px}
.hero-status{margin:14px 0 0;font-size:13px;line-height:1.6;color:var(--muted);max-width:620px;
  border-left:2px solid var(--line);padding-left:12px}
.hero-status b{color:var(--amber)}
.lastc{border-left:2px solid var(--ok);padding:2px 0 2px 18px;margin-top:auto}
.lastc .kicker{color:var(--ok);margin-bottom:4px}
.lastc-date{font-family:Georgia,serif;font-size:26px;line-height:1.2;color:var(--fg);margin:0 0 6px;
  font-variant-numeric:tabular-nums}
.lastc-text{margin:0;font-size:13px;line-height:1.6;color:var(--body)}
.lastc-note{margin:9px 0 0;font-size:11px;line-height:1.55;color:var(--dim)}
/* Odliczanie do ustawowego limitu 40 dni — rozciąga się do dołu panelu po prawej. */
.cd{position:relative;overflow:hidden;isolation:isolate;margin-top:auto;max-width:620px;
  border:1px solid var(--line);border-left:3px solid var(--amber);padding:15px 20px 14px;
  background:radial-gradient(130% 120% at 0% 0%,rgba(var(--amber-rgb),.12),transparent 58%),var(--panel)}
.cd:before{content:"";position:absolute;left:0;right:0;top:0;height:2px;z-index:2;
  background:linear-gradient(90deg,var(--amber),transparent 45%,transparent 55%,var(--amber));
  background-size:200% 100%;animation:cdRun 6s linear infinite}
.cd > *{position:relative;z-index:1}
.cd-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
.cd .kicker{color:var(--amber);margin:0}
.cd-live{display:inline-flex;align-items:center;gap:6px;font-size:9.5px;letter-spacing:.16em;
  text-transform:uppercase;color:var(--dim);white-space:nowrap}
.cd-live i{width:6px;height:6px;border-radius:50%;background:var(--amber);
  animation:cdLive 2s ease-out infinite}
.cd-clock{display:flex;align-items:flex-end;gap:4px 16px;flex-wrap:wrap;margin:6px 0 0}
.cd-days{display:flex;align-items:baseline;gap:9px;color:var(--fg)}
.cd-days b{font-family:Georgia,"Times New Roman",serif;font-weight:400;
  font-size:clamp(52px,6.2vw,76px);line-height:.9;letter-spacing:-.03em;
  font-variant-numeric:tabular-nums;text-shadow:0 0 26px rgba(var(--amber-rgb),.22)}
.cd-days i{font-style:normal;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--muted)}
.cd-time{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:clamp(19px,2vw,28px);
  line-height:1;letter-spacing:.04em;color:var(--amber);font-variant-numeric:tabular-nums;padding-bottom:5px}
.cd-ticks{display:grid;grid-template-columns:repeat(40,1fr);gap:3px;margin:14px 0 0}
.cd-ticks span{height:13px;background:var(--track);border-radius:1px;
  box-shadow:inset 0 0 0 1px rgba(127,127,127,.12)}
.cd-ticks span.on{background:var(--amber);box-shadow:0 0 7px rgba(var(--amber-rgb),.45)}
.cd-meta{margin:11px 0 0;font-size:11px;color:var(--muted)}
.cd-note{margin:4px 0 0;font-size:11px;line-height:1.5;color:var(--dim)}
.cd.past:before{animation:none;background:var(--line)}
.cd.past .cd-time,.cd.past .cd-live,.cd.past .cd-live i{color:var(--dim);animation:none}
@keyframes cdRun{to{background-position:-200% 0}}
@keyframes cdLive{0%{box-shadow:0 0 0 0 rgba(var(--amber-rgb),.55)}70%,100%{box-shadow:0 0 0 7px rgba(var(--amber-rgb),0)}}
.keyfacts-wrap{padding-block:2px 10px}
.pressgal{margin:0 auto;max-width:1136px;border:1px solid var(--line);background:var(--panel);
  padding:20px;margin-bottom:26px}
.pg-head .kicker{color:var(--muted);margin:0}
.pg-head h2{font-family:Georgia,"Times New Roman",serif;font-weight:400;
  font-size:clamp(22px,2.6vw,30px);line-height:1.2;margin:6px 0 8px;color:var(--fg)}
.pg-lead-text{max-width:660px;margin:0 0 18px;font-size:13px;line-height:1.6;color:var(--muted)}
.pg-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;align-items:start}
.pg-item{margin:0;min-width:0}
.pg-item a{display:block}
.pg-item img{width:100%;height:auto;max-height:340px;object-fit:cover;display:block;
  background:var(--panel);border:1px solid var(--line)}
.pg-lead{grid-column:span 2}
.pg-lead img{max-height:400px}
.pg-video{margin:0 0 14px}
.pg-video video{width:100%;height:auto;display:block;background:#000;border:1px solid var(--line)}
.pg-video figcaption{margin-top:8px;font-size:11px;line-height:1.5;color:var(--dim)}
.hero-shot{margin:0 0 24px;max-width:none}
.hero-shot img{width:100%;height:auto;display:block;border:1px solid var(--line);background:var(--panel)}
.hero-shot figcaption{margin-top:7px;font-size:11px;line-height:1.5;color:var(--dim)}
.eco-chip{display:inline-flex;align-items:center;gap:6px;font-size:10px;letter-spacing:.1em;
  text-transform:uppercase;color:var(--muted);border:1px solid var(--line);border-radius:999px;
  padding:4px 9px 4px 5px}
.eco-chip img{width:16px;height:16px;border-radius:50%;object-fit:contain}
.assets{margin:0 0 26px;border:1px solid var(--line);background:var(--panel);padding:18px}
.assets .kicker{color:var(--muted);margin:0}
.assets h2{font-family:Georgia,"Times New Roman",serif;font-weight:400;
  font-size:clamp(20px,2.2vw,26px);margin:4px 0 8px;color:var(--fg)}
.assets-lead{margin:0 0 14px;font-size:12px;line-height:1.6;color:var(--muted);max-width:720px}
.assets-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.asset{margin:0;min-width:0}
.asset img{width:100%;height:220px;object-fit:cover;display:block;border:1px solid var(--line)}
.asset figcaption{margin-top:7px;font-size:10px;line-height:1.5;color:var(--dim)}
.foot-eco{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 14px}
.foot-eco-label{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--dim);margin-right:4px}
.pg-item figcaption{margin-top:8px;font-size:11px;line-height:1.5;color:var(--dim)}
.pg-credit{margin:14px 0 0;font-size:11px;color:var(--muted)}
.pg-credit a{color:var(--muted);text-decoration:none;border-bottom:1px dotted var(--line)}
.pg-credit a:hover{color:var(--amber);border-color:var(--amber)}
.pg-note{margin:6px 0 0;font-size:10px;line-height:1.55;color:var(--dim);max-width:760px}
@media(max-width:920px){
  .pg-grid{grid-template-columns:1fr 1fr}
  .pg-lead{grid-column:1/-1;grid-row:auto}
  .assets-grid{grid-template-columns:1fr 1fr}
  .asset img{height:190px}
}
@media(max-width:640px){
  .pg-grid{grid-template-columns:1fr}
  .pg-item img,.pg-lead img{max-height:none}
  .assets{padding:14px}
  .assets-grid{grid-template-columns:1fr}
  .asset img{height:200px}
  .hero-shot{max-width:none}
}
.keyfacts{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--line);
  border:1px solid var(--line)}
.sfact{background:var(--panel);padding:15px 17px;min-width:0}
.sfact-top{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:7px}
.sfact-label{font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:var(--dim)}
.vbadge{font-size:10px;letter-spacing:.08em;text-transform:uppercase;padding:2px 7px;
  border:1px solid var(--line);border-radius:999px;white-space:nowrap}
.vbadge.confirmed{color:var(--ok);border-color:rgba(var(--ok-rgb),.45)}
.vbadge.calculated{color:var(--warn);border-color:rgba(var(--warn-rgb),.45)}
.vbadge.unconfirmed{color:var(--bad);border-color:rgba(var(--bad-rgb),.72);background:rgba(var(--bad-rgb),.14);font-weight:700}
.side-block h4{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--dim);margin:0 0 10px}
.evlist{list-style:none;margin:0;padding:0}
.evlist li{display:grid;grid-template-columns:78px 1fr;gap:10px;padding:9px 0;
  border-top:1px solid rgba(39,43,51,.65);font-size:12px;line-height:1.55;color:var(--muted)}
.evlist li:first-child{border-top:0}
.evlist b{color:var(--fg);font-weight:600;font-variant-numeric:tabular-nums}
.side-link{display:flex;gap:14px;flex-wrap:wrap;margin:12px 0 0;font-size:11px}
.side-link a{color:var(--muted)}
.side-link a:hover{color:var(--amber)}
.lead.social h3{font-family:inherit;font-size:15px;font-weight:600;line-height:1.5}
.lead.social{grid-template-columns:1fr}
.lead.social .lead-side{border-left:0;border-top:1px solid var(--line)}
.excerpt-fold{border:1px solid var(--line);background:var(--panel)}
.excerpt-fold summary{cursor:pointer;padding:13px 18px;font-size:11px;color:var(--muted);
  letter-spacing:.06em;text-transform:uppercase}
.excerpt-fold summary:hover{color:var(--fg)}
.excerpt-fold .excerpt{border:0;border-top:1px solid var(--line);max-height:520px;overflow:auto}
.sfact-value{margin:0 0 5px;color:var(--fg);font-size:15px;line-height:1.35;font-weight:600}
.sfact-note{margin:0 0 7px;font-size:12px;line-height:1.5;color:var(--muted)}
.sfact-src{margin:0;font-size:11px;letter-spacing:.07em;text-transform:uppercase}
.sfact-src a{color:var(--muted);text-decoration:none;border-bottom:1px dotted var(--line)}
.sfact-src a:hover{color:var(--amber);border-color:var(--amber)}
.nonews{border-left:2px solid var(--amber);background:rgba(var(--amber-rgb),.06);
  padding:12px 16px;margin:0 0 20px;font-size:13px;line-height:1.6;color:var(--body)}
.nonews b{color:var(--amber)}
.src-badge{font-size:10px;letter-spacing:.09em;text-transform:uppercase;padding:2px 7px;
  border-radius:999px;border:1px solid var(--line);white-space:nowrap}
.src-badge.change{color:var(--warn);border-color:rgba(var(--amber-rgb),.45)}
.src-badge.social{color:var(--warn);border-color:rgba(var(--warn-rgb),.5)}
.src-badge.media{color:var(--muted)}
.lead-warn{margin:10px 0 0;font-size:12px;line-height:1.55;color:var(--warn);
  border-left:2px solid rgba(var(--warn-rgb),.5);padding-left:10px}
.detail-kind{display:inline-block;margin:0 0 4px;font-size:10px;letter-spacing:.1em;
  text-transform:uppercase;border:1px solid var(--line);padding:3px 9px;border-radius:999px;color:var(--muted)}
.detail-kind.social{color:var(--warn);border-color:rgba(var(--warn-rgb),.5)}
/* Roadmapa prawna */
.dl-strip{display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:var(--line);
  border:1px solid var(--line);margin-bottom:26px}
.dl{background:var(--panel);padding:16px 18px;display:flex;flex-direction:column;gap:4px;min-width:0}
.dl-label{font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:var(--dim)}
.dl-days{font-family:Georgia,serif;font-size:24px;line-height:1.2;color:var(--amber)}
.dl-date{font-size:11px;color:var(--muted);font-variant-numeric:tabular-nums}
.dl-pl{font-size:12px;line-height:1.6;color:var(--muted);margin-top:4px}
.dl-basis{margin-top:auto;padding-top:9px;font-size:10px;letter-spacing:.06em;text-transform:uppercase;
  color:var(--dim);border-top:1px solid var(--line)}
.roadmap{list-style:none;margin:0;padding:0}
.rm{display:grid;grid-template-columns:152px 1fr;gap:22px;padding:18px 0;border-top:1px solid var(--line)}
.rm:last-child{border-bottom:1px solid var(--line)}
.rm-when{font-size:11px;color:var(--muted);font-variant-numeric:tabular-nums;padding-top:3px}
.rm-body h3{font-family:Georgia,serif;font-size:19px;font-weight:400;margin:0 0 6px;color:var(--fg);
  display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.rm-body p{margin:0 0 7px;font-size:13px;line-height:1.65;color:var(--muted);max-width:780px}
.rm-basis{font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--dim)}
.rm-basis a{color:var(--dim);border-bottom:1px dotted var(--line);text-decoration:none}
.rm-basis a:hover{color:var(--amber)}
.rm-badge{font-size:10px;letter-spacing:.09em;text-transform:uppercase;padding:3px 8px;border-radius:999px;
  border:1px solid var(--line);color:var(--muted);white-space:nowrap}
.rm.done .rm-badge{color:var(--ok);border-color:rgba(var(--ok-rgb),.45)}
.rm.current .rm-badge{color:var(--amber);border-color:rgba(var(--amber-rgb),.55);background:rgba(var(--amber-rgb),.07)}
.rm.next .rm-badge{color:var(--amber2);border-color:var(--line);border-style:dashed}
.rm.unknown .rm-badge{border-style:dashed}
.rm.conditional .rm-badge{border-style:dashed;color:var(--dim)}
.legal-notes{margin-top:22px;border:1px solid var(--line);background:var(--panel);padding:16px 20px}
.legal-notes h3{margin:0 0 8px;font-family:Georgia,serif;font-size:17px;font-weight:400;color:var(--fg)}
.legal-notes ul{margin:0;padding-left:18px;font-size:12px;line-height:1.65;color:var(--muted)}
.legal-notes li{padding:3px 0}
/* Patronat */
.patron{padding-block:0 56px}
.patron-box{display:flex;flex-wrap:wrap;align-items:center;gap:16px 22px;
  border:1px solid var(--line);background:var(--panel);padding:18px 22px}
.patron-mark{width:46px;height:46px;flex:0 0 auto;display:grid;place-items:center;
  border:1px solid var(--amber);color:var(--amber);font-family:Georgia,serif;font-size:22px;line-height:1}
.patron-copy{flex:1 1 320px;min-width:0}
.patron-copy h3{font-family:Georgia,serif;font-size:20px;font-weight:400;margin:2px 0 6px;color:var(--fg)}
.patron-copy p{margin:0;font-size:12.5px;line-height:1.65;color:var(--muted);max-width:64ch}
.patron-note{margin-top:6px;font-size:11px;color:var(--dim)}
.patron-links{display:flex;gap:8px;flex-wrap:wrap;margin-left:auto}
.section{padding-block:56px;border-top:1px solid var(--line)}
.section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:28px;margin-bottom:26px}
.kicker{font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--dim);margin:0 0 8px}
.section h2{font-family:Georgia,"Times New Roman",serif;font-weight:400;
  font-size:clamp(28px,3.4vw,42px);line-height:1.1;margin:0;color:var(--fg)}
.section-note{color:var(--muted);font-size:12px;line-height:1.6;max-width:430px;margin:0}
.lead{display:grid;grid-template-columns:1.45fr .85fr;border:1px solid var(--line);background:var(--panel)}
.lead-main{padding:26px 28px}
.lead-kicker{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--amber)}
.lead h3{font-family:Georgia,"Times New Roman",serif;font-size:clamp(22px,2.7vw,32px);
  font-weight:400;line-height:1.22;margin:10px 0 14px;color:var(--fg)}
.lead h3 a{text-decoration:none}
.lead h3 a:hover{color:var(--amber)}
.lead-meta{display:flex;gap:8px 14px;flex-wrap:wrap;font-size:11px;color:var(--dim)}
.lead-meta a{color:var(--muted)}
.gloss{font-size:12px;line-height:1.65;color:var(--muted);margin:8px 0 0;max-width:72ch}
.gloss .ai-tag{display:inline-block;font-size:9px;letter-spacing:.1em;text-transform:uppercase;
  color:var(--dim);border:1px solid var(--line);padding:1px 5px;margin-right:7px;vertical-align:1px}
.lead-side{border-left:1px solid var(--line);padding:20px 24px}
.mini-story{padding:11px 0;border-bottom:1px solid var(--line)}
.mini-story:last-child{border-bottom:0}
.mini-story h4{font-size:14px;line-height:1.45;margin:0 0 4px;font-weight:600;color:var(--fg)}
.mini-story h4 a{text-decoration:none}
.mini-story h4 a:hover{color:var(--amber)}
.mini-story .m{font-size:11px;letter-spacing:.05em;color:var(--dim)}
.split{display:grid;grid-template-columns:1.55fr .85fr;gap:48px;align-items:start}
.fact-list{list-style:none;margin:0;padding:0;counter-reset:facts}
.fact-list li{counter-increment:facts;position:relative;padding:17px 0 17px 46px;border-bottom:1px solid var(--line)}
.fact-list li:last-child{border-bottom:0}
.fact-list li:before{content:counter(facts,decimal-leading-zero);position:absolute;left:0;top:19px;
  font-size:10px;letter-spacing:.1em;color:var(--amber);font-variant-numeric:tabular-nums}
.fact-list p{margin:0;font-size:15px;line-height:1.6;color:var(--body2)}
.sources{display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:7px;font-size:11px;color:var(--dim)}
.sources a{display:inline-block;padding-block:3px;color:var(--muted);text-decoration:none;border-bottom:1px solid var(--line)}
.sources a:hover{color:var(--amber);border-color:var(--amber)}
/* Przypisy aktów prawnych i linki źródeł */
.acts{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 0}
.act{display:inline-block;font-size:10px;letter-spacing:.06em;text-transform:uppercase;
  padding:3px 8px;border:1px solid var(--line);border-radius:999px;color:var(--muted);
  text-decoration:none;background:rgba(var(--amber-rgb),.04);white-space:nowrap}
.act:hover{color:var(--amber);border-color:rgba(var(--amber-rgb),.55)}
.src-link{color:var(--muted);text-decoration:none;border-bottom:1px dotted var(--line)}
.src-link:hover{color:var(--amber);border-color:var(--amber)}
.ctr-links{display:flex;flex-wrap:wrap;gap:6px 14px;padding:0 20px 12px;font-size:11px}
.acts-label{margin:14px 0 0;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim)}
.err-src{margin-left:8px;font-size:10px}
.err-src .src-link{margin-right:10px}
.claims{margin-top:26px;border:1px solid rgba(var(--amber-rgb),.3);background:rgba(var(--amber-rgb),.04);padding:18px 20px}
.claims h3{font-family:Georgia,serif;font-size:19px;font-weight:400;margin:0 0 4px;color:var(--amber)}
.claims>p{font-size:11px;color:var(--muted);margin:0 0 8px}
.claims ul{list-style:none;padding:0;margin:0}
.claims li{padding:10px 0;border-bottom:1px solid rgba(var(--amber-rgb),.15);font-size:13px;line-height:1.55}
.claims li:last-child{border-bottom:0;padding-bottom:0}
.claims .src{display:block;font-size:10px;color:var(--dim);margin-top:3px}
.aside-card{border:1px solid var(--line);background:var(--panel);padding:20px 22px;margin-bottom:18px}
.aside-card h3{font-family:Georgia,serif;font-size:21px;font-weight:400;margin:0 0 12px;color:var(--fg)}
.unknown{padding:11px 0;border-bottom:1px solid var(--line);font-size:13px;line-height:1.55}
.unknown:last-child{border-bottom:0;padding-bottom:0}
.unknown .q{color:var(--fg);font-weight:600}
.unknown .d{color:var(--muted);font-size:11px;margin-top:3px}
.legend{font-size:12px;color:var(--muted)}
.legend div{display:flex;gap:9px;padding:6px 0;align-items:flex-start}
.dot{width:7px;height:7px;border-radius:50%;margin-top:7px;flex:0 0 auto;background:var(--amber)}
.dot.ok{background:var(--ok)}.dot.warn{background:var(--warn)}
.timeline{position:relative;margin:0;padding:0;list-style:none}
.timeline:before{content:"";position:absolute;left:96px;top:8px;bottom:10px;width:1px;background:var(--line)}
.tl{display:grid;grid-template-columns:78px 1fr;gap:40px;padding:0 0 26px;position:relative}
.tl:last-child{padding-bottom:0}
.tl-date{font-size:12px;color:var(--muted);text-align:right;padding-top:1px;font-variant-numeric:tabular-nums}
.tl-date b{display:block;color:var(--fg);font-size:13px;font-weight:600}
.tl-body{position:relative;font-size:14px;line-height:1.6;color:var(--body2)}
.tl-body:before{content:"";position:absolute;left:-24px;top:7px;width:9px;height:9px;border-radius:50%;
  background:var(--amber);box-shadow:0 0 0 4px var(--ink)}
.tl.claimed .tl-body:before{background:var(--warn)}
.tl-badge{display:inline-block;font-size:10px;letter-spacing:.08em;text-transform:uppercase;
  padding:1px 6px;border:1px solid var(--line);color:var(--muted);margin-left:6px;vertical-align:1px}
.tl-badge.b-claimed,.tl-badge.b-calc{color:var(--warn);border-color:rgba(var(--warn-rgb),.4)}
.tl-src{display:block;margin-top:5px;font-size:11px;color:var(--dim)}
.tl-src a{color:var(--muted)}
.ctr-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:18px}
.ctr{border:1px solid var(--line);background:var(--panel);min-width:0}
.ctr-head{padding:18px 20px 12px}
.ctr h3{font-family:Georgia,serif;font-size:22px;font-weight:400;margin:0 0 5px;color:var(--fg)}
.ctr .summary{font-size:12px;line-height:1.6;color:var(--muted);margin:0}
.table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;max-width:100%}
.ctr table{width:100%;min-width:560px;border-collapse:collapse;font-size:12px}
.ctr th,.ctr td{text-align:left;padding:9px 20px;border-top:1px solid var(--line);vertical-align:top}
.ctr th{color:var(--dim);font-size:10px;text-transform:uppercase;letter-spacing:.08em}
.ctr td:first-child{color:var(--muted);width:34%}
.ctr-note{margin:0;padding:11px 20px;border-top:1px solid var(--line);
  background:rgba(var(--amber-rgb),.05);font-size:11px;line-height:1.6;color:var(--warn)}
.errors{margin-top:18px;border:1px solid var(--line);background:var(--panel);padding:0 20px}
.errors summary{cursor:pointer;padding:15px 0;font-size:12px;color:var(--muted);list-style-position:inside}
.errors summary:hover{color:var(--fg)}
.errors ol{margin:0 0 16px;padding-left:18px;font-size:12px;line-height:1.6;color:var(--muted)}
.errors li{padding:5px 0}
.errors b{color:var(--fg);font-weight:600}
.market-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:14px}
.coin{border:1px solid var(--line);background:var(--panel);padding:15px 14px}
.coin-top{display:flex;align-items:center;gap:8px}
.coin-logo{width:22px;height:22px;border-radius:50%;object-fit:contain;flex:none;
  background:rgba(127,127,127,.08)}
.coin .name{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted)}
.coin .price{font-family:Georgia,serif;font-size:clamp(20px,1.7vw,23px);margin:7px 0 12px;
  font-variant-numeric:tabular-nums;color:var(--fg);line-height:1.1}
.coin .delta{display:flex;justify-content:space-between;gap:6px;font-size:10px;color:var(--dim);
  border-top:1px solid var(--line);padding-top:8px;font-variant-numeric:tabular-nums}
.up{color:var(--ok)}.down{color:var(--bad)}
.market-note{font-size:11px;line-height:1.65;color:var(--muted);margin:14px 0 0;max-width:780px}
.filters{display:flex;gap:10px;flex-wrap:wrap}
.filters input{flex:1 1 260px;background:var(--panel);border:1px solid var(--line);color:var(--fg);
  padding:11px 14px;font:inherit;font-size:14px;border-radius:0;min-width:0}
.filters input:focus{outline:none;border-color:var(--amber)}
.arch-filter{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:16px 0 0;font-size:11px;color:var(--dim)}
.arch-filter a{color:var(--muted);text-decoration:none;border:1px solid var(--line);padding:5px 11px;border-radius:999px}
.arch-filter a:hover{color:var(--amber);border-color:var(--amber)}
.arch-filter a.on{color:var(--amber);border-color:rgba(var(--amber-rgb),.55);background:rgba(var(--amber-rgb),.07)}
.results-meta{font-size:11px;color:var(--dim);margin:14px 0 0}
.story{display:grid;grid-template-columns:126px 1fr;gap:28px;padding:18px 0;border-top:1px solid var(--line)}
.story-date{font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}
.story-date span{display:block}
.story-date .h{color:var(--dim);font-size:10px;margin-top:2px}
.story h3{font-family:Georgia,serif;font-weight:400;font-size:19px;line-height:1.35;margin:0 0 5px;color:var(--fg)}
.story h3 a{text-decoration:none}
.story h3 a:hover{color:var(--amber)}
.story .meta{display:flex;gap:6px 12px;flex-wrap:wrap;font-size:11px;color:var(--muted)}
.story .meta a{color:var(--muted)}
.story .meta a:hover{color:var(--amber)}
.pager{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-top:26px;
  font-size:11px;color:var(--muted);border-top:1px solid var(--line);padding-top:18px}
.pager a{color:var(--fg);text-decoration:none;border:1px solid var(--line);padding:8px 14px;white-space:nowrap}
.pager a:hover{border-color:var(--amber);color:var(--amber)}
.pager .dis{color:var(--dim);border-color:transparent;padding:8px 0}
.empty{color:var(--muted);font-size:13px;padding:16px 0;margin:0}
.method-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:28px}
.method h3{font-family:Georgia,serif;font-size:21px;font-weight:400;margin:0 0 7px;color:var(--fg)}
.method p{font-size:12px;line-height:1.7;color:var(--muted);margin:0}
.review{display:grid;grid-template-columns:1.6fr 1fr;gap:1px;background:var(--line);border:1px solid var(--line)}
.rev-main{background:var(--panel);padding:20px 22px;min-width:0}
.rev-main p{margin:0 0 10px;font-size:13px;line-height:1.65;color:var(--body2)}
.rev-main p:last-child{margin-bottom:0}
.rev-status b{color:var(--fg)}
.rev-latest a{color:var(--amber)}
.rev-latest .fine{display:block;margin-top:4px;font-size:11px;color:var(--dim)}
.rev-meta{background:var(--panel);margin:0;padding:16px 22px;display:grid;gap:9px;align-content:start}
.rev-meta div{display:flex;justify-content:space-between;gap:14px;font-size:11px;line-height:1.5}
.rev-meta dt{color:var(--dim)}
.rev-meta dd{margin:0;color:var(--fg);text-align:right}
@media(max-width:920px){.review{grid-template-columns:1fr}}
.stats-line{display:flex;flex-wrap:wrap;gap:12px 30px;margin-top:30px;padding-top:20px;
  border-top:1px solid var(--line);font-size:11px;color:var(--dim)}
.stats-line b{color:var(--fg);font-weight:600}
footer{padding-block:34px 58px;border-top:1px solid var(--line);color:var(--dim);font-size:11px;line-height:1.7}
footer p{max-width:860px;margin:0 0 10px}
footer a{color:var(--muted)}
footer a:hover{color:var(--amber)}
.foot-nav{display:flex;gap:18px;flex-wrap:wrap;margin:14px 0}
/* Strona wpisu */
.detail{padding-block:46px 56px;max-width:840px}
.back{font-size:11px;letter-spacing:.08em;text-transform:uppercase;text-decoration:none;color:var(--muted)}
.back:hover{color:var(--amber)}
.detail h1{font-family:Georgia,serif;font-weight:400;font-size:clamp(27px,3.6vw,40px);
  line-height:1.16;margin:14px 0 14px;color:var(--fg)}
.detail-meta{display:flex;gap:6px 16px;flex-wrap:wrap;font-size:11px;color:var(--dim);
  padding-bottom:20px;border-bottom:1px solid var(--line)}
.detail-meta a{color:var(--muted)}
.detail h2{font-family:Georgia,serif;font-size:23px;font-weight:400;margin:30px 0 10px;color:var(--fg)}
.excerpt{border:1px solid var(--line);background:var(--panel);padding:18px 20px;
  font-size:13px;line-height:1.7;color:var(--body2);white-space:pre-wrap;word-break:break-word}
.excerpt-label{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);margin:0 0 6px}
.summary{border-left:2px solid var(--amber);padding:2px 0 2px 16px;font-size:14px;line-height:1.7;margin:0 0 14px}
.summary .tag{display:block;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);margin-bottom:3px}
.checks{border:1px solid var(--line);background:var(--panel);padding:18px 20px;margin-top:24px}
.checks h2{margin:0 0 6px;font-size:20px}
.checks p{font-size:11px;color:var(--muted);margin:0 0 10px}
.checks ul{list-style:none;padding:0;margin:0}
.checks li{padding:9px 0;border-top:1px solid var(--line);font-size:12px;line-height:1.6}
.checks li b{color:var(--amber)}
.checks li .note{display:block;color:var(--muted);margin-top:2px}
.checks .clean{color:var(--ok);font-size:12px;margin:0}
.notfound{padding:80px 0;text-align:center}
.notfound h1{font-family:Georgia,serif;font-weight:400;font-size:44px;margin:0 0 10px}
/* Panel „nowa relacja” — tylko gdy działa /live.js */
.livebox{position:fixed;right:18px;bottom:18px;z-index:60;width:min(390px,calc(100vw - 36px));
  background:var(--panel);border:1px solid var(--amber);border-left-width:4px;
  box-shadow:0 22px 60px rgba(0,0,0,.6);padding:16px 18px 14px;
  max-height:min(70vh,560px);overflow:auto;overscroll-behavior:contain;
  animation:lbIn .35s cubic-bezier(.2,.75,.25,1) both}
@keyframes lbIn{from{opacity:0;transform:translateY(10px)}}
.lb-close{position:absolute;top:6px;right:8px;background:none;border:0;color:var(--dim);
  font-size:20px;line-height:1;cursor:pointer;padding:4px}
.lb-close:hover{color:var(--amber)}
.lb-kicker{margin:0 0 6px;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--amber)}
.lb-title{margin:0 0 9px;padding-right:18px;font-family:Georgia,serif;font-weight:400;
  font-size:17px;line-height:1.35;color:var(--fg)}
.lb-title a{text-decoration:none}
.lb-title a:hover{color:var(--amber2)}
.lb-tag{margin:9px 0 2px;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.lb-sum{margin:0;font-size:12px;line-height:1.55;color:var(--body)}
.lb-social{margin:8px 0 0;color:var(--warn);font-size:11px}
.lb-foot{margin:10px 0 0;font-size:10px;letter-spacing:.1em;text-transform:uppercase}
.lb-foot a{color:var(--amber);text-decoration:none}
@media(max-width:640px){.livebox{right:10px;left:10px;bottom:10px;width:auto}}
@media(max-width:1100px){
  .nav{order:3;width:100%;border-top:1px solid var(--line);padding-top:10px;gap:4px 20px;
    flex-wrap:wrap;overflow:visible}
  .nav a{padding:8px 0}
}
@media(max-width:920px){
  .shero-grid{display:flex;flex-direction:column;gap:24px;align-items:stretch}
  .shero-grid .lastc{border-left:0;border-top:2px solid var(--ok);padding:14px 0 0}
  .keyfacts{grid-template-columns:repeat(2,1fr)}
  .split{grid-template-columns:1fr;gap:30px}
  .lead{grid-template-columns:1fr}
  .lead-side{border-left:0;border-top:1px solid var(--line)}
  .market-grid{grid-template-columns:repeat(2,1fr)}
  .method-grid{grid-template-columns:1fr;gap:20px}
  .tl-labels{position:static;height:auto;display:grid;grid-template-columns:repeat(2,1fr);gap:4px 10px}
  .tl-labels span{position:static;transform:none;max-width:none}
}
@media(max-width:640px){
  .wrap{padding:0 18px}
  .s-ok{margin-left:0}
  .s-asof{white-space:normal}
  .shero{padding-block:16px 26px}
  .shero h1{font-size:clamp(27px,8.4vw,38px)}
  .statusbar{font-size:11px;line-height:1.6;gap:6px 8px;padding:10px 12px}
  .s-asof{width:auto}
  .s-dl{white-space:normal}
  .s-dl-note{display:none}
  .s-sep,.s-loc{display:none}
  .nav-wrap{display:block;order:3;width:100%;position:relative}
  .nav-wrap::after{content:"";position:absolute;right:0;top:9px;bottom:0;width:60px;pointer-events:none;
    background:linear-gradient(90deg,rgba(0,0,0,0),var(--ink))}
  .nav-wrap::before{content:"›";position:absolute;right:0;top:9px;bottom:0;width:34px;z-index:1;
    display:grid;place-items:center;background:var(--ink);color:var(--amber);font-size:18px;line-height:1;pointer-events:none}
  .nav{flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;padding:9px 40px 0 0}
  .s-dl{max-width:100%;overflow-wrap:anywhere}
  .ops-link{display:none}
  .livebox{max-height:min(55vh,460px)}
  .keyfacts{grid-template-columns:1fr}
  .sfact{padding:14px 15px}
  .filters input{font-size:16px}
  .arch-filter a{padding:10px 13px;font-size:12px}
  .story .meta a,.sfact-src a,.side-link a{display:inline-block;padding:7px 0}
  .evlist li{grid-template-columns:64px 1fr;font-size:11px}
  .dl-strip{grid-template-columns:1fr}
  .rm{grid-template-columns:1fr;gap:6px}
  .legal-notes{padding:14px 16px}
  .tl-head{font-size:9px;gap:4px}
  .tl-labels{position:static;height:auto;display:grid;grid-template-columns:repeat(2,1fr);gap:4px 10px;font-size:9px}
  .tl-labels span{position:static;transform:none;max-width:none}
  .dossier .row{grid-template-columns:92px 1fr}
  .section{padding-block:38px}
  .section-head{flex-direction:column;align-items:flex-start;gap:8px}
  .story{grid-template-columns:1fr;gap:5px}
  .story-date span{display:inline;margin-right:8px}
  .story-date .h{display:inline}
  .timeline:before{display:none}
  .tl{grid-template-columns:1fr;gap:3px;padding-bottom:22px}
  .tl-date{text-align:left}
  .tl-body{padding-left:14px}
  .tl-body:before{left:0;top:6px}
  .table-wrap{overflow-x:auto}
  .ctr table{min-width:520px;font-size:12px}
  .ctr th,.ctr td{padding:8px 12px}
  .ctr td:first-child{width:34%;font-size:10px}
  .coin .price{font-size:22px}
  .pager{flex-wrap:wrap}
  .disclaimer{padding:14px 16px}
}

/* ============================================================
   Czwarty motyw: DOSSIER — akta prawne na ciepłym papierze.
   Stonowany, poważny: tusz, oksydowana czerwień pieczęci, mosiądz.
   Scopowany html[data-theme], więc wygrywa z bazą bez !important.
   ============================================================ */
html[data-theme="dossier"]{
  --ink:#ece5d3;--paper:#f3eee1;--panel:#f8f4ea;--panel2:#fffdf6;--line:#d9cfb8;
  --fg:#1c1710;--body:#2c261d;--body2:#332c22;--body3:#3d352a;--muted:#5f5747;--dim:#6a6252;
  --amber:#8a2731;--amber2:#a8404a;--amber-deep:#5c1b22;--track:#e0d6bf;
  --ok:#1f7a4d;--warn:#8a600d;--bad:#a02c36;
  --amber-rgb:138,39,49;--ok-rgb:31,122,77;--warn-rgb:138,96,13;--bad-rgb:160,44,54;
  scrollbar-color:#c3b79b #ece5d3;scrollbar-width:thin;
}
html[data-theme="dossier"] body{background:var(--ink);color:var(--body)}
html[data-theme="dossier"] body:before{
  background:
    radial-gradient(1100px 620px at 86% -12%,rgba(138,39,49,.055),transparent 60%),
    radial-gradient(820px 520px at -8% 2%,rgba(138,96,13,.06),transparent 55%),
    radial-gradient(circle,rgba(28,23,16,.03) .5px,transparent .6px);
  background-size:auto,auto,4px 4px;
}
html[data-theme="dossier"] ::-webkit-scrollbar{width:11px;height:11px}
html[data-theme="dossier"] ::-webkit-scrollbar-track{background:#ece5d3}
html[data-theme="dossier"] ::-webkit-scrollbar-thumb{background:#c3b79b;border:3px solid #ece5d3;border-radius:8px}
html[data-theme="dossier"] ::-webkit-scrollbar-thumb:hover{background:var(--amber)}
html[data-theme="dossier"] a:focus-visible,
html[data-theme="dossier"] button:focus-visible,
html[data-theme="dossier"] input:focus-visible,
html[data-theme="dossier"] summary:focus-visible,
html[data-theme="dossier"] [tabindex]:focus-visible{outline:2px solid var(--amber);outline-offset:2px}

/* Masthead statyczny — przewija się razem ze stroną */
html[data-theme="dossier"] .masthead{background:rgba(236,229,211,.72);
  border-bottom:1px solid var(--line)}
html[data-theme="dossier"] .brand-mark{background:var(--panel2);border:1.5px solid var(--amber);
  box-shadow:0 0 0 1px var(--panel2),0 0 0 2.5px rgba(138,39,49,.22)}
html[data-theme="dossier"] .nav a.active{color:var(--amber);border-color:var(--amber)}
html[data-theme="dossier"] .switch{background:var(--panel);border-color:var(--line)}
html[data-theme="dossier"] .switch a.on{background:var(--panel2);color:var(--amber);box-shadow:inset 0 -2px 0 var(--amber)}
html[data-theme="dossier"] .ops-link{background:var(--panel);border-color:var(--line)}

/* Przyciski i pieczęcie */
html[data-theme="dossier"] .btn:not(.ghost){background:var(--amber);border-color:var(--amber);color:#f8f4ea}
html[data-theme="dossier"] .btn:not(.ghost):hover{background:var(--amber2);border-color:var(--amber2)}
html[data-theme="dossier"] .btn.ghost{background:transparent;color:var(--fg);border-color:var(--line)}
html[data-theme="dossier"] .btn.ghost:hover{border-color:var(--amber);color:var(--amber)}
html[data-theme="dossier"] .skip{color:#f8f4ea}
html[data-theme="dossier"] .vbadge,html[data-theme="dossier"] .src-badge,
html[data-theme="dossier"] .rm-badge,html[data-theme="dossier"] .tl-badge,
html[data-theme="dossier"] .detail-kind{border-radius:2px}

/* Kapcja aktowa nad hero */
.filing{display:flex;align-items:center;justify-content:space-between;gap:14px;
  flex-wrap:wrap;border-bottom:1px solid var(--line);
  padding:11px 2px;margin-bottom:20px;
  font:600 10px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.filing .f-no{color:var(--amber);font-weight:700}
.filing .f-ed{color:var(--dim)}

/* Pasek postępu — mosiądz i tusz, bez neonu */
html[data-theme="dossier"] .tl-track{background:linear-gradient(180deg,#e7ddc7,var(--track));
  border-color:var(--line);box-shadow:inset 0 1px 2px rgba(28,23,16,.13),0 1px 0 rgba(255,255,255,.6)}
html[data-theme="dossier"] .tl-track:after{opacity:.22;mix-blend-mode:multiply;
  background:repeating-linear-gradient(90deg,rgba(28,23,16,.2) 0 1px,transparent 1px 2.5%)}
html[data-theme="dossier"] .tl-fill{background:linear-gradient(90deg,var(--amber-deep),var(--amber) 60%,var(--amber2));
  box-shadow:inset 0 1px 0 rgba(255,255,255,.25)}
html[data-theme="dossier"] .tl-fill:before,html[data-theme="dossier"] .tl-fill:after{display:none}
html[data-theme="dossier"] .tl-mark{background:linear-gradient(180deg,transparent,var(--dim) 28%,var(--dim) 72%,transparent)}
html[data-theme="dossier"] .tl-mark:after{background:var(--panel2);border-color:var(--dim);box-shadow:0 0 0 2px var(--ink)}
html[data-theme="dossier"] .tl-mark.hit{background:linear-gradient(180deg,transparent,var(--amber) 28%,var(--amber) 72%,transparent)}
html[data-theme="dossier"] .tl-mark.hit:after{background:var(--amber);border-color:var(--amber2);box-shadow:0 0 0 2px var(--ink)}
html[data-theme="dossier"] .tl-event{background:var(--fg);box-shadow:0 0 0 2px var(--ink)}
html[data-theme="dossier"] .tl-now{background:radial-gradient(circle at 34% 28%,#fff,var(--ok) 55%,#0d5c37);
  box-shadow:0 0 0 2px var(--ink),0 0 8px rgba(31,122,77,.5);animation:none}
html[data-theme="dossier"] .tl-now:before,html[data-theme="dossier"] .tl-now:after{display:none}
html[data-theme="dossier"] .tl-clip{box-shadow:0 8px 20px rgba(28,23,16,.18),0 1px 0 rgba(255,255,255,.7) inset,0 -1px 0 rgba(28,23,16,.08) inset}
html[data-theme="dossier"] .tl-clip:hover{box-shadow:0 14px 30px rgba(28,23,16,.24),0 0 0 1px rgba(138,39,49,.2)}

/* Akta / karty */
html[data-theme="dossier"] .dossier{background:linear-gradient(180deg,var(--panel2),var(--panel));border-color:var(--line)}
html[data-theme="dossier"] .dossier:before{background:var(--amber)}
html[data-theme="dossier"] .dossier .row,html[data-theme="dossier"] .evlist li{border-color:rgba(217,207,184,.75)}
html[data-theme="dossier"] .dossier-head,html[data-theme="dossier"] .dossier-note{border-color:var(--line)}
html[data-theme="dossier"] .sfact{background:var(--panel)}
html[data-theme="dossier"] .lead,html[data-theme="dossier"] .aside-card,
html[data-theme="dossier"] .ctr,html[data-theme="dossier"] .coin,
html[data-theme="dossier"] .legal-notes,html[data-theme="dossier"] .errors{background:var(--panel);border-color:var(--line)}
html[data-theme="dossier"] .lead-side{border-color:var(--line)}
html[data-theme="dossier"] .excerpt-fold{background:var(--panel);border-color:var(--line)}
html[data-theme="dossier"] .filters input{background:var(--panel2);border-color:var(--line);color:var(--fg)}
html[data-theme="dossier"] .filters input:focus{border-color:var(--amber)}
html[data-theme="dossier"] .livebox{background:var(--panel2);border-color:var(--amber);box-shadow:0 18px 50px rgba(28,23,16,.28)}
html[data-theme="dossier"] .rm.expired .rm-badge{color:var(--warn);border-color:rgba(var(--warn-rgb),.5);
  border-style:dashed;background:rgba(var(--warn-rgb),.06)}

/* Sekcja: stan okna ustawowego */
.window{border:1px solid var(--line);background:var(--panel);position:relative}
.window:before{content:"";position:absolute;top:-1px;left:-1px;width:64px;height:3px;background:var(--amber)}
.window-grid{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--line)}
.wcell{background:var(--panel);padding:20px 22px;min-width:0}
.wchip{white-space:nowrap;flex:0 0 auto}
.wcell-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
.wcell-label{font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:var(--dim)}
html[data-theme="dossier"] .wchip{font-size:10px;letter-spacing:.08em;text-transform:uppercase;padding:3px 9px;
  border:1px solid var(--line);border-radius:2px;white-space:nowrap}
html[data-theme="dossier"] .wchip.expired{color:var(--warn);border-color:rgba(var(--warn-rgb),.5);background:rgba(var(--warn-rgb),.07)}
html[data-theme="dossier"] .wchip.open{color:var(--ok);border-color:rgba(var(--ok-rgb),.5);background:rgba(var(--ok-rgb),.07)}
.wcell-date{font-family:Georgia,serif;font-size:30px;line-height:1.1;color:var(--fg);
  font-variant-numeric:tabular-nums;margin:0 0 2px}
.wcell-count{font-size:12px;color:var(--amber);font-weight:600;margin:0 0 10px}
.wcell-body{font-size:12.5px;line-height:1.65;color:var(--muted);margin:0}
.wcell-basis{margin-top:12px;padding-top:10px;border-top:1px solid var(--line);
  font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--dim)}
.window-note{margin:0;padding:13px 22px;border-top:1px solid var(--line);
  font-size:11.5px;line-height:1.6;color:var(--muted);background:rgba(var(--amber-rgb),.04)}

/* Sekcja: scenariusze */
.scen-bar{display:flex;height:34px;border:1px solid var(--line);background:var(--panel);overflow:hidden}
.scen-seg{position:relative;height:100%;width:var(--w);min-width:0;display:flex;align-items:center;
  justify-content:center;border-right:1px solid rgba(248,244,234,.55);transition:width 1.1s cubic-bezier(.2,.75,.25,1)}
.scen-seg:last-child{border-right:0}
.scen-seg span{font:700 10px/1 ui-monospace,Menlo,monospace;color:#f8f4ea;letter-spacing:.03em;white-space:nowrap}
html[data-theme="dossier"].js .scen-seg{width:0}
html[data-theme="dossier"].js .scen-bar.in .scen-seg{width:var(--w)}
.scen-legend{display:flex;flex-wrap:wrap;gap:6px 18px;margin:11px 0 26px;font-size:11px;color:var(--muted)}
.scen-legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px;vertical-align:-1px}
.scen-grid{display:grid;grid-template-columns:1fr;gap:16px}
.scen-card{border:1px solid var(--line);background:var(--panel);
  border-left:3px solid var(--sc,var(--amber));padding:20px 24px;min-width:0}
.scen-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:8px}
.scen-rank{font:700 11px/1 ui-monospace,Menlo,monospace;color:var(--sc,var(--amber));letter-spacing:.1em}
.scen-card h3{font-family:Georgia,serif;font-size:21px;font-weight:400;margin:5px 0 0;color:var(--fg);line-height:1.25}
.scen-prob{display:flex;align-items:baseline;gap:8px;flex:0 0 auto}
.scen-prob b{font-family:Georgia,serif;font-size:30px;line-height:1;color:var(--sc,var(--amber));font-variant-numeric:tabular-nums}
.scen-prob small{font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim)}
.scen-hyp{display:inline-block;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--warn);
  border:1px dashed rgba(var(--warn-rgb),.55);padding:2px 7px;border-radius:2px;margin-bottom:10px}
.scen-desc{font-size:13px;line-height:1.7;color:var(--body2);margin:0 0 12px;max-width:820px}
.scen-meta{display:grid;grid-template-columns:1fr 1fr;gap:14px 26px;border-top:1px solid var(--line);padding-top:12px}
.scen-meta h4{font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);margin:0 0 5px}
.scen-meta p{font-size:12px;line-height:1.6;color:var(--muted);margin:0}
.scen-meta .span2{grid-column:1/-1}
.scen-meta .basis{font-size:11px;color:var(--dim)}
.scen-foot{display:grid;grid-template-columns:1fr 1fr;gap:26px;margin-top:24px;border-top:1px solid var(--line);padding-top:20px}
.scen-foot h3{font-family:Georgia,serif;font-size:18px;font-weight:400;margin:0 0 7px;color:var(--fg)}
.scen-foot p{font-size:12px;line-height:1.7;color:var(--muted);margin:0}

/* Ujawnianie przy scrollu — tylko gdy JS działa (klasa .js), inaczej treść widoczna */
html[data-theme="dossier"].js .reveal{opacity:0;transform:translateY(14px);
  transition:opacity .6s ease,transform .6s cubic-bezier(.2,.75,.25,1)}
html[data-theme="dossier"].js .reveal.in{opacity:1;transform:none}
html[data-theme="dossier"] .read-progress{position:fixed;top:0;left:0;height:2px;width:0;background:var(--amber);z-index:60}
@media(prefers-reduced-motion:reduce){
  html[data-theme="dossier"].js .reveal{opacity:1;transform:none;transition:none}
  .scen-seg{transition:none}

}
@media(max-width:920px){
  .window-grid{grid-template-columns:1fr}
  .scen-meta,.scen-foot{grid-template-columns:1fr}
  .scen-foot{gap:18px}
}
@media(max-width:640px){
  html[data-theme="dossier"] .masthead{position:static;padding-block:12px}
  html[data-theme="dossier"] .section,html[data-theme="dossier"] .shero{scroll-margin-top:20px}
  .filing{font-size:9px;gap:8px}
  .wcell{padding:16px}
  .wcell-date{font-size:25px}
  .scen-card{padding:16px}
  .scen-prob b{font-size:25px}
  .scen-bar{height:28px}
  .scen-seg span{font-size:8.5px}
  .scen-seg.tiny span{display:none}
}
`;

/** Wspólny przedrostek adresu: zachowuje język i motyw w linkach i przy udostępnianiu. */
function pref(l, th) {
  const params = [];
  if (l !== 'pl') params.push(`lang=${l}`);
  if (th !== 'editorial') params.push(`theme=${th}`);
  return params.length ? `?${params.join('&')}` : '';
}

export function masthead(lang = 'pl', theme = 'editorial') {
  const l = normalizeLang(lang);
  const th = normalizeTheme(theme);
  const home = `/${pref(l, th)}`;
  // Przełączniki muszą podać wartość jawnie — inaczej cookie trzyma stary wybór.
  const full = (lg, tm) => `/?lang=${lg}&theme=${tm}`;
  return `
<header class="wrap masthead">
  <a class="brand" href="${home}">
    <span class="brand-mark" aria-hidden="true">M</span>
    <span class="brand-name">${esc(t(l, 'brand.name'))}<small>${esc(t(l, 'brand.sub'))}</small></span>
  </a>
  <div class="nav-wrap">
  <nav class="nav" aria-label="${esc(t(l, 'nav.aria'))}">
    <a href="${home}#sprawa">${esc(t(l, 'nav.case'))}</a>
    <a href="${home}#co-nowego">${esc(t(l, 'nav.latest'))}</a>
    <a href="${home}#procedura">${esc(t(l, 'nav.procedure'))}</a>
    ${th === 'dossier' ? `<a href="${home}#scenariusze">${esc(t(l, 'nav.scenarios'))}</a>` : ''}
    <a href="${home}#wiemy">${esc(t(l, 'nav.know'))}</a>
    <a href="${home}#os-czasu">${esc(t(l, 'nav.timeline'))}</a>
    <a href="${home}#sprzecznosci">${esc(t(l, 'nav.contradictions'))}</a>
    <a href="${home}#rynek">${esc(t(l, 'nav.market'))}</a>
    <a href="${home}#archiwum">${esc(t(l, 'nav.archive'))}</a>
    <a href="${home}#metodologia">${esc(t(l, 'nav.method'))}</a>
  </nav>
  </div>
  <div class="switches">
    <div class="switch" role="group" aria-label="${esc(t(l, 'lang.label'))}">
      <a class="${l === 'pl' ? 'on' : ''}" href="${full('pl', th)}"${l === 'pl' ? ' aria-current="true"' : ''}>PL</a>
      <a class="${l === 'en' ? 'on' : ''}" href="${full('en', th)}"${l === 'en' ? ' aria-current="true"' : ''}>EN</a>
    </div>
    <div class="switch" role="group" aria-label="${esc(t(l, 'theme.label'))}">
      <a class="${th === 'editorial' ? 'on' : ''}" href="${full(l, 'editorial')}"${th === 'editorial' ? ' aria-current="true"' : ''}>${esc(t(l, 'theme.editorial'))}</a>
      <a class="${th === 'pulse' ? 'on' : ''}" href="${full(l, 'pulse')}"${th === 'pulse' ? ' aria-current="true"' : ''}>${esc(t(l, 'theme.pulse'))}</a>
      <a class="${th === 'spectrum' ? 'on' : ''}" href="${full(l, 'spectrum')}"${th === 'spectrum' ? ' aria-current="true"' : ''}>${esc(t(l, 'theme.spectrum'))}</a>
      <a class="${th === 'dossier' ? 'on' : ''}" href="${full(l, 'dossier')}"${th === 'dossier' ? ' aria-current="true"' : ''}>${esc(t(l, 'theme.dossier'))}</a>
    </div>
  </div>
  <a class="ops-link" href="/ops">${esc(t(l, 'nav.panel'))}</a>
</header>`;
}

export function footer(lang = 'pl', extra = '', theme = 'editorial') {
  const l = normalizeLang(lang);
  const th = normalizeTheme(theme);
  const home = `/${pref(l, th)}`;
  return `
<footer class="wrap">
  <p><strong>${esc(t(l, 'footer.disclaimer.label'))}</strong> ${esc(t(l, 'footer.disclaimer'))}</p>
  <p>${esc(t(l, 'footer.independence'))}</p>
  ${extra}
  <div class="foot-eco" aria-label="${esc(t(l, 'eco.label'))}">
    <span class="foot-eco-label">${esc(t(l, 'eco.label'))}</span>
    ${[['hex.png', 'HEX'], ['pulsechain.png', 'PulseChain'], ['pulsex.jpg', 'PulseX'], ['dai-on-pulsechain.png', 'pDAI'], ['pulsechain-peacock.png', 'Peacock']].map(([f, s]) => `<span class="eco-chip"><img src="/logos/${f}" alt="" width="16" height="16" loading="lazy" decoding="async">${s}</span>`).join('')}
  </div>
  <nav class="foot-nav" aria-label="${esc(t(l, 'footer.method'))}">
    <a href="${home}#metodologia">${esc(t(l, 'footer.method'))}</a>
    <a href="${home}#archiwum">${esc(t(l, 'footer.archive'))}</a>
    <a href="${home}#sprzecznosci">${esc(t(l, 'footer.errors'))}</a>
    <a href="/api/items">API</a>
    <a href="/ops">${esc(t(l, 'footer.panel'))}</a>
  </nav>
  <p>${t(l, 'footer.copyright', { year: new Date().getFullYear(), updated: CONTENT_UPDATED })}</p>
</footer>`;
}

// Data ręcznej aktualizacji warstwy faktów (src/facts.js).
export const CONTENT_UPDATED = '15.11.2026';

export function page({
  title, description, body, noIndex = false, extraHead = '', lang = 'pl', theme = 'pulse', live = false,
}) {
  const l = normalizeLang(lang);
  const th = normalizeTheme(theme);
  const liveAttrs = live
    ? ` data-live-since="${Date.now()}" data-live-lang="${l}" data-live-new="${esc(t(l, 'live.new'))}"`
      + ` data-live-more="${esc(t(l, 'live.more'))}" data-live-open="${esc(t(l, 'live.open'))}"`
      + ` data-live-close="${esc(t(l, 'live.close'))}" data-live-pl="${esc(t(l, 'live.summary_pl'))}"`
      + ` data-live-en="${esc(t(l, 'live.summary_en'))}" data-live-social="${esc(t(l, 'live.social'))}"`
    : '';
  return `<!doctype html>
<html lang="${l}" data-theme="${th}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%230b0c0e'/%3E%3Ctext x='16' y='23' font-family='Georgia,serif' font-size='20' fill='%23f7b23b' text-anchor='middle'%3EM%3C/text%3E%3C/svg%3E">
<meta name="theme-color" content="${{ pulse: '#120e15', spectrum: '#120d1a', dossier: '#ece5d3' }[th] || '#0b0c0e'}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:locale" content="${l === 'en' ? 'en_GB' : 'pl_PL'}">
${noIndex ? '<meta name="robots" content="noindex,nofollow">' : '<meta name="robots" content="index,follow">'}
<style>${PAGE_CSS}</style>
${extraHead}
</head>
<body${liveAttrs}>
<a class="skip" href="#tresc">${esc(t(l, 'skip'))}</a>
${masthead(l, th)}
<main id="tresc">
${body}
</main>
${footer(l, '', th)}
${live ? '<script src="/live.js" defer></script><script src="/auto.js" defer></script>' : ''}
<script src="/countdown.js" defer></script>
${th === 'dossier' ? '<script src="/dossier.js" defer></script>' : ''}
</body>
</html>`;
}

export function notFoundPage(lang = 'pl', theme = 'pulse') {
  const l = normalizeLang(lang);
  const th = normalizeTheme(theme);
  return page({
    lang: l,
    theme: th,
    title: t(l, 'notfound.title'),
    description: t(l, 'notfound.desc'),
    noIndex: true,
    body: `<div class="wrap notfound"><p class="kicker">404</p><h1>${esc(t(l, 'notfound.h'))}</h1>
    <p><a class="btn ghost" href="/?lang=${l}&theme=${th}">${esc(t(l, 'notfound.back'))}</a></p></div>`,
  });
}
