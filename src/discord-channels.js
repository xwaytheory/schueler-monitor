/**
 * Zarzadzanie kanalem Discord dla monitora.
 *
 * Bot (token) moze utworzyc dedykowany kanal + webhook w swoim serwerze.
 * Webhook jest preferowany - nie wymaga uprawnien bota do wysylania.
 */

const API = 'https://discord.com/api/v10';

async function api(token, method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* nie-JSON */ }
  if (!res.ok) {
    const msg = json?.message || text.slice(0, 200) || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return json;
}

/**
 * Znajduje istniejacy kanal o podanej nazwie albo tworzy nowy pod parentem.
 * @returns {Promise<{id:string, name:string, created:boolean}>}
 */
export async function ensureChannel(token, guildId, name, parentId = null, topic = '') {
  const channels = await api(token, 'GET', `/guilds/${guildId}/channels`);
  const existing = channels.find((c) => c.type === 0 && c.name === name);
  if (existing) {
    return { id: existing.id, name: existing.name, created: false };
  }
  const body = { name, type: 0 };
  if (parentId) body.parent_id = parentId;
  if (topic) body.topic = topic;
  const created = await api(token, 'POST', `/guilds/${guildId}/channels`, body);
  return { id: created.id, name: created.name, created: true };
}

/**
 * Tworzy webhook w kanale (bot nie moze pobrac istniejacych webhookow
 * bez uprawnien manage_webhooks, wiec tworzymy nowy za kazdym razem).
 * @returns {Promise<string>} URL webhooka
 */
export async function createWebhook(token, channelId, name = 'Monitor Schueler') {
  const wh = await api(token, 'POST', `/channels/${channelId}/webhooks`, { name });
  if (!wh?.url) throw new Error('Discord nie zwrocil URL webhooka');
  return wh.url;
}

/** Usuwa webhook (po zmianie kanalu/tokenu). */
export async function deleteWebhook(webhookId, token) {
  return api(token, 'DELETE', `/webhooks/${webhookId}`);
}

/** Sprawdza, czy bot jest w serwerze. */
export async function listGuilds(token) {
  return api(token, 'GET', '/users/@me/guilds');
}
