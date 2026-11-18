import { CONFIG } from './config.js';
import { logNotification } from './db.js';
import { checkClaims, CASE_STATUS, CASE_DISCLAIMER, redactPrivate } from './facts.js';

const COLOR = {
  critical: 0xd93025,   // zatrzymanie / aresztowanie / nowy komunikat oficjalny
  high: 0xf9ab00,       // rozwój sprawy, decyzja procesowa
  normal: 0x1d9bf0,     // zwykły news
};

function severityFor(item) {
  const t = `${item.title} ${item.text || ''}`.toLowerCase();
  if (/zatrzyman|zatrzymany|gözalt|gozalt|detain|red notice|czerwona nota/.test(t)) return 'critical';
  if (/sąd|sad|court|trial|hearing|charges|oskarz|eskort|transfer|przekaz|release|zwoln|indict|deport/.test(t)) return 'high';
  return 'normal';
}

/** Discord liczy łączną długość embeda; przycinamy opcjonalne pola. */
function fitEmbed(embed) {
  const len = (s) => String(s || '').length;
  const total = () =>
    len(embed.title) + len(embed.description) + len(embed.footer?.text) +
    embed.fields.reduce((n, f) => n + len(f.name) + len(f.value), 0);

  while (total() > 5800 && embed.fields.length > 2) {
    // Usuwamy najpierw mniej istotne pola z końca (np. EN / dopasowanie).
    embed.fields.pop();
  }
  if (total() > 5800 && embed.description) {
    embed.description = embed.description.slice(0, Math.max(0, 5800 - (total() - len(embed.description))));
  }
  return embed;
}

/** Discord przyjmuje w `url` tylko http/https; inne scheme pomijamy. */
function embedUrl(raw) {
  try {
    const u = new URL(String(raw || ''));
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.toString();
  } catch { /* niepoprawny URL */ }
  return undefined;
}

function buildEmbed(item, summary) {
  const sev = severityFor(item);
  const rawTitle = redactPrivate(item.title_pl || item.title);
  const title = rawTitle.length > 250 ? rawTitle.slice(0, 247) + '…' : rawTitle;

  // Data publikacji artykułu — Discord pokazuje czas wysłania wiadomości,
  // więc bez tego pola czytelnik widzi błędną datę. Strona bez metadanej
  // publikacji (np. rejestr) nie może udawać świeżego artykułu.
  const hasPublishedAt = Boolean(item.publishedAt);
  const pubTs = item.publishedAt || item.firstSeenAt;

  const fields = [];
  fields.push({
    name: '📋 Stan sprawy',
    value: `${CASE_STATUS.statusShort} · brak publicznej decyzji sądu · brak wyroku (stan ${CASE_STATUS.statusAsOf})`,
    inline: false,
  });
  if (summary.pl) {
    fields.push({ name: '📌 Streszczenie materiału (PL)', value: redactPrivate(summary.pl).slice(0, 800), inline: false });
  }
  if (summary.en) {
    fields.push({ name: '🇬🇧 Summary (EN)', value: redactPrivate(summary.en).slice(0, 600), inline: false });
  }
  fields.push({ name: 'Źródło', value: `${item.sourceLabel}`.slice(0, 1024), inline: true });
  fields.push({
    name: hasPublishedAt ? '📅 Data publikacji' : '🕒 Wykryto',
    value: `<t:${Math.floor(pubTs / 1000)}:f> · <t:${Math.floor(pubTs / 1000)}:R>`,
    inline: true,
  });

  // Warstwa weryfikacji faktów: oznacza błędy redakcyjne i twierdzenia
  // wymagające atrybucji, żeby czytelnik nie wziął nagłówka za fakt.
  const check = checkClaims(`${item.title} ${item.text || ''}`);
  if (check.flags.length) {
    const errors = check.flags.filter((f) => f.kind === 'error');
    const claims = check.flags.filter((f) => f.kind === 'claimed');
    if (claims.length) {
      fields.push({
        name: '⚠️ Twierdzenie wymaga atrybucji',
        value: claims.map((f) => `• ${f.label}: ${f.note}`).join('\n').slice(0, 1024),
        inline: false,
      });
    }
    if (errors.length) {
      fields.push({
        name: '🚩 Błąd / nieścisłość w materiale',
        value: errors.map((f) => `• ${f.label}: ${f.note}`).join('\n').slice(0, 1024),
        inline: false,
      });
    }
  }

  return fitEmbed({
    title: `[MATERIAŁ ŹRÓDŁOWY] ${title}`.slice(0, 256),
    url: embedUrl(item.url),
    color: COLOR[sev],
    description: (summary.pl ? '' : redactPrivate((item.text || '').slice(0, 400))) || undefined,
    fields,
    footer: {
      text: `${CASE_DISCLAIMER} Monitor nie jest stroną postępowania.`.slice(0, 2048),
    },
    // Timestamp w embedzie = data publikacji artykułu (nie czas wysłania).
    timestamp: new Date(pubTs).toISOString(),
  });
}

/** Zapis do lokalnego audytu nie może przewrócić udanej wysyłki. */
function audit(itemId, channel, status, detail = null) {
  try {
    logNotification(itemId, channel, status, detail);
  } catch (e) {
    console.error('[discord] audit log error:', e.message);
  }
}

/**
 * Wysyła powiadomienie na Discord webhook.
 * @returns {Promise<{ok:boolean, status?:number, error?:string}>}
 */
export async function notify(item, summary) {
  const url = CONFIG.discord.webhookUrl;
  if (!url) {
    audit(item.id, 'discord', 'skipped', 'brak DISCORD_WEBHOOK_URL');
    return { ok: false, error: 'brak DISCORD_WEBHOOK_URL' };
  }

  let payload;
  try {
    const embed = buildEmbed(item, summary);
    payload = {
      username: 'Monitor Schueler',
      embeds: [embed],
      allowed_mentions: { parse: [] },
    };
  } catch (e) {
    // Zły timestamp w bazie nie może zablokować kolejki powiadomień.
    const detail = `buildEmbed: ${String(e?.message || e).slice(0, 150)}`;
    audit(item.id, 'discord', 'error', detail);
    return { ok: false, error: detail };
  }
  if (CONFIG.discord.channelHint) payload.content = CONFIG.discord.channelHint;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text().catch(() => '');
    if (!res.ok) {
      const detail = `HTTP ${res.status}: ${text.slice(0, 200)}`;
      audit(item.id, 'discord', 'error', detail);
      return { ok: false, error: detail };
    }
    audit(item.id, 'discord', 'sent', null);
    return { ok: true, status: res.status };
  } catch (e) {
    const detail = String(e?.message || e).slice(0, 200);
    audit(item.id, 'discord', 'error', detail);
    return { ok: false, error: detail };
  }
}

/** Wysyła dzienny digest jako zwykłą wiadomość (limit 2000 znaków). */
export async function sendDigest(text) {
  const url = CONFIG.discord.webhookUrl;
  if (!url) return { ok: false, error: 'brak DISCORD_WEBHOOK_URL' };
  const content = String(text || '').slice(0, 1950);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Monitor Schueler',
        content,
        allowed_mentions: { parse: [] },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true, status: res.status };
  } catch (e) {
    return { ok: false, error: String(e?.message || e).slice(0, 200) };
  }
}

/** Wysyla test powiadomienia (do weryfikacji kanalu). */
export async function sendTest() {
  const url = CONFIG.discord.webhookUrl;
  if (!url) return { ok: false, error: 'brak DISCORD_WEBHOOK_URL' };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Monitor Schueler',
        embeds: [{
          title: '✅ Monitor sprawy Schuelera — test połączenia',
          description: 'Kanał działa poprawnie. Od tej chwili trafią tu nowe informacje o sprawie Richarda Jamesa Schuelera (Richard Heart, HEX / PulseChain).',
          color: 0x1d9bf0,
          footer: { text: 'Monitor sprawy Schueler' },
        }],
        allowed_mentions: { parse: [] },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}` };
    return { ok: true, status: res.status };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}
