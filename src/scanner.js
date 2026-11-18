import { CONFIG } from './config.js';
import { collectAll } from './collector.js';
import { FAST_SOURCE_IDS } from './sources.js';
import { evaluate } from './matcher.js';
import { contentKey, dedupKey } from './dedup.js';
import { storyKey, storyDetailLevel } from './story.js';
import { isImportantAlert } from './alert-policy.js';
import { insertItem, upsertSourceState, markNotified, markNotifyFailed, markSuppressed, listPendingNotifications, setSummary, getKV, setKV, getStory, markStoryNotified, countSentToday, countUnnotified, listItems, getItemByDedup, getItemByContentKey, getContentHash, listSourceState } from './db.js';
import { summarize, peekSummary } from './summarizer.js';
import { notify, sendDigest } from './discord.js';
import crypto from 'node:crypto';

const HOUR = 3600 * 1000;

let state = {
  running: false,
  lastRunAt: null,
  lastRunMs: null,
  lastError: null,
  runs: 0,
  itemsFound: 0,
  itemsMatched: 0,
  itemsNotified: 0,
  // Czy pierwszy skan w tej instalacji juz sie odbyl (przetrwane w bazie,
  // zeby restart procesu nie resetowal limitu powiadomien).
  bootstrapped: false,
};

/** Czy wpis jest "nowy" - bootstrap: przy pierwszym uruchomieniu bierzemy wpisy z ostatnich godzin. */
function isRecent(item, bootstrap) {
  if (!bootstrap) return true;
  const ref = item.publishedAt || item.firstSeenAt;
  return ref >= Date.now() - CONFIG.bootstrapLookbackHours * HOUR;
}

/** Wpisy sprzed daty sprawy nie są alertami - nawet jeśli dotyczą Schuelera. */
function beforeCaseStart(ts) {
  return Number(ts) > 0 && Number(ts) < CONFIG.caseStartAt;
}

/** Po przerwie w działaniu stara kolejka nie może udawać świeżych alertów. */
function isStale(ts) {
  return Number(ts) > 0 && Number(ts) < Date.now() - CONFIG.notifyMaxAgeHours * HOUR;
}

/**
 * Wykonuje jeden cykl skanowania.
 * @param {{notify?:boolean, dryRun?:boolean}} opts
 */
export async function runScan(opts = {}) {
  if (state.running) return { skipped: true, reason: 'skan juz trwa' };
  state.running = true;
  const started = Date.now();

  // Wewnętrzne wejście dla testów (kolektor, streszczenia, wysyłka).
  const io = opts._io || {};
  const collect = io.collect || collectAll;
  const makeSummary = io.summarize || summarize;
  const sendNotification = io.notify || notify;

  try {
    // Bootstrap tylko przy pierwszym skanie z skonfigurowanym webhookiem. Bez
    // webhooka nie oznaczamy instalacji jako "bootstrapped", zeby po jego
    // dodaniu stare wpisy nie polecialy wszystkie naraz.
    const hasWebhook = Boolean(CONFIG.discord.webhookUrl);
    const firstRun = !getKV('bootstrapped');
    const bootstrap = firstRun && hasWebhook;
    // opts.only = szybka ścieżka (podzbiór źródeł); bez niego pełny skan.
    const results = await collect(opts.only ? { only: opts.only } : undefined);
    let found = 0, matched = 0, notified = 0, duplicates = 0;
    const newItems = [];
    // Wpisy wysłane bez streszczenia AI — dopełniamy je w tle, po alertach.
    const deferredSummaries = [];
    // Klucz -> wskaz, ktore zrodlo daje najlepsza wersje artykulu.
    const bestByKey = new Map();
    // Hashe stron statycznych — zapisujemy je dopiero po udanych insertach.
    const pageHashes = new Map();

    for (const { src, ok, items, error } of results) {
      if (!ok) {
        upsertSourceState(src.id, { ok, error: error || null, count: 0 });
        continue;
      }

      // Strony z wersjonowaniem (oficjalne komunikaty, akta, rejestr):
      // wpuszczamy wpis tylko wtedy, gdy tresc sie zmienila. Zwykłe strony
      // artykułów traktujemy jak feed — dedup po URL, bez wersji na każdy szum.
      if ((src.kind === 'page' || src.kind === 'interpol') && src.versioned) {
        const hash = crypto.createHash('sha256')
          .update(items.map((i) => `${i.title || ''}|${i.text || ''}`).join('|'))
          .digest('hex');
        const prevHash = getContentHash(src.id);
        upsertSourceState(src.id, { ok, count: items.length });
        if (prevHash && prevHash === hash) continue; // brak zmian
        // Zmiana treści = nowa wersja strony (nowy klucz dedupu i nowy ID).
        const version = hash.slice(0, 16);
        items.forEach((item, i) => {
          item.sourceHash = version;
          item.changeDetected = Boolean(prevHash);
          item.id = `${item.source}:${version}:${i}`;
        });
        if (!prevHash && firstRun) {
          // Pierwsze pobranie: archiwizujemy, ale nie powiadamiamy (to nie jest nowość).
          for (const item of items) {
            found++;
            const verdict = evaluate(item.text, item.title);
            if (!verdict.relevant) continue;
            matched++;
            const key = dedupKey(item);
            if (!getItemByDedup(key)) {
              insertItem({
                id: item.id, dedupKey: key, source: item.source, sourceLabel: item.sourceLabel,
                title: item.title, url: item.url, publishedAt: item.publishedAt, firstSeenAt: Date.now(),
                rawText: item.text, score: verdict.score, matchedTerms: verdict.terms,
                changeDetected: item.changeDetected === true,
                suppressed: 1, suppressedReason: 'bootstrap-page',
              });
            }
          }
          upsertSourceState(src.id, { ok, count: items.length, contentHash: hash });
          continue;
        }
        // Hash zapisujemy dopiero po udanych insertach — inaczej awaria
        // oznaczyłaby stronę jako "bez zmian" i zgubiła nową treść.
        pageHashes.set(src.id, { hash, count: items.length });
      } else if (src.kind === 'page') {
        upsertSourceState(src.id, { ok, count: items.length });
        if (firstRun) {
          // Pierwsze pobranie statycznej strony: tylko archiwum, bez alertu.
          for (const item of items) {
            found++;
            const verdict = evaluate(item.text, item.title);
            if (!verdict.relevant) continue;
            matched++;
            const key = dedupKey(item);
            if (!getItemByDedup(key)) {
              insertItem({
                id: item.id, dedupKey: key,
                contentKey: contentKey({ title: item.title, text: item.text }),
                source: item.source, sourceLabel: item.sourceLabel,
                title: item.title, url: item.url, publishedAt: item.publishedAt, firstSeenAt: Date.now(),
                rawText: item.text, score: verdict.score, matchedTerms: verdict.terms,
                suppressed: 1, suppressedReason: 'bootstrap-page',
              });
            }
          }
          continue;
        }
        // Kolejne skany: normalny dedup po URL.
      } else {
        upsertSourceState(src.id, { ok, error: null, count: items.length });
      }

      for (const item of items) {
        found++;
        const verdict = evaluate(item.text, item.title);
        if (!verdict.relevant) continue;
        matched++;
        // Przed 14.10.2026 to tło sprawy, nie nowa informacja. Nie zaśmiecamy
        // kolejki starymi artykułami (np. o pozwie SEC z 2023 r.).
        if (beforeCaseStart(item.publishedAt || item.firstSeenAt)) continue;
        // Zrodla referencyjne (akta, archiwa, dane podatkowe) trafiaja do
        // archiwum jako kontekst, ale nie generuja powiadomien.
        if (item.isReference) continue;

        const key = dedupKey(item);
        const prev = bestByKey.get(key);
        if (prev) {
          duplicates++;
          // Preferujemy zrodlo z bogatszym opisem (dluzszy tekst).
          if ((item.text?.length || 0) > (prev.item.text?.length || 0)) {
            bestByKey.set(key, { item, verdict });
          }
          continue;
        }
        bestByKey.set(key, { item, verdict });
      }
    }

    // Cicho padnięte źródło to najczęstsza przyczyna „monitor nic nie łapie”
    // (24 zapytania newsowe stały na 503 przez wiele godzin, zanim ktoś
    // zauważył). Jeden zbiorczy alert na 12 h — kanał nie zamienia się w log.
    if (!opts.only && CONFIG.discord.webhookUrl) {
      const failing = listSourceState().filter((s) => Number(s.consecutive_failures) >= 3);
      const lastAlert = Number(getKV('source_health_alert_at') || 0);
      if (failing.length && Date.now() - lastAlert > 12 * HOUR) {
        const lines = failing.slice(0, 12).map(
          (s) => `• ${s.source} — ${String(s.last_error || 'błąd').slice(0, 80)}`,
        );
        const more = failing.length > 12 ? `\n…i ${failing.length - 12} więcej` : '';
        const sent = await sendDigest(
          `⚠️ Monitor Schuelera: ${failing.length} źródeł nie działa (≥3 skany z rzędu).\n`
          + `${lines.join('\n')}${more}\nSprawdź /ops albo raport source-health.`,
        );
        if (sent.ok) setKV('source_health_alert_at', String(Date.now()));
      }
    }

    for (const { item, verdict } of bestByKey.values()) {
      const key = dedupKey(item);
      const existing = getItemByDedup(key);
      if (existing) {
        duplicates++;
        // Wpis jest juz w archiwum - aktualizujemy dane, ale go nie powtarzamy.
        continue;
      }
      // Identyczny tytuł i treść z innym URL-em (np. dwa posty X) to jeden wpis.
      // Strony oficjalne mają własny klucz wersji, więc ich nie scalamy.
      const cKey = item.sourceHash ? null : contentKey({ title: item.title, text: item.text });
      if (cKey && getItemByContentKey(cKey)) {
        duplicates++;
        continue;
      }
      const isNew = insertItem({
        id: item.id,
        dedupKey: key,
        contentKey: cKey,
        source: item.source,
        sourceLabel: item.sourceLabel,
        title: item.title,
        url: item.url,
        publishedAt: item.publishedAt,
        firstSeenAt: Date.now(),
        rawText: item.text,
        score: verdict.score,
        matchedTerms: verdict.terms,
        changeDetected: item.changeDetected === true,
      });
      if (isNew) {
        newItems.push({ ...item, score: verdict.score, matchedTerms: verdict.terms });
      }
    }

    // Hash stron zapisujemy po insertach. Jeśli cokolwiek rzuciło wyjątek
    // wcześniej, hash nie zostanie zapisany i następny skan ponowi próbę.
    for (const [source, { hash, count }] of pageHashes) {
      upsertSourceState(source, { ok: true, count, contentHash: hash });
    }

    // Posortuj nowe wpisy: najpierw najwyższy score, potem najnowsze.
    newItems.sort((a, b) => (b.score - a.score) || ((b.publishedAt || 0) - (a.publishedAt || 0)));

    // Limity powiadomień:
    //  - bootstrap: limit początkowy (reszta zostaje w panelu),
    //  - dobowy limit twardy (ochrona przed zalewem kanału),
    //  - minimalny odstęp między wiadomościami (rate limit Discorda).
    const sentToday = countSentToday();
    const dailyLeft = Math.max(0, CONFIG.maxNotificationsPerDay - sentToday);
    const notifyLimit = Math.min(bootstrap ? CONFIG.bootstrapNotifyLimit : Infinity, dailyLeft);
    let notifiedThisRun = 0;

    // Kolejka powiadomień = WSZYSTKIE wpisy w archiwum bez powiadomienia.
    // Bez webhooka nie ma sensu wołać AI ani zwiększać licznika prób.
    const toNotify = [];
    if (opts.notify !== false && !opts.dryRun && CONFIG.discord.webhookUrl) {
      for (const row of listPendingNotifications()) {
        // Snapshot strony oficjalnej wykrywamy po czasie pierwszego pobrania:
        // strony często aktualizują treść bez zmiany daty publikacji.
        const isPage = String(row.dedup_key || '').startsWith('page:');
        const ts = isPage ? row.first_seen_at : (row.published_at || row.first_seen_at);
        // Stare wpisy (przed datą sprawy) zostają w archiwum jako tło, ale
        // nigdy nie trafiają do alertów.
        if (beforeCaseStart(ts)) {
          markSuppressed(row.id, 'before-case');
          continue;
        }
        // Po przerwie w skanowaniu nie wysyłamy tygodniowej kolejki jako
        // „nowych informacji”. Starsze wpisy zostają w archiwum.
        if (isStale(ts)) {
          markSuppressed(row.id, 'stale');
          continue;
        }
        const rawText = row.raw_text || '';
        // Wpisy z kolejki też przechodzą przez matcher: homonimy nazwiska
        // (np. sportowcy, naukowcy) nie mogą wisieć w kolejce latami.
        if (rawText && !evaluate(`${row.title}\n${rawText}`, row.title).relevant) {
          markSuppressed(row.id, 'off-topic');
          continue;
        }
        // Tryb "important": komentarze, kursy i zwykłe wzmianki zostają
        // w archiwum, ale nie generują powiadomienia.
        if (!isImportantAlert({ source: row.source, title: row.title, text: rawText }, CONFIG.alertPolicy)) {
          markSuppressed(row.id, 'low-signal');
          continue;
        }
        if (bootstrap && !isRecent({ publishedAt: ts, firstSeenAt: row.first_seen_at }, true)) {
          // Stary wpis z bootstrapu nie jest nowością i nigdy nie powinien trafić do kolejki.
          markSuppressed(row.id, 'bootstrap-old');
          continue;
        }
        let terms = [];
        try { terms = row.matched_terms ? JSON.parse(row.matched_terms) : []; } catch { terms = []; }
        toNotify.push({
          id: row.id, source: row.source, sourceLabel: row.source_label,
          title: row.title, url: row.url, publishedAt: row.published_at,
          firstSeenAt: row.first_seen_at, text: row.raw_text || '',
          matchedTerms: terms,
        });
      }
    }

    let lastNotifyAt = 0;
    let consecutiveNotifyFailures = 0;
    let limitReached = false;
    let notifyAborted = false;
    for (const item of toNotify) {
      if (notifiedThisRun >= notifyLimit) { limitReached = true; break; }
      // Grupowanie zdarzen: 20 portali pisze o jednym aresztowaniu -
      // powiadamiamy tylko raz. Nowy rodzaj zdarzenia (proces po aresztowaniu)
      // albo nowy poziom szczegolowosci (ujawnienie kwot) = nowe powiadomienie.
      const sText = `${item.title} ${item.text || ''}`;
      const sKey = storyKey(item.text || '', item.title);
      const detailLevel = storyDetailLevel(sText);
      if (sKey) {
        const story = getStory(sKey);
        // Ten sam etap sprawy nie powtarza alertu w krotkim oknie (np. 20 portali
        // o jednym aresztowaniu). Po STORY_REALERT_HOURS nowa wzmianka moze
        // zaalarmowac ponownie - inaczej przyszly wyrok nigdy by nie przeszedl.
        const recentStory = story &&
          Date.now() - (story.notified_at || 0) < CONFIG.storyRealertHours * HOUR;
        if (recentStory && story.detail_level >= detailLevel) {
          // Zdarzenie już powiadomione na tym poziomie — wpis zostaje w archiwum,
          // ale nie wisi w kolejce jako „oczekujący”.
          markSuppressed(item.id, `story:${sKey}`);
          continue;
        }
      }

      // Domyślnie alert leci natychmiast: bierzemy streszczenie tylko z cache,
      // a brakujące generujemy w tle. Wołanie modelu potrafi trwać dziesiątki
      // sekund i blokowało wysyłkę (opts.waitForSummary wymusza stary tryb).
      let summary = peekSummary(item.title, item.text) || { pl: '', en: '' };
      if (!summary.pl && !summary.en) {
        if (opts.waitForSummary) {
          try {
            summary = await makeSummary(item.title, item.text);
          } catch (e) {
            console.error('[scan] summary error:', e.message);
          }
        } else {
          deferredSummaries.push({ id: item.id, title: item.title, text: item.text });
        }
      }
      // Zapisujemy streszczenie, zeby panel mial je takze dla wczesniejszych wpisow.
      if (summary.pl || summary.en) {
        setSummary(item.id, summary.pl, summary.en, summary.titlePl, summary.titleEn);
      }

      // Odstep miedzy powiadomieniami.
      const gap = Date.now() - lastNotifyAt;
      if (gap < CONFIG.minNotifyGapMs) {
        await new Promise((r) => setTimeout(r, CONFIG.minNotifyGapMs - gap));
      }

      const r = await sendNotification(item, summary);
      if (r.ok) {
        markNotified(item.id);
        markStoryNotified(sKey, item.id, item.title, detailLevel);
        notified++;
        notifiedThisRun++;
        consecutiveNotifyFailures = 0;
        lastNotifyAt = Date.now();
      } else {
        markNotifyFailed(item.id, r.error);
        consecutiveNotifyFailures++;
        console.error('[scan] notify failed:', r.error);
        // Trzy błędy z rzędu = webhook najpewniej nie działa. Nie mielimy
        // kolejki i nie wołamy AI dla reszty — wpisy zostają na następny skan.
        if (consecutiveNotifyFailures >= 3) {
          console.error('[scan] 3 kolejne błędy webhooka — przerywam wysyłkę w tym skanie');
          notifyAborted = true;
          break;
        }
      }
    }

    // Streszczenia odroczone: nie blokują alertów, ale dopełniają archiwum.
    // W testach (wstrzyknięte io) nie ruszamy tła, żeby nie pisać po zamknięciu bazy.
    if (deferredSummaries.length && !opts._io) {
      void (async () => {
        for (const it of deferredSummaries.slice(0, 20)) {
          try {
            const s = await summarize(it.title, it.text);
            if (s?.pl || s?.en) setSummary(it.id, s.pl || '', s.en || '', s.titlePl || '', s.titleEn || '');
          } catch (e) {
            console.error('[scan] deferred summary error:', e.message);
          }
        }
      })();
    }

    // Bootstrap: wpisy ponad limit nie mogą wrócić jako "nowe" przy kolejnym
    // skanie. Chowamy je do archiwum z jawnym powodem; są widoczne publicznie,
    // ale nie trafią już do kolejki powiadomień.
    if (bootstrap && limitReached) {
      for (const row of listPendingNotifications(100_000)) {
        markSuppressed(row.id, 'bootstrap-limit');
      }
    }

    state.lastRunAt = Date.now();
    state.lastRunMs = Date.now() - started;
    state.lastError = null;
    state.runs++;
    state.itemsFound = found;
    state.itemsMatched = matched;
    state.itemsNotified = notified;
    state.bootstrapped = Boolean(getKV('bootstrapped')) || (bootstrap && !notifyAborted);

    // Po pierwszym udanym skanie flaga zostaje w bazie - kolejne restarty procesu
    // nie uruchomiaja ponownie trybu bootstrap (limitu powiadomien). Jeśli
    // wysyłkę przerwały błędy webhooka, bootstrap trwa dalej: inaczej reszta
    // kolejki zostałaby uznana za "starą" i nigdy nie trafiłaby na Discorda.
    if (bootstrap && !notifyAborted) setKV('bootstrapped', '1');

    return { ok: true, found, matched, newItems: newItems.length, duplicates, notified, bootstrap, notifyAborted };
  } catch (e) {
    state.lastError = String(e?.message || e);
    state.lastRunAt = Date.now();
    state.lastRunMs = Date.now() - started;
    console.error('[scan] fatal:', state.lastError);
    return { ok: false, error: state.lastError };
  } finally {
    state.running = false;
  }
}

/**
 * Uruchamia dwie pętle: pełny skan co SCAN_INTERVAL_SEC i szybką ścieżkę
 * (źródła mogące ogłosić wypuszczenie/ekstradycję) co FAST_SCAN_INTERVAL_SEC.
 * Skan, który już trwa, blokuje kolejny tick — pętle nie nakładają się.
 */
export function startLoop() {
  const tick = () => {
    runScan().catch((e) => console.error('[scan] loop error:', e.message));
  };
  // Szybka ścieżka: rejestr Interpolu, oficjalne komunikaty, zapytania o tahliye/iade.
  const fast = () => {
    runScan({ only: FAST_SOURCE_IDS }).catch((e) => console.error('[scan] fast loop error:', e.message));
  };
  setTimeout(tick, 3000);
  const timer = setInterval(tick, CONFIG.scanIntervalSec * 1000);
  setTimeout(fast, 6000);
  const fastTimer = setInterval(fast, CONFIG.fastScanIntervalSec * 1000);
  console.log(
    `[scan] pełny skan co ${CONFIG.scanIntervalSec}s · szybka ścieżka (${FAST_SOURCE_IDS.length} źródeł: Interpol, oficjalne, wypuszczenie/ekstradycja) co ${CONFIG.fastScanIntervalSec}s · alerty bez czekania na streszczenie AI`,
  );
  return () => { clearInterval(timer); clearInterval(fastTimer); };
}

export function getState() {
  return { ...state };
}

export function pendingCount() {
  return countUnnotified();
}

export function recentItems(limit = 100, offset = 0) {
  return listItems({ limit, offset });
}
