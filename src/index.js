import { CONFIG } from './config.js';
import { startWeb } from './web.js';
import { startLoop } from './scanner.js';
import { sendTest } from './discord.js';

process.on('unhandledRejection', (r) => console.error('[unhandledRejection]', r));
// Blad nieobsluzony w kodzie synchronicznym oznacza niespójny stan procesu.
// Logujemy i konczymy proces - supervisor (systemd) uruchomi go ponownie.
process.on('uncaughtException', (e) => {
  console.error('[uncaughtException]', e);
  process.exit(1);
});

console.log(`[app] start — skan co ${CONFIG.scanIntervalSec}s, dane: ${CONFIG.dataDir}`);

startWeb();
startLoop();

if (!CONFIG.discord.webhookUrl) {
  console.warn('[discord] brak DISCORD_WEBHOOK_URL — powiadomienia nie beda wysylane.');
}

// Test powiadomienia przy starcie (tylko gdy webhook jest skonfigurowany).
if (process.env.SEND_STARTUP_TEST === '1' && CONFIG.discord.webhookUrl) {
  sendTest().then((r) =>
    console.log(r.ok ? '[discord] test wyslany' : '[discord] test blad: ' + r.error));
}
