/**
 * Dopasowanie w tresci do sprawy Richarda Jamesa Schuelera.
 *
 * Regula: wpis musi zawierac jedno imie/pseudonim osoby (osoba glowna)
 * ALBO jedno z wyrazów kluczowych HEX/PulseChain/Interpol w kontekscie arestu
 * albo slowa kluczowe same w sobie (czerwona nota, zatrzymany...).
 */

/** Pseudonimy i warianty pisowni osoby. */
export const PERSON_ALIASES = [
  'schueler', 'schüler', 'schuler', 'schueller', 'schu ler',
  'richard james schueler', 'richard james heart', 'richard heart',
  'james heart', 'balina james', 'richard j. schueler',
  'richard j schueler', 'richard schueler', 'richard james schuler',
  'rich "hex" heart', "rich 'hex' heart", 'hex richard heart',
  'richard heart aka', 'richard heart also known',
  // Aliasy z SOURCE-PACK.md (stan 21.10.2026)
  'richard heard',          // Yle
  'whale james',            // tureckie media (tlumaczenie "Balina James")
  'richard james heard',
];

/** Wyrazy silnie zwiazane ze sprawa (same w sobie wystarczaja). */
export const STRONG_TERMS = [
  'czerwona nota', 'czerwonej noty', 'red notice', 'red notices',
  'interpol', 'interpolu', 'interpol\'e', 'interpolün',
  'kripto dolandiriciligi', 'kripto dolandırıcılığı',
];

/** Kontekst kryptowalutowy - silny sygial powiazania ze sprawa. */
export const CRYPTO_CORE = [
  'hex', 'pulsechain', 'pulsex', 'hex finance', 'ehex', 'epulse',
  'hex token', 'hex coin', 'hex founder', 'pulsechain founder',
];

/** Kontekst kryptowalutowy - slaby, moze byc przypadkowy. */
export const CRYPTO_WEAK = [
  'pls', 'heartbeat', 'bsc', 'staking',
];

/** Wszystkie terminy krypto. */
export const CRYPTO_TERMS = [...CRYPTO_CORE, ...CRYPTO_WEAK];

/** Slowa oznaczajace nowy development w sprawie. */
export const EVENT_TERMS = [
  'zatrzyman', 'zatrzymany', 'zatrzymanie', 'zatrzymania', 'zatrzymaniu',
  'aresztowan', 'aresztowany', 'aresztowanie', 'aresztowania', 'aresztowaniu',
  'pojmany', 'pojmano',
  'gözalt', 'gozalt', 'gözaltı', 'gozalti', 'gözaltına', 'gozaltina',
  'yakaland', 'yakalandi', 'yakalama', 'tutuklan', 'tutuklandi', 'tutuklama', 'tutuklu',
  'tahliye', 'iddianame', 'mahkeme', 'dava', 'davasi', 'davada', 'davasinda',
  'hukum', 'beraat', 'iade', 'iadesi', 'ekstradisyon', 'savcilik', 'sorusturma', 'karar',
  'operasyon', 'ele gecir', 'baskin',
  'detained', 'detention', 'arrested', 'arrest', 'festgenommen', 'verhaftet', 'inhaftiert',
  'pidatetty', 'vangittu', 'syytetty', 'oikeudenkaynti',
  'wydan', 'wywol', 'czerwona nota', 'red notice', 'ektrad', 'extradit',
  'proces', 'sąd', 'sad', 'court', 'trial', 'hearing', 'lawyer', 'adwokat',
  'sąd', 'decyz', 'oskarz', 'oskarzony', 'oskarzona', 'oskarzenie', 'oskarzenia',
  'prokuratura', 'prokuratury', 'sledztwo', 'dochodzenie',
  'charges', 'indict', 'zwolnion', 'released', 'bail',
  'transfer', 'przekaz', 'eskort', 'deport', 'wywiad', 'mıt', 'mit', 'police', 'policja',
  'zabezpiecz', 'skonfisk', 'confiscat', 'majątek', 'asset',
  'subpoena', 'witness', 'świadek', 'swiatek', 'hearing', 'zeznan', 'testimon',
  'sec ', 'sec charged', 'sec v', 'sec lawsuit', 'pozw', 'lawsuit', 'class action',
  'sentenc', 'wyrok', 'prison', 'więzienie', 'wiezienie', 'skaz', 'absentia', 'zastęp',
  'frozen', 'zamroż', 'zamroz', 'freeze', 'liquidat', 'bankrupt', 'upadłość',
  'turkey', 'turcja', 'türkiye', 'turkiye', 'istanbul', 'stambuł', 'stambul',
  'finland', 'finlandia', 'finlandii',
];

/** Terminy rynkowe - wskazuja wahania kursu, ale NIE sa zdarzeniem w sprawie. */
export const MARKET_TERMS = [
  'price', 'cena', 'kurs', 'spad', 'wzrost', 'pump', 'dump', 'krach', 'crasz',
  'tank', 'tanks', 'plunge', 'surge', 'ralli', 'spadki', 'wzrosty',
];

/** Wyrazy, ktore NIGDY nie powinny dac trafienia (dzwiek podobny). */
export const NOISE_TERMS = [
  'schueler field', 'jon schueler', 'beth schueler', 'faith schueler',
  'schueler high', 'schueler county', 'richard heart transplant',
  'heart transplant', 'heart surgery', 'heart attack', 'heart disease',
  'heart rate', 'heartbeat monitor', 'coronary', 'cardiac',
  'hex code', 'hex color', 'hex value', 'hex string', 'hexdump',
  'pulse survey', 'pulse oximeter', 'pls reg', 'pls one', 'please',
  'baltimore', 'maryland',
  // Wzmianki o innych ludziach o nazwisku Heart
  'jerry heart', 'blake heart', 'sherri heart', 'holly heart', 'james heart sr',
  // Nekrologi i smierc - nazwisk Schueler jest bardzo popularne
  'obituary', 'obituaries', 'funeral home', 'funeral', 'died', 'passed away',
  'necrology', 'memorial service', 'burial', 'graveside', 'wake service',
  'condolences', 'survived by', 'in lieu of flowers',
  // Nie dotyczy sprawy
  'price prediction', 'price analysis', 'hodler', 'hodlers digest',
];

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // usuwa diakrytyki: turkce/niemieckie
    .replace(/[ıİ]/g, 'i')
    .replace(/[şŞ]/g, 's')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[çÇ]/g, 'c')
    .replace(/[öÖ]/g, 'o')
    .replace(/[üÜ]/g, 'u')
    // Dzierżawczość angielska: "Schueler's" musi trafiać jak "Schueler",
    // a "RH's" jak "RH" — inaczej apostrof rozbijał dopasowanie.
    .replace(/[’'`]s(?![a-z0-9])/g, '')
    // Tureckie przyrostki (Schueler'in, Heart'ın, Interpol'e) po apostrofie:
    // apostrof zamieniamy na spację, żeby rdzeń został osobnym słowem.
    .replace(/[’'`]/g, ' ')
    .replace(/[^\p{L}\p{N}\s.+#]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Normalizuje do postaci porownawczej (bez diakrytykow, male litery). */
export function normalize(text) {
  return norm(text);
}

function includesTerm(haystack, term) {
  const t = norm(term);
  if (!t) return false;
  if (t.includes(' ')) return haystack.includes(t);
  // pojedyncze slowo: granice slow, aby "hex" nie trafialo w "hexdump"
  return new RegExp(`(^|[^a-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i').test(haystack);
}

/**
 * Ocenia waznosc wpisu.
 * @param {string} text - pelna tresc (tytul + opis)
 * @param {string} [title] - sam tytul; regula odrzucania szumu dziala tylko na tytule,
 *                            bo opisy artykulow czesto zawieraja slowa typu "died"
 *                            w kontekście cudzego zdarzenia.
 * @returns {{relevant:boolean, score:number, terms:string[], reason:string}}
 */
export function evaluate(text, title = '') {
  const hay = normalize(text);
  if (!hay) return { relevant: false, score: 0, terms: [], reason: 'pusty' };

  // 1. Wyrazy szumu uniewazniaja trafienie - sprawdzamy tylko tytul.
  const noiseHay = title ? normalize(title) : hay;
  const noise = NOISE_TERMS.filter((n) => includesTerm(noiseHay, n));
  if (noise.length) {
    return { relevant: false, score: 0, terms: noise, reason: `szum w tytule: ${noise.join(', ')}` };
  }

  const personHits = PERSON_ALIASES.filter((p) => includesTerm(hay, p));
  const strongHits = STRONG_TERMS.filter((p) => includesTerm(hay, p));
  const cryptoCore = CRYPTO_CORE.filter((p) => includesTerm(hay, p));
  const cryptoWeak = CRYPTO_WEAK.filter((p) => includesTerm(hay, p));
  const eventHits = EVENT_TERMS.filter((p) => includesTerm(hay, p));
  const marketHits = MARKET_TERMS.filter((p) => includesTerm(hay, p));

  const terms = [...new Set([...personHits, ...strongHits, ...cryptoCore, ...cryptoWeak, ...eventHits, ...marketHits])];

  // Nazwisko "Schueler" = jednoznaczne. Pseudonim "Richard Heart" jest szumowy
  // i sam w sobie nie wystarczy - wymaga kontekstu sprawy.
  const surname = personHits.some((p) => norm(p).includes('schueler'));
  const fullName = personHits.some((p) => {
    const n = norm(p);
    return n.includes('richard') && n.includes('schueler');
  });
  // Skrót „RH" bywa używany przez konta śledzące sprawę (np. @sec_rh). Sam w sobie
  // jest zbyt pospolity, więc liczy się tylko razem z sygnałem sprawy.
  const rhAlias = /\brh\b/.test(hay)
    && /\b(detention|detained|custody|extradition|red notice|interpol|istanbul|be[sş]ikta[sş]|t[üu]rkiye|turkey|finland|finnish|court|trial|hearing|charges?|g[oö]zalt|iade|luovutus|tax fraud)\b/.test(hay);

  const pseudonym = rhAlias || personHits.some((p) => {
    const n = norm(p);
    return n === 'richard heart' || n === 'james heart'
      || n === 'richard james heart' || n === 'balina james';
  });
  const crypto = cryptoCore.length > 0;
  const anyCrypto = crypto || cryptoWeak.length > 0;

  let score = 0;
  let reason = '';

  if (surname) {
    score += 140;
    reason = 'nazwisko Schueler';
  } else if (pseudonym) {
    score += 90;
    reason = 'pseudonim Richard Heart';
  }

  if (strongHits.length) {
    score += 45;
    reason = reason ? reason + ' + Interpol/czerwona nota' : 'Interpol / czerwona nota';
  }

  if (crypto) {
    score += 30;
    reason = reason ? reason + ' + HEX/PulseChain' : 'kontekst HEX/PulseChain';
  } else if (cryptoWeak.length) {
    score += 8;
  }

  if (eventHits.length) {
    score += 25;
    if (!surname && !pseudonym && !strongHits.length) {
      // samo zdarzenie bez powiazania z osoba - za szerokie
      if (!anyCrypto) {
        return { relevant: false, score, terms, reason: 'zdarzenie bez powiazania ze sprawa' };
      }
      score += 5;
      reason = 'zdarzenie w kontekście krypto';
    }
  }

  if (marketHits.length) {
    score += 5;
  }

  // Nazwisk Schueler jest wiele. Sama wzmianka (bez pełnego imienia) musi
  // mieć kontekst sprawy: Interpol, HEX/PulseChain albo wydarzenie prawne.
  if (surname && !fullName && strongHits.length === 0 && !crypto && eventHits.length === 0) {
    return { relevant: false, score, terms, reason: 'samo nazwisko bez kontekstu sprawy' };
  }

  // Brak jakiegokolwiek powiazania z osoba / sprawa.
  // WYJATEK: HEX/PulseChain + wydarzenie prawne + Turcja/Finlandia to ta sprawa,
  // nawet gdy wpis nie powtarza nazwiska (np. relacja "Day 14").
  const caseGeo = /\b(istanbul|stambul|turkey|turcja|t[üu]rkiye|finland|finlandia|finnish|finska)\b/.test(hay);
  const caseLegal = /\b(detain\w*|arrest\w*|custody|extradit\w*|court|trial|hearing|verdict|sentenc\w*|charges?|charged|indict\w*|prosecut\w*|police|raid)\b/.test(hay);
  const caseContext = crypto && caseLegal && caseGeo;
  if (!surname && !pseudonym && !strongHits.length && !caseContext) {
    return { relevant: false, score, terms, reason: 'brak powiazania ze sprawa' };
  }

  // Sam pseudonim bez zdarzenia i bez Interpolu - za slabe.
  if (pseudonym && !surname && strongHits.length === 0 && eventHits.length === 0) {
    return { relevant: false, score, terms, reason: 'pseudonim bez kontekstu zdarzenia' };
  }

  // Sam termin krypto ("HEX", "PulseChain") bez osoby i bez zdarzenia - za szerokie.
  if (!surname && !pseudonym && !strongHits.length && eventHits.length === 0) {
    return { relevant: false, score, terms, reason: 'sama terminologia krypto' };
  }

  // Sam Interpol / czerwona nota bez nazwiska i bez kontekstu HEX/PulseChain - za szerokie
  // (ogolne wiadomosci Interpolu nie dotycza tej sprawy).
  if (!surname && !pseudonym && !anyCrypto) {
    return { relevant: false, score, terms, reason: 'ogolna wzmianka o Interpolie' };
  }

  return { relevant: true, score, terms, reason };
}
