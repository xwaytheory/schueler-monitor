/**
 * Bootstrap kanału Discord: tworzy (lub znajduje) dedykowany kanał
 * i webhook, po czym wypisuje gotowy wpis do .env
 *
 * Uzycie: node src/cli-channel.js
 */
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from './config.js';
import { ensureChannel, createWebhook, listGuilds } from './discord-channels.js';

const { botToken, guildId, channelName, channelParentId, channelTopic } = CONFIG.discord;

if (!botToken) {
  console.error('Brak DISCORD_BOT_TOKEN w .env');
  process.exit(1);
}

const guilds = await listGuilds(botToken);
console.log('Serwery bota:');
for (const g of guilds) console.log(`  ${g.id}  ${g.name}`);

if (!guildId) {
  console.error('\nBrak DISCORD_GUILD_ID - ustaw id serwera z listy powyzej.');
  process.exit(1);
}
if (!guilds.some((g) => g.id === guildId)) {
  console.error(`Bot nie jest w serwerze ${guildId}.`);
  process.exit(1);
}

const ch = await ensureChannel(botToken, guildId, channelName, channelParentId || null, channelTopic);
console.log(`\nKanal: ${ch.name} (${ch.id}) ${ch.created ? '- UTWORZONY' : '- juz istnial'}`);

const url = await createWebhook(botToken, ch.id, 'Monitor Schueler');
console.log(`Webhook utworzony w kanale ${ch.name}.`);

// Zapisujemy URL do .env (nadpisujac DISCORD_WEBHOOK_URL).
const envPath = path.join(CONFIG.root, '.env');
let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const line = `DISCORD_WEBHOOK_URL=${url}`;
if (/^DISCORD_WEBHOOK_URL=.*$/m.test(env)) {
  env = env.replace(/^DISCORD_WEBHOOK_URL=.*$/m, line);
} else {
  env = env.trimEnd() + '\n' + line + '\n';
}
if (!/^DISCORD_BOT_TOKEN=/m.test(env)) env = env.trimEnd() + '\nDISCORD_BOT_TOKEN=' + botToken + '\n';
if (!/^DISCORD_GUILD_ID=/m.test(env)) env = env.trimEnd() + '\nDISCORD_GUILD_ID=' + guildId + '\n';
fs.writeFileSync(envPath, env);
console.log('Zapisano DISCORD_WEBHOOK_URL do .env');
console.log(`\nKanal jest gotowy. Powiadomienia pojdą pod kanal #${ch.name}.`);
