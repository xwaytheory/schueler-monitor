import test from 'node:test';
import assert from 'node:assert/strict';
import { renderHome } from '../src/web-public.js';
import {
  caseDay, caseProgress, daysUntil, KEY_FACTS, LAST_CONFIRMED, LEGAL_ROADMAP, LEGAL_DEADLINES,
  LEGAL_NOTES, PROGRESS_MARKS,
} from '../src/facts.js';
import { parseFeed } from '../src/feed-parser.js';

const home = (over = {}) => renderHome({
  latest: [],
  market: null,
  archive: { items: [], total: 0, pageNo: 1, pageCount: 1, q: '', src: '' },
  methodology: { sourceCount: 78, archiveTotal: 0, lastRunAt: null },
  ...over,
});

test('dzień sprawy liczy się od 14.10.2026 (dzień 1)', () => {
  assert.equal(caseDay(new Date('2026-10-14T09:00:00+03:00')), 1);
  assert.equal(caseDay(new Date('2026-10-21T23:00:00+03:00')), 8);
  assert.equal(caseDay(new Date('2026-10-30T22:00:00+03:00')), 17);
});

test('pierwszy ekran: pasek statusu i kluczowe fakty na górze', () => {
  const html = home();
  const heroIdx = html.indexOf('id="sprawa"');
  const newsIdx = html.indexOf('id="co-nowego"');
  assert.ok(heroIdx > -1 && newsIdx > heroIdx, 'sekcja sprawy jest przed „Co nowego”');
  assert.match(html, /class="statusbar"/);
  assert.match(html, /Brak znanego wyroku/);
  assert.match(html, /Dzień \d+/);
  assert.equal((html.match(/class="sfact"/g) || []).length, KEY_FACTS.length);
  for (const f of KEY_FACTS) {
    assert.ok(html.includes(f.label), `etykieta faktu: ${f.label}`);
    assert.ok(html.includes(f.value), `wartość faktu: ${f.value}`);
  }
  assert.ok(html.includes(`Ostatnie potwierdzone`), 'blok ostatniego potwierdzenia');
  assert.ok(html.includes(LAST_CONFIRMED.date));
});

test('brak nowych potwierdzonych informacji jest pokazany jawnie', () => {
  const html = home();
  assert.match(html, /Brak nowych potwierdzonych informacji od 21\.10\.2026/);
});

test('wpis z X nie dostaje streszczenia AI i jest oznaczony jako niezweryfikowany', () => {
  const now = Date.now();
  const html = home({
    latest: [
      {
        id: 'x-prof-test:1', source: 'x-prof-test', source_label: 'X: @test',
        title: 'Day 17 update about custody', url: 'https://x.com/test/status/1',
        published_at: now, summary_pl: 'Media podają, że ujawniono wniosek o ekstradycję.',
      },
      {
        id: 'gn:1', source: 'gn-en-heart', source_label: 'Google News EN',
        title: 'Finland confirms request', url: 'https://example.com/a',
        first_seen_at: now - 3600_000, summary_pl: 'Streszczenie medialne.',
      },
    ],
  });
  const leadBlock = html.slice(html.indexOf('class="lead-main"'), html.indexOf('class="lead-side"'));
  assert.match(leadBlock, /wpis społecznościowy/);
  assert.match(leadBlock, /Traktuj jako relację niezweryfikowaną/);
  assert.ok(!leadBlock.includes('Streszczenie AI'), 'brak streszczenia AI przy wpisie z X');
  assert.ok(!leadBlock.includes('ujawniono wniosek'), 'fałszywe streszczenie nie trafia na górę');
});

test('licznik dni do terminu działa w obie strony', () => {
  const day = new Date('2026-10-31T12:00:00+03:00');
  assert.equal(daysUntil('2026-11-01', day), 1);
  assert.equal(daysUntil('2026-11-23', day), 23);
  assert.equal(daysUntil('2026-10-30', day), -1);
});

test('statusbar pokazuje terminy ustawowe, a strona ma roadmapę prawną', () => {
  const html = home();
  assert.match(html, /class="s-dl"/);
  for (const d of LEGAL_DEADLINES) assert.ok(html.includes(d.label), `termin w pasku: ${d.label}`);
  assert.match(html, /id="procedura"/);
  for (const s of LEGAL_ROADMAP) {
    assert.ok(html.includes(s.title), `krok roadmapy: ${s.title}`);
    assert.ok(html.includes(s.basis), `podstawa prawna kroku: ${s.title}`);
  }
  assert.equal((html.match(/class="rm /g) || []).length, LEGAL_ROADMAP.length);
  for (const n of LEGAL_NOTES) assert.ok(html.includes(n.slice(0, 40)), 'zastrzeżenie prawne');
});

test('pasek postępu okna ustawowego jest animowany i zgodny z dniem sprawy', () => {
  assert.equal(caseProgress(new Date('2026-10-14T09:00:00+03:00')), 0);
  assert.equal(caseProgress(new Date('2026-10-21T09:00:00+03:00')), 17.5);
  assert.equal(caseProgress(new Date('2026-11-23T09:00:00+03:00')), 100);
  assert.equal(caseProgress(new Date('2026-12-31T09:00:00+03:00')), 100);

  const html = home();
  assert.match(html, /class="tl-track" role="progressbar"/);
  assert.match(html, /class="tl-fill"/);
  assert.match(html, /class="tl-now"/);
  assert.match(html, /class="tl-event"/);
  assert.equal((html.match(/class="tl-mark/g) || []).length, PROGRESS_MARKS.length);
  assert.match(html, /@keyframes tlGrow/);
  assert.match(html, /@keyframes tlPulse/);
  assert.match(html, /prefers-reduced-motion/);
});

test('archiwum ma filtr źródeł: media vs X', () => {
  const html = home();
  assert.match(html, /class="arch-filter"/);
  assert.match(html, /\?src=media#archiwum/);
  assert.match(html, /\?src=social#archiwum/);
  assert.match(html, /X \/ społecznościowe/);
});

test('wersja EN ma angielski interfejs i streszczenie EN', () => {
  const item = {
    id: 'gn:en', source: 'gn-en', source_label: 'Google News',
    title: 'Finland confirms request', url: 'https://example.com/en',
    published_at: Date.now(), summary_pl: 'Polskie streszczenie.', summary_en: 'English summary.',
  };
  const pl = home({ latest: [item] });
  const en = home({ latest: [item], lang: 'en' });

  assert.match(pl, /<html lang="pl" data-theme="pulse">/);
  assert.match(en, /<html lang="en" data-theme="pulse">/);
  assert.match(en, /Case monitor/);
  assert.match(en, /What we know/);
  assert.match(en, /No known verdict/);
  assert.match(en, /English summary\./);
  assert.doesNotMatch(en, /Polskie streszczenie\./, 'lead w EN nie pokazuje polskiego streszczenia');
  assert.match(pl, /Polskie streszczenie\./);
  assert.doesNotMatch(en, /Brak znanego wyroku/);
});

test('pulse jest domyślne, a sekcje dossier są na każdym motywie', () => {
  assert.match(home(), /data-theme="pulse"/);
  for (const theme of ['dossier', 'editorial', 'pulse', 'spectrum']) {
    const html = home(theme === 'dossier' ? {} : { theme });
    assert.match(html, /class="filing"/, `kapeja aktowa: ${theme}`);
    assert.match(html, /id="okno"/, `okno ustawowe: ${theme}`);
    assert.match(html, /id="scenariusze"/, `scenariusze: ${theme}`);
    assert.equal((html.match(/class="scen-card/g) || []).length, 5, `karty scenariuszy: ${theme}`);
  }
});

test('motyw Pulse jest domyślny, pozostałe są opcjonalne', () => {
  const pl = home();
  const editorial = home({ theme: 'editorial' });
  assert.match(pl, /<html lang="pl" data-theme="pulse">/);
  assert.match(editorial, /<html lang="pl" data-theme="editorial">/);
  assert.match(pl, /html\[data-theme="pulse"\]\{/);
  assert.match(pl, /--amber:#d494ab/);
});

test('feedy z datą z przyszłości są odrzucane', () => {  const xml = `<rss><channel><item><title>Test</title><link>https://example.com/1</link>
    <pubDate>${new Date(Date.now() + 400 * 86400_000).toUTCString()}</pubDate></item>
    <item><title>Stary</title><link>https://example.com/2</link><pubDate>Mon, 01 Jan 1990 00:00:00 GMT</pubDate></item>
    </channel></rss>`;
  const items = parseFeed(xml, { source: 't', label: 'T' });
  assert.equal(items.length, 2);
  for (const it of items) assert.equal(it.publishedAt, null, 'data poza oknem jest odrzucana');
});

test('etykiety osi czasu stoja pod swoimi znacznikami, nie w rownych kolumnach', () => {
  const html = home();
  // 14.10 = dzien 0, ~18.10 = dzien 5 (12,5 %), 1.11 = dzien 19 (47,5 %), 23.11 = dzien 40 (100 %).
  assert.match(html, /style="--at:0\.0%"/);
  assert.match(html, /style="--at:12\.5%"/);
  assert.match(html, /style="--at:47\.5%"/);
  assert.match(html, /style="--at:100\.0%"/);
  assert.doesNotMatch(html, /\.tl-labels\{display:grid;grid-template-columns:repeat\(4,1fr\)/);
});

test('akty prawne i źródła twierdzeń są klikalne', () => {
  const html = home();
  assert.match(html, /class="acts"/);
  assert.match(html, /class="acts-label"/);
  assert.ok(html.includes('https://www.mevzuat.gov.tr/mevzuatmetin/1.5.6706.pdf'), 'link do ustawy 6706');
  assert.match(html, /https:\/\/www\.coe\.int\/en\/web\/conventions\/full-list\?module=treaty-detail&amp;treatynum=024/, 'link do ECE');
  assert.ok(html.includes('https://www.finlex.fi/fi/laki/ajantasa/1970/19700456'), 'link do ustawy fińskiej');
  assert.ok(html.includes('https://www.yenisafak.com/gundem/balina-james-istanbulda-yakalandi-4865222'), 'link do jedynego źródła twierdzenia');
  assert.match(html, /class="src-link"/);
  assert.match(html, /Ostatnia weryfikacja/);
  assert.ok((html.match(/class="act"/g) || []).length >= 9, 'każdy akt ma przypis');
});

test('chronologia obejmuje wpisy po 21.10 i odsyła do źródeł', () => {
  const html = home();
  assert.ok(html.includes('lettersforrichard.org'));
  assert.ok(html.includes('cryptospecting.com'));
  assert.match(html, /\b13\.11\b/);
  assert.match(html, /Przegląd monitora/);
  assert.match(html, /przegląd, nie zdarzenie/);
});

test('nowe wpisy i tweety są nad starszą treścią, oś pokazuje wpis społecznościowy', () => {
  const now = Date.now();
  const html = home({
    latest: [
      { id: 'x-a', source: 'x-prof-test', source_label: 'X: @a', title: 'Najnowszy wpis', url: 'https://x.com/a/1', published_at: now },
      { id: 'x-b', source: 'x-prof-test', source_label: 'X: @a', title: 'Drugi wpis', url: 'https://x.com/a/2', published_at: now - 7200_000 },
      { id: 'gn-1', source: 'gn-en', source_label: 'Google News', title: 'Materiał', url: 'https://example.com/a', published_at: now - 3600_000 },
    ],
  });
  const latestIdx = html.indexOf('id="co-nowego"');
  assert.ok(latestIdx > -1, 'sekcja nowych wpisów istnieje');
  assert.ok(latestIdx < html.indexOf('id="wiemy"'), 'nowe wpisy przed bilansem wiedzy');
  assert.ok(latestIdx < html.indexOf('id="os-czasu"'), 'nowe wpisy przed osią czasu');
  assert.match(html, /class="community"/);
  assert.match(html, /Wpisy z X/);
  assert.match(html, /class="tl-social"/);
  assert.doesNotMatch(html, /tl-social-note/, 'legenda pod osią usunięta');
  // Pinezka wpisu z dzisiaj stoi dokładnie na kropce „dziś”, a nie obok niej.
  const nowLeft = /class="tl-now" style="left:([\d.]+)%"/.exec(html)?.[1];
  const socialLeft = /class="tl-social" style="left:([\d.]+)%"/.exec(html)?.[1];
  assert.ok(nowLeft && socialLeft, 'oba znaczniki mają pozycję');
  assert.equal(socialLeft, nowLeft, 'pinezka tweeta pokrywa się z kropką „dziś”');
});

test('pierwszy ekran nie dubluje kamieni milowych, status ma dwie warstwy', () => {
  const html = home();
  const hero = html.slice(html.indexOf('id="sprawa"'), html.indexOf('id="co-nowego"'));
  assert.ok(!hero.includes('class="tl-clips"'), 'karty akt są poza pierwszym ekranem');
  assert.match(hero, /class="statusbar-main"/);
  assert.match(hero, /class="statusbar-meta"/);
  assert.match(hero, /class="calc"/);
  assert.ok(hero.indexOf('class="shero-grid"') < hero.indexOf('class="tl-bar"'), 'oś czasu jest pod nazwiskiem');
  assert.ok(hero.indexOf('class="hero-side"') < hero.indexOf('class="hero-shot"'), 'zdjęcie w prawej kolumnie');
  assert.ok(hero.indexOf('class="hero-shot"') < hero.indexOf('class="lastc"'), 'karta ostatniego potwierdzenia pod zdjęciem');
  assert.ok(html.indexOf('class="tl-clips"') > html.indexOf('id="os-czasu"'), 'karty akt są w sekcji osi czasu');
});

test('roadmapa nie powtarza kart terminów i oznacza minięte okno jako po terminie', () => {
  const html = home();
  assert.doesNotMatch(html, /class="dl-strip"/);
  assert.match(html, /Termin minął — brak potwierdzenia/);
  assert.doesNotMatch(html, /Trwa — otwarte okno/);
  assert.match(html, /06 — Procedura/);
  assert.match(html, /03 — Chronologia/);
  assert.match(html, /04 — Bilans wiedzy/);
  assert.match(html, /09 — Archiwum/);
});

test('patronat Kryptosfery jest na stronie i linkuje do kanału i filmu', () => {
  const pl = home();
  assert.match(pl, /id="patronat"/);
  assert.match(pl, /Kryptosfera — patron i przyjaciel/);
  assert.ok(pl.includes('https://t.me/mojakryptosfera'), 'link do Telegrama');
  assert.ok(pl.includes('https://youtu.be/yDn3beKTolY?t=447'), 'link do filmu od 7:27');
  const en = home({ lang: 'en' });
  assert.match(en, /Kryptosfera — patron and friend/);
  assert.doesNotMatch(en, /patron i przyjaciel/);
});

test('podpisy zdjęć majątek i ekosystem tłumaczą się na EN', () => {
  const en = home({ lang: 'en' });
  assert.match(en, /Assets in the background/);
  assert.match(en, /Ecosystem/);
  assert.match(en, /Mercedes-AMG G 63/);
  assert.doesNotMatch(en, /Majątek w tle sprawy/);
});

test('majątek i galeria zatrzymania są nisko, bez zdjęcia Lamborghini', () => {
  const pl = home();
  assert.ok(pl.indexOf('id="majatek"') > pl.indexOf('id="wiemy"'), 'blok majątku poniżej „Co wiemy”');
  assert.ok(pl.indexOf('id="dokumentacja"') > pl.indexOf('id="archiwum"'), 'galeria poniżej archiwum');
  assert.ok(pl.indexOf('id="dokumentacja"') > pl.indexOf('id="os-czasu"'), 'galeria poniżej osi czasu');
  assert.match(pl, /dziewięć samochodów/);
  assert.doesNotMatch(pl, /lamborghini/i, 'zdjęcia Lamborghini nie ma na stronie');
  assert.doesNotMatch(pl, /jeden z zajętych samochodów/);
});

test('wycinki prasowe pod osia maja cztery karty i tlumacza sie na EN', () => {
  const pl = home();
  assert.equal((pl.match(/class="tl-clip"/g) || []).length, PROGRESS_MARKS.length);
  assert.match(pl, /Zatrzymanie w Stambule/);
  assert.match(pl, /Koniec 40 dni/);
  assert.ok(pl.indexOf('class="tl-clips"') > pl.indexOf('class="tl-labels"'), 'wycinki są pod etykietami');
  const en = home({ lang: 'en' });
  assert.match(en, /Detained in Istanbul/);
  assert.match(en, /The 40 days run out/);
});

test('zdjęcia sprawy są na stronie w trzech miejscach, podpisane i podlinkowane', () => {
  const pl = home();
  // 1. kadr z zatrzymania przy nazwisku, 2. galeria pod osią, 3. majątek w „Co wiemy”.
  assert.match(pl, /class="hero-shot"/);
  assert.match(pl, /id="dokumentacja"/);
  assert.match(pl, /id="majatek"/);
  assert.equal((pl.match(/<img src="\/press\//g) || []).length, 33);
  for (const f of ['fotel.jpg', 'kuchnia-wyspa.jpg', 'kuchnia-zaplecze.jpg', 'kuchnia-blat.jpg',
    'serwerownia-szeroko.jpg', 'serwerownia-rigi.jpg', 'serwerownia-rigi-2.jpg', 'serwerownia-polki.jpg',
    'serwerownia-liczniki.jpg',
    'sejf-wnetrze.jpg', 'kasa-portfel.jpg', 'sejf-klucze.jpg',
    'zegarki-taca.jpg', 'zegarki-gablota.jpg', 'witryna-zegarki.jpg', 'bizuteria-stol.jpg',
    'gotowka-torba.jpg', 'licznik-gotowki.jpg', 'bron-dluga.jpg', 'bron.jpg',
    'auto-vito.jpg', 'auto-vito-tyl.jpg', 'auto-maybach-s.jpg', 'auto-g.jpg',
    'auto-maybach-gls.jpg', 'auto-porsche.jpg', 'auto-g-tyl.jpg', 'auto-porsche-vin.jpg',
    'kuchnia-szeroko.jpg', 'sejf-szafa.jpg', 'paszport-usa-hd.jpg',
    'pozwolenie-bron-odatv.jpg']) {
    assert.ok(pl.includes(`/press/${f}`), `plik galerii: ${f}`);
  }
  assert.match(pl, /alt="Schueler w fotelu/);
  assert.match(pl, /Cytat prasowy/);
  assert.ok(pl.includes('https://www.dha.com.tr/'), 'link do materiału źródłowego');
  assert.ok(pl.indexOf('class="hero-shot"') < pl.indexOf('id="co-nowego"'), 'zdjęcie w pierwszym ekranie');
  const en = home({ lang: 'en' });
  assert.match(en, /Photos: DHA, Sabah/);
  assert.doesNotMatch(en, /Fot\. DHA/);
  assert.doesNotMatch(en, /kadr z materiału wideo DHA/);
});

test('rynek ma oryginalne logotypy tokenów, a stopka — rząd ekosystemu', () => {
  const market = {
    rows: [
      { id: 'hex', name: 'HEX (Ethereum)', price: 0.0006, d24: -32.5, d7: -40, d30: -55 },
      { id: 'pulsechain', name: 'PLS', price: 0.00002, d24: -12, d7: -20, d30: -30 },
      { id: 'prvx', name: 'PRVX (ProveX)', price: 0.01, d24: null, d7: null, d30: null },
    ],
    updatedAtMs: Date.now(),
  };
  const pl = home({ market });
  assert.match(pl, /class="coin-logo" src="\/logos\/hex\.png"/);
  assert.match(pl, /src="\/logos\/pulsechain\.png"/);
  assert.match(pl, /src="\/logos\/prvx\.png"/);
  assert.doesNotMatch(pl, /class="eco-chips"/, 'brak chipów tokenów przy nazwisku');
  assert.match(pl, /class="foot-eco"/);
  assert.ok(pl.includes('/logos/pulsex.jpg'), 'logo PulseX');
});
