# Monitor sprawy Schueler — Richard James Schueler / Richard Heart / HEX / PulseChain

Stały monitor wiadomości o sprawie **Richarda Jamesa Schuelera** (ps. *Richard Heart*, *Balina James*),
zatrzymanego 14.10.2026 w Stambule na podstawie **czerwonej noty Interpolu**.

**Przegląd kodu:** zacznij od `REVIEW-GUIDE.md` — mapa modułów, trasy, model danych,
wykluczenia i znane ograniczenia.

System skanuje **wszystkie 118 źródeł** w każdym cyklu. Interwał i równoległość pobierania
są konfigurowane przez `SCAN_INTERVAL_SEC` (domyślnie 360 s; w tej instalacji 180 s),
`FAST_SCAN_INTERVAL_SEC` (szybka ścieżka oficjalna: 30 s) oraz `MAX_FETCH_CONCURRENCY`
(domyślnie 12; w tej instalacji 8). Konta X przez `r.jina.ai` pobierane są pojedynczo
z odstępem `JINA_SPACING_MS` (2,5 s), bo burst 33 żądań kończył się HTTP 429. Jeśli skan trwa dłużej niż interwał, kolejny tick jest
pomijany — pętle się nie nakładają. Skan co 10 s przeciążał lusterka X i feedy (HTTP 429/406);
po zwolnieniu tempa health pokazuje 118/118 źródeł.

**Alert nie czeka na AI.** Powiadomienie na Discorda leci natychmiast po wykryciu wpisu:
streszczenie bierzemy z cache, a brakujące generujemy w tle (i zapisujemy do archiwum).
Wcześniej wołanie modelu (do 30 s na wpis) blokowało wysyłkę — dziś nie może opóźnić alertu.
Rynek (CoinGecko/DexScreener) odświeżany jest najwyżej raz na 5 minut.
Alerty dotyczą wydarzeń **od 14.10.2026**; starsze wpisy zostają w archiwum tylko jako tło
(`CASE_START`).

Strona publiczna (`/`) jest **serwisem redakcyjnym**: pokazuje potwierdzone fakty, oś czasu,
sprzeczności w mediach i archiwum relacji. Panel operacyjny (`/ops`) jest oddzielony i wymaga
tokena — pokazuje stan źródeł, kolejkę i błędy wysyłki. Dzięki temu czytelnik nie widzi
telemetrii ani konfiguracji.

## Publiczny adres

- Strona sprawy: `http://92.5.146.17:3000/`
- Panel operacyjny: `/ops` (wymaga `ADMIN_TOKEN`)
- Publiczne API archiwum: `/api/items` (`limit` 1–100, `offset`, `q`)
- Publiczne API nowych wpisów: `/api/latest?since=<ms>` (dla panelu na żywo)
- API administracyjne: `/api/status`, `/api/notifications`, `POST /api/scan` (Bearer token)
- Healthcheck: `/healthz`

## Język, motyw i aktualizacja na żywo

- **Język:** `?lang=pl` (domyślnie) albo `?lang=en`. Wybór zapisuje się w ciasteczku
  `mntr_lang`; dotyczy całego interfejsu, faktów, roadmapy, osi czasu i metadanych.
  Tytuły relacji i nazwy źródeł zostają w języku wydawcy (to cytat, nie interfejs).
- **Streszczenia:** przy wykryciu wpisu powstają **oba** streszczenia — `summary_pl`
  i `summary_en`. Strona PL pokazuje polskie, strona EN angielskie; notatka wpisu pokazuje
  oba obok siebie. Wpisy z X nadal nie dostają streszczeń AI.
- **EN bez resztek PL:** etykiety źródeł są tłumaczone w locie (`localizeSourceLabel`),
  lista znanych błędów i podstawa prawna terminów mają wersje angielskie, a strona EN
  nie pokazuje polskiego streszczenia pod angielską etykietą.
- **Motyw:** cztery szaty, wszystkie bez neonu:
  - `?theme=pulse` (domyślny — wyciszona śliwka, pudrowy róż, stare złoto, szałwia),
  - `?theme=dossier` (akta prawne na ciepłym papierze),
  - `?theme=editorial` (bursztyn/tusz),
  - `?theme=spectrum` (bliżej ekosystemu: głęboki fiolet, wyciszona magenta,
    stonowany cyan i stare złoto; kontrast tekstu ≥ 5,4:1).
  Wybór zapisuje się w `mntr_theme`.
- **Na żywo:** strona zawiera mały skrypt `/live.js` (bez CDN), który co 15 s pyta
  `/api/latest`. Gdy pojawi się nowy wpis, w rogu ekranu wyświetla tytuł w języku wydawcy
  oraz **oba streszczenia (PL i EN)**; kolejność zależy od języka strony, ale żadne nie
  znika. Panel nie przeładowuje strony i nie zmienia pozycji czytania, ma własne
  przewijanie i znika po 60 s albo po zamknięciu. Zapytania nie nakładają się, a po
  powrocie z bfcache pętla wznawia się sama. CSP pozostaje ostre:
  `default-src 'none'; script-src 'self'; connect-src 'self'`.


## Kanał Discord

- Serwer: **PYRALNIA** (`637697303737794561`)
- Kanał: **#schueler-hex-pulsechain** (`1562518992672002203`), pod kategorią `#bot`
- Webhook tworzony automatycznie przez `src/cli-channel.js`

## Źródła (118)

Wszystkie źródła są sprawdzane w tym samym cyklu — co `SCAN_INTERVAL_SEC` (domyślnie 360 s;
w tej instalacji 180 s, a źródła oficjalne w szybkiej ścieżce co 30 s).

| Typ | Przykłady |
|---|---|
| News (Bing → Google) | Schueler, "Richard Heart", "Balina James" (TR), HEX PulseChain, zapytanie fińskie `site:hs.fi OR site:is.fi OR site:iltalehti.fi OR site:mtvuutiset.fi OR site:yle.fi`, `site:iha.com.tr OR tv100 OR haber3 OR patronlardunyasi OR yenisafak`, zapytanie `site:stt.fi/vero.fi/oikeus.fi/poliisi.fi/um.fi`, **`site:basin.adalet.gov.tr/cte.adalet.gov.tr/icisleri.gov.tr/egm.gov.tr/jandarma.gov.tr/istanbul*.adalet.gov.tr`**, NTV/Ekonomim/Sözcü |
| News `site:x.com` (Bing → Google) | wpisy z **X/Twittera**: zapytania EN + `Schueler iade/ekstradisyon` (TR) + `Schueler luovutus/veropetos` (FI) |
| X przez r.jina.ai | 34 profile: @istanbulCBS (prokuratura Stambuł), @_pulseheartwin_, @sec_rh, @abakingurlek (minister), @RichardHeartWin; @BeInCrypto, @WuBlockchain, @lookonchain, @INTERPOL_HQ, @SECGov, @EmniyetGM (policja TR) i in. |
| Bing News (osobne zapytania) | "Richard Heart" (areszt/ekstradycja/Interpol), Richard James Schueler |
| RSS — Turcja | AA (TR/EN, agencja, która podała komunikat ministra), Sabah, Milliyet, Cumhuriyet, CNN Türk, Euronews TR, Diken, **Yeni Şafak**, **Sözcü**, **Yeni Asır**, **Bloomberg HT**, Habertürk, Hürriyet, Daily Sabah |
| RSS — Finlandia | **Yle** Uutiset, **Yle News (EN)**, Helsingin Sanomat, Ilta-Sanomat, Iltalehti, MTV Uutiset, **Syyttäjälaitos** (prokuratura) |
| RSS — krypto/instytucje | Decrypt, CoinDesk, Cointelegraph, The Block, SEC, DOJ, Reddit r/Pulsechain (przez Google News — Reddit blokuje bezpośredni RSS) |
| Strony oficjalne | Ministerstwo Sprawiedliwości TR, Policja Stambuł, AA (tekst), DHA, Yeni Şafak, Hukuki Haberler, Yle 14.10 |
| Rejestry | OpenSanctions (Interpol) |
| Dane rynkowe | CoinGecko (HEX Ethereum, HEX PulseChain, PLS, PLSX, pDAI, pCOCK) + DexScreener (PRVX) |
| **Referencyjne** (kontekst, bez powiadomień) | HS Verokone (dane podatkowe), SEC 2023-143 + Litigation Release, Yle 2023/2024/2025, Iltalehti, MTV, IS, HS, Forbes TR, TR TV, Wikipedia FI |

Wycofane, martwe źródła są usuwane z listy, a ich wpisy oznaczane jako `retired-source`
(ukryte w archiwum). Tak zniknęły CourtListener (HTTP 405 z serwera), archiwum Europol
(404/429) i „status.hex.tech” (strona innego produktu).

**Konta X z pakietu źródeł:** @abakingurlek, @istanbulCBS i @EmniyetGM to konta instytucjonalne
(oznaczone jako oficjalne), @sec_rh i @_pulseheartwin_ to agregatory społecznościowe —
na stronie mają osobny badge „X / społecznościowe”, nie dostają streszczeń AI i nie są
prezentowane jako fakt.

**Fallback dla X:** gdy r.jina.ai zablokuje dostęp (429/403, zwykle na kilkanaście minut),
kolektor automatycznie pobiera to samo konto przez zapytanie `site:x.com` — najpierw Bing,
potem Google. Pokrycie treści z X nie ginie.

Strony statyczne są odpytywane i **wpuszczane do archiwum tylko gdy zmieni się ich treść** (hash).

## Jak działa klasyfikacja

`src/matcher.js` — ocena wagi wpisu:

- **Pełne imię i nazwisko** (`Richard [James] Schueler`) → trafienie (+140)
- **Samo nazwisko `Schueler`** → wymaga kontekstu sprawy: Interpol, HEX/PulseChain
  albo wydarzenie prawne; inaczej wpis odpada (nazwisko jest popularne)
- **Pseudonim `Richard Heart`** → wymaga kontekstu zdarzenia lub Interpolu (+90)
- **Terminy mocne** (`interpol`, `red notice`, `czerwona nota`) → +45
- **Kontekst HEX/PulseChain** → +30
- **Terminy zdarzeń** (areszt, sąd, ekstradycja, transfer…) → +25
- **Filtr szumu** — odrzuca homonimy: *Schueler Field*, *heart transplant*, *HEX color code*,
  *Heartbeat monitor* oraz nazwiska innych osób (sportowcy, naukowcy, przedsiębiorcy).

Bez pełnego imienia, pseudonimu w kontekście zdarzenia lub terminu mocnego wpis
nie przechodzi. Kolejka powiadomień dodatkowo reewaluuje stare wpisy tym samym
matcherem — homonimy nie wracają po zmianie reguł.

Deduplikacja (`src/dedup.js`) po znormalizowanym URL (rozwijane przekierowania Bing),
identyfikatorze Google News (normalizowanym do małych liter) oraz — tylko dla wpisów
bez poprawnego adresu — tytule. Dodatkowo **odcisk treści** (tytuł + początek tekstu)
scala identyczne posty X i przedruki, które mają różne URL-e. Ten sam artykuł z 5 źródeł
to jeden wpis. Zwykłe strony artykułów są dedupowane po URL; tylko źródła z
`versioned: true` (oficjalne komunikaty, akta sądowe, rejestr) zapisują kolejne wersje
po zmianie treści.

### Grupowanie zdarzeń (`src/story.js`)

Deduplikacja artykułów nie wystarcza: 20 portali pisze o **jednym** zatrzymaniu.
Moduł grupuje wpisy w zdarzenia:

- **klucz zdarzenia** = rodzaj faktu (areszt / proces / ekstradycja / komunikat ministra / MİT / SEC / Finlandia)
- **poziom szczegółowości** = 1 (ogólnie) lub 2 (ujawnione kwoty, broń, auta, portfele, zegarki)

Powiadomienie leci tylko wtedy, gdy zdarzenie jest **nowe** albo pojawił się **nowy poziom
szczegółowości** (np. najpierw „zatrzymany”, potem „zatrzymany + 7,15 mln USD i 6 zimnych portfeli”).
Rozwój procesu po zatrzymaniu to nowe zdarzenie = nowe powiadomienie. Tytuł ma pierwszeństwo
przed wzmianką o zatrzymaniu w treści, więc „rozprawa po zatrzymaniu” nie jest liczona jako
kolejne aresztowanie. Po `STORY_REALERT_HOURS` (domyślnie 24 h) nowa wzmianka o tym samym
zdarzeniu może znowu zaalarmować — inaczej przyszły wyrok byłby wiecznie wyciszony.

Wpisy zgrupowane w zdarzeniu (`story:*`) **zostają w publicznym archiwum** — są tylko
pomijane w powiadomieniach.

### Polityka alertów (`src/alert-policy.js`)

Domyślnie (`ALERT_POLICY=important`) na Discorda trafiają tylko:

- komunikaty źródeł oficjalnych (MoJ, policja, sąd, SEC/DOJ, Interpol, konto ministra),
- ważne zdarzenia: zatrzymanie/areszt, zarzuty, sąd, ekstradycja, komunikat ministra,
  zatrzymanie ochroniarzy, czerwona nota.

Komentarze, kursy, spekulacje i zwykłe wzmianki zostają w archiwum publicznym, ale nie
generują powiadomień. `ALERT_POLICY=all` przywraca wysyłkę każdego trafienia matchera.

### Warstwa weryfikacji faktów (`src/facts.js`)

Z pakietu `SOURCE-PACK.md`, aktualizowana ręcznie. Monitor **nie przekazuje treści bez oznaczeń**:

- **Kluczowe fakty** (`KEY_FACTS`) — sześć kafli na pierwszym ekranie: status prawny, podstawa
  (czerwona nota), zarzut, zabezpieczenia, ekstradycja, wyrok. Każdy z badge
  *Potwierdzone* / *Wyliczenie* / *Brak potwierdzenia* i linkiem do źródła.
- **Fakty potwierdzone** — 10 ustaleń opartych na źródłach pierwotnych (Interpol API,
  MoJ, sądy, HS Verokone, CoinGecko).
- **Twierdzenia z jednego źródła** — pozycje wymagające atrybucji
  (Çiftçi Towers, dane osoby prywatnej (żony), zawody ochroniarzy, „poszukiwany od lutego 2026").
- **Znane błędy redakcyjne** — 8 reguł wykrywanych w treści artykułu
  (np. „aresztowany" zamiast *gözaltı*, „1 mld USD oszustwa", „64 Rolexy" zamiast 28,
  „badacze MIT" zamiast **MİT** — tureckiego wywiadu, „skazany na 4 lata" zamiast
  *maksimum kary*).
- **Roadmapa prawna** (`LEGAL_ROADMAP`, `LEGAL_DEADLINES`, `LEGAL_NOTES`) — kroki od
  zatrzymania do możliwych zakończeń z podstawami prawnymi: turecki CMK 5271 art. 91 i 109,
  ustawa 6706 o współpracy międzynarodowej (art. 11, 14–19), Europejska Konwencja
  o Ekstradycji (art. 16, 18) oraz fińska ustawa 456/1970. Dwa liczniki w pasku statusu:
  okno 18 dni na dokumenty Finlandii (1.11.2026) i maksimum 40 dni tymczasowego zatrzymania
  ekstradycyjnego (23.11.2026). Terminy to **wyliczenia redakcji** z daty zatrzymania.

Każde powiadomienie na Discordzie automatycznie dostaje sekcję
**🚩 Błąd / nieścisłość w materiale** lub **⚠️ Twierdzenie wymaga atrybucji**.

Strona publiczna ma dziś następującą strukturę: **pasek statusu** (stan, dzień sprawy,
liczniki ustawowe), **kluczowe fakty**, **„Co nowego”** (najnowsza relacja + potwierdzone
zdarzenia i jawny komunikat „brak nowych potwierdzonych informacji od 21.10.2026”),
**roadmapę prawną**, **Co wiemy / czego nie wiemy**, **oś czasu**, **sprzeczności i znane
błędy**, **rynek** (kontekst), **archiwum z filtrem Media / X** oraz **metodologię**.
Dzień sprawy i liczniki ustawowe są wyliczane z daty, więc nie zesztywnieją po cichu
na starym stanie. Telemetria, kolejka i konfiguracja są w oddzielnym panelu `/ops`.

### Daty publikacji

Data w newsie to **data publikacji artykułu**, nie moment wykrycia przez monitor:

- RSS/Atom — z `pubDate` (Google News, Bing, agencje, krypto-portale).
- X przez r.jina.ai — z względnego znacznika czasu (`1h`, `3d`).
- Strony oficjalne (HTML) — z meta tagów `article:published_time`, JSON-LD `datePublished`,
  znacznika `<time datetime>` lub z widocznej daty w treści.

Znormalizowane do milisekund (`src/feed-parser.js` → `normalizeTimestamp`); wartości
spoza sensownego zakresu (przed 2000, w przyszłości) są odrzucane.

W powiadomieniu na Discordzie pole **📅 Data publikacji** pokazuje datę artykułu
w strefie Europe/Warsaw — znacznik czasu wiadomości na Discordzie pokazuje bowiem
czas wysłania, który bywa myląco dużo późniejszy.

Na stronie publicznej wpisy są sortowane po dacie publikacji; w nocie wpisu widnieje też data wykrycia.
### Limity powiadomień

- `BOOTSTRAP_NOTIFY_LIMIT` — ile powiadomień leci przy pierwszym uruchomieniu (reszta w panelu).
  Flaga trzymana jest **w bazie**, więc restart procesu jej nie resetuje. Jeśli wysyłkę
  przerwą błędy webhooka, bootstrap pozostaje aktywny i kolejka wróci przy następnym skanie.
- `MAX_NOTIFICATIONS_PER_DAY` — twardy limit dobowy.
- `MIN_NOTIFY_GAP_MS` — minimalny odstęp między wiadomościami (rate limit Discorda).
- `CASE_START` — data sprawy (domyślnie `2026-10-14`). Wpisy starsze nie trafiają do
  alertów; zostają w archiwum jako kontekst. Nowe skany pomijają je już na wejściu.
- `NOTIFY_MAX_AGE_HOURS` — po przerwie w skanowaniu kolejka starsza niż np. 24 h jest
  oznaczana jako `stale`; do Discorda trafiają tylko świeże informacje.
- `STORY_REALERT_HOURS` — po ilu godzinach kolejna wzmianka o tym samym zdarzeniu może
  znowu zaalarmować (domyślnie 24 h). W oknie obowiązuje jeden alert na zdarzenie.
- `ALERT_POLICY` — `important` (domyślnie: oficjalne komunikaty i ważne zdarzenia)
  albo `all` (każde trafienie matchera).
- Wpisy, których nie udało się wysłać, wracają do kolejki przy następnym skanie (max 5 prób).
- Wpisy celowo pominięte (duplikat zdarzenia, stary wpis z bootstrapu, niski sygnał) są
  oznaczane jako `suppressed` i nie wiszą w kolejce jako „oczekujące", ale zostają w
  publicznym archiwum. Ukrywane są tylko duplikaty treści i wpisy z innej sprawy.

### Bezpieczeństwo i panel `/ops`

- Strona publiczna nie ma formularzy akcji poza wyszukiwarką archiwum. Jedyny skrypt to
  lokalny `/live.js` (bez CDN), a CSP dopuszcza wyłącznie `script-src 'self'` i
  `connect-src 'self'`; reszta zasobów nadal jest zablokowana (`default-src 'none'`).
- `/ops`, `POST /scan`, `POST /test` oraz administracyjne API wymagają `ADMIN_TOKEN`.
  Panel loguje się przez `POST /ops/login` i dostaje **podpisane ciasteczko sesyjne**
  (HttpOnly, SameSite=Strict, 12 h); token nie trafia do URL ani do ciasteczka.
  API przyjmuje nagłówek `Authorization: Bearer …`. Logowanie ma limit nieudanych prób.
- Bez ustawionego `ADMIN_TOKEN` panel jest wyłączony — automatyczny skan działa dalej.
- Ręczny skan ma limit 60 s i działa w tle (`/scan` wraca od razu, `/api/scan` zwraca `202`);
  test Discorda ma limit 30 s. Linki zewnętrzne są przepuszczane tylko
  dla `http:` i `https:`; `javascript:` i `data:` są blokowane.
- Dane wrażliwe (score, dopasowane terminy, błędy HTTP, konfiguracja webhooka) nie trafiają
  na stronę publiczną.
- Osoby prywatne nie są identyfikowane: imię i nazwisko żony jest zamieniane na „A.K.”
  w tytułach, fragmentach, streszczeniach AI, API i powiadomieniach Discorda.
- Za reverse proxy aplikacja ufa `X-Real-IP` / `X-Forwarded-For` tylko wtedy, gdy
  połączenie przychodzi z loopbacku. Limity logowania i nieudanych tokenów Bearer
  liczone są per adres klienta. Produkcyjnie panel `/ops` powinien działać wyłącznie
  po HTTPS (nginx terminuje TLS).

## Uruchomienie

```bash
npm start                     # strona publiczna + /ops + pętla skanowania
npm test                      # testy (klasyfikacja, dedup, zdarzenia, limity, motywy)
npm run health                # dzienny audyt źródeł: milczące, psujące się, wycofane
node src/cli-scan.js          # jednorazowy skan z raportem (bez zapisu)
node src/cli-channel.js       # utwórz/odnajdź kanał Discord + webhook
node src/cli-backfill.js 60   # wygeneruj brakujące streszczenia AI dla archiwum
```

Konfiguracja w `.env` (patrz `.env.example`).

## Serwer

- Aplikacja: `/home/ubuntu/schueler-monitor`
- Serwis: `schueler-monitor.service` (systemd, restart=always)
- Nginx: `/etc/nginx/sites-available/schueler` → proxy na `127.0.0.1:3010`, publicznie na porcie **3000**
- Dane: SQLite `data/monitor.db` (WAL)
- Logi: `journalctl -u schueler-monitor -f`

```bash
sudo systemctl restart schueler-monitor
sudo systemctl status schueler-monitor
```

## Stack

Node.js ≥ 22, **zero zależności** (tylko `node:sqlite`, `node:http`, `fetch`).
AI: OpenRouter (`gpt-4o-mini`) z fallbackiem na `pollinations.ai`.
