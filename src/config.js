import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Wczytuje .env (prosty parser, bez zaleznosci) do process.env. */
function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadDotEnv(path.join(ROOT, '.env'));

const env = process.env;

/** Data graniczna sprawy: wpisy starsze nie trafiają do alertów. */
function parseCaseStart(raw) {
  const s = String(raw || '2026-10-14T00:00:00+03:00').trim();
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00+03:00` : s;
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) {
    throw new Error(`CASE_START musi być datą ISO (np. 2026-10-14), otrzymano: ${raw}`);
  }
  return ts;
}

/** Polityka alertów: "important" (tylko ważne) albo "all" (każde trafienie). */
function parseAlertPolicy(raw) {
  const v = String(raw || 'important').trim().toLowerCase();
  if (v !== 'important' && v !== 'all') {
    throw new Error(`ALERT_POLICY musi być "important" albo "all" (otrzymano: ${raw})`);
  }
  return v;
}

/** Liczba całkowita z zakresu; zła wartość zatrzymuje start z czytelnym błędem. */
function intEnv(name, fallback, min, max) {
  const raw = env[name];
  if (raw === undefined || String(raw).trim() === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new Error(`${name} musi być liczbą całkowitą w zakresie ${min}–${max} (otrzymano: ${raw})`);
  }
  return n;
}

export const CONFIG = {
  root: ROOT,
  dataDir: env.DATA_DIR || path.join(ROOT, 'data'),
  port: intEnv('PORT', 3010, 0, 65535),
  host: env.HOST || '127.0.0.1',
  scanIntervalSec: intEnv('SCAN_INTERVAL_SEC', 360, 10, 86400),
  // Szybka ścieżka: tylko źródła, które mogą ogłosić wypuszczenie/ekstradycję
  // (rejestr Interpolu, oficjalne komunikaty, zapytania o tahliye/iade/luovutus).
  fastScanIntervalSec: intEnv('FAST_SCAN_INTERVAL_SEC', 120, 10, 86400),
  // Ile źródeł pobierać równolegle. Przy skanie co 10 s i ~90 źródłach
  // musi być wysokie, żeby pełny przebieg zmieścił się w interwale.
  maxFetchConcurrency: intEnv('MAX_FETCH_CONCURRENCY', 12, 1, 64),
  // r.jina.ai dławi serię żądań z jednego IP (HTTP 429). Konta X pobieramy
  // pojedynczo, z tym odstępem — 33 profile × 2,5 s mieści się w cyklu.
  jinaSpacingMs: intEnv('JINA_SPACING_MS', 2500, 0, 60000),
  // Wpisy opublikowane przed tą datą nie trafiają do kolejki ani alertów.
  caseStart: env.CASE_START || '2026-10-14',
  caseStartAt: parseCaseStart(env.CASE_START),
  // Token do panelu redakcyjnego /ops i recznych akcji. Bez niego panel jest wylaczony.
  adminToken: env.ADMIN_TOKEN || '',
  // Ile skanow jest "starych" wpisow, ktore traktujemy jako nowe przy pierwszym uruchomieniu.
  bootstrapLookbackHours: intEnv('BOOTSTRAP_LOOKBACK_HOURS', 72, 1, 8760),
  // Ile powiadomien wysylamy na Discord przy pierwszym uruchomieniu (reszta trafia do panelu).
  bootstrapNotifyLimit: intEnv('BOOTSTRAP_NOTIFY_LIMIT', 10, 0, 1000),
  // Twardy limit powiadomien na Discord w ciagu doby (ochrona przed zalewem).
  maxNotificationsPerDay: intEnv('MAX_NOTIFICATIONS_PER_DAY', 40, 0, 10000),
  // Po dłuższej przerwie nie wysyłamy starej kolejki jako „nowości”.
  notifyMaxAgeHours: intEnv('NOTIFY_MAX_AGE_HOURS', 24, 1, 720),
  // Po tym czasie kolejna wzmianka o tym samym zdarzeniu może znów zaalarmować
  // (np. wyrok tydzień po aresztowaniu). W oknie = nadal jeden alert.
  storyRealertHours: intEnv('STORY_REALERT_HOURS', 24, 1, 8760),
  // "important" = tylko oficjalne komunikaty i ważne zdarzenia; "all" = wszystko.
  alertPolicy: parseAlertPolicy(env.ALERT_POLICY),
  // Minimalny odstep miedzy powiadomieniami (ms) - chroni rate limit Discorda.
  minNotifyGapMs: intEnv('MIN_NOTIFY_GAP_MS', 2000, 0, 600000),
  maxItemsPerSource: intEnv('MAX_ITEMS_PER_SOURCE', 40, 1, 500),
  requestTimeoutMs: intEnv('REQUEST_TIMEOUT_MS', 25000, 1000, 120000),
  userAgent: env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',

  discord: {
    webhookUrl: env.DISCORD_WEBHOOK_URL || '',
    // Opcjonalnie: drukuj link do wiadomosci w panelu.
    channelHint: env.DISCORD_CHANNEL_HINT || '',
    // Bot Discord - do automatycznego utworzenia kanalu i webhooka.
    botToken: env.DISCORD_BOT_TOKEN || '',
    guildId: env.DISCORD_GUILD_ID || '',
    channelName: env.DISCORD_CHANNEL_NAME || 'schueler-hex-pulsechain',
    channelParentId: env.DISCORD_CHANNEL_PARENT_ID || '',
    channelTopic: env.DISCORD_CHANNEL_TOPIC ||
      '🔔 Monitor sprawy Richarda Jamesa Schuelera (Richard Heart / HEX / PulseChain) — ' +
      'zatrzymany 14.10.2026 w Stambule, czerwona nota Interpolu. ' +
      'Automatyczne powiadomienia o nowych informacjach.',
  },

  ai: {
    // OpenRouter (klucz jest opcjonalny - bez niego dziala tryb bez streszczania AI).
    openrouterKey: env.OPENROUTER_API_KEY || '',
    openrouterModel: env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
    // Darmowy fallback (pollinations) - limit 1 zapytanie / 30 s / IP.
    pollinationsUrl: env.POLLINATIONS_URL || 'https://text.pollinations.ai/prompt',
    pollinationsModel: env.POLLINATIONS_MODEL || 'openai-fast',
    // Prosty cache: hash tresci -> wygenerowane podsumowanie.
    cacheFile: env.AI_CACHE_FILE || path.join(env.DATA_DIR || path.join(ROOT, 'data'), 'ai-cache.json'),
  },

  dbFile: env.DB_FILE || path.join(env.DATA_DIR || path.join(ROOT, 'data'), 'monitor.db'),
};

export const DATA_DIR = CONFIG.dataDir;
export const DB_FILE = CONFIG.dbFile;
export const AI_CACHE_FILE = CONFIG.ai.cacheFile;
