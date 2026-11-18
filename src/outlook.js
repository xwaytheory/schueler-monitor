/**
 * Warstwa prognozy dla motywu „dossier" — scenariusze rozwoju sprawy.
 * To HIPOTEZY redakcyjne oparte na prawie i praktyce, nie fakty ani komunikaty
 * stron. Prawdopodobieństwa są szacunkiem i sumują się do 100%.
 *
 * Stan okna ustawowego wyliczamy z dat (facts.js), więc nie zesztywnieje.
 */
import { LEGAL_DEADLINES, daysUntil } from './facts.js';

/** Stan dwóch okien ustawowych: 'expired' (termin minął) albo 'open'. */
export function windowStates(date = new Date()) {
  return LEGAL_DEADLINES.map((d) => {
    const left = daysUntil(d.date, date);
    return { ...d, left, state: left < 0 ? 'expired' : 'open' };
  });
}

/**
 * Scenariusze. `prob` = szacowane prawdopodobieństwo (%), `color` = kolor
 * wykresu (stonowany, separowalny luminancją i etykietą). Kolejność malejąca.
 * Każdy ma podstawę prawną i sygnały wyprzedzające — żeby czytelnik wiedział,
 * co obserwować, zamiast zgadywać.
 */
export const SCENARIOS = [
  {
    id: 'request',
    prob: 45,
    color: '#8a2731',
    pl: {
      title: 'Wniosek Finlandii wpłynął, zatrzymanie trwa',
      desc: 'Finlandia przesłała formalny wniosek i dokumenty (wyrok/nakaz, opis czynów, przedawnienie) kanałem dyplomatycznym. Tymczasowe zatrzymanie ekstradycyjne (geçici tutuklama) trwa, a sąd w Stambule bada dopuszczalność wniosku. To scenariusz najbardziej zgodny z tym, że żadna ze stron nie ogłosiła zwolnienia.',
      basis: 'ECE art. 16 ust. 4 · ustawa 6706 art. 14–16 · laki 456/1970 §§ 13, 26',
      signals: 'Potwierdzenie Yle / HS / STT lub KRP; komunikat MoJ Turcji o wniosku; wzmianka o rozprawie przed İstanbul Ağır Ceza Mahkemesi.',
      meaning: 'Sprawa wchodzi w fazę sądową. Zatrzymanie kontrolowane co 30 dni, nie dłuższe niż grożąca kara. Decyzja o ekstradycji jeszcze nie zapadła.',
    },
    en: {
      title: 'Finland’s request filed, custody continues',
      desc: 'Finland sent the formal request and documents (judgment/warrant, description of acts, limitation) through diplomatic channels. Provisional extradition custody (geçici tutuklama) continues and an Istanbul court examines admissibility. This fits the fact that neither side has announced a release.',
      basis: 'ECE art. 16(4) · Law 6706 art. 14–16 · Act 456/1970 §§ 13, 26',
      acts: ['ece', 'law6706', 'act456'],
      signals: 'Confirmation by Yle / HS / STT or the NBI; a Turkish MoJ statement on the request; mention of a hearing before the İstanbul Ağır Ceza Mahkemesi.',
      meaning: 'The case enters the judicial phase. Custody reviewed every 30 days, no longer than the penalty faced. No extradition decision yet.',
    },
  },
  {
    id: 'release',
    prob: 25,
    color: '#8a600d',
    pl: {
      title: 'Zwolnienie / uchylenie zatrzymania',
      desc: 'Jeśli dokumenty nie dotarły w 18 dni (okno minęło 1.11.2026), Turcja może uchylić tymczasowe zatrzymanie — chyba że przedłużyła je do 40 dni na wyraźny wniosek Finlandii. Sąd mógł też zwolnić z braku podstaw. Schueler pozostaje poszukiwany czerwoną notą, ale jest na wolności — do ponownego zatrzymania, gdy wniosek dotrze.',
      basis: 'Ustawa 6706 art. 14(6) · ECE art. 16 ust. 4',
      signals: 'Tureckie media: „tahliye" (zwolnienie); oświadczenie zespołu prawnego; brak wzmianek o zatrzymaniu przy jednoczesnej ciszy o wniosku.',
      meaning: 'Nie koniec sprawy. Finlandia może wnioskować ponownie, prowadzić sprawę zaocznie albo korzystać z pomocy prawnej w Turcji.',
    },
    en: {
      title: 'Release / custody lifted',
      desc: 'If the documents did not arrive within 18 days (the window closed on 1 Nov 2026), Turkey may lift provisional custody — unless it extended it to the 40-day maximum on an explicit request from Finland. A court may also have released for lack of grounds. Schueler remains wanted under the red notice but is at liberty — until re-arrest when a request arrives.',
      basis: 'Law 6706 art. 14(6) · ECE art. 16(4)',
      acts: ['law6706', 'ece'],
      signals: 'Turkish media: “tahliye” (release); a statement from the legal team; no custody mentions alongside silence on a request.',
      meaning: 'Not the end of the case. Finland may request again, proceed in absentia, or use mutual legal assistance in Turkey.',
    },
  },
  {
    id: 'control',
    prob: 15,
    color: '#1f7a4d',
    pl: {
      title: 'Nadzór sądowy i zakaz opuszczania kraju',
      desc: 'Zamiast aresztu sąd stosuje adli kontrol (nadzór sądowy): zakaz opuszczania kraju, obowiązek stawiennictwa, poręczenie. Środek łagodniejszy, ale zapewniający obecność na czas postępowania ekstradycyjnego.',
      basis: 'CMK art. 109 · ustawa 6706 art. 14(5)',
      signals: 'Tureckie komunikaty o „adli kontrol" / „yurtdışı çıkış yasağı"; confiscata paszportu; brak wzmianek o areszcie.',
      meaning: 'Schueler nie jest w areszcie, ale nie może wyjechać. Postępowanie ekstradycyjne toczy się dalej.',
    },
    en: {
      title: 'Judicial control and travel ban',
      desc: 'Instead of remand, the court imposes adli kontrol (judicial control): a travel ban, duty to report, bail. A lighter measure that still secures presence during extradition proceedings.',
      basis: 'CMK art. 109 · Law 6706 art. 14(5)',
      acts: ['cmk', 'law6706'],
      signals: 'Turkish statements on “adli kontrol” / “yurtdışı çıkış yasağı”; passport confiscation; no remand mentions.',
      meaning: 'Schueler is not in remand but cannot leave. Extradition proceedings continue.',
    },
  },
  {
    id: 'surrender',
    prob: 10,
    color: '#3c5a78',
    pl: {
      title: 'Ekstradycja zatwierdzona, przekazanie do Finlandii',
      desc: 'Sąd uznaje wniosek dopuszczalny, kasacja do Yargıtay uprawomocnia decyzję, a prezydent na wniosek ministra wydaje zgodę na przekazanie. To ścieżka wielomiesięczna, nie tygodniowa — wymaga prawomocności i decyzji wykonawczej.',
      basis: 'Ustawa 6706 art. 15–19 · ECE art. 18',
      signals: 'Orzeczenie sądu o dopuszczalności; kasacja Yargıtay; komunikat o decyzji prezydenta; data i miejsce przekazania.',
      meaning: 'Po przylocie sąd fiński stosuje areszt, a sprawa karna (ciężkie oszustwo podatkowe) wraca na wokandę. Zasada specjalności chroni przed ściganiem za inne czyny.',
    },
    en: {
      title: 'Extradition approved, surrender to Finland',
      desc: 'The court finds the request admissible, cassation to the Court of Cassation finalises it, and the president, on the minister’s motion, consents to surrender. This is a months-long path, not weeks — it requires finality and an executive decision.',
      basis: 'Law 6706 art. 15–19 · ECE art. 18',
      acts: ['law6706', 'ece'],
      signals: 'A court ruling on admissibility; cassation; a statement on the presidential decision; a surrender date and place.',
      meaning: 'On arrival a Finnish court imposes remand and the criminal case (aggravated tax fraud) returns to the docket. The specialty rule bars prosecution for other acts.',
    },
  },
  {
    id: 'refusal',
    prob: 5,
    color: '#6b6252',
    pl: {
      title: 'Odmowa ekstradycji',
      desc: 'Sąd odmawia: np. tureckie obywatelstwo (niepotwierdzone), polityczny/dyskryminacyjny charakter wniosku, brak podwójnej karalności, ne bis in idem lub przedawnienie. Odmowa musi być uzasadniona.',
      basis: 'Anayasa art. 38 · ustawa 6706 art. 11 · ECE art. 2, 3, 9, 10',
      signals: 'Orzeczenie odmowne z uzasadnieniem; potwierdzenie tureckiego obywatelstwa; zarzut obrony o brak odpowiednika w VUK art. 359.',
      meaning: 'Odmowa nie kończy sprawy fińskiej — Finlandia może wracać do wniosku i postępowania karnego w przyszłości.',
    },
    en: {
      title: 'Extradition refused',
      desc: 'The court refuses: e.g. Turkish citizenship (unconfirmed), a political/discriminatory request, lack of double criminality, ne bis in idem, or limitation. A refusal must be reasoned.',
      basis: 'Constitution art. 38 · Law 6706 art. 11 · ECE art. 2, 3, 9, 10',
      acts: ['constitution', 'law6706', 'ece', 'vuk'],
      signals: 'A reasoned refusal ruling; confirmation of Turkish citizenship; a defence argument on no equivalent under VUK art. 359.',
      meaning: 'Refusal does not end the Finnish case — Finland may revisit the request and criminal proceedings in future.',
    },
  },
];