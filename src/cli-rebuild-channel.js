/**
 * Odtwarza kanał Discorda w kolejnosci chronologicznej
 * (najstarsza na gorze, najnowsza na dole).
 *
 * Discord nie pozwala przenosic wiadomosci z webhookow miedzy kanalami,
 * a nie pozwala tez zmienic ich kolejnosci wewnatrz kanału. Jedyna droga:
 *   1. pobrac tresc wszystkich wiadomosci (embedy),
 *   2. usunac je,
 *   3. opublikowac ponownie w kolejnosci rosnacej
 *      (kazda nowa wiadomosc ląduje na dole kanału).
 */
import { CONFIG } from './config.js';

const API = 'https://discord.com/api/v10';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(token, method, path, body) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const res = await fetch(API + path, {
      method,
      headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* nie-JSON */ }
    if (res.ok) return json;
    if (res.status === 429) {
      const wait = Number(res.headers.get('retry-after') || json?.retry_after || 2);
      console.log(`  rate limit - czekam ${wait}s`);
      await sleep((wait + 0.5) * 1000);
      continue;
    }
    const err = new Error(json?.message || text.slice(0, 200) || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  throw new Error('rate limit: przekroczono liczbe prob');
}

const token = CONFIG.discord.botToken;
const webhookUrl = CONFIG.discord.webhookUrl;
if (!token || !webhookUrl) {
  console.error('Brak DISCORD_BOT_TOKEN lub DISCORD_WEBHOOK_URL');
  process.exit(1);
}

const channelId = process.argv[2];
if (!channelId) {
  console.error('Uzycie: node src/cli-rebuild-channel.js <channel_id>');
  process.exit(1);
}

/**
 * Wczytuje wpisy, ktore kiedys zostaly powiadomione, z archiwum bazy.
 * Zrodlem prawdy jest tabela `notifications` (historia wysylek) - flaga
 * `items.notified` mozna zresetowac, historia wysylek nie.
 */
async function loadArchive() {
  const { db } = await import('./db.js');
  const rows = db.prepare(`
    SELECT i.id, i.source_label, i.title, i.url, i.published_at, i.first_seen_at,
           i.summary_pl, i.summary_en, i.matched_terms,
           MIN(n.created_at) AS sent_at
    FROM notifications n
    JOIN items i ON i.id = n.item_id
    WHERE n.status='sent'
    GROUP BY i.id
    ORDER BY MIN(n.created_at) ASC
  `).all();
  db.close();
  return rows.map((r) => ({
    id: r.id,
    sourceLabel: r.source_label,
    title: r.title,
    url: r.url,
    // Kolejnosc wg kiedy wyslano, ale data w embedzie to data artykulu.
    time: r.sent_at,
    articleTime: r.published_at || r.first_seen_at,
    summaryPl: r.summary_pl,
    summaryEn: r.summary_en,
    matchedTerms: r.matched_terms ? JSON.parse(r.matched_terms) : [],
  }));
}

// 1. Pobierz wszystkie wiadomosci.
const all = [];
let before;
for (let i = 0; i < 30; i++) {
  const q = new URLSearchParams({ limit: '100' });
  if (before) q.set('before', before);
  const page = await api(token, 'GET', `/channels/${channelId}/messages?${q}`);
  if (!page.length) break;
  all.push(...page);
  if (page.length < 100) break;
  before = page[page.length - 1].id;
  await sleep(300);
}
console.log(`pobrano ${all.length} wiadomosci`);

// 1a. Rezerwa z archiwum bazy: po nieudanym odtworzeniu czesc wiadomosci
//     mogla zniknac. Archiwum jest zrodlem prawdy, wiec korzystamy z niego.
const archive = await loadArchive();
console.log(`archiwum bazy: ${archive.length} powiadomionych wpisow`);

// 2. Zbuduj liste do odtworzenia: tresc z kanalu + uzupelnienie z archiwum.
//    Kolejnosc chronologiczna (najstarsza najpierw).
const seen = new Set();
const chrono = [];

// Mapa tytul -> data artykulu z archiwum (do odtworzenia pola "Kiedy").
const articleTimeByTitle = new Map();
for (const a of archive) {
  const k = (a.title || '').slice(0, 120);
  if (k && !articleTimeByTitle.has(k)) articleTimeByTitle.set(k, a.articleTime);
}

for (const m of [...all].sort((a, b) => a.timestamp.localeCompare(b.timestamp))) {
  const embeds = (m.embeds || []).map((e) => ({
    title: e.title,
    description: e.description,
    url: e.url,
    color: e.color,
    fields: (e.fields || []).map((f) => ({ name: f.name, value: f.value, inline: f.inline })),
    footer: e.footer ? { text: e.footer.text } : undefined,
    timestamp: e.timestamp,
    author: e.author?.name ? { name: e.author.name } : undefined,
  })).filter((e) => e.title || e.description || (e.fields && e.fields.length));

  if (!embeds.length && !(m.content && m.content.length)) continue;
  const key = (embeds[0]?.title || m.content || '').slice(0, 120);
  if (seen.has(key)) continue;
  seen.add(key);
  chrono.push({
    embeds,
    content: m.content && m.content.length ? m.content : undefined,
    time: m.timestamp,
    // Data artykulu z archiwum (jesli jest) - do odtworzenia pola "Kiedy".
    articleTime: articleTimeByTitle.get(key) || m.timestamp,
  });
}

// Uzupelnienie z archiwum bazy - po to, aby nie zgubic wpisow,
// ktore nie przetrwaly poprzedniej proby odtworzenia.
for (const a of archive) {
  const key = (a.title || '').slice(0, 120);
  if (!key || seen.has(key)) continue;
  seen.add(key);

  const fields = [];
  if (a.summaryPl) fields.push({ name: '📌 Co to znaczy (PL)', value: a.summaryPl.slice(0, 1024), inline: false });
  if (a.summaryEn) fields.push({ name: '🇬🇧 Summary (EN)', value: a.summaryEn.slice(0, 1024), inline: false });
  if (a.matchedTerms?.length) {
    fields.push({ name: '🔎 Dopasowanie', value: a.matchedTerms.slice(0, 12).join(' · ').slice(0, 1024), inline: true });
  }
  fields.push({ name: 'Źródło', value: a.sourceLabel, inline: true });
  // Pola dat - pokazuja date publikacji artykulu, nie date wyslania.
  const unix = Math.floor(a.articleTime / 1000);
  const d = new Date(a.articleTime);
  const pl = new Intl.DateTimeFormat('pl-PL', {
    timeZone: 'Europe/Warsaw',
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(d);
  const dm = new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', day: '2-digit', month: '2-digit' }).format(d);
  fields.push({ name: '📅 Data publikacji', value: `${pl} (${dm})`, inline: true });
  fields.push({ name: 'Kiedy', value: `<t:${unix}:f> (<t:${unix}:R>)`, inline: true });

  chrono.push({
    embeds: [{
      title: (a.title || '').slice(0, 250),
      url: a.url || undefined,
      color: 0x1d9bf0,
      fields,
      footer: { text: 'Monitor sprawy Schueler — Richard Heart / HEX / PulseChain' },
      timestamp: new Date(a.articleTime).toISOString(),
    }],
    time: new Date(a.time).toISOString(),
    articleTime: a.articleTime,
  });
}

chrono.sort((a, b) => String(a.time).localeCompare(String(b.time)));
console.log(`do odtworzenia: ${chrono.length} wiadomosci (z kanalu + archiwum)`);

// 3. Usun stare wiadomosci (od najnowszych, zeby rate limit nie przeszkadzal).
console.log('usuwanie starych wiadomosci...');
for (const m of all) {
  await api(token, 'DELETE', `/channels/${channelId}/messages/${m.id}`);
  await sleep(120);
  process.stdout.write('.');
}
console.log('\nwyczyszczono kanal');

// 4. Publikuj ponownie w kolejnosci chronologicznej.
//    Kazda nowa wiadomosc ląduje na dole kanału, wiec ostatnia
//    opublikowana (najnowsza) zostaje na dole.
console.log('publikowanie ponowne...');
let ok = 0;
for (let i = 0; i < chrono.length; i++) {
  const p = chrono[i];
  // Odtwarzamy date publikacji artykulu (nie date wyslania powiadomienia).
  const pubTs = p.articleTime || p.time;
  const unix = Math.floor(new Date(pubTs).getTime() / 1000);
  const d = new Date(pubTs);
  const pl = new Intl.DateTimeFormat('pl-PL', {
    timeZone: 'Europe/Warsaw',
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(d);
  const dm = new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', day: '2-digit', month: '2-digit' }).format(d);

  const embeds = p.embeds.map((e) => {
    const hasKiedy = e.fields?.some((f) => f.name === 'Kiedy');
    const hasDate = e.fields?.some((f) => f.name === '📅 Data publikacji');
    if (!hasKiedy && !hasDate) {
      // Brak pola dat - dodajemy ja.
      return {
        ...e,
        fields: [...(e.fields || []),
          { name: '📅 Data publikacji', value: `${pl} (${dm})`, inline: true },
          { name: 'Kiedy', value: `<t:${unix}:f> (<t:${unix}:R>)`, inline: true }],
      };
    }
    return {
      ...e,
      fields: e.fields.map((f) => {
        if (f.name === 'Kiedy') return { ...f, value: `<t:${unix}:f> (<t:${unix}:R>)` };
        if (f.name === '📅 Data publikacji') return { ...f, value: `${pl} (${dm})` };
        return f;
      }),
    };
  });

  // Webhook tez jest limitowany - ponawiamy po wyczekaniu.
  for (let attempt = 0; attempt < 8; attempt++) {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Monitor Schueler',
        embeds,
        ...(p.content ? { content: p.content } : {}),
      }),
    });
    if (res.ok) {
      ok++;
      process.stdout.write('.');
      break;
    }
    if (res.status === 429) {
      const wait = Number(res.headers.get('retry-after') || 2);
      console.log(`\n  rate limit - czekam ${wait}s`);
      await sleep((wait + 0.5) * 1000);
      continue;
    }
    console.log(`\n  blad wysylki: HTTP ${res.status}`);
    break;
  }
  await sleep(700);
}
console.log(`\nopublikowano ${ok}/${chrono.length}`);

// 5. Weryfikacja.
const check = await api(token, 'GET', `/channels/${channelId}/messages?limit=100`);
const ts = check.map((m) => m.timestamp);
const chronoOk = ts.every((t, i) => i === 0 || ts[i - 1] <= t);
console.log(`po odtworzeniu: ${check.length} wiadomosci`);
console.log(`kolejnosc chronologiczna (najnowsza na dole): ${chronoOk ? 'TAK' : 'NIE'}`);
if (check.length) {
  console.log(`najstarsza: ${check[check.length - 1].timestamp}`);
  console.log(`najnowsza:  ${check[0].timestamp}`);
}
