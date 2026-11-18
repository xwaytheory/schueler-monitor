/**
 * Sortuje wiadomosci w kanale Discord chronologicznie:
 * najstarsza na gorze, najnowsza na dole.
 *
 * Discord pozwala przenosic wiadomosci miedzy kanalami, ale nie zmienia
 * ich kolejnosci wewnatrz kanału. Jedyny sposob to:
 *   1. pobrac wszystkie wiadomosci,
 *   2. przenieść je do kanłu tymczasowego (w kolejności malejącej - nowe na gorze),
 *   3. przenieść z powrotem do kanału docelowego w kolejności rosnącej
 *      (kazda przeniesiona wiadomosc ląduje na gorze, wiec kolejna ląduje nizej).
 */
import { CONFIG } from './config.js';

const API = 'https://discord.com/api/v10';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(token, method, path, body) {
  // Discord agresywnie limituje zapisy - ponawiamy po wyczekaniu.
  for (let attempt = 0; attempt < 6; attempt++) {
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

/** Pobiera wszystkie wiadomosci z kanalu (od najnowszych). */
async function fetchAll(token, channelId) {
  const out = [];
  let before;
  for (let i = 0; i < 30; i++) {
    const q = new URLSearchParams({ limit: '100' });
    if (before) q.set('before', before);
    const page = await api(token, 'GET', `/channels/${channelId}/messages?${q}`);
    if (!page.length) break;
    out.push(...page);
    if (page.length < 100) break;
    before = page[page.length - 1].id;
  }
  return out;
}

const token = CONFIG.discord.botToken;
if (!token) {
  console.error('Brak DISCORD_BOT_TOKEN');
  process.exit(1);
}

const channelId = process.argv[2];
if (!channelId) {
  console.error('Uzycie: node src/cli-sort-channel.js <channel_id>');
  process.exit(1);
}

const messages = await fetchAll(token, channelId);
console.log(`pobrano ${messages.length} wiadomosci`);

if (messages.length < 2) {
  console.log('za malo wiadomosci do sortowania');
  process.exit(0);
}

// Discord zwraca wiadomosci malejaco (najnowsza pierwsza).
// Przenosimy je w kolejnosci malejacej do kanalu tymczasowego,
// a potem z powrotem w kolejnosci rosnacej - kazda przeniesiona
// wiadomosc trafia na gorę, wiec kolejna ląduje nizej.
const chrono = [...messages].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

const tmpName = `sort-tmp-${Date.now()}`;
const tmp = await api(token, 'POST', `/guilds/${CONFIG.discord.guildId}/channels`, {
  name: tmpName, type: 0, parent_id: CONFIG.discord.channelParentId || null,
});
console.log(`kanal tymczasowy: ${tmp.id}`);

try {
  // 1. Do kanału tymczasowego w kolejności malejącej (najnowsza pierwsza).
  //    Ścieżka wskazuje kanał ZDŹDŁOWY (tu: kanał docelowy), w body cel.
  for (const m of [...chrono].reverse()) {
    await api(token, 'PATCH', `/channels/${channelId}/messages/${m.id}`, { channel_id: tmp.id });
    await sleep(120);
    process.stdout.write('.');
  }
  console.log('\nprzeniesiono do kanału tymczasowego');

  // 2. Z powrotem do kanału docelowego w kolejności rosnącej.
  //    Każda przeniesiona wiadomość ląduje na górze, więc ostatnia
  //    przeniesiona (najnowsza) ląduje na dole.
  for (const m of chrono) {
    await api(token, 'PATCH', `/channels/${tmp.id}/messages/${m.id}`, { channel_id: channelId });
    await sleep(120);
    process.stdout.write('.');
  }
  console.log('\nprzeniesiono z powrotem');
} finally {
  await api(token, 'DELETE', `/channels/${tmp.id}`).catch(() => {});
  console.log('kanal tymczasowy usuniety');
}

const check = await fetchAll(token, channelId);
const stillChrono = check.every((m, i) => i === 0 || check[i - 1].timestamp <= m.timestamp);
console.log(`\npo sortowaniu: ${check.length} wiadomosci, chronologicznie (najnowsza na dole): ${stillChrono ? 'TAK' : 'NIE'}`);
