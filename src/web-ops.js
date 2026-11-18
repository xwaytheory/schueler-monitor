import { CONFIG } from './config.js';
import { esc, fmtDateTime, relTime, page, cleanTitle } from './web-ui.js';

const OPS_CSS = `
.ops-top{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;
  padding-block:36px 22px;border-bottom:1px solid var(--line);flex-wrap:wrap}
.ops-top h1{font-family:Georgia,serif;font-weight:400;font-size:40px;margin:0;color:var(--fg)}
.ops-sub{color:var(--muted);font-size:12px;margin:6px 0 0}
.flash{padding:11px 14px;border:1px solid var(--ok);background:rgba(var(--ok-rgb),.08);
  color:var(--ok);font-size:12px;margin:18px 0}
.flash.err{border-color:var(--bad);background:rgba(var(--bad-rgb),.08);color:var(--bad)}
.ops-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));gap:10px;margin:22px 0}
.stat{border:1px solid var(--line);background:var(--panel);padding:13px 15px}
.stat b{display:block;font-family:Georgia,serif;font-size:26px;font-weight:400;color:var(--fg);line-height:1.2}
.stat span{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted)}
.ops-grid{display:grid;grid-template-columns:1.2fr .8fr;gap:18px;align-items:start}
.panel{border:1px solid var(--line);background:var(--panel);padding:17px 19px;margin-bottom:18px}
.panel h2{font-family:Georgia,serif;font-size:20px;font-weight:400;margin:0 0 12px;color:var(--fg)}
.panel h2 .hint{font-family:system-ui,sans-serif;font-size:10px;color:var(--dim);letter-spacing:0;margin-left:8px}
.actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.dim{color:var(--dim);font-size:11px;margin:9px 0 0}
.pill{display:inline-block;font-size:9px;text-transform:uppercase;letter-spacing:.07em;
  padding:2px 7px;border:1px solid var(--line);color:var(--muted)}
.pill.sent{color:var(--ok);border-color:rgba(var(--ok-rgb),.4)}
.pill.error{color:var(--bad);border-color:rgba(var(--bad-rgb),.4)}
.pill.warn{color:var(--warn);border-color:rgba(var(--warn-rgb),.4)}
.ops-table{width:100%;border-collapse:collapse;font-size:11px}
.ops-table th,.ops-table td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top}
.ops-table th{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--dim);font-weight:600}
.ops-table td{color:var(--muted)}
.ops-table td b{color:var(--fg);font-weight:600}
.ops-table .err{color:var(--bad);word-break:break-word}
.ops-table a{color:var(--muted)}
.queue-item{padding:8px 0;border-bottom:1px solid var(--line);font-size:12px}
.queue-item:last-child{border-bottom:0}
.queue-item .t{color:var(--fg);display:block;line-height:1.4}
.queue-item .m{font-size:10px;color:var(--dim);margin-top:2px}
.warnbox{border-left:2px solid var(--warn);background:rgba(var(--warn-rgb),.06);padding:10px 13px;
  font-size:11px;line-height:1.6;color:var(--muted);margin:10px 0 0}
.login{max-width:460px;margin:70px auto 90px;border:1px solid var(--line);background:var(--panel);padding:28px 30px}
.login h1{font-family:Georgia,serif;font-weight:400;font-size:30px;margin:0 0 8px}
.login p{font-size:12px;color:var(--muted);line-height:1.65}
.login label{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin:16px 0 5px}
.login input{width:100%;background:var(--ink);border:1px solid var(--line);color:var(--fg);
  padding:10px 12px;font:inherit;border-radius:0}
.login input:focus{outline:none;border-color:var(--amber)}
.login code{background:var(--ink);border:1px solid var(--line);padding:1px 5px;font-size:11px;color:var(--amber)}
@media(max-width:900px){.ops-grid{grid-template-columns:1fr}}
`;

function renderLogin({ configured, error }) {
  const body = !configured
    ? `<div class="login">
        <p class="kicker">Panel redakcyjny</p>
        <h1>Najpierw ustaw token</h1>
        <p>Panel operacyjny jest wyłączony, dopóki nie ustawisz <code>ADMIN_TOKEN</code>.
        Dodaj go do pliku <code>.env</code> i uruchom proces ponownie:</p>
        <p><code>ADMIN_TOKEN=wybierz-długi-losowy-token</code></p>
        <p>Bez tokena nie można uruchomić skanu ręcznego ani wysłać testu na Discorda.
        Automatyczny skan działa niezależnie.</p>
        <p><a class="btn ghost" href="/">← Strona publiczna</a></p>
      </div>`
    : `<div class="login">
        <p class="kicker">Panel redakcyjny</p>
        <h1>Dostęp ograniczony</h1>
        <p>Podaj token administratora. Sesja jest podpisana po stronie serwera
        i wygasa po 12 godzinach.</p>
        ${error ? `<p class="flash err">${esc(error)}</p>` : ''}
        <form method="post" action="/ops/login">
          <label for="token">Token administratora</label>
          <input id="token" name="token" type="password" autocomplete="current-password"
            maxlength="200" required>
          <p style="margin-top:14px"><button class="btn" type="submit">Wejdź</button></p>
        </form>
        <p style="margin-top:18px"><a href="/">← Strona publiczna</a></p>
      </div>`;
  return page({
    title: 'Panel redakcyjny — Monitor sprawy Schuelera',
    description: 'Dostęp ograniczony.',
    noIndex: true,
    extraHead: `<style>${OPS_CSS}</style>`,
    body,
  });
}

export function renderOpsLogin(opts = {}) {
  return renderLogin({
    configured: Boolean(CONFIG.adminToken),
    error: opts.error ? String(opts.error) : '',
  });
}

export function renderOps(data) {
  const { state, srcState, stats, notifications, pending, flash, flashError, market } = data;
  const statusPl = { sent: 'wysłano', error: 'błąd', skipped: 'pominięto' };
  const statusLabel = (s) => statusPl[s] || String(s || '');

  const okSources = stats.sourcesOk;
  const sourceRows = [...srcState].sort((a, b) => {
    const af = a.last_error ? 1 : 0;
    const bf = b.last_error ? 1 : 0;
    return bf - af || String(a.source).localeCompare(String(b.source));
  }).map((s) => {
    const status = s.last_error
      ? '<span class="pill error">błąd</span>'
      : s.last_ok_at
        ? '<span class="pill sent">OK</span>'
        : '<span class="pill warn">oczekuje</span>';
    return `
    <tr>
      <td><b>${esc(s.source)}</b></td>
      <td>${s.last_ok_at ? esc(relTime(s.last_ok_at)) : 'nigdy'}</td>
      <td>${Number(s.last_count ?? 0)}</td>
      <td>${Number(s.consecutive_failures ?? 0) || '—'}</td>
      <td>${s.last_error ? `<span class="pill error">błąd</span> <span class="err">${esc(String(s.last_error).slice(0, 120))}</span>` : status}</td>
    </tr>`;
  }).join('');

  const notifRows = notifications.map((n) => {
    const title = n.item_title ? cleanTitle(n.item_title) : '';
    const shown = title.length > 160 ? `${title.slice(0, 160)}…` : title;
    const item = !title
      ? '<span class="dim">—</span>'
      : n.item_suppressed
        ? `<span class="dim">${esc(shown)}</span> <span class="pill warn">wycofany</span>`
        : `<a href="/item/${encodeURIComponent(n.item_id)}">${esc(shown)}</a>`;
    return `
    <tr>
      <td>${esc(fmtDateTime(n.created_at))}</td>
      <td><span class="pill ${n.status === 'sent' ? 'sent' : n.status === 'error' ? 'error' : ''}">${esc(statusLabel(n.status))}</span></td>
      <td>${item}
        ${n.detail ? `<span class="err">${esc(String(n.detail).slice(0, 120))}</span>` : ''}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="3">brak</td></tr>';

  const queue = pending.map((p) => `
    <div class="queue-item">
      <span class="t">${esc(cleanTitle(p.title))}</span>
      <span class="m">${esc(p.source_label)} · próby: ${Number(p.notify_attempts ?? 0)} · ${esc(fmtDateTime(p.published_at || p.first_seen_at))}</span>
    </div>`).join('') || '<p class="dim">Kolejka pusta — wszystko wysłane albo celowo pominięte.</p>';

  const warnings = [
    !CONFIG.discord.webhookUrl ? 'Brak DISCORD_WEBHOOK_URL — powiadomienia nie są wysyłane, a kolejka rośnie.' : '',
    !CONFIG.adminToken ? 'Brak ADMIN_TOKEN — ten panel jest niedostępny.' : '',
    CONFIG.adminToken && CONFIG.adminToken.length < 16
      ? 'ADMIN_TOKEN jest krótki — użyj co najmniej 16 losowych znaków.'
      : '',
    !CONFIG.ai.openrouterKey ? 'Brak OPENROUTER_API_KEY — streszczenia AI korzystają z darmowego fallbacku.' : '',
  ].filter(Boolean);

  return page({
    title: 'Panel operacyjny — Monitor sprawy Schuelera',
    description: 'Panel operacyjny monitora.',
    noIndex: true,
    extraHead: `<style>${OPS_CSS}</style>`,
    body: `
<div class="wrap">
  <div class="ops-top">
    <div>
      <p class="kicker">Panel redakcyjny</p>
      <h1>Operacje</h1>
      <p class="ops-sub">Ostatni skan: ${state.lastRunAt ? `${esc(fmtDateTime(state.lastRunAt))} (${esc(relTime(state.lastRunAt))})` : '—'}
        ${state.running ? ' · skan trwa' : ''}
        ${state.lastRunMs != null ? ` · ${Math.round(state.lastRunMs / 1000)} s` : ''}
        · błąd: ${state.lastError ? esc(state.lastError) : 'brak'}</p>
    </div>
    <a class="btn ghost" href="/">← Strona publiczna</a>
  </div>

  ${flash ? `<div class="flash ${flashError ? 'err' : ''}">${esc(flash)}</div>` : ''}

  <div class="ops-stats">
    <div class="stat"><b>${stats.total}</b><span>Wpisy razem</span></div>
    <div class="stat"><b>${stats.unnotified}</b><span>W kolejce</span></div>
    <div class="stat"><b>${stats.sent}</b><span>Wysłane</span></div>
    <div class="stat"><b>${stats.failed}</b><span>Nieudane wysyłki</span></div>
    <div class="stat"><b>${stats.suppressed}</b><span>Pominięte celowo</span></div>
    <div class="stat"><b>${okSources}/${stats.sourcesTotal}</b><span>Źródła OK</span></div>
  </div>

  <div class="ops-grid">
    <div>
      <div class="panel">
        <h2>Ręczne akcje <span class="hint">limit: skan 60 s, test 30 s</span></h2>
        <div class="actions">
          <form method="post" action="/scan"><button class="btn" type="submit">Uruchom skan</button></form>
          <form method="post" action="/test"><button class="btn ghost" type="submit">Wyślij test</button></form>
        </div>
        <p class="dim">Skan ręczny działa w tle tak samo jak cykliczny: zbiera, deduplikuje,
        streszcza i wysyła powiadomienia w granicach limitu dobowego.</p>
      </div>

      <div class="panel">
        <h2>Kolejka powiadomień <span class="hint">${pending.length < stats.unnotified ? `${pending.length} z ${stats.unnotified}` : pending.length} oczekujących</span></h2>
        ${queue}
      </div>
    </div>

    <div>
      <div class="panel">
        <h2>Konfiguracja</h2>
        <table class="ops-table">
          <tr><td>Discord</td><td>${CONFIG.discord.webhookUrl ? '<span class="pill sent">webhook ustawiony</span>' : '<span class="pill error">brak</span>'}</td></tr>
          <tr><td>AI</td><td>${CONFIG.ai.openrouterKey ? 'OpenRouter' : 'fallback (pollinations)'}</td></tr>
          <tr><td>Rynek</td><td>${market?.updatedAtMs ? esc(fmtDateTime(market.updatedAtMs)) : 'brak danych'}</td></tr>
          <tr><td>Interwał</td><td>${CONFIG.scanIntervalSec} s</td></tr>
          <tr><td>Limit dzienny</td><td>${CONFIG.maxNotificationsPerDay}</td></tr>
          <tr><td>Bootstrap</td><td>${CONFIG.bootstrapLookbackHours} h / ${CONFIG.bootstrapNotifyLimit} powiadomień</td></tr>
          <tr><td>Token panelu</td><td>${CONFIG.adminToken ? 'ustawiony' : '<span class="pill error">brak</span>'}</td></tr>
        </table>
        ${warnings.map((w) => `<div class="warnbox">${esc(w)}</div>`).join('')}
      </div>

      <div class="panel">
        <h2>Ostatnie powiadomienia <span class="hint">20 najnowszych</span></h2>
        <div class="table-wrap">
          <table class="ops-table">
            <thead><tr><th>Kiedy</th><th>Status</th><th>Wpis / szczegóły</th></tr></thead>
            <tbody>${notifRows}</tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <div class="panel">
    <h2>Źródła <span class="hint">${srcState.length} rekordów</span></h2>
    <div class="table-wrap">
      <table class="ops-table">
        <thead><tr><th>Źródło</th><th>Ostatni sukces</th><th>Pozycje</th><th>Błędy z rzędu</th><th>Status</th></tr></thead>
        <tbody>${sourceRows || '<tr><td colspan="5">brak danych — uruchom skan</td></tr>'}</tbody>
      </table>
    </div>
  </div>
</div>`,
  });
}
