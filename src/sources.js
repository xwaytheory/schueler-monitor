/**
 * Definicja zrodel. Kazde zrodlo ma id, etykiete, rodzaj i (opcjonalnie) zapytanie.
 *
 * Rodzaje:
 *  - 'rss'      : bezposredni feed RSS/Atom (pobieramy i filtrujemy tresc)
 *  - 'gnews'   : zapytanie w wyszukiwarce newsów (Bing podstawowo, Google jako zapas)
 *  - 'xsite'   : zapytanie site:x.com w tej samej wyszukiwarce (zrodla z X/Twitter)
 *  - 'bing'    : zapytanie wyłącznie w Bing News (RSS)
 *  - 'jina'    : strona x.com czytana przez r.jina.ai (profil konta)
 *  - 'json'    : API zwracajace JSON (np. ceny)
 */

/**
 * Dostawcy wyszukiwania newsów.
 *
 * Od 12.11.2026 podstawowym dostawcą jest Bing News: Google News RSS
 * odpowiada z serwera hostingowego HTTP 503 („Sorry…”) na każde zapytanie,
 * czyli 22 źródła zapytań siedziały cicho. Google zostaje jako zapas —
 * kolektor próbuje go, gdy Bing zawiedzie.
 */
const BING_LOCALES = { tr: 'cc=tr&setlang=tr', fi: 'cc=fi&setlang=fi' };

/** URL zapytania Bing News (RSS). */
export function bingNewsUrl(q, locale) {
  const loc = BING_LOCALES[locale] || '';
  return `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=RSS${loc ? `&${loc}` : ''}`;
}

/** URL zapytania Google News (RSS) — dostawca zapasowy. */
export function googleNewsUrl(q, locale) {
  const [hl, gl, ceid] = { tr: ['tr', 'TR', 'TR:tr'], fi: ['fi', 'FI', 'FI:fi'] }[locale]
    || ['en-US', 'US', 'US:en'];
  return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=${hl}&gl=${gl}&ceid=${ceid}`;
}

/** Zapytania do wyszukiwarki newsów (Bing → Google jako zapas). */
export const GOOGLE_NEWS_QUERIES = [
  { id: 'gn-en-schueler', label: 'News EN (Bing/Google): Schueler', q: 'Schueler' },
  { id: 'gn-en-heart', label: 'News EN (Bing/Google): "Richard Heart"', q: '"Richard Heart"' },
  { id: 'gn-en-balina', label: 'News EN (Bing/Google): "Balina James"', q: '"Balina James"' },
  { id: 'gn-en-hex', label: 'News EN (Bing/Google): HEX PulseChain', q: 'HEX PulseChain arrest OR fraud OR investigation' },
  { id: 'gn-tr-schueler', label: 'Haberler (Bing/Google): Schueler', q: 'Schueler', locale: 'tr' },
  { id: 'gn-tr-heart', label: 'Haberler (Bing/Google): Richard Heart', q: '"Richard Heart"', locale: 'tr' },
  { id: 'gn-tr-hex', label: 'Haberler (Bing/Google): HEX kripto', q: 'HEX kripto dolandırıcılık OR gözaltı', locale: 'tr' },
  { id: 'gn-tr-balina', label: 'Haberler (Bing/Google): "Balina James"', q: '"Balina James"', locale: 'tr' },
  // Twierdzenie z tureckiego X (14–17.10.2026): sprawa miała obejmować też Hiszpanię.
  // Niepotwierdzone oficjalnie — zapytanie ma wyłapać, czy media to podchwycą.
  { id: 'gn-tr-ispanya', label: 'Haberler (Bing/Google): Schueler İspanya', q: '(Schueler OR "Balina James") İspanya', locale: 'tr' },
  {
    id: 'gn-tr-ntv', label: 'Haberler (Bing/Google): NTV, Ekonomim',
    q: '(site:ntv.com.tr OR site:ekonomim.com OR site:sozcu.com.tr) Schueler', locale: 'tr',
  },
  {
    id: 'gn-fi-schueler', label: 'News FI (Bing/Google): Schueler (HS, IS, IL, MTV, Yle)',
    q: '(site:hs.fi OR site:is.fi OR site:iltalehti.fi OR site:mtvuutiset.fi OR site:yle.fi) Schueler',
    locale: 'fi',
  },
  {
    id: 'gn-fi-heart', label: 'News FI (Bing/Google): "Richard Heart"',
    q: '"Richard Heart"', locale: 'fi',
  },
  {
    // Portale tureckie, które publikowały o sprawie, a blokują bezpośrednie pobieranie (403).
    id: 'gn-tr-blocked', label: 'Haberler (Bing/Google): İHA, TV100, Haber3, Patronlar, Yeni Şafak',
    q: '(site:iha.com.tr OR site:tv100.com OR site:haber3.com OR site:patronlardunyasi.com OR site:yenisafak.com) (Schueler OR "Balina James")',
    locale: 'tr',
  },
  {
    // Tureckie serwisy oficjalne bez RSS: komunikaty MS, więziennictwa, MSW,
    // policji, żandarmerii i prokuratur okręgowych w Stambule.
    id: 'gn-tr-official', label: 'Haberler (Bing/Google): TR oficjalne (MS, CTE, MSW, EGM, Jandarma, adliye)',
    q: '(site:basin.adalet.gov.tr OR site:cte.adalet.gov.tr OR site:istanbul.adalet.gov.tr OR site:istanbulanadolu.adalet.gov.tr OR site:icisleri.gov.tr OR site:egm.gov.tr OR site:jandarma.gov.tr) (Schueler OR "Richard Heart" OR "Balina James")',
    locale: 'tr',
  },
  {
    // Fińskie źródła oficjalne i agencyjne bez działającego RSS.
    id: 'gn-fi-extra', label: 'News FI (Bing/Google): STT, vero.fi, oikeus.fi, poliisi.fi, UM',
    q: '(site:stt.fi OR site:vero.fi OR site:oikeus.fi OR site:poliisi.fi OR site:um.fi) (Schueler OR "Richard Heart")',
    locale: 'fi',
  },
];

/**
 * Zapytania o wypuszczenie/ekstradycję — najwyższy priorytet.
 * Sprawdzane też w szybkiej ścieżce (co FAST_SCAN_INTERVAL_SEC), nie tylko
 * przy pełnym skanie, żeby informacja o zwolnieniu dotarła w minutach.
 * „Schueler” trafia też do tytułów jako „Schueller”/„Şueler” — pokrywa matcher.
 */
export const RELEASE_QUERIES = [
  {
    id: 'gn-release-tr', label: 'Zwolnienie/ekstradycja TR: tahliye, serbest, iade',
    q: '(Schueler OR "Balina James") (tahliye OR serbest OR iade OR ekstradisyon)', locale: 'tr',
  },
  {
    id: 'gn-release-en', label: 'Zwolnienie/ekstradycja EN: released, bail, extradition',
    q: '(Schueler OR "Richard Heart") (released OR release OR bail OR extradition)',
  },
  {
    id: 'gn-release-fi', label: 'Zwolnienie/luovutus FI: vapautettu, luovutus',
    q: '(Schueler OR "Richard Heart") (vapautettu OR luovutus OR vangittu)', locale: 'fi',
  },
];

/** Zapytania site:x.com - wychwytuja tresc z kont X (Twitter). */
export const X_SITE_QUERIES = [
  { id: 'x-heart', label: 'X: "Richard Heart"', q: '"Richard Heart"' },
  { id: 'x-schueler', label: 'X: Schueler', q: 'Schueler' },
  { id: 'x-hex', label: 'X: HEX PulseChain', q: 'HEX PulseChain' },
  { id: 'x-balina', label: 'X: "Balina James"', q: '"Balina James"' },
  { id: 'x-tr-iade', label: 'X (TR): Schueler iade / ekstradisyon', q: 'Schueler iade OR ekstradisyon', locale: 'tr' },
  { id: 'x-fi-luovutus', label: 'X (Finland): Schueler luovutus', q: 'Schueler luovutus OR veropetos', locale: 'fi' },
];

/** Konta X czytane przez r.jina.ai. */
export const X_PROFILES = [
  { id: 'x-prof-beincrypto', label: 'X: @BeInCrypto', handle: 'BeInCrypto' },
  { id: 'x-prof-wu', label: 'X: @WuBlockchain', handle: 'WuBlockchain' },
  { id: 'x-prof-lookonchain', label: 'X: @lookonchain', handle: 'lookonchain' },
  { id: 'x-prof-interpol', label: 'X: @INTERPOL_HQ', handle: 'INTERPOL_HQ' },
  { id: 'x-prof-sec', label: 'X: @SECGov', handle: 'SECGov' },
];

/**
 * Zapasowe pokrycie kont X przez Google News (`site:x.com`).
 * Uzywane, gdy r.jina.ai zablokuje dostep (antyspam) - wtedy te profile
 * chwilowo nie dzialaja, ale tresc z X i tak jest zbierana.
 */
export const X_PROFILE_FALLBACK = X_PROFILES.map((p) => ({
  id: `xprof-${p.handle.toLowerCase()}`,
  label: `X (site:x.com): @${p.handle}`,
  kind: 'gnews',
  url: `https://news.google.com/rss/search?q=${encodeURIComponent(`site:x.com "${p.handle}"`)}&hl=en-US&gl=US&ceid=US:en`,
}));

/** Bezposrednie feedy RSS (calosciowe). */
export const RSS_SOURCES = [
  { id: 'aa-tr', label: 'AA (Anadolu Ajansi) - TR', url: 'https://www.aa.com.tr/tr/rss/default?cat=guncel' },
  { id: 'aa-tr-ekonomi', label: 'AA (Anadolu Ajansi) - ekonomi TR', url: 'https://www.aa.com.tr/tr/rss/default?cat=ekonomi' },
  { id: 'aa-en', label: 'AA - EN', url: 'https://www.aa.com.tr/en/rss/default?cat=world' },
  { id: 'haberturk-tr', label: 'Haberturk - TR', url: 'https://www.haberturk.com/rss' },
  { id: 'hurriyet-tr', label: 'Hurriyet - TR', url: 'https://www.hurriyet.com.tr/rss/guncel' },
  { id: 'sabah-tr-rss', label: 'Sabah - TR', url: 'https://www.sabah.com.tr/rss/anasayfa.xml' },
  { id: 'milliyet-tr-rss', label: 'Milliyet - TR', url: 'https://www.milliyet.com.tr/rss/rssNew/gundemRss.xml' },
  { id: 'cumhuriyet-tr-rss', label: 'Cumhuriyet - TR', url: 'https://www.cumhuriyet.com.tr/rss/1' },
  { id: 'cnnturk-tr-rss', label: 'CNN Türk - TR', url: 'https://www.cnnturk.com/feed/rss/all/news' },
  { id: 'euronews-tr-rss', label: 'Euronews Türkçe - TR', url: 'https://tr.euronews.com/rss?level=theme&name=news' },
  { id: 'diken-tr-rss', label: 'Diken - TR', url: 'https://www.diken.com.tr/feed/' },
  { id: 'yeniasafak-tr-rss', label: 'Yeni Şafak - TR', url: 'https://www.yenisafak.com/rss?xml=gundem' },
  { id: 'sozcu-tr-rss', label: 'Sözcü - TR', url: 'https://www.sozcu.com.tr/feeds/rsssubpub' },
  { id: 'yeniasir-tr-rss', label: 'Yeni Asır - TR', url: 'https://www.yeniasir.com.tr/rss/gundem.xml' },
  { id: 'bloomberght-tr-rss', label: 'Bloomberg HT - TR (ekonomia)', url: 'https://www.bloomberght.com/rss' },
  { id: 'dailysabah-tr', label: 'Daily Sabah - TR', url: 'https://www.dailysabah.com/rssFeed/turkey' },
  { id: 'dailysabah-world', label: 'Daily Sabah - World', url: 'https://www.dailysabah.com/rssFeed/world' },
  // Jedyny angielskojęzyczny serwis turecki relacjonujący sądy i ekstradycję.
  { id: 'turkishminute-tr-rss', label: 'Turkish Minute — TR (EN)', url: 'https://www.turkishminute.com/feed/' },
  { id: 'decrypt', label: 'Decrypt', url: 'https://decrypt.co/feed' },
  { id: 'coindesk', label: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
  { id: 'cointelegraph', label: 'Cointelegraph', url: 'https://cointelegraph.com/rss' },
  {
    // Bezpośredni RSS zwraca 502/403 z adresów serwerowni (Cloudflare blokuje
    // datacenter IP; z domu ten sam URL odpowiada 200). Ta sama redakcja przez
    // wyszukiwarkę newsów, wzorzec jak przy Reddicie.
    id: 'theblock', label: 'The Block (przez wyszukiwarkę newsów)',
    kind: 'gnews',
    q: 'site:theblock.co (Richard Heart OR HEX OR PulseChain)',
  },
  // Finlandia — największe redakcje (zweryfikowane 30.10.2026: HTTP 200, świeże wpisy).
  { id: 'yle-fi-rss', label: 'Yle Uutiset (Finland)', url: 'https://feeds.yle.fi/uutiset/v1/recent.rss?publisherIds=YLE_UUTISET' },
  { id: 'yle-en-rss', label: 'Yle News - EN', url: 'https://feeds.yle.fi/uutiset/v1/recent.rss?publisherIds=YLE_NEWS' },
  { id: 'hs-fi-rss', label: 'Helsingin Sanomat (Finland)', url: 'https://www.hs.fi/rss/tuoreimmat.xml' },
  { id: 'is-fi-rss', label: 'Ilta-Sanomat (Finland)', url: 'https://www.is.fi/rss/tuoreimmat.xml' },
  { id: 'iltalehti-fi-rss', label: 'Iltalehti (Finland)', url: 'https://www.iltalehti.fi/rss/rss.xml' },
  { id: 'mtv-fi-rss', label: 'MTV Uutiset (Finland)', url: 'https://www.mtvuutiset.fi/api/feed/rss/mtv_uusimmat_100' },
  {
    // Stary feed /feed/rss-feed przestał odpowiadać po przebudowie strony (Next.js).
    // Ta sama instytucja przez wyszukiwarkę newsów; zapytanie celowo wąskie, żeby
    // nie zbierać statycznych stron serwisu. Zero wyników = źródło nadal zdrowe.
    id: 'syyttaja-fi-rss', label: 'Syyttäjälaitos (prokuratura Finlandii, przez wyszukiwarkę)',
    kind: 'gnews',
    q: 'site:syyttajalaitos.fi (Schueler OR "Richard Heart" OR luovutus OR ekstraditio)', locale: 'fi',
  },
  { id: 'sec-press', label: 'SEC - Press releases', url: 'https://www.sec.gov/news/pressreleases.rss' },
  { id: 'justice-news', label: 'US DOJ - News', url: 'https://www.justice.gov/news/rss' },
  // Reddit blokuje bezpośredni RSS z serwera (403); ta sama treść przez wyszukiwarkę.
  {
    id: 'reddit-pulsechain', label: 'Reddit r/Pulsechain (przez wyszukiwarkę newsów)',
    q: 'site:reddit.com pulsechain',
    kind: 'gnews',
  },
];

/** Zapytania Bing News. */
export const BING_QUERIES = [
  // To zapytanie musi różnić się od `gn-en-heart`, bo od 12.11.2026 oba
  // korzystają najpierw z Binga — identyczny URL był pobierany dwa razy.
  { id: 'bing-heart', label: 'Bing News: Richard Heart (areszt/ekstradycja)', q: '"Richard Heart" (arrest OR detention OR extradition OR Interpol)' },
  { id: 'bing-schueler', label: 'Bing News: Schueler', q: 'Richard James Schueler' },
];

/**
 * Strony oficjalne i pierwotne - sprawdzane bezposrednio (HTML),
 * nie przez agregator. `versioned: true` oznacza, że strona jest
 * porównywana z poprzednią wersją (zmiana treści = nowy wpis).
 * Zwykłe artykuły bez tej flagi są dedupowane po URL, bez wersji na szum.
 */
export const PAGE_SOURCES = [
  {
    id: 'interpol-red', label: 'Interpol — public Red Notice register (2024/65212)',
    kind: 'interpol', versioned: true, refreshMs: 5 * 60 * 1000,
    url: 'https://r.jina.ai/https://ws-public.interpol.int/notices/v1/red?name=Schueler',
  },
  {
    id: 'moj-tr', label: 'Ministerstwo Sprawiedliwości TR (oficjalny)',
    url: 'https://basin.adalet.gov.tr/1-milyar-dolarlik-kripto-vurgununun-suphelisi-istanbul-da-yakalandi',
    versioned: true,
  },
  {
    id: 'polis-tr', label: 'Policja Stambul (oficjalny)',
    url: 'https://www.polisbasin.com/kirmizi-bultenle-aranan-kripto-para-dolandiricisi-istanbul-da-yakalandi-evinden-600-bin-dolar-cikti/2574/',
    versioned: true,
  },
  {
    id: 'dha-tr', label: 'DHA (Turcja)',
    url: 'https://www.dha.com.tr/yerel-haberler/istanbul/kirmizi-bultenle-aranan-kripto-dolandiricisinin-2964206',
  },
  {
    id: 'yenisafak-tr', label: 'Yeni Safak (Turcja)',
    url: 'https://www.yenisafak.com/gundem/balina-james-istanbulda-yakalandi-4865222',
  },
  {
    id: 'hukuki-tr', label: 'Hukuki Haberler (Turcja - prawo ekstradycyjne)',
    url: 'https://hukukihaberler.com/kirmizi-bultenli-schueller-operasyonu-korumalar-gozaltinda-7-milyon-dolar-iade-sureci-nasil-isler',
  },
  {
    id: 'aa-tr-arrest', label: 'AA TR (aresztowanie - tekst)',
    url: 'https://www.aa.com.tr/tr/gundem/bakan-gurlek-interpolun-kirmizi-bultenle-aradigi-abdli-schuelerin-yakalandigini-bildirdi/4091693',
  },
  {
    id: 'yle-fi', label: 'Yle (Finlandia)',
    url: 'https://yle.fi/a/74-20251539',
  },
  {
    id: 'is-fi', label: 'Ilta-Sanomat (Finlandia)',
    url: 'https://www.is.fi/kotimaa/art-2000010922223.html',
  },
  {
    id: 'iltalehti-fi', label: 'Iltalehti (Finlandia)',
    url: 'https://www.iltalehti.fi/ulkomaat/a/9cbf718a-c495-499f-9194-a2e9dac11820',
  },
  {
    id: 'opensanctions', label: 'OpenSanctions (rejestr Interpol)',
    url: 'https://www.opensanctions.org/entities/Q108455374/',
    versioned: true,
  },
];

/**
 * Zrodla JSON. Puste celowo: ceny pobiera fetchMarketData() w kolektorze,
 * najwyżej raz na 5 minut (osobne źródło „prices" odpytywało CoinGecko co skan
 * i przy 10-sekundowym interwale natychmiast wpadało w limit 429).
 */
export const JSON_SOURCES = [];

/**
 * Kontrolne / historyczne zrodla z pakietu SOURCE-PACK.
 * To nie sa zrodla "news" - sa zrodlami, ktore sie zmieniaja rzadko
 * (dane podatkowe, akta sadowe, archiwa). Monitor sprawdza je, ale
 * w panelu traktuje jako "kontekst", nie jako nowe wiadomosci.
 */
export const REFERENCE_SOURCES = [
  {
    id: 'verokone', label: 'HS Verokone - rekord Schuelera',
    url: 'https://verokone.hs.fi/henkilo/1979Schueler%20Richard%20James',
    note: 'Dane podatkowe: 2022 - 24. miejsce, 15 247 314 EUR dochodu kapitalowego, 0 EUR z pracy, 34% podatku.',
  },
  {
    id: 'sec-2023-143', label: 'SEC - komunikat 2023-143 (31.07.2023)',
    url: 'https://www.sec.gov/newsroom/press-releases/2023-143',
    note: 'Pozew cywilny: >1 mld USD zebranych, >=12 mln USD sprzeniewerzone. Oddalony 28.02.2025 (brak jurysdykcji).',
    userAgent: 'RichardJamesSchulerMonitor/1.0 (admin@example.com)',
  },
  {
    id: 'sec-litigation-release', label: 'SEC - Litigation Release 25794',
    url: 'https://www.sec.gov/enforcement-litigation/litigation-releases/lr-25794',
    note: 'Uwaga: sam SEC ma w nim literowke - drukuje 23-cv-05794, poprawny numer sprawy to 1:23-cv-05749 (E.D.N.Y.).',
    userAgent: 'RichardJamesSchulerMonitor/1.0 (admin@example.com)',
  },
  {
    id: 'yle-arrest-2024', label: 'Yle 17.09.2024 - nakaz zatrzymania w Helsinkach',
    url: 'https://yle.fi/a/74-20112197',
    note: 'Oryginalne relacje z nakazu sadu: ciężkie oszustwo podatkowe + naduzycie. Urzad Skarbowy zawiadomil policje.',
  },
  {
    id: 'yle-tax-2023', label: 'Yle 8.11.2023 - 24. miejsce na liscie podatkowej',
    url: 'https://yle.fi/a/74-20059254',
    note: '15 mln EUR dochodu kapitalowego w 2022, 0 EUR dochodu z pracy, ponad 5 mln EUR podatku.',
  },
  {
    id: 'yle-watches-2025', label: 'Yle 7.01.2025 - zarekwirowane zegarki w Espoo',
    url: 'https://yle.fi/a/74-20135322',
    note: 'Zegarki >2,6 mln EUR (glownie Rolex), zamrozone srodki.',
  },
  {
    id: 'iltalehti-verokone', label: 'Iltalehti 8.11.2024 - "zniknal z Verokone"',
    url: 'https://www.iltalehti.fi/kotimaa/a/b9627dc4-ef20-481b-b2a1-ad3fd749072f',
    note: 'Dochody spadly do zera, miejsce zamieszkania nieznane.',
  },
  {
    id: 'mtv-verokone', label: 'MTV Uutiset - tabela 200 najwiekszych',
    url: 'https://www.mtvuutiset.fi/artikkeli/heilla-oli-suomen-suurimmat-tulot-lista-julki/8814868',
    note: 'Tabela z 2022: poz. 24 - Schueler Richard James, 0 EUR ansiotulo, 15 247 314 EUR.',
  },
  {
    id: 'is-europol-2024', label: 'Ilta-Sanomat 22.12.2024 - milioner na liscie Europolu',
    url: 'https://www.is.fi/kotimaa/art-2000010922223.html',
    note: 'Europol 18.12.2024; dane podatkowe: 15,2 mln EUR dochodu, mátky 5,2 mln EUR.',
  },
  {
    id: 'hs-verokone-2023', label: 'Ilta-Sanomat 15.11.2023 - 24. miejsce',
    url: 'https://www.is.fi/kotimaa/art-2000009977567.html',
    note: 'Wpis na liście podatkowej Finlandii.',
  },
  {
    id: 'hs-2024', label: 'HS 17.09.2024 - nakaz zatrzymania',
    url: 'https://www.hs.fi/suomi/art-2000010703487.html',
    note: 'Sąd Okręgowy w Helsinkach: nakaz zatrzymania nieobecnego 13.09.2024.',
  },
  {
    id: 'hs-2026-05', label: 'HS 5.5.2026 - ok. 280 mln EUR, propozycja dobrowolnego stawienia',
    url: 'https://www.hs.fi/suomi/art-2000011963415.html',
    note: 'Kwota 280 mln EUR; Schueler w Dubaju; propozycja dobrowolnego zgloszenia.',
  },
  {
    id: 'forbes-tr', label: 'Forbes Turkiye 14.10.2026',
    url: 'https://www.forbes.com.tr/haberler/kirmizi-bultenle-aranan-milyarder-kripto-dolandiricisi-istanbul-da-yakalandi-balina-richard-james-schueler-kim',
    note: 'UWAGA: zawiera błędy — pisze o „1,5 mld USD funduszu” i „88 zegarkach”; żadne źródło oficjalne tego nie podaje.',
  },
  {
    id: 'trtv', label: 'TR TV 17.10.2026',
    url: 'https://www.trtv.net/2026/10/17/interpol-firarisi-richard-schueler-istanbulda-yakalandi/',
    note: 'Czerwona nota na wniosek Finlandii; sprawa SEC oddalona w 2025.',
  },
  {
    id: 'fi-wikipedia', label: 'Wikipedia fi (terciarna - weryfikacja krzyzowa)',
    url: 'https://fi.wikipedia.org/wiki/Richard_Schueler',
    note: 'Zrodlo terciarne - do weryfikacji krzyzowej, nie jako zrodlo pierwotne.',
  },
];

/** Konta X istotne dla sprawy (z pakietu SOURCE-PACK). */
export const X_PROFILES_PACK = [
  { id: 'x-prof-gurlek', label: 'X: @abakingurlek (minister sprawiedliwosci TR)', handle: 'abakingurlek' },
  { id: 'x-prof-secrh', label: 'X: @sec_rh (agregator — nie źródło oficjalne)', handle: 'sec_rh' },
  { id: 'x-prof-pulseheart', label: 'X: @_pulseheartwin_ (agregator — nie źródło oficjalne)', handle: '_pulseheartwin_' },
  { id: 'x-prof-awildsj', label: 'X: @AWildSJ (społeczność — nie źródło oficjalne)', handle: 'AWildSJ' },
  { id: 'x-prof-nuclearherbs', label: 'X: @NuclearHerbs (społeczność — nie źródło oficjalne)', handle: 'NuclearHerbs' },
  { id: 'x-prof-sommi', label: 'X: @yourfriendSOMMI (społeczność — nie źródło oficjalne)', handle: 'yourfriendSOMMI' },
  // Zweryfikowane 30.10.2026 (lustro RSS działa): prokuratura stambulska, policja TR, konto samego Schuelera.
  { id: 'x-prof-istanbulcbs', label: 'X: @istanbulCBS (prokuratura Stambuł)', handle: 'istanbulCBS' },
  { id: 'x-prof-emniyetgm', label: 'X: @EmniyetGM (policja TR)', handle: 'EmniyetGM' },
  { id: 'x-prof-richardheart', label: 'X: @RichardHeartWin (konto Schuelera)', handle: 'RichardHeartWin' },
  // Zweryfikowane 1.11.2026 — konta, które faktycznie pisały o sprawie (lustro RSS: 200, świeże wpisy).
  { id: 'x-prof-whalepulse', label: 'X: @WhalePulse (analityk on-chain — nie źródło oficjalne)', handle: 'WhalePulse' },
  { id: 'x-prof-cagdasevren', label: 'X: @CagdasEvren (dziennikarz krypto TR)', handle: 'CagdasEvren' },
  { id: 'x-prof-usembturkiye', label: 'X: @USEmbTurkiye (ambasada USA w Turcji)', handle: 'USEmbTurkiye' },
  { id: 'x-prof-coinkolik', label: 'X: @coinkolik (krypto TR)', handle: 'coinkolik' },
  // Zweryfikowane 11.11.2026 — tureckie konta, ktore faktycznie pisaly o sprawie.
  // Odpowiedzi pod nimi to glownie zarty i polityka, ale kanal lapie nowe wpisy.
  { id: 'x-prof-pusholder', label: 'X: @pusholder (agregat TR)', handle: 'pusholder' },
  { id: 'x-prof-balinaavcisi', label: 'X: @balina_avcisi (krypto TR)', handle: 'balina_avcisi' },
  { id: 'x-prof-btcferit', label: 'X: @BtcFerit (krypto TR)', handle: 'BtcFerit' },
  { id: 'x-prof-trthaber', label: 'X: @trthaber (redakcja TR)', handle: 'trthaber' },
  { id: 'x-prof-sontv', label: 'X: @sontv_ (redakcja TR)', handle: 'sontv_' },
  { id: 'x-prof-dwturkce', label: 'X: @dw_turkce (redakcja TR)', handle: 'dw_turkce' },
  { id: 'x-prof-gztcom', label: 'X: @gztcom (agregat TR)', handle: 'gztcom' },
  { id: 'x-prof-istihbarat', label: 'X: @istihbaratRapor (agregat TR)', handle: 'istihbaratRapor' },
  // Konta redakcji, które publikowały o sprawie — łapią news szybciej niż RSS.
  { id: 'x-prof-aa-hbr', label: 'X: @anadoluajansi (agencja TR)', handle: 'anadoluajansi' },
  { id: 'x-prof-haberturk', label: 'X: @HaberTURK', handle: 'HaberTURK' },
  { id: 'x-prof-ntv', label: 'X: @ntv', handle: 'ntv' },
  { id: 'x-prof-cnnturk', label: 'X: @cnnturk', handle: 'cnnturk' },
  { id: 'x-prof-sabah', label: 'X: @sabah', handle: 'sabah' },
  { id: 'x-prof-hurriyet', label: 'X: @hurriyet', handle: 'hurriyet' },
  { id: 'x-prof-yleuutiset', label: 'X: @yleuutiset (Yle)', handle: 'yleuutiset' },
  { id: 'x-prof-iltasanomat', label: 'X: @iltasanomat (Ilta-Sanomat)', handle: 'iltasanomat' },
];

/**
 * Wszystkie zrodla w jednej liscie (uzywane przez kolektor).
 *
 * KOLEJNOŚĆ MA ZNACZENIE: źródła najszybciej podające nową informację o sprawie
 * (konta X i zapytania Google News) idą pierwsze, żeby zdążyły się pobrać na
 * początku skanu — reszta (feedy ogólne, archiwa) na końcu.
 */
/**
 * Źródła szybkiej ścieżki: wszystko, co może ogłosić wypuszczenie albo
 * ekstradycję. Pełny skan obejmuje je także — szybka pętla tylko skraca czas.
 */
export const FAST_SOURCE_IDS = [
  'interpol-red',
  'gn-release-tr',
  'gn-release-en',
  'gn-release-fi',
  'gn-tr-official',
  'gn-tr-ntv',
  'gn-tr-blocked',
  'gn-fi-extra',
  'moj-tr',
  'polis-tr',
  'aa-tr-arrest',
];

export function allSources() {
  const out = [];

  for (const p of X_PROFILES_PACK) {
    out.push({
      id: p.id, label: p.label, kind: 'jina',
      url: `https://r.jina.ai/https://x.com/${p.handle}`,
    });
  }
  for (const p of X_PROFILES) {
    out.push({
      id: p.id, label: p.label, kind: 'jina',
      url: `https://r.jina.ai/https://x.com/${p.handle}`,
    });
  }

  // Zapytania: Bing jest dostawcą podstawowym, Google — zapasem.
  for (const g of [...GOOGLE_NEWS_QUERIES, ...RELEASE_QUERIES]) {
    out.push({
      id: g.id, label: g.label, kind: 'gnews',
      url: bingNewsUrl(g.q, g.locale),
      fallbacks: [googleNewsUrl(g.q, g.locale)],
    });
  }
  for (const x of X_SITE_QUERIES) {
    const q = 'site:x.com ' + x.q;
    out.push({
      id: x.id, label: x.label, kind: 'xsite',
      url: bingNewsUrl(q, x.locale),
      fallbacks: [googleNewsUrl(q, x.locale)],
    });
  }
  for (const r of RSS_SOURCES) {
    out.push({
      id: r.id, label: r.label, kind: r.kind || 'rss',
      url: r.q ? bingNewsUrl(r.q, r.locale) : r.url,
      fallbacks: r.q ? [googleNewsUrl(r.q, r.locale)] : r.fallbacks,
    });
  }
  for (const b of BING_QUERIES) {
    out.push({
      id: b.id, label: b.label, kind: 'bing',
      url: `https://www.bing.com/news/search?q=${encodeURIComponent(b.q)}&format=RSS`,
    });
  }
  for (const j of JSON_SOURCES) {
    out.push({ id: j.id, label: j.label, kind: 'json', url: j.url, meta: j });
  }
  for (const p of PAGE_SOURCES) {
    out.push({ id: p.id, label: p.label, kind: p.kind || 'page', url: p.url, versioned: p.versioned === true, refreshMs: p.refreshMs });
  }
  for (const r of REFERENCE_SOURCES) {
    out.push({ id: r.id, label: r.label, kind: 'reference', url: r.url, note: r.note, userAgent: r.userAgent });
  }
  return out;
}


/**
 * Etykiety źródeł są zapisywane w bazie po polsku. Przy lang=en tłumaczymy
 * tylko część opisową (nazwy wydawców zostają), żeby stare wpisy też były EN.
 */
const EN_LABEL_RULES = [
  [/Ministerstwo Sprawiedliwości TR \(oficjalny\)/g, 'Turkish Ministry of Justice (official)'],
  [/Policja Stambul \(oficjalny\)/g, 'Istanbul Police (official)'],
  [/\(Turcja - prawo ekstradycyjne\)/g, '(Turkey — extradition law)'],
  [/\(Turcja\)/g, '(Turkey)'],
  [/\(Finlandia\)/g, '(Finland)'],
  [/\(prokuratura Finlandii, przez Google News\)/g, '(Finnish prosecution, via Google News)'],
  [/\(prokuratura Stambuł\)/g, "(Istanbul prosecutor's office)"],
  [/\(prokuratura Stambul\)/g, "(Istanbul prosecutor's office)"],
  [/\(policja TR\)/g, '(Turkish police)'],
  [/\(konto Schuelera\)/g, "(Schueler's account)"],
  [/\(dziennikarz krypto TR\)/g, '(Turkish crypto journalist)'],
  [/\(krypto TR\)/g, '(Turkish crypto)'],
  [/\(agregat TR\)/g, '(Turkish aggregator)'],
  [/\(redakcja TR\)/g, '(Turkish outlet)'],
  [/\(ambasada USA w Turcji\)/g, '(US Embassy in Turkey)'],
  [/\(agencja TR\)/g, '(Turkish agency)'],
  [/\(minister sprawiedliwości TR\)/g, '(Turkish justice minister)'],
  [/\(minister sprawiedliwosci TR\)/g, '(Turkish justice minister)'],
  [/\(agregator — nie źródło oficjalne\)/g, '(aggregator — not an official source)'],
  [/\(agregator - nie zrodlo oficjalne\)/g, '(aggregator — not an official source)'],
  [/\(społeczność — nie źródło oficjalne\)/g, '(community — not an official source)'],
  [/\(analityk on-chain — nie źródło oficjalne\)/g, '(on-chain analyst — not an official source)'],
  [/\(analityk on-chain - nie zrodlo oficjalne\)/g, '(on-chain analyst — not an official source)'],
  [/\(aresztowanie - tekst\)/g, '(detention — text)'],
  [/\(rejestr Interpol\)/g, '(Interpol registry)'],
  [/\(terciarna - weryfikacja krzyzowa\)/g, '(tertiary — cross-check)'],
  [/\(terciarna - weryfikacja krzyżowa\)/g, '(tertiary — cross-check)'],
  [/\(ekonomia\)/g, '(economy)'],
  [/\(MS, CTE, MSW, EGM, Jandarma, adliye\)/g, '(MoJ, CTE, MoI, EGM, Gendarmerie, courthouses)'],
  [/Haberler \(Bing\/Google\)/g, 'News TR (Bing/Google)'],
  [/TR oficjalne/g, 'TR official'],
  [/HS Verokone - rekord Schuelera/g, 'HS Verokone — Schueler record'],
  [/SEC - komunikat /g, 'SEC — release '],
  [/ - nakaz zatrzymania w Helsinkach/g, ' — arrest warrant in Helsinki'],
  [/ - nakaz zatrzymania/g, ' — arrest warrant'],
  [/ - 24\. miejsce na liscie podatkowej/g, ' — 24th place on the tax list'],
  [/ - 24\. miejsce/g, ' — 24th place'],
  [/ - zarekwirowane zegarki w Espoo/g, ' — watches seized in Espoo'],
  [/ - "zniknal z Verokone"/g, ' — "disappeared from Verokone"'],
  [/ - tabela 200 najwiekszych/g, ' — top-200 table'],
  [/ - ok\. 280 mln EUR, propozycja dobrowolnego stawienia/g, ' — approx. EUR 280 million, offer of voluntary surrender'],
  [/ - milioner na liscie Europolu/g, ' — millionaire on the Europol list'],
  [/Wikipedia fi/g, 'Finnish Wikipedia'],
  [/Forbes Turkiye/g, 'Forbes Türkiye'],
  [/przez Bing\/Google/g, 'via Bing/Google'],
];

/**
 * Stare wpisy w archiwum mają etykiety z czasów, gdy zapytania szły wyłącznie
 * przez Google. Dziś te same źródła korzystają najpierw z Binga — normalizujemy
 * samą nazwę źródła, nie zmieniając historii wpisu.
 */
const LEGACY_LABEL_RULES = [
  [/^Google News EN: /, 'News EN (Bing/Google): '],
  [/^Google News Finland: /, 'News FI (Bing/Google): '],
  [/^Google Haberler: /, 'Haberler (Bing/Google): '],
  [/przez Google News/g, 'przez Bing/Google'],
];

export function localizeSourceLabel(label, lang) {
  let raw = String(label || '');
  if (!raw) return raw;
  for (const [re, to] of LEGACY_LABEL_RULES) raw = raw.replace(re, to);
  if (lang !== 'en') return raw;
  let out = raw;
  for (const [re, to] of EN_LABEL_RULES) out = out.replace(re, to);
  return out;
}
