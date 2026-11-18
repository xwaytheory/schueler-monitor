/**
 * Porzadkuje kanal Discord:
 *   1. usuwa wiadomosci, ktore nie naleza do sprawy (nekrologi, szum),
 *   2. uzupelnia brakujace pole "Data publikacji" w pozostalych,
 *   3. nie zmienia kolejnosci (Discord nie pozwala zmienic kolejnosci
 *      inaczej niz przez przenoszenie - a wiadomosci webhookow nie da sie
 *      przenosic).
 *
 * Uzycie: node src/cli-clean-channel.js <channel_id>
 */
import { CONFIG } from './config.js';
import { db } from './db.js';
import { evaluate } from './matcher.js';

const API = 'https://discord.com/api/v10';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const token = CONFIG.discord.botToken;
const webhookUrl = CONFIG.discord.webhookUrl;
const channelId = process.argv[2];
if (!token || !webhookUrl || !channelId) {
  console.error('Brak tokenu / webhooka / id kanalu');
  process.exit(1);
}
const whId = webhookUrl.split('/').slice(-2)[0];
const whToken = webhookUrl.split('/').pop();

async function api(method, path) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const res = await fetch(API + path, {
      method,
      headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* nie-JSON */ }
    if (res.ok) return json;
    if (res.status === 429) {
      const wait = Number(res.headers.get('retry-after') || json?.retry_after || 2);
      await sleep((wait + 0.5) * 1000);
      continue;
    }
    throw new Error(json?.message || text.slice(0, 200) || `HTTP ${res.status}`);
  }
  throw new Error('rate limit');
}

async function webhook(method, path, body) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const res = await fetch(`${API}/webhooks/${whId}/${whToken}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.ok) return true;
    if (res.status === 429) {
      const wait = Number(res.headers.get('retry-after') || 2);
      await sleep((wait + 0.5) * 1000);
      continue;
    }
    throw new Error(`HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 150)}`);
  }
  return false;
}

// 1. Pobierz wszystkie wiadomosci.
const all = [];
let before;
for (let i = 0; i < 20; i++) {
  const q = new URLSearchParams({ limit: '100' });
  if (before) q.set('before', before);
  const page = await api('GET', `/channels/${channelId}/messages?${q}`);
  if (!page.length) break;
  all.push(...page);
  if (page.length < 100) break;
  before = page[page.length - 1].id;
  await sleep(400);
}
console.log(`wiadomosci w kanale: ${all.length}`);

// 2. Mapa tytul -> data artykulu z archiwum bazy.
const rows = db.prepare('SELECT title, published_at FROM items WHERE published_at IS NOT NULL').all();
const byTitle = new Map();
for (const r of rows) {
  const k = (r.title || '').slice(0, 120);
  if (k && !byTitle.has(k)) byTitle.set(k, r.published_at);
}

// 3. Usun szum (nekrologi itp.) i uzupelnij daty.
let removed = 0, patched = 0, ok = 0;
for (const m of all) {
  const embeds = m.embeds || [];
  if (!embeds.length) continue;
  const e = embeds[0];
  const title = e.title || '';
  const text = `${title} ${e.description || ''}`;

  const verdict = evaluate(text, title);
  const hasDate = (e.fields || []).some((f) => f.name.includes('Data publikacji'));
  const hasKiedy = (e.fields || []).some((f) => f.name === 'Kiedy');

  // Szum w tytule -> usun.
  if (!verdict.relevant) {
    const del = await webhook('DELETE', `/messages/${m.id}`);
    if (del) { removed++; process.stdout.write('x'); }
    await sleep(350);
    continue;
  }

  // Brak daty -> uzupelnij z archiwum.
  if (!hasDate) {
    const pub = byTitle.get(title.slice(0, 120));
    if (pub) {
      const unix = Math.floor(pub / 1000);
      const d = new Date(pub);
      const pl = new Intl.DateTimeFormat('pl-PL', {
        timeZone: 'Europe/Warsaw',
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
      }).format(d);
      const dm = new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', day: '2-digit', month: '2-digit' }).format(d);
      const fields = [...(e.fields || [])];
      fields.push({ name: '📅 Data publikacji', value: `${pl} (${dm})`, inline: true });
      const withKiedy = fields.map((f) => f.name === 'Kiedy'
        ? { ...f, value: `<t:${unix}:f> (<t:${unix}:R>)` }
        : f);
      if (!hasKiedy) {
        withKiedy.push({ name: 'Kiedy', value: `<t:${unix}:f> (<t:${unix}:R>)`, inline: true });
      }
      const edited = await webhook('PATCH', `/messages/${m.id}`, {
        username: 'Monitor Schueler',
        embeds: [{
          title: e.title, description: e.description, url: e.url, color: e.color,
          fields: withKiedy, footer: e.footer, timestamp: new Date(pub).toISOString(),
        }],
      });
      if (edited) { patched++; process.stdout.write('+'); }
      await sleep(350);
      continue;
    }
  }
  ok++;
}

db.close();
console.log(`\nusunieto (szum): ${removed}, uzupelniono date: ${patched}, bez zmian: ${ok}`);
