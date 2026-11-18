/**
 * Grupowanie wpisow w "zdarzenia" (stories).
 *
 * 20 portali pisze o jednym aresztowaniu - to jedno zdarzenie, nie 20 wiadomosci.
 * Bez tego kanal Discorda zalewa sie powtorzeniami tego samego faktu.
 *
 * Klucz zdarzenia = sygnal glowny (co sie wydarzylo) + wiadomosc o szczegolach
 * ( czy ujawniono szczegoly zabezpieczen / kwoty).
 *
 *   "Schueler zatrzymany"                 -> arrest:plain
 *   "Schueler zatrzymany, zajęto 7 mln $" -> arrest:assets
 *   "Sąd w Helsinkach otworzył sprawę"    -> court:plain
 *
 * Nowy rodzaj zdarzenia (proces po aresztowaniu) = nowe powiadomienie.
 */

/** Sygnaly glowne - wybierany jest pierwszy pasujacy (kolejnosc = priorytet). */
export const PRIMARY_SIGNALS = [
  { id: 'arrest', patterns: [
    /zatrzyman\w*/i, /g[öo]zalt\w*/i, /yakaland\w*/i, /yakalama\w*/i,
    /\bdetain\w*/i, /\barrest\w*/i, /areszt\w*/i, /\bcaptur\w*/i,
    /\bapprehend\w*/i, /\bapprehensi\w*/i, /\btaken\s+into\s+custody\b/i,
    /tutukla\w*/i, /tutuklan\w*/i,
    /kiinni\s+otettu/i, /otettu\s+kiinni/i, /pidätetty/i, /pidatetty/i,
    /pidättäm\w*/i, /vangittu/i, /festgenommen/i, /verhaftet/i, /inhaftiert/i,
  ] },
  { id: 'rednotice', patterns: [
    /red\s+notices?/i, /czerwona\s+nota/i, /czerwonej\s+noty/i,
    /k[ıi]rm[ıi]z[ıi]\s*b[üu]lten/i, /kirmiz\s*bulten/i,
    /interpol[^\n]{0,40}(notice|b[üu]lten)/i,
  ] },
  { id: 'extradition', patterns: [
    /ekstrad\w*/i, /extradit\w*/i, /iade\s+(s[üu]reci|islem)/i,
    /handover\s+to\s+[a-z]/i, /transfer\w*\s+to\s+[a-z]/i, /przekaz\w*\s+do\s+[a-z]/i,
    /ausliefer\w*/i, /luovut\w*/i,
  ] },
  { id: 'court', patterns: [
    /duru[sş]ma\s+a[çc][ıi]ld\w*/i, /mahkeme\w*/i, /\btrial\b/i, /\bhearing\b/i,
    /yarg[ıi]t\w*/i, /s[ąa]d\s+okr[ęe]gowy/i, /\bverdict\b/i, /\bsentenc\w*/i,
    /\bwyrok\w*/i, /\bcharge[sd]?\s+against\b/i, /\bprosecut\w*/i,
    /savc[ıi]\w*/i, /oikeudenk\w*/i, /gericht\w*/i,
  ] },
  { id: 'charges', patterns: [
    /\bcharges?\b/i, /\bcharged\b/i, /\bindict\w*/i,
    /oskarż\w*/i, /oskarz\w*/i, /zarzut\w*/i,
    /iddianame\w*/i, /iddia\s+edildi/i,
    /syytte\w*/i, /syytetty/i, /anklage\w*/i,
  ] },
  { id: 'bodyguards', patterns: [
    /korumalar?\w*\s+(da\s+)?(g[öo]zalt|yakaland\w*)/i,
    /bodyguards?\s+(were\s+)?(detained|arrested|captured)/i,
    /3\s+ochroniarz/i, /guards?\s+(were\s+)?detained/i,
  ] },
  { id: 'ministry', patterns: [
    /g[üu]rlek[^.\n]{0,80}(said|announc|declar|confirm|told|a[çc][ıi]klad\w*|duyurdu)/i,
    /bakan\w*[^.\n]{0,80}(a[çc][ıi]klad\w*|duyurdu)/i,
    /(minister\s+of\s+justice|justice\s+minister)[^.\n]{0,80}(said|announc|declar|confirm|told|order|sign|statement|decision)/i,
    /adalet\s+bakanl\w*[^.\n]{0,80}(a[çc][ıi]klad\w*|duyurdu|statement)/i,
    /ministerstwo\s+sprawiedliwo[śs]ci[^.\n]{0,80}(komunikat|o[śs]wiadcz|poinformowa|podkre[śs]l)/i,
  ] },
  { id: 'mit', patterns: [/\bM[İI]T\b/, /wywiad/i, /istihbarat/i, /intelligence\s+support/i] },
  { id: 'sec', patterns: [/\bSEC\b/, /unregistered\s+(offering|securit)/i, /sec\s+charged/i] },
  { id: 'finland', patterns: [/finland\w*/i, /finnish/i, /suomi/i, /helsinki/i, /veropetos/i, /t[öo]rke[äa]\s+veropetos/i] },
  { id: 'price', patterns: [
    /\b(tanks?|plunges?|tumbled|dropped|dives?)\b/i, /\b\d{1,2}%\s*(drop|fall|spad)/i,
    /kurs\w*\s+(spad\w*|d[üu][sş]t[üu])/i, /token\s+(price|value)/i,
  ] },
];

/** Sygnaly szczegolow - informuja, czy ujawniono konkretne kwoty/zabezpieczenia. */
export const DETAIL_SIGNALS = [
  { id: 'cash', patterns: [
    /7[,.]15\s*(mln|million|milyon|\$)?/i, /7\s+150\s+000/i, /7\s+milyon\s+150/i,
    /\$7\.15\s*m/i, /\$7\s*m\b/i, /\$7[,.]\d+\s*m/i, /cash\s+(seized|confiscated)/i,
    /nakit\s+el\s+ge[çc]irildi/i, /7[,.]\s?15\s*(mln|million)/i,
  ] },
  { id: 'vehicles', patterns: [
    /9\s+(luksus\w*|l[üu]ks\w*|luxury)?\s*(ara[çc]\w*|arac\w*|car\w*|vehicle\w*)/i,
    /9\s+araca/i, /9\s+luksus/i,
  ] },
  { id: 'weapons', patterns: [
    /\b(4 rifles|3 pistols|1[ ,]400 rounds)\b/i,
    /\bsilah\w*/i, /\btabanca\w*/i, /\bcephen\w*/i,
    /\bfirearms?\b/i, /\bammunition\b/i, /\bweapon\w*/i,
  ] },
  { id: 'wallets', patterns: [
    /6\s+(hardware\s+)?(cold\s+)?wallet/i, /6\s+zimnych?\s+portfeli/i,
    /\bcold\s+wallets?\b/i, /hardware\s+wallet/i,
  ] },
  { id: 'watches', patterns: [/\b(24|28|64)\s+(luxury\s+)?watch\w*/i, /\b(24|28|64)\s*zegark\w*/i, /rolex/i] },
];

/**
 * Sygnaly opisujace nowy etap sprawy. W tytule maja pierwszenstwo przed samym
 * zatrzymaniem: "sad po zatrzymaniu" to nowa informacja, a nie kolejna relacja
 * o aresztowaniu (ktora i tak jest juz zgrupowana jako `arrest`).
 */
export const DEVELOPMENT_SIGNALS = ['rednotice', 'extradition', 'court', 'charges', 'bodyguards', 'ministry', 'sec'];

/** Sygnaly zaprzeczajace sygnalowi - "brak decyzji sadu" to nie rozprawa. */
const NEGATIONS = {
  court: [
    /\bno\s+(?:[\w-]+\s+){0,3}(court|trial|hearing|verdict|ruling|sentence)\b/i,
    /\bnot\s+(yet\s+)?(been\s+)?(sentenced|convicted|tried)\b/i,
    /\bwithout\s+(a\s+)?(trial|hearing|verdict|sentence)\b/i,
    /\bnie\s+(ma|będzie|został|została)\s+(jeszcze\s+)?(wyrok|rozpraw|proces)/i,
  ],
  charges: [
    /\bno\s+(?:[\w-]+\s+){0,3}(charges?|indictment)\b/i,
    /\bnot\s+(yet\s+)?(been\s+)?(charged|indicted)\b/i,
    /\bwithout\s+(any\s+)?(charge|charges|indictment)\b/i,
    /\bnie\s+(postawiono|ma)\s+(mu\s+)?zarzut/i,
  ],
  extradition: [
    /\bno\s+(?:[\w-]+\s+){0,5}extradition\b/i,
    /\bnot\s+(yet\s+)?(been\s+)?extradited\b/i,
    /\bnie\s+(ma|będzie)\s+ekstradycji/i,
  ],
};

/**
 * Mocne warianty sygnalow. "Prosecutor" czy "savci" czesto opisuja samo
 * zatrzymanie, wiec nie moga same zmienic zdarzenia w rozprawę.
 */
const STRONG_PATTERNS = {
  court: /\b(court|trial|hearing|verdict|sentenc\w*|convicted)\b|\bs[ąa]d\b|\bwyrok\w*|\bmahkeme\w*|\byarg[ıi]t\w*|\boikeudenk\w*|\bgericht\w*|duru[sş]ma/i,
  charges: /\b(charges?|charged|indict\w*)\b|\bzarzut\w*|\boskarż\w*|\bsyytte\w*|\biddianame\w*/i,
};

function isNegated(id, text) {
  return (NEGATIONS[id] || []).some((p) => p.test(text));
}

/** Sygnaly nowego etapu sprawy (bez tych zaprzeczonych w tekscie). */
export function developmentSignals(text) {
  const t = String(text || '');
  if (!t) return [];
  return PRIMARY_SIGNALS
    .filter((s) => DEVELOPMENT_SIGNALS.includes(s.id))
    .filter((s) => s.patterns.some((p) => p.test(t)))
    .filter((s) => !isNegated(s.id, t))
    .filter((s) => !STRONG_PATTERNS[s.id] || STRONG_PATTERNS[s.id].test(t))
    .map((s) => s.id);
}

/** Zwraca id sygnalow glownych obecnych w tekscie. */
export function primarySignals(text) {
  const t = String(text || '');
  return PRIMARY_SIGNALS.filter((s) => s.patterns.some((p) => p.test(t))).map((s) => s.id);
}

/** Zwraca id sygnalow szczegolowych obecnych w tekscie. */
export function detailSignals(text) {
  const t = String(text || '');
  return DETAIL_SIGNALS.filter((s) => s.patterns.some((p) => p.test(t))).map((s) => s.id);
}

/**
 * Klucz zdarzenia - rodzaj zdarzenia (areszt, proces, ekstradycja...).
 *
 * Kolejnosc: najpierw nowy etap sprawy w tytule, potem w pierwszych zdaniach
 * tresci, a na koncu zwykly priorytet sygnalow. Dzieki temu artykul
 * "ruszyl proces zatrzymanego" nie jest liczony jako kolejne aresztowanie.
 *
 * @param {string} text
 * @param {string} [title]
 * @returns {string|null}
 */
export function storyKey(text, title = '') {
  const headline = developmentSignals(title);
  if (headline.length) return headline[0];
  const lead = developmentSignals(String(text || '').slice(0, 400));
  if (lead.length) return lead[0];
  const primary = primarySignals(text);
  if (!primary.length) return null;
  // Pierwszy z listy = najwyzszy priorytet.
  return primary[0];
}

/**
 * Poziom szczegolowosci wpisu: 1 = ogolny, 2 = z konkretnymi kwotami/zabezpieczeniami.
 * Wyzszy poziom = wiecej nowych informacji (warte osobnego powiadomienia).
 */
export function storyDetailLevel(text) {
  return detailSignals(text).length ? 2 : 1;
}

/** Czy wpis opisuje wazny development (areszt, ekstradycja, proces, nowy komunikat). */
export function isHighSignal(text) {
  const p = primarySignals(text);
  return p.includes('arrest') || p.includes('extradition') || p.includes('court') ||
    p.includes('charges') || p.includes('ministry') || p.includes('bodyguards') ||
    p.includes('rednotice');
}
