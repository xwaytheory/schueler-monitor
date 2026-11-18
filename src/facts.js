/**
 * Warstwa weryfikacji faktów (źródło: SOURCE-PACK.md, stan 21.10.2026).
 *
 * Rozróżniamy:
 *   'confirmed' — ustalenie potwierdzone w podanych źródłach,
 *   'claimed'   — twierdzenie jednego źródła (wymaga atrybucji),
 *   'error'     — znany błąd redakcyjny do oznaczenia.
 */

/**
 * Osoba prywatna (żona) nie może być identyfikowana w treściach pochodzących
 * z mediów. Redakcja zamienia imię i nazwisko na inicjały z oficjalnych źródeł.
 */
const PRIVATE_NAME_RE = /\bAlina(?:\s+Kara)?\b/gi;

export function redactPrivate(text) {
  return String(text ?? '').replace(PRIVATE_NAME_RE, 'A.K.');
}

/** Dzień sprawy liczony od zatrzymania 14.10.2026 (dzień 1) w strefie Stambułu. */
const CASE_START_DATE = '2026-10-14';
const CASE_TZ = 'Europe/Istanbul';
const isoDayFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: CASE_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
});

function civilDay(date = new Date()) {
  return isoDayFmt.format(date);
}

export function caseDay(date = new Date()) {
  const start = Date.parse(`${CASE_START_DATE}T00:00:00Z`);
  const today = Date.parse(`${civilDay(date)}T00:00:00Z`);
  return Math.floor((today - start) / 86_400_000) + 1;
}

/** Ile pełnych dni zostało do daty (ujemne = termin minął). Liczone w strefie sprawy. */
export function daysUntil(isoDate, date = new Date()) {
  const target = Date.parse(`${isoDate}T00:00:00Z`);
  const today = Date.parse(`${civilDay(date)}T00:00:00Z`);
  return Math.round((target - today) / 86_400_000);
}

/** Koniec wyliczanego okna ustawowego: 40. dzień od zatrzymania. */
export const CASE_DEADLINE_DATE = '2026-11-23';

/**
 * Punkty kontrolne na pasku postępu. `at` to numer dnia okna 14.10 → 23.11
 * (0 = zatrzymanie, 40 = limit), a render przelicza go na procent szerokości.
 */
export const PROGRESS_MARKS = [
  { id: 'start', at: 0, label: '14.10', note: 'zatrzymanie' },
  { id: 'decision', at: 5, label: '~18.10', note: 'decyzja sądu' },
  { id: 'docs', at: 19, label: '1.11', note: 'dokumenty Finlandii' },
  { id: 'limit', at: 40, label: '23.11', note: 'limit 40 dni' },
];

/** Postęp okna ustawowego 0–100 % (dzień 1 = 0 %, 40. dzień = 100 %). */
export function caseProgress(date = new Date()) {
  const day = caseDay(date);
  return Math.min(100, Math.max(0, ((day - 1) / 40) * 100));
}

const plDate = (iso) => iso.split('-').reverse().join('.');

export const CASE_STATUS = {
  // Zatrzymanie 14.10.2026 odbyło się w trybie gözaltı. Od tego czasu sąd
  // musiał zdecydować o areszcie, nadzorze albo zwolnieniu — tej decyzji
  // nie ma w źródłach publicznych. Nie wolno więc opisywać gözaltı jako
  // statusu trwającego w dniu 32.
  detention: 'gözaltı (14.10.2026)',
  get day() { return caseDay(); },
  get statusAsOf() { return plDate(civilDay()); },
  get statusPl() {
    return `zatrzymanie potwierdzone 14.10.2026 — brak publicznej decyzji sądu o tymczasowym areszcie ekstradycyjnym, nadzorze sądowym albo zwolnieniu; obecny status prawny nieujawniony; stan na ${this.statusAsOf}`;
  },
  get statusShort() { return `Status sądowy nieujawniony · dzień ${this.day}`; },
  get statusEn() {
    return `detention confirmed on 14.10.2026 — no public court decision on provisional extradition arrest, judicial control or release; current legal status undisclosed; as of ${this.statusAsOf}`;
  },
  charge: 'ciężkie oszustwo podatkowe (aggravated tax fraud)', chargeShort: 'Zarzut w nocie (Finlandia)',
  chargeEn: 'aggravated tax fraud',
  redNotice: '2024/65212',
  redNoticeDate: '13.12.2024',
  requestingCountry: 'Finlandia',
  arrestWarrantDate: '13.09.2024',
  court: 'sąd pierwszej instancji w Helsinkach (käräjäoikeus)',    courtShort: 'Tymczasowe aresztowanie zaoczne (Finlandia)',
  taxYear: 2022,
  taxRank: 24,
  taxIncome: '15 247 314 €',
  taxEmploymentIncome: '0 €',
  taxRate: '34 %',
  taxArrears: 'blisko 5,2 mln € (mätky)',
  secDismissal: '28.02.2025',
  publicConfirmation: '17.10.2026',
  extraditionDeadline: '1.11.2026',
  extraditionMax: '23.11.2026',
  extraditionNote:
    'brak potwierdzonego wniosku. Wyliczenie redakcji: 18 dni od 14.10 mija 1.11.2026, ' +
    '40 dni — 23.11.2026 (ECE art. 16)',
};

/**
 * Akty prawne cytowane na stronie — każdy z linkiem do tekstu źródłowego.
 * `label`/`en` to krótkie nazwy w przypisach; `url` prowadzi do aktu.
 */
export const LEGAL_ACTS = {
  law6706: { label: 'Ustawa 6706', en: 'Law 6706', url: 'https://www.mevzuat.gov.tr/mevzuatmetin/1.5.6706.pdf' },
  cmk: { label: 'CMK 5271', en: 'CMK 5271', url: 'https://www.mevzuat.gov.tr/mevzuatmetin/1.5.5271.pdf' },
  ece: { label: 'ECE (ETS 24)', en: 'ECE (ETS 24)', url: 'https://www.coe.int/en/web/conventions/full-list?module=treaty-detail&treatynum=024' },
  cets98: { label: 'Protokół ETS 98', en: 'Protocol ETS 98', url: 'https://www.coe.int/en/web/conventions/full-list?module=treaty-detail&treatynum=098' },
  act456: { label: 'Ustawa fińska 456/1970', en: 'Finnish Act 456/1970', url: 'https://www.finlex.fi/fi/laki/ajantasa/1970/19700456' },
  act621: { label: 'Ustawa fińska 621/1999', en: 'Finnish Act 621/1999', url: 'https://www.finlex.fi/fi/laki/ajantasa/1999/19990621' },
  constitution: { label: 'Konstytucja TR art. 38', en: 'Turkish Constitution art. 38', url: 'https://www.anayasa.gov.tr/tr/mevzuat/anayasa/' },
  vuk: { label: 'VUK art. 359', en: 'VUK art. 359', url: 'https://www.mevzuat.gov.tr/mevzuatmetin/1.5.213.pdf' },
  echr: { label: 'EKPC', en: 'ECHR', url: 'https://www.echr.coe.int/documents/d/echr/Convention_ENG' },
};

/** Data ostatniego przeglądu redakcyjnego (nie: ostatniego potwierdzonego faktu). */
export const REVIEWED_AT = '16.11.2026';

/** Wspólne zastrzeżenie prawne — używane na stronie i w powiadomieniach. */
export const CASE_DISCLAIMER =
  'Richard James Schueler nie został skazany w żadnej jurysdykcji i korzysta z domniemania niewinności. ' +
  'Opisane zarzuty pozostają twierdzeniami stron na etapie zatrzymania, śledztwa lub postępowania sądowego. ' +
  'Zatrzymanie w Turcji 14.10.2026 nastąpiło w trybie gözaltı (zatrzymanie policyjne) — monitor nie zna publicznej decyzji sądu o dalszym statusie. ' +
  'Monitor nie jest stroną postępowania i nie twierdzi, że zarzuty są prawdziwe.';

/**
 * Najważniejsze fakty — pierwszy ekran strony.
 * `badge`: 'confirmed' (źródło pierwotne lub wiele relacji) albo
 * 'calculated' (wyliczenie redakcji, nie komunikat stron).
 */
export const KEY_FACTS = [
  {
    id: 'status', label: 'Status prawny', badge: 'unconfirmed',
    value: 'Status sądowy nieujawniony',
    note: 'Zatrzymany 14.10.2026 w Beşiktaş (potwierdzone 17.10). Gözaltı z mocy prawa kończy się w kilka dni, więc sąd musiał zdecydować: areszt ekstradycyjny, nadzór albo zwolnienie. Żadnej decyzji nie ma w źródłach publicznych.',
    source: 'MS Turcji, AA · CMK 91',
    url: 'https://basin.adalet.gov.tr/1-milyar-dolarlik-kripto-vurgununun-suphelisi-istanbul-da-yakalandi',
  },
  {
    id: 'basis', label: 'Podstawa', badge: 'confirmed',
    value: 'Czerwona nota Interpolu 2024/65212',
    note: 'Wniosek Finlandii · opublikowana 13.12.2024 · nota nie jest nakazem aresztowania.',
    source: 'Interpol',
    url: 'https://ws-public.interpol.int/notices/v1/red/2024-65212',
  },
  {
    id: 'charge', label: 'Zarzut w nocie', badge: 'confirmed',
    value: 'Ciężkie oszustwo podatkowe',
    note: 'Jedyny zarzut w publicznym rekorcie Interpolu. Turcja nie ogłosiła własnych zarzutów.',
    source: 'Interpol',
    url: 'https://ws-public.interpol.int/notices/v1/red/2024-65212',
  },
  {
    id: 'seizure', label: 'Zabezpieczenia', badge: 'confirmed',
    value: '7,15 mln USD i 160 tys. TL gotówki',
    note: '15 adresów. 6 zimnych portfeli, 28 zegarków, 4 karabiny, 3 pistolety, 1 400 naboi. Osobno 9 aut żony.',
    source: 'MS Turcji, AA',
    url: 'https://basin.adalet.gov.tr/1-milyar-dolarlik-kripto-vurgununun-suphelisi-istanbul-da-yakalandi',
  },
  {
    id: 'extradition', label: 'Ekstradycja', badge: 'unconfirmed',
    value: 'Brak potwierdzonego wniosku Finlandii',
    note: 'Terminy 1.11 i 23.11.2026 to wyliczenie redakcji z ECE art. 16, nie komunikat stron.',
    source: 'Metodologia',
    url: '#metodologia',
  },
  {
    id: 'conviction', label: 'Wyrok', badge: 'confirmed',
    value: 'Brak znanego wyroku',
    note: 'Nie ma publicznego wyroku w żadnej jurysdykcji. Pozew cywilny SEC oddalony 28.02.2025 bez orzeczenia o istocie.',
    source: 'E.D.N.Y. 1:23-cv-05749',
    url: 'https://www.courtlistener.com/docket/67649362/securities-and-exchange-commission-v-schueler/',
  },
];

/** Ostatnie ustalenie potwierdzone w źródłach — punkt odniesienia dla „co nowego”. */
export const LAST_CONFIRMED = {
  date: '21.10.2026',
  text: 'Brak publicznego orzeczenia o areszcie, brak ogłoszonych zarzutów w Turcji, brak potwierdzonego wniosku o ekstradycję.',
};

/**
 * Terminy ustawowe, które da się policzyć z daty zatrzymania (14.10.2026).
 * `date` służy do wyliczenia licznika dni; `basis` to podstawa prawna.
 */
export const LEGAL_DEADLINES = [
  {
    id: 'docs-18',
    label: 'Dokumenty Finlandii',
    date: '2026-11-01',
    days: 18,
    basis: 'ECE art. 16 ust. 4 · ustawa 6706 art. 14(6)',
    acts: ['ece', 'law6706'],
    pl: '18 dni na przesłanie wniosku i dokumentów ekstradycyjnych. Konwencja (ECE art. 16 ust. 4) pozwala wtedy uchylić tymczasowe zatrzymanie, a turecka ustawa 6706 art. 14(6) czyni to obowiązkowym, jeśli dokumenty nie dotrą.',
    note: 'Termin liczony przez redakcję od dnia zatrzymania; Turcja nie potwierdziła, czy wniosek wpłynął.',
  },
  {
    id: 'max-40',
    label: 'Maksimum zatrzymania ekstradycyjnego',
    date: '2026-11-23',
    days: 40,
    basis: 'ECE art. 16 ust. 4 · ustawa 6706 art. 14(4)',
    acts: ['ece', 'law6706'],
    pl: '40 dni — ustawowy limit tymczasowego zatrzymania ekstradycyjnego. Po nim zwolnienie; ponowne zatrzymanie jest możliwe, jeśli wniosek dotrze później. Praktyka sporadycznie łamie ten termin — to błąd, nie podstawa prawna.',
    note: 'To limit samego zatrzymania, nie decyzja o ekstradycji.',
  },
];

/**
 * Roadmapa prawna: od zatrzymania do możliwych zakończeń. Statusy:
 *   'done'     — już się stało,
 *   'unknown'  — powinno się stać, brak publicznej decyzji,
 *   'current'  — trwa otwarte okno/termin,
 *   'next'     — następny krok ustawowy,
 *   'possible' — scenariusz zależny od decyzji stron.
 */
export const LEGAL_ROADMAP = [
  {
    id: 'detention',
    when: '14.10.2026',
    status: 'done',
    title: 'Zatrzymanie i gözaltı',
    pl: 'Policja stambulska i MİT zatrzymują go w Beşiktaş. W sprawach ekstradycyjnych zatrzymany musi stanąć przed sędzią pokoju najpóźniej w ciągu 24 godzin. Zwykłe zatrzymanie policyjne też ma limit 24 godzin (plus 12 godzin na transport); wydłużenie do 4 dni dotyczy wyłącznie spraw zbiorowych i wyjątków z CMK art. 91(4).',
    basis: 'CMK 5271 art. 91 · ustawa 6706 art. 14(3)',
    acts: ['cmk', 'law6706'],
    src: 'mevzuat.gov.tr · MoJ TR',
    url: 'https://basin.adalet.gov.tr/1-milyar-dolarlik-kripto-vurgununun-suphelisi-istanbul-da-yakalandi',
  },
  {
    id: 'judge',
    when: 'do ~18.10.2026',
    status: 'unknown',
    title: 'Decyzja sędziego po gözaltı',
    pl: 'Po zakończeniu gözaltı sąd musi wybrać: geçici tutuklama (areszt na potrzeby ekstradycji), adli kontrol (nadzór sądowy) albo zwolnienie. Żadnej z tych decyzji nie ma w źródłach publicznych — dlatego status prawny pozostaje nieujawniony.',
    basis: 'CMK art. 91 i 109 · ustawa 6706 art. 14(3), (5)–(6)',
    acts: ['cmk', 'law6706'],
    src: 'mevzuat.gov.tr',
  },
  {
    id: 'docs',
    when: 'okno: do 1.11.2026',
    status: 'current',
    title: '18 dni na dokumenty Finlandii',
    pl: 'Finlandia musi przesłać formalny wniosek razem z dokumentami. Jeśli nie dotrą w 18 dni od zatrzymania, tymczasowe zatrzymanie ekstradycyjne musi zostać uchylone. Turcja nie potwierdziła publicznie, czy wniosek wpłynął.',
    basis: 'ECE art. 16 ust. 4 · ustawa 6706 art. 14(6)',
    acts: ['ece', 'law6706'],
    src: 'Rada Europy · mevzuat.gov.tr',
    url: 'https://www.coe.int/en/web/conventions/full-list?module=treaty-detail&treatynum=024',
  },
  {
    id: 'max40',
    when: 'limit: 23.11.2026',
    status: 'next',
    title: '40 dni — maksimum geçici tutuklama',
    pl: 'Nawet z dokumentami tymczasowe zatrzymanie ekstradycyjne nie może przekroczyć 40 dni. Po tym terminie musi nastąpić zwolnienie; ponowne zatrzymanie jest możliwe, gdy wniosek dotrze później. To nadal nie jest decyzja o ekstradycji.',
    basis: 'ECE art. 16 ust. 4 · ustawa 6706 art. 14(4)',
    acts: ['ece', 'law6706'],
    src: 'Rada Europy · mevzuat.gov.tr',
    url: 'https://www.coe.int/en/web/conventions/full-list?module=treaty-detail&treatynum=024',
  },
  {
    id: 'finland-request',
    when: 'bez terminu',
    status: 'possible',
    title: 'Finlandia przygotowuje i wysyła wniosek',
    pl: 'Wniosek wychodzący przygotowuje policja i prokuratura, a wysyła go Ministerstwo Sprawiedliwości Finlandii kanałem dyplomatycznym (ustawa 456/1970 §§ 13 i 26). Finlandia nie ma ustawowego terminu na złożenie wniosku — ogranicza ją tylko okno 18/40 dni po stronie tureckiej. Dokumenty nie są z zasady jawne: dostęp można odmówić, gdy ujawnienie szkodziłoby stosunkom międzynarodowym albo śledztwu (ustawa 621/1999 § 24). Pierwszym publicznym sygnałem będzie więc najpewniej Yle/HS/STT albo komunikat KRP.',
    basis: 'Laki 456/1970 §§ 13, 26 · 621/1999 § 24',
    acts: ['act456', 'act621'],
    src: 'Finlex · Ministerstwo Sprawiedliwości Finlandii',
    url: 'https://www.finlex.fi/fi/laki/ajantasa/1970/19700456',
  },
  {
    id: 'court',
    when: 'bez terminu',
    status: 'possible',
    title: 'Sąd bada wniosek (İstanbul Ağır Ceza Mahkemesi)',
    pl: 'Po doręczeniu wniosku sąd bada jego dopuszczalność i czy zarzut nie jest sprawą polityczną. Ustawowego terminu nie ma; zatrzymanie jest wtedy kontrolowane co 30 dni i nie może trwać dłużej niż kara grożąca za zarzut.',
    basis: '6706 art. 15, 16(1)–(2) i 18',
    acts: ['law6706'],
    src: '6706 · DIABGM',
  },
  {
    id: 'cassation',
    when: 'do 3 miesięcy',
    status: 'possible',
    title: 'Kasacja do Yargıtay',
    pl: 'Od decyzji sądu przysługuje kasacja do Sądu Najwyższego, który ma ją rozpoznać w ciągu 3 miesięcy. Do czasu prawomocności zatrzymanie trwa.',
    basis: '6706 art. 18(4)',
    acts: ['law6706'],
    src: '6706',
  },
  {
    id: 'executive',
    when: 'do 1 roku',
    status: 'possible',
    title: 'Decyzja prezydenta o wydaniu',
    pl: 'Ostateczną decyzję o przekazaniu podejmuje prezydent na wniosek ministra sprawiedliwości. Jeśli w ciągu roku od prawomocnej decyzji sądu nie zapadnie decyzja wykonawcza, środki przymusu muszą zostać zniesione. Odmowa jest możliwa także po decyzji sądu.',
    basis: '6706 art. 19 i 16(3) · AYM 2018/19302',
    acts: ['law6706'],
    src: '6706 · Trybunał Konstytucyjny TR',
  },
  {
    id: 'surrender',
    when: 'po decyzji',
    status: 'possible',
    title: 'Przekazanie do Finlandii',
    pl: 'Jeśli ekstradycja zostanie zatwierdzona, Turcja informuje Finlandię o miejscu i dacie przekazania. Od wyznaczonej daty Turcja może go zwolnić po 15 dniach, a musi po 30 — strony mogą też ustalić nową datę (ECE art. 18 ust. 3–5). Po przylocie sąd fiński stosuje areszt i sprawa karna wraca na wokandę.',
    basis: 'ECE art. 18 ust. 3–5',
    acts: ['ece'],
    src: 'Rada Europy',
    url: 'https://www.coe.int/en/web/conventions/full-list?module=treaty-detail&treatynum=024',
  },
  {
    id: 'citizenship',
    when: 'zależne od nieznanego faktu',
    status: 'conditional',
    title: 'Obywatelstwo tureckie blokuje ekstradycję',
    pl: 'Turecki obywatel nie może być wydany za granicę. Nie znaleźliśmy potwierdzenia, że Schueler ma tureckie obywatelstwo — tureckie komunikaty policyjne mówią o „podejrzanych cudzoziemskich”, a rekord Interpolu podaje obywatelstwo USA. Turecki dowód tożsamości zwykle dowodzi obywatelstwa, ale żadne źródło takiego dokumentu nie potwierdza; sam pobyt czy karta pobytu takiej ochrony nie dają.',
    basis: 'Anayasa art. 38 · 6706 art. 11(1)(a)',
    acts: ['constitution', 'law6706'],
    src: 'Konstytucja TR · 6706',
  },
];

/** Czynniki, które mogą zmienić powyższe kroki — jawnie pokazane. */
export const LEGAL_NOTES = [
  'Brak publicznej decyzji nie znaczy, że jej nie ma — tureckie sądy nie publikują decyzji w sprawach ekstradycyjnych, a Finlandia nie komentuje wniosków (tajemnica dokumentów, ustawa 621/1999 s. 24).',
  'Praktyka sporadycznie przedłuża zatrzymanie ponad 40 dni i sporządza wniosek bez pełnych dokumentów; to błąd, nie podstawa prawna.',
  'Przestępstwa skarbowe są co do zasady ekstradycyjne, jeśli odpowiadają przestępstwu tej samej natury w prawie tureckim (art. 2 protokołu ETS 98, który zastąpił art. 5 ECE). Sporne pozostaje, czy fiński zarzut odpowiada tureckiemu przestępstwu skarbowemu (VUK art. 359) — to typowy zarzut obrony, nie automatyczne zwolnienie.',
  'Gdyby Finlandia nie przesłała wniosku na czas, może wystąpić o zatrzymanie ponownie (ECE art. 16 ust. 5), prowadzić sprawę zaocznie albo korzystać z pomocy prawnej w Turcji; w tej sprawie fiński sąd już raz aresztował go zaocznie (13.09.2024).',
  'Jeśli Turcja odmówi, musi podać uzasadnienie (ECE art. 18 ust. 2), a Finlandia może wracać do sprawy karnej i wniosku w przyszłości — odmowa nie kończy sprawy.',
  'Warunki formalne, które sąd turecki sprawdza zawsze: podwójna karalność (czyn zagrożony co najmniej rokiem w obu krajach — ECE art. 2 ust. 1, fińska ustawa 456/1970 § 4) oraz zasada specjalności, czyli zakaz ścigania za inne czyny niż objęte zgodą (ECE art. 14; ustawa 6706 art. 10(4)).',
  'Odrębne podstawy odmowy: charakter polityczny lub dyskryminacyjny wniosku, ne bis in idem i przedawnienie (ECE art. 3, 9, 10; ustawa 6706 art. 11). Możliwe też uproszczone wydanie za zgodą osoby (ustawa 6706 art. 17).',
];

/** Ustalenia potwierdzone w podanych źródłach. */
export const CONFIRMED_FACTS = [
  {
    id: 'detained',
    short: 'Zatrzymany 14.10.2026 rano w Beşiktaş (Stambuł) wraz z żoną. Publicznie potwierdzone 17.10.2026. Ostatnie potwierdzone ustalenie (21.10.2026): brak publicznej decyzji sądu — nie wiadomo, czy jest w areszcie ekstradycyjnym, w nadzorze sądowym czy na wolności.',
    pl: 'Zatrzymany 14.10.2026 rano w dzielnicy Beşiktaş w Stambule, wraz z żoną. Publicznie potwierdzone 17.10.2026 (MoJ, AA). Ostatnie potwierdzone ustalenie (21.10.2026): brak jakiejkolwiek publicznej decyzji sądu. Zatrzymanie policyjne (gözaltı) ma ustawowy limit kilku dni, więc dalszy status — areszt ekstradycyjny, nadzór sądowy albo zwolnienie — pozostaje nieujawniony.',
    en: 'Detained on 14.10.2026 in Beşiktaş, Istanbul, together with his wife. Publicly confirmed on 17.10.2026 (MoJ, AA). Last confirmed status (21.10.2026): no public court decision at all. Police custody has a statutory limit of a few days, so his current status — provisional extradition arrest, judicial control or release — remains undisclosed.',
    level: 'confirmed',
    source: 'MoJ, AA, İHA, policja stambułska',
    links: [
      { label: 'MoJ (17.10.2026)', url: 'https://basin.adalet.gov.tr/1-milyar-dolarlik-kripto-vurgununun-suphelisi-istanbul-da-yakalandi' },
      { label: 'AA (17.10.2026)', url: 'https://www.aa.com.tr/tr/gundem/bakan-gurlek-interpolun-kirmizi-bultenle-aradigi-abdli-schuelerin-yakalandigini-bildirdi/4091693' },
    ],
  },
  {
    id: 'charge',
    short: 'Czerwona nota Interpolu 2024/65212 (opublikowana 13.12.2024) na wniosek Finlandii. W oficjalnym rekordzie jedyny zarzut: „1. AGGRAVATED TAX FRAUD”. Nota nie jest nakazem aresztowania.',
    pl: 'Czerwona nota Interpolu (sygn. 2024/65212), opublikowana 13.12.2024 na wniosek Finlandii. W oficjalnym, publicznym rekordzie Interpolu jedynym zarzutem jest „1. AGGRAVATED TAX FRAUD” (ciężkie oszustwo podatkowe). Czerwona nota to prośba o lokalizację i zatrzymanie — nie nakaz aresztowania; Turcja nie ogłosiła własnych zarzutów.',
    en: 'Interpol Red Notice (ref. 2024/65212), published on 13.12.2024 at Finland’s request. The only charge in the official Interpol record is "1. AGGRAVATED TAX FRAUD". A Red Notice is a request to locate and detain — not an arrest warrant; Turkey has not announced its own charges.',
    level: 'confirmed',
    source: 'Interpol public API (live)',
    links: [
      { label: 'Interpol — record 2024/65212', url: 'https://ws-public.interpol.int/notices/v1/red/2024-65212' },
      { label: 'Interpol — czerwone noty', url: 'https://www.interpol.int/How-we-work/Notices/Red-Notices' },
    ],
  },
  {
    id: 'finland-case',
    short: 'Finlandia: 13.09.2024 tymczasowe aresztowanie zaoczne w sprawie ciężkiego oszustwa podatkowego (2020–2024) i zarzutów pobicia 16-latka (2021).',
    pl: 'Sąd pierwszej instancji w Helsinkach (käräjäoikeus) zarządził 13.09.2024 tymczasowe aresztowanie zaoczne (w nieobecności) w sprawie zarzutów ciężkiego oszustwa podatkowego (2.06.2020–2.04.2024) oraz pobicia 16-latka (16–17.02.2021). Urząd Skarbowy Finlandii zawiadomił policję. To odrębna sprawa fińska, nie turecka.',
    en: 'The Helsinki District Court ordered his remand in absentia on 13.09.2024 for aggravated tax fraud (2.06.2020–2.04.2024) and assault of a 16-year-old (16–17.02.2021). The Finnish Tax Administration notified the police. This is a separate Finnish case, not the Turkish one.',
    level: 'confirmed',
    source: 'Yle 17.09.2024, HS, Iltalehti (relacje medialne)',
    links: [
      { label: 'Yle (17.09.2024)', url: 'https://yle.fi/a/74-20112197' },
      { label: 'HS (17.09.2024)', url: 'https://www.hs.fi/suomi/art-2000010703487.html' },
    ],
  },
  {
    id: 'no-conviction',
    short: 'Brak skazania w żadnej jurysdykcji. Pozew cywilny SEC oddalony 28.02.2025 bez orzeczenia o istocie zarzutów; brak sprawy karnej w USA.',
    pl: 'Schueler nie został skazany w żadnej jurysdykcji. Sąd federalny w USA oddalił pozew cywilny SEC 28.02.2025 m.in. z powodu braku jurysdykcji osobistej (Rule 12(b)(2)) i niewystarczającego uzasadnienia pozwu (12(b)(6)); 21.04.2025 SEC nie złożyła poprawionego pozwu. Sąd nie orzekł o istocie zarzutów. Przeciwko Schuelerowi nie toczy się postępowanie karne w USA.',
    en: 'He has not been convicted in any jurisdiction. The US federal court dismissed the SEC civil case on 28.02.2025 for lack of personal jurisdiction (Rule 12(b)(2)) and failure to state a claim (12(b)(6)); the SEC did not amend by 21.04.2025. No ruling on the merits. No US criminal proceedings against him.',
    level: 'confirmed',
    source: 'E.D.N.Y. 1:23-cv-05749, Dkt 57 i 60',
    links: [
      { label: 'CourtListener — docket', url: 'https://www.courtlistener.com/docket/67649362/securities-and-exchange-commission-v-schueler/' },
      { label: 'Postanowienie, Dkt 57 (PDF)', url: 'https://storage.courtlistener.com/recap/gov.uscourts.nyed.501047/gov.uscourts.nyed.501047.57.0.pdf' },
    ],
  },
  {
    id: 'tax-record',
    short: '2022: 24. miejsce na fińskiej liście podatkowej, 15 247 314 € dochodu kapitałowego, 0 € z pracy, stawka 34 %. To dane podatkowe, nie przedmiot zarzutu.',
    pl: 'W roku podatkowym 2022 zajął 24. miejsce na fińskiej liście podatkowej: 15 247 314 € dochodu kapitałowego przy zerowym dochodzie z pracy, stawka 34 %. Ponieważ nie pobierano zaliczek, powstało blisko 5,2 mln € zaległości (mätky). To dane podatkowe, nie przedmiot zarzutu.',
    en: 'For tax year 2022 he ranked 24th on the Finnish tax list: EUR 15,247,314 in capital income with zero employment income, 34 % tax rate. Because no tax advances were withheld, nearly EUR 5.2 million in arrears (mätky) accrued. This is tax data, not the charge itself.',
    level: 'confirmed',
    source: 'HS Verokone, IS 22.12.2024, Svenska Yle',
    links: [
      { label: 'HS Verokone — rekord', url: 'https://verokone.hs.fi/henkilo/1979Schueler%20Richard%20James' },
      { label: 'IS (22.12.2024)', url: 'https://www.is.fi/kotimaa/art-2000010922223.html' },
    ],
  },
  {
    id: 'disappearance',
    short: 'Rok później jego dochody w Finlandii spadły do zera i zniknął z Verokone — miejsce zamieszkania było nieznane.',
    pl: 'Rok później jego dochody w Finlandii spadły do zera i zniknął z Verokone — o jego miejscu zamieszkania nie było wiadomo.',
    en: 'A year later his Finnish income dropped to zero and he disappeared from Verokone — his place of residence was unknown.',
    level: 'confirmed',
    source: 'Iltalehti 8.11.2024',
    links: [
      { label: 'Iltalehti (8.11.2024)', url: 'https://www.iltalehti.fi/kotimaa/a/b9627dc4-ef20-481b-b2a1-ad3fd749072f' },
    ],
  },
  {
    id: 'seizure-official',
    short: 'Oficjalna lista zabezpieczeń (17.10.2026): 7,15 mln USD + 160 tys. TL, 6 zimnych portfeli, 28 zegarków, 4 karabiny, 3 pistolety bez pozwolenia, 1 400 naboi; 15 adresów w Beşiktaş, Üsküdar i Sarıyer. Osobno 9 samochodów żony (AA).',
    pl: 'Oficjalna lista zabezpieczeń (MoJ/Gürlek, 17.10.2026) obejmuje 15 adresów w Beşiktaş, Üsküdar i Sarıyer: 7 150 000 USD + 160 000 TL gotówki, 6 zimnych portfeli, 300 torebek, 100 par butów, 136 par okularów, 28 zegarków, 97 sztuk biżuterii, 29 telefonów, 12 laptopów, 11 obudów komputerowych, 19 dysków SSD, 46 pendrive’ów, 19 kart graficznych, 4 karabiny, 3 pistolety bez pozwolenia i 1 400 naboi. Osobno: 9 samochodów zarejestrowanych na żonę (AA).',
    en: 'The official seizure list (MoJ/Gürlek, 17.10.2026) covers 15 addresses in Beşiktaş, Üsküdar and Sarıyer: USD 7,150,000 + TRY 160,000 cash, 6 cold wallets, 300 bags, 100 pairs of shoes, 136 pairs of glasses, 28 watches, 97 pieces of jewellery, 29 phones, 12 laptops, 11 computer cases, 19 SSDs, 46 USB drives, 19 graphics cards, 4 rifles, 3 unlicensed pistols and 1,400 rounds. Separately: 9 vehicles registered to his wife (AA).',
    level: 'confirmed',
    source: 'MoJ, AA, DHA, TRT Haber, Hürriyet, A Haber',
    links: [
      { label: 'MoJ', url: 'https://basin.adalet.gov.tr/1-milyar-dolarlik-kripto-vurgununun-suphelisi-istanbul-da-yakalandi' },
      { label: 'AA — 9 samochodów', url: 'https://www.aa.com.tr/tr/gundem/kripto-para-dolandiriciligindan-yakalanan-suphelinin-esine-ait-9-araca-el-konuldu/4091913' },
    ],
  },
  {
    id: 'no-court-order',
    short: 'Turcja: brak publicznej decyzji o areszcie (tutuklama), brak ogłoszonych zarzutów, brak potwierdzonego wniosku o ekstradycję.',
    pl: 'Na dzień 21.10.2026 brak publicznego orzeczenia sądu o areszcie (tutuklama) i brak ogłoszonych zarzutów w Turcji. Brak potwierdzonego wniosku o ekstradycję. Fińska policja nie potwierdziła zatrzymania.',
    en: 'As of 21.10.2026 there is no public court order on remand (tutuklama) and no charges announced in Turkey. No confirmed extradition request. The Finnish police did not confirm the detention.',
    level: 'confirmed',
    source: 'Hukuki Haberler 17.10, Decrypt, The Block, HS',
    links: [
      { label: 'Hukuki Haberler (17.10.2026)', url: 'https://hukukihaberler.com/kirmizi-bultenli-schueller-operasyonu-korumalar-gozaltinda-7-milyon-dolar-iade-sureci-nasil-isler' },
    ],
  },
  {
    id: 'market',
    short: 'Po informacji o zatrzymaniu HEX (Ethereum) spadł 14–15.10 o 30–35 % w ciągu doby; kapitalizacja spadła o ok. 160 mln USD. To kontekst rynkowy, nie dowód w sprawie.',
    pl: 'Po informacji o zatrzymaniu HEX (Ethereum) spadł 14–15.10.2026 o 30–35 % w ciągu doby (do ok. 0,0006 USD), a kapitalizacja spadła o ok. 160 mln USD (z ponad 500 mln do ok. 340 mln; szacunek CoinMarketCap). Wersja HEX na PulseChain spadła nawet o 64 % od szczytu do dołka 14.10. Dla porównania: BTC −3 %, ETH −5 % w tym samym oknie. To kontekst rynkowy, nie dowód w sprawie.',
    en: 'After the detention news HEX (Ethereum) fell 30–35 % within a day on 14–15.10.2026 (to about USD 0.0006) and market cap dropped by roughly USD 160 million (from over USD 500m to about USD 340m; CoinMarketCap estimate). The PulseChain version of HEX fell as much as 64 % peak-to-trough on 14.10. For comparison: BTC −3 %, ETH −5 % in the same window. Market context, not evidence in the case.',
    level: 'confirmed',
    source: 'CoinGecko, Cointelegraph, The Block, CoinMarketCap',
    links: [
      { label: 'Cointelegraph (15.10.2026)', url: 'https://cointelegraph.com/news/hex-token-erases-160m-reports-founder-schuelers-arrest' },
      { label: 'CoinGecko — HEX', url: 'https://www.coingecko.com/en/coins/hex' },
    ],
  },
  {
    id: 'no-exchange-halt',
    short: 'HEX nie jest notowany na głównych giełdach centralnych, PLS i PLSX również — więc nie było zawieszeń notowań. HEX obraca się głównie na Uniswap; sieć działała bez przerwy.',
    pl: 'Żadna z głównych giełd centralnych nie notuje HEX, PLS ani PLSX, więc nie było zawieszeń notowań. HEX obraca się głównie na Uniswap; PLS na mniejszych platformach (m.in. Kanga Global, SafeTrade). Nie ma publicznego komunikatu o zamrożeniu kontraktów.',
    en: 'No major centralised exchange lists HEX, PLS or PLSX, so there were no trading halts. HEX trades mainly on Uniswap; PLS on smaller venues (e.g. Kanga Global, SafeTrade). There is no public announcement of contract freezes.',
    level: 'confirmed',
    source: 'MEXC, Gate.io, Kraken, OKX, CoinGecko',
    links: [
      { label: 'CoinGecko — HEX', url: 'https://www.coingecko.com/en/coins/hex' },
    ],
  },
];

/** Twierdzenia z jednego źródła — wymagają atrybucji. */
export const CLAIMED_FACTS = [
  {
    id: 'building',
    pl: 'Według Yeni Şafak policja ustaliła, że Schueler z żoną przebywał w mieszkaniu w Çiftçi Towers w Beşiktaş.',
    en: 'According to Yeni Şafak, police traced him and his wife to an apartment in Çiftçi Towers, Beşiktaş.',
    level: 'claimed',
    source: 'Yeni Şafak 18.10.2026 (jedyne źródło — brak potwierdzenia oficjalnego)',
    url: 'https://www.yenisafak.com/gundem/balina-james-istanbulda-yakalandi-4865222',
  },
  {
    id: 'wife-name',
    pl: 'Imienia i nazwiska żony nie publikujemy. Źródła oficjalne podają tylko inicjały „A.K.”; pełne dane podało jedno medium (Yeni Şafak). To osoba prywatna bez publicznych zarzutów, więc jej nie identyfikujemy.',
    en: 'We do not publish his wife’s full name. Official sources give only the initials “A.K.”; one outlet (Yeni Şafak) published full details. She is a private person with no public charges, so we do not identify her.',
    level: 'claimed',
    source: 'Yeni Şafak 18.10.2026 (jedno źródło; dane osoby prywatnej)',
    url: 'https://www.yenisafak.com/gundem/balina-james-istanbulda-yakalandi-4865222',
  },
  {
    id: 'guards',
    pl: 'Według Yeni Şafak ochroniarze to dwaj emerytowani policjanci (İ.A., Ü.A.) i emerytowany podoficer (S.İ.) — wszyscy obywatele tureccy.',
    en: 'According to Yeni Şafak, the bodyguards were two retired police officers (İ.A., Ü.A.) and a retired non-commissioned officer (S.İ.), all Turkish citizens.',
    level: 'claimed',
    source: 'Yeni Şafak 18.10.2026 (jedyne źródło)',
    url: 'https://www.yenisafak.com/gundem/balina-james-istanbulda-yakalandi-4865222',
  },
  {
    id: 'wanted-since-feb',
    pl: 'Według Sabah Schueler był poszukiwany w Turcji od lutego 2026; miał wyjechać z Turcji w 2024 r. i wrócić nielegalnie. Brak potwierdzenia w źródłach oficjalnych.',
    en: 'According to Sabah, he had been wanted in Turkey since February 2026; he allegedly left Turkey in 2024 and re-entered illegally. No official confirmation.',
    level: 'claimed',
    source: 'Sabah (jedno źródło, bez potwierdzenia oficjalnego)',
  },
];

/** Czego nie wiemy — jawnie pokazane luki, nie domysły. */
export const UNKNOWNS = [
  {
    id: 'remand',
    pl: 'Czy turecki sąd zdecydował o areszcie ekstradycyjnym (geçici tutuklama), nadzorze (adli kontrol) czy zwolnieniu?',
    detail: 'Brak publicznego orzeczenia. Zatrzymanie policyjne ma ustawowy limit (24 godziny w trybie ekstradycyjnym, do 4 dni w zwykłym), więc sąd musiał zdecydować między 14 a 18.10.2026 — decyzji nie ujawniono.',
    en: 'Has a Turkish court ordered provisional extradition arrest (geçici tutuklama), judicial control (adli kontrol) or release? No public decision; police custody has a statutory cap (24 hours in extradition cases).',
  },
  {
    id: 'citizenship',
    pl: 'Czy Schueler ma tureckie obywatelstwo albo tureckie dokumenty?',
    detail: 'Nie znaleźliśmy potwierdzenia. Tureckie komunikaty policji mówią o „podejrzanych cudzoziemskich” (yabancı uyruklu), a rekord Interpolu podaje wyłącznie obywatelstwo USA. Obywatelstwo tureckie blokowałoby ekstradycję (art. 38 konstytucji TR; art. 11 ustawy 6706); sam dokument pobytowy takiej ochrony nie daje.',
    en: 'Does Schueler hold Turkish citizenship or Turkish identity documents? Not confirmed. Turkish police statements describe “foreign-national suspects”; the Interpol record lists US nationality only. Turkish citizenship would bar extradition (Constitution art. 38; Law 6706 art. 11).',
  },
  {
    id: 'charges-tr',
    pl: 'Jakie zarzuty ogłosi prokuratura w Stambule?',
    detail: 'Nie ma publicznego aktu oskarżenia ani komunikatu prokuratury w sprawie Schuelera.',
    en: 'What charges will the Istanbul prosecutor announce? No public indictment or prosecutor statement in his case.',
  },
  {
    id: 'extradition',
    pl: 'Czy Turcja otrzymała wniosek Finlandii o ekstradycję i czy termin już biegnie?',
    detail: 'Brak potwierdzenia. Daty 1.11 i 23.11 to wyliczenie redakcji na podstawie ECE art. 16, nie oficjalny komunikat.',
    en: 'Has Turkey received Finland’s extradition request, and is the clock running? Unconfirmed; 1 and 23 November are our calculation under ECE art. 16.',
  },
  {
    id: 'finland',
    pl: 'Czy Finlandia potwierdzi zatrzymanie i jakie podejmie kroki?',
    detail: 'Fińska policja nie komentuje. Finlandia nie potwierdziła publicznie wniosku o ekstradycję.',
    en: 'Will Finland confirm the detention and what steps will it take? Finnish police have not commented; no public confirmation of an extradition request.',
  },
  {
    id: 'assault',
    pl: 'Co z zarzutem pobicia z fińskiego nakazu z 13.09.2024?',
    detail: 'W obecnym publicznym rekordzie Interpolu widnieje tylko zarzut podatkowy. Interpol nie publikuje historii zmian noty; nie ma komunikatu o wycofaniu zarzutu.',
    en: 'What happened to the assault charge in the Finnish 13.09.2024 order? The current public Interpol record lists only the tax charge; Interpol does not publish amendment history.',
  },
  {
    id: 'whereabouts',
    pl: 'Gdzie przebywa Schueler i jaki jest jego stan?',
    detail: 'Brak oświadczenia jego zespołu prawnego, rodziny lub tureckich władz po 14.10.2026.',
    en: 'Where is Schueler and what is his condition? No statement from his legal team, family or Turkish authorities after 14.10.2026.',
  },
];

/** Znane błędy redakcyjne — etykiety i reguły. */
export const KNOWN_ERRORS = [
  {
    id: 'arrested-vs-detained',
    label: 'Areszt vs zatrzymanie', labelEn: 'Arrest vs detention',
    pattern: /\b(aresztowan\w*|aresztowany|aresztowano|arrested)\b/i,
    pl: 'Było gözaltı (zatrzymanie policyjne). Areszt (tutuklama) to odrębna decyzja sądu — nie ogłoszona.',
    en: 'It was gözaltı (police custody). Remand (tutuklama) is a separate court decision — not announced.',
  },
  {
    id: 'billion-crypto-fraud',
    label: 'Kwota 1 mld USD', labelEn: 'USD 1 billion figure',
    pattern: /(?:\$|usd\s*)?\b1\s*(?:mld|miliard|miliardo|billion)\b/i,
    pl: 'Kwota „1 mld USD” pochodzi z brzmienia komunikatu ministra i z pozwu SEC, który został oddalony. Oficjalny zarzut Interpolu to ciężkie oszustwo podatkowe; kwota fińska to ok. 280 mln EUR.',
    en: 'The "USD 1 billion" figure comes from the minister\'s wording and from the SEC complaint, which was dismissed. The official Interpol charge is aggravated tax fraud; the Finnish figure is about EUR 280 million.',
  },
  {
    id: 'convicted',
    label: 'Wyrok vs maksimum kary', labelEn: 'Verdict vs maximum penalty',
    pattern: /\b(skazany|skazano|skazując|convicted|sentenced)\b/i,
    pl: 'Fiński proces jest na etapie śledztwa i zarzutów. Za ciężkie oszustwo podatkowe grozi 4 miesiące – 4 lata; to maksimum kary, nie wyrok.',
    en: 'The Finnish case is at the investigation/charge stage. Aggravated tax fraud carries four months to four years — that is the maximum penalty, not a sentence.',
    links: [
      { label: 'Yle (17.09.2024)', url: 'https://yle.fi/a/74-20112197' },
    ],
  },
  {
    id: 'watches',
    label: 'Liczba zegarków', labelEn: 'Number of watches',
    pattern: /\b(64|88)\s+(Rolex|zegark\w*|watch\w*)/i,
    pl: 'Oficjalna lista zabezpieczeń podaje 28 zegarków. Liczba 64 pochodzi z wczesnych relacji tabloidów, a 88 to wyliczenie Forbes Türkiye — nie oficjalny stan zabezpieczenia.',
    en: 'The official seizure list states 28 watches. The 64 figure comes from early tabloid reports; 88 is a Forbes Türkiye count — not the official seizure record.',
    links: [
      { label: 'MoJ', url: 'https://basin.adalet.gov.tr/1-milyar-dolarlik-kripto-vurgununun-suphelisi-istanbul-da-yakalandi' },
      { label: 'Forbes TR', url: 'https://www.forbes.com.tr/haberler/kirmizi-bultenle-aranan-milyarder-kripto-dolandiricisi-istanbul-da-yakalandi-balina-richard-james-schueler-kim' },
    ],
  },
  {
    id: 'mit-university',
    label: 'MIT vs MİT', labelEn: 'MIT vs MİT',
    pattern: /\b(MIT|Massachusetts\s+Institute)\b/i,
    pl: 'W materiałach chodzi o MİT (Millî İstihbarat Teşkilatı, turecki wywiad), nie o Massachusetts Institute of Technology.',
    en: 'The material refers to MİT (Millî İstihbarat Teşkilatı, the Turkish intelligence agency), not the Massachusetts Institute of Technology.',
    links: [
      { label: 'The Cool Down', url: 'https://www.thecooldown.com/green-business/richard-heart-arrested-luxury-home-istanbul/' },
    ],
  },
  {
    id: 'assault-removed',
    label: 'Zarzut pobicia', labelEn: 'Assault charge',
    pattern: /(zarzut\s+pobicia\s+(został\s+)?usunięty|assault.*removed|removed.*assault)/i,
    pl: 'W obecnym, publicznym rekordzie Interpolu widnieje wyłącznie zarzut ciężkiego oszustwa podatkowego. Interpol nie publikuje historii zmian noty — nie ma komunikatu o usunięciu zarzutu pobicia.',
    en: 'The current public Interpol record shows only the aggravated tax fraud charge. Interpol does not publish notice amendment history — there is no announcement that the assault charge was withdrawn.',
  },
  {
    id: 'fund-1-5bn',
    label: 'Kwota 1,5 mld USD', labelEn: 'USD 1.5 billion figure',
    pattern: /1\s*[,.]5\s*(?:mld|miliard|miliardo|billion)/i,
    pl: 'Kwota „1,5 mld USD” pochodzi z tureckich mediów (Forbes Türkiye i in.). Żadne źródło oficjalne jej nie podało; kwota SEC to ponad 1 mld USD zebranych i co najmniej 12 mln USD sprzeniewierzonych środków.',
    en: 'The "USD 1.5 billion" figure comes from Turkish media (Forbes Türkiye and others). No official source states it; the SEC figures are over USD 1 billion raised and at least USD 12 million misappropriated.',
    links: [
      { label: 'Forbes TR', url: 'https://www.forbes.com.tr/haberler/kirmizi-bultenle-aranan-milyarder-kripto-dolandiricisi-istanbul-da-yakalandi-balina-richard-james-schueler-kim' },
    ],
  },
  {
    id: 'seventh-depot',
    label: 'Yediemin Otoparkı', labelEn: 'Yediemin Otoparkı',
    pattern: /Yediemin\s+Otopark/i,
    pl: 'Nazwa „Yediemin Otoparkı” nie jest poparta przez żadne źródło w tej sprawie — tureckie materiały mówią tylko „otoparka çekildi”. Nazwa należy do innej sprawy.',
    en: 'The name "Yediemin Otoparkı" is not supported by any source in this case — Turkish material only says the vehicles were taken to a car park. The name belongs to a different case.',
  },
];

/** Oś czasu 14–21.10.2026 (zweryfikowana). */
export const TIMELINE = [
  {
    date: '14.10', level: 'confirmed',
    pl: 'Rano: policja i MİT — nalot w Beşiktaş. Zatrzymany mężczyzna „R.J.S.” z żoną „A.K.”. Podstawa: czerwona nota Interpolu. Media podają sprzeczne liczby zabezpieczeń (4 mln vs 600 tys. USD; 64 vs 24 zegarki).',
    en: 'Morning: police and MİT raid in Beşiktaş. A man "R.J.S." detained with his wife "A.K.". Basis: Interpol Red Notice. Media report conflicting seizure figures (4m vs 600k USD; 64 vs 24 watches).',
    src: 'MoJ · AA · İHA · policja stambułska',
    url: 'https://basin.adalet.gov.tr/1-milyar-dolarlik-kripto-vurgununun-suphelisi-istanbul-da-yakalandi',
  },
  {
    date: '14.10 wieczór', level: 'confirmed',
    pl: 'Daily Sabah, powołując się na İHA, jako pierwszy podaje pełne nazwisko: Richard James Schueler, also known as Richard Heart. Media fińskie relacjonują doniesienia tureckie; policja fińska nie komentuje. Spadek HEX, PLS, PLSX.',
    en: 'Daily Sabah, citing İHA, is first to give the full name: Richard James Schueler, also known as Richard Heart. Finnish media relay Turkish reports; Finnish police do not comment. HEX, PLS, PLSX fall.',
    src: 'Daily Sabah (İHA) · media fińskie',
  },
  {
    // Przegląd doniesień, nie zdarzenie w sprawie.
    date: '15.10', level: 'confirmed', kind: 'review',
    pl: 'Kolejne raporty kryptomediów. Żaden nie donosi o orzeczeniu sądu, wniosku o ekstradycję ani oświadczeniu prawników. Nadal zatrzymany policyjnie i przesłuchiwany.',
    en: 'Further crypto media reports. None mention a court decision, an extradition request or a lawyers’ statement. Still in police custody and being questioned.',
    src: 'CoinDesk · Decrypt · The Block',
    url: 'https://www.coindesk.com/policy/2026/10/15/hex-founder-richard-heart-arrested-in-istanbul-turkish-media-report',
  },
  {
    date: '16.10', level: 'claimed',
    pl: '15.10: zatrzymano 3 osoby opisane jako ochroniarze (DHA; Sabah podał to 16.10). Przeszukano 15 adresów w Beşiktaş, Üsküdar i Sarıyer. Sabah podaje zaktualizowane liczby: 7,15 mln USD + 160 tys. TL, 6 zimnych portfeli, 4 karabiny, 3 pistolety bez pozwolenia, 1 400 naboi — te pozycje potwierdza później oficjalna lista MoJ z 17.10.',
    en: '15.10: three more people described as bodyguards were detained (DHA; Sabah reported it on 16.10). 15 addresses searched in Beşiktaş, Üsküdar and Sarıyer. Sabah reports updated figures: USD 7.15m + TRY 160,000, 6 cold wallets, 4 rifles, 3 unlicensed pistols, 1,400 rounds — these items are later confirmed by the official MoJ list of 17.10.',
    src: 'DHA · Sabah',
    url: 'https://www.dha.com.tr/yerel-haberler/istanbul/kirmizi-bultenle-aranan-kripto-dolandiricisinin-2964206',
  },
  {
    date: '17.10', level: 'confirmed',
    pl: 'Oficjalne potwierdzenie: minister sprawiedliwości Akın Gürlek i Anadolu Ajansı. Oficjalna lista zabezpieczeń: 7 150 000 USD + 160 000 TL, 28 zegarków, 1 400 naboi, 15 adresów. Osobno 9 samochodów zarejestrowanych na żonę (AA). Oświadczenie ministra na X o 09:15 TRT.',
    en: 'Official confirmation: Justice Minister Akın Gürlek and Anadolu Agency. Official seizure list: USD 7,150,000 + TRY 160,000, 28 watches, 1,400 rounds, 15 addresses. Separately, 9 vehicles registered to his wife (AA). Minister’s statement on X at 09:15 TRT.',
    src: 'MoJ · AA · TRT Haber',
    url: 'https://www.aa.com.tr/tr/gundem/bakan-gurlek-interpolun-kirmizi-bultenle-aradigi-abdli-schuelerin-yakalandigini-bildirdi/4091693',
  },
  {
    date: '18.10', level: 'confirmed', kind: 'calc',
    pl: '5. dzień. Brak decyzji sądu. Termin 18 dni na wniosek Finlandii upływa ok. 1.11, maks. 40 dni — ok. 23.11 (ECE art. 16). To wyliczenie redakcji; Turcja nie potwierdziła wniosku.',
    en: 'Day 5. No court decision. The 18-day deadline for Finland’s request expires around 1 November; the 40-day maximum around 23 November (ECE art. 16). Our calculation; Turkey has not confirmed a request.',
    src: 'Hukuki Haberler · ECE art. 16',
    url: 'https://hukukihaberler.com/kirmizi-bultenli-schueller-operasyonu-korumalar-gozaltinda-7-milyon-dolar-iade-sureci-nasil-isler',
  },
  {
    date: '19.10', level: 'claimed',
    pl: 'Yeni Şafak: znaleziony w Çiftçi Towers; ochroniarze to emerytowani policjanci i podoficer. Ten sam artykuł zawiera dwa błędy: „4 lata więzienia” (to maksimum kary) i „1 mld USD oszustwa”.',
    en: 'Yeni Şafak: found in Çiftçi Towers; bodyguards are retired police officers and a retired NCO. The same article carries two errors: "four years in prison" (the maximum penalty) and "USD 1bn fraud".',
    src: 'Yeni Şafak (jedno źródło)',
    url: 'https://www.yenisafak.com/gundem/balina-james-istanbulda-yakalandi-4865222',
  },
  {
    // Status na koniec dnia, nie nowe zdarzenie.
    date: '20.10', level: 'confirmed', kind: 'review',
    pl: '7. dzień od zatrzymania. Nadal brak publicznego orzeczenia o areszcie ani o zwolnieniu z kontrolą sądową. Finlandia nie potwierdza wniosku o ekstradycję. Cisza po stronie Schuelera, żony i zespołu prawnego.',
    en: 'Day 7 since the detention. Still no public remand order or release under judicial control. Finland does not confirm an extradition request. Silence from Schueler, his wife and the legal team.',
    src: 'Hukuki Haberler · Decrypt · The Block',
    url: 'https://hukukihaberler.com/kirmizi-bultenli-schueller-operasyonu-korumalar-gozaltinda-7-milyon-dolar-iade-sureci-nasil-isler',
  },
  {
    date: '21.10', level: 'confirmed', kind: 'review',
    pl: 'Przegląd statusu na koniec 8. dnia: zatrzymanie potwierdzone / brak publicznego orzeczenia o areszcie / brak ogłoszonych zarzutów w Turcji / brak potwierdzenia ekstradycji / brak skazania gdziekolwiek. Nadal brak informacji od tureckich władz, Finlandii i zespołu Schuelera.',
    en: 'Status at the end of day 8: detention confirmed / no public remand order / no charges announced in Turkey / extradition not confirmed / no conviction anywhere. Still no information from Turkish authorities, Finland or Schueler’s team.',
    src: 'Hukuki Haberler · Decrypt · The Block · HS',
    url: 'https://hukukihaberler.com/kirmizi-bultenli-schueller-operasyonu-korumalar-gozaltinda-7-milyon-dolar-iade-sureci-nasil-isler',
  },
  {
    date: '22–30.10', level: 'confirmed', kind: 'review',
    pl: 'Brak nowych potwierdzonych informacji. Monitor nie znalazł publicznego orzeczenia o areszcie, ogłoszonych zarzutów w Turcji ani potwierdzonego wniosku Finlandii o ekstradycję. W tym okresie pojawiały się wyłącznie wpisy społecznościowe (m.in. @_pulseheartwin_), w tym spekulacje o scenariuszach po 1.11 — bez potwierdzenia w źródłach oficjalnych.',
    en: 'No new confirmed information. The monitor found no public remand order, no announced charges in Turkey and no confirmed Finnish extradition request. The period produced only social posts (e.g. @_pulseheartwin_), including speculation about scenarios after 1 November — without official confirmation.',
    src: 'Monitoring źródeł (brak nowych komunikatów)',
  },
  {
    date: '1.11', level: 'confirmed', kind: 'calc',
    pl: '18. dzień: mija okno na wniosek i dokumenty Finlandii. Brak publicznego potwierdzenia, czy dokumenty dotarły, i brak decyzji sądu — to wyliczenie redakcji z ECE art. 16, nie komunikat stron. Jeśli dokumenty nie dotarły, Turcja musi uchylić tymczasowe zatrzymanie (ustawa 6706 art. 14(6)).',
    en: 'Day 18: the window for Finland’s request and documents expires. No public confirmation that the documents arrived and no court decision — this is our calculation under ECE art. 16, not a statement by the parties. If the documents did not arrive, Turkey must lift provisional custody (Law 6706 art. 14(6)).',
    src: 'ECE art. 16 · wyliczenie redakcji',
    url: 'https://www.coe.int/en/web/conventions/full-list?module=treaty-detail&treatynum=024',
  },
  {
    // To nie jest zdarzenie w sprawie, tylko niezależny przegląd społecznościowy.
    // Nie może trafiać do „ostatnich potwierdzonych zdarzeń” na pierwszym ekranie.
    date: '13.11', level: 'claimed', kind: 'review',
    pl: 'Niezależny przegląd społecznościowy (cryptospecting.com) — stan na 13.11.2026: brak publicznej decyzji tureckiego sądu o areszcie, nadzorze lub zwolnieniu; brak własnych zarzutów Turcji; brak potwierdzonego wniosku Finlandii; brak skazania w jakiejkolwiek jurysdykcji.',
    en: 'An independent community review (cryptospecting.com) — position as of 13.11.2026: no public Turkish court decision on remand, judicial control or release; no Turkish charges of its own; no confirmed Finnish request; no conviction in any jurisdiction.',
    src: 'Cryptospecting — community legal timeline (13.11.2026)',
    url: 'https://cryptospecting.com/richard-heart/legal',
  },
  {
    // Jedno źródło społeczne, nie komunikat władz ani stron. Bez danych kontaktowych.
    date: '17.11', level: 'claimed',
    pl: 'Na tureckim portalu adopcyjnym KirikKuyruk pojawiło się ogłoszenie o 3-letnim owczarku niemieckim Heximusie z Beşiktaş. Według ogłoszenia właściciele zostali zatrzymani, a pies jest pod opieką zaprzyjaźnionej rodziny i szuka stałego domu. To jedno źródło, bez potwierdzenia władz albo rodziny; monitor nie podaje danych kontaktowych.',
    en: 'A Turkish rehoming site, KirikKuyruk, lists a three-year-old German Shepherd named Heximus in Beşiktaş. According to the listing his owners were detained and the dog is being cared for by a family friend while a permanent home is sought. Single source, no confirmation from the authorities or the family; the monitor does not publish the contact details.',
    src: 'KirikKuyruk — ogłoszenie adopcyjne (jedno źródło)',
    url: 'https://kirikkuyruk.com/ilan/owners-arrested-heximus-is-guilty-of-needing-a-fur-ever-home/',
  },
  {
    // Data nie jest zaszyta: renderTimeline podstawia dzień bieżącego przeglądu,
    // żeby oś czasu nie pokazywała nieaktualnej daty review. '10.11' to tylko
    // klucz tłumaczeń i wartość zapasowa.
    id: 'review', auto: true, kind: 'review',
    date: '10.11', level: 'claimed',
    pl: 'Przegląd monitora: brak nowych potwierdzonych informacji od 21.10. W listopadzie 2026 nowe elementy były wyłącznie społecznościowe — m.in. kampania listów lettersforrichard.org (listy do prokuratury stambulskiej, przekazywane obrońcy) oraz wpisy @_pulseheartwin_ i @yourfriendSOMMI. Twierdzenia o kontakcie z prawnikiem i jego słowach nie mają potwierdzenia w źródłach; nie publikujemy ich jako faktu.',
    en: 'Monitor review: no new confirmed information since 21.10. In November 2026 the new material was community-only — including the lettersforrichard.org letter campaign (letters to the Istanbul Chief Public Prosecutor’s Office, forwarded to counsel) and posts by @_pulseheartwin_ and @yourfriendSOMMI. Claims of contact with a lawyer and of his words are not corroborated by sources; we do not publish them as fact.',
    src: 'lettersforrichard.org · X: @yourfriendSOMMI (nie źródło oficjalne)',
    url: 'https://www.lettersforrichard.org/',
  },
];

/** Sprzeczności między źródłami — do pokazania, nie do rozstrzygania po cichu. */
export const CONTRADICTIONS = [
  {
    id: 'charge-basis',
    topic: 'Podstawa czerwonej noty',
    summary: 'Oficjalny rekord Interpolu: jeden zarzut — ciężkie oszustwo podatkowe. Minister mówi o „1 mld USD krypto”.',
    rows: [
      ['Interpol (rekord publiczny, live)', 'jedyny zarzut: „1. AGGRAVATED TAX FRAUD”, Finlandia'],
      ['Europol / FAST Finland (18.12.2024)', 'dwa zarzuty: oszustwo podatkowe + pobicie 16-latka'],
      ['Minister Gürlek / MoJ', '„1 miliard dolarów oszustwa na aktywach kryptowalutowych w USA i Finlandii”'],
      ['İHA / Hürriyet (14.10)', '„wysoka kwota kripto-dolandırıcılığı” + „yakalama kararı” (nakaz zatrzymania)'],
    ],
    note: 'Oficjalna treść noty = oszustwo podatkowe. Ramka „1 mld USD krypto” to kwalifikacja ministra; żadne źródło nie potwierdziło jej jako podstawy noty. Nie scalać.',
    links: [
      { label: 'Interpol — record 2024/65212', url: 'https://ws-public.interpol.int/notices/v1/red/2024-65212' },
      { label: 'AA (17.10.2026)', url: 'https://www.aa.com.tr/tr/gundem/bakan-gurlek-interpolun-kirmizi-bultenle-aradigi-abdli-schuelerin-yakalandigini-bildirdi/4091693' },
    ],
  },
  {
    id: 'amounts',
    topic: 'Kwoty',
    summary: 'Trzy różne kwoty: 1 mld USD (minister/SEC), 1,5 mld USD (media tureckie), ok. 280 mln EUR (Finlandia).',
    rows: [
      ['1 mld USD', 'brzmienie komunikatu ministra; SEC: „> $1 billion zebranych”'],
      ['1,5 mld USD', 'nie kwota SEC — twierdzenie mediów tureckich (Sözcü/Sabah/A Haber)'],
      ['280 896 000 EUR', 'kwota fińska (HS, maj 2026), bliżej „setek milionów” z Interpolu/Europolu'],
    ],
    note: 'Ok. 280 mln EUR to kwota objęta fińskim zarzutem. Według fińskich źródeł dotyczy dochodów z pracy (ansiotulo), nie kapitałowych, i nie jest kwotą skradzioną inwestorom.',
    links: [
      { label: 'HS (5.5.2026)', url: 'https://www.hs.fi/suomi/art-2000011963415.html' },
      { label: 'SEC complaint (PDF)', url: 'https://www.sec.gov/files/litigation/complaints/2023/comp-pr2023-143.pdf' },
    ],
  },
  {
    id: 'seizures',
    topic: 'Zabezpieczenia — cztery niekompatybilne zestawy',
    summary: 'Cztery zestawy: różny zakres (1 vs 15 adresów) i różne liczby zegarków (24/28/64/88).',
    rows: [
      ['MoJ/Gürlek/AA/DHA/TRT/Hürriyet, 17.10', '$7 150 000 + 160 000 TL | 28 zegarków | 1 400 naboi | 15 adresów'],
      ['İHA/AA/TRT/Milliyet/TGRT, 14.10', '$600 000 + €2600 + 50 000 TL | 24 | 1360 (+7 magazynki, 1 nóż) | 1 adres'],
      ['Sözcü/TV100/Haberler, 14.10', '$4 000 000 | 64 (53 Rolex + 11 Patek Philippe) | — | jego mieszkanie'],
      ['Forbes TR, 14.10', '$4 mln (próżniowo zapakowane) + $600 tys. | 53 + 11 + 24 wcześniej | 1360 | 1 adres + most'],
    ],
    note: 'Przyczyna: zakres (1 adres vs 15 adresów). Dodatkowo 2 drony, 20 złotych bransoletek i 7 złotych łańcuszków występują tylko w zestawie z 14.10. 9 samochodów to osobny komunikat AA z 17.10.',
    links: [
      { label: 'MoJ (17.10)', url: 'https://basin.adalet.gov.tr/1-milyar-dolarlik-kripto-vurgununun-suphelisi-istanbul-da-yakalandi' },
      { label: 'İHA (17.10)', url: 'https://www.iha.com.tr/istanbul-haberleri/kirmizi-bultenle-aranan-kripto-para-dolandiriciligi-suphelisinin-esi-adina-kayitli-9-araca-el-konuldu-501939358' },
      { label: 'Forbes TR (14.10)', url: 'https://www.forbes.com.tr/haberler/kirmizi-bultenle-aranan-milyarder-kripto-dolandiricisi-istanbul-da-yakalandi-balina-richard-james-schueler-kim' },
    ],
  },
];

const NEGATION_RE =
  /(?:\bnie\b|\bbez\b|\bnigdy\b|\bżadn|\bnot\b|\bno\b|\bnever\b|\bwithout\b|\bdenied\b|\bdenies\b|\bzaprzecz|\bdementuje|\bunconfirmed\b|\bniepotwierdzon)/i;

const ATTRIBUTION_RE =
  /(?:\bwedług\b|\bzdaniem\b|\bjak podaje\b|\bjak donosi\b|\btwierdzi\b|\bcytuj|\bmówi\b|\baccording to\b|\breportedly\b|\breported by\b|\ballegedly\b|\bquoted\b)/i;

const MEDIA_NAME_RE =
  /\b(Yeni\s*Şafak|Sabah|SABAH|Forbes|Sözcü|Habertürk|Hürriyet|Daily Sabah|Anadolu|AA|İHA|DHA|Yle|HS|Iltalehti|The Block|Decrypt|Cointelegraph|CoinDesk)\b/;

const MAX_FLAGS = 8;

function sentences(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
}

function negated(sentence, index) {
  const before = sentence.slice(Math.max(0, index - 80), index);
  return NEGATION_RE.test(before) || /^\s*(nie|not|no)\b/i.test(sentence);
}

function hasAttribution(sentence) {
  return ATTRIBUTION_RE.test(sentence) || MEDIA_NAME_RE.test(sentence);
}

function fraudContext(sentence, index) {
  const around = sentence.slice(Math.max(0, index - 110), index + 130);
  return /oszustw|fraud|scam|defraud|przestępstw|krypto/i.test(around);
}

function maximumPenaltyContext(sentence) {
  return /grozi|carries|maximum|maksimum|do\s+4\s+lat|up to|penalty|karze|penalty/i.test(sentence);
}

function officialWatchContext(sentence) {
  return /\b28\b|oficjaln|official|media pisały|wcześniej|early reports|nie 64/i.test(sentence);
}

function turkishIntelligenceContext(sentence) {
  return /MİT|Millî|Milli|Turkish intelligence|turecki wywiad|istihbarat/i.test(sentence);
}

/**
 * Fińskie „tymczasowe aresztowanie zaoczne” (remand in absentia) to prawidłowe
 * określenie decyzji sądu, a nie tureckie gözaltı. Nie oznaczamy go jako błędu,
 * chyba że w tym samym fragmencie mowa jest o Turcji.
 */
function finnishRemandContext(sentence, index) {
  const around = sentence.slice(Math.max(0, index - 100), index + 140);
  if (!/zaoczn|in\s+absentia|käräjäoikeus|helsink|finland|finnish|fińsk/i.test(around)) return false;
  return !/turcj|istanbul|stambuł|beşiktaş|gözalt|gozalt|turkish/i.test(around);
}

/**
 * Sprawdza tekst pod kątem znanych błędów i twierdzeń bez potwierdzenia.
 * Reguły działają na zdaniach, z prostą obsługą negacji i atrybucji.
 * @returns {{flags: {id:string, kind:string, label:string, note:string, sentence:string}[], level:string}}
 */
export function checkClaims(text, lang = 'pl') {
  const en = lang === 'en';
  const t = String(text || '');
  const flags = [];
  const push = (id, kind, note, sentence) => {
    if (flags.length >= MAX_FLAGS) return;
    if (flags.some((f) => f.id === id)) return;
    const e = KNOWN_ERRORS.find((x) => x.id === id);
    const c = CLAIMED_FACTS.find((x) => x.id === id);
    const fallback = en
      ? { building: 'Site / location', 'wife-name': "Wife's name", guards: 'Bodyguards', 'wanted-since-feb': 'Search in Turkey' }[id]
      : { building: 'Budowa / lokalizacja', 'wife-name': 'Imię żony', guards: 'Ochroniarze', 'wanted-since-feb': 'Poszukiwanie w Turcji' }[id];
    flags.push({
      id,
      kind,
      label: en ? (e?.labelEn || fallback) : (e?.label || fallback),
      note: note || (en ? (e?.en || c?.en) : (e?.pl || c?.pl)) || '',
      sentence: redactPrivate(sentence.slice(0, 240)),
    });
  };

  for (const s of sentences(t)) {
    // 1. Areszt vs zatrzymanie.
    const arrest = /\b(aresztowan\w*|aresztowany|aresztowano|arrested)\b/i.exec(s);
    if (arrest && !negated(s, arrest.index) && !finnishRemandContext(s, arrest.index)) {
      push('arrested-vs-detained', 'error', null, s);
    }

    // 2. Kwota 1 mld USD — tylko jako kwota oszustwa, nie „SEC zebrał ponad 1 mld”.
    const billion = /(?:\$|usd\s*)?\b1\s*(?:mld|miliard|miliardo|billion)\b/i.exec(s);
    if (billion && !negated(s, billion.index) && fraudContext(s, billion.index)) {
      push('billion-crypto-fraud', 'error', null, s);
    }

    // 3. Wyrok vs maksimum kary.
    const convicted = /\b(skazany|skazano|skazując|convicted|sentenced)\b/i.exec(s);
    if (convicted && !negated(s, convicted.index) && !maximumPenaltyContext(s)) {
      push('convicted', 'error', null, s);
    }

    // 4. Liczba zegarków — tylko gdy podana jako bieżący stan zabezpieczenia.
    const watches = /\b(64|88)\s+(Rolex|zegark\w*|watch\w*)/i.exec(s);
    if (watches && !negated(s, watches.index) && !officialWatchContext(s)) {
      push('watches', 'error', null, s);
    }

    // 5. MIT vs MİT.
    const mit = /\b(MIT|Massachusetts\s+Institute)\b/i.exec(s);
    if (mit && !turkishIntelligenceContext(s)) {
      push('mit-university', 'error', null, s);
    }

    // 6. „Zarzut pobicia usunięty” — nie ma takiego komunikatu.
    const removed = /(zarzut\s+pobicia\s+(został\s+)?usunięty|assault.*removed|removed.*assault)/i.exec(s);
    if (removed && !negated(s, removed.index)) {
      push('assault-removed', 'error', null, s);
    }

    // 7. 1,5 mld USD — kwota medialna, nie oficjalna.
    const fund = /1\s*[,.]5\s*(?:mld|miliard|miliardo|billion)/i.exec(s);
    if (fund && !negated(s, fund.index)) {
      push('fund-1-5bn', 'error', null, s);
    }

    // 8. Yediemin Otoparkı — nazwa z innej sprawy.
    const depot = /Yediemin\s+Otopark/i.exec(s);
    if (depot && !negated(s, depot.index) && !/inna sprawa|nie dotyczy/i.test(s)) {
      push('seventh-depot', 'error', null, s);
    }

    // Twierdzenia wymagające atrybucji — tylko gdy w zdaniu nie ma wskazania źródła.
    if (!hasAttribution(s)) {
      if (/çiftçi\s*towers/i.test(s)) push('building', 'claimed', null, s);
      if (/alina\s+kara/i.test(s)) push('wife-name', 'claimed', null, s);
      if (/(İ\.A\.|Ü\.A\.|S\.İ\.|emerytowani policjanci|retired police officers)/i.test(s) &&
          /ochroniarz|bodyguard/i.test(s)) {
        push('guards', 'claimed', null, s);
      }
      if (/(od lutego 2026|since february 2026|nielegaln\w+ (ponowny )?wjazd|illegal re-entry)/i.test(s)) {
        push('wanted-since-feb', 'claimed', null, s);
      }
    }
  }

  const hasError = flags.some((f) => f.kind === 'error');
  const hasClaim = flags.some((f) => f.kind === 'claimed');

  return {
    flags,
    level: hasError ? 'error' : hasClaim ? 'claimed' : 'clean',
  };
}



