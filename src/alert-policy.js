import { isHighSignal } from './story.js';

/**
 * Źródła, których komunikaty traktujemy jako oficjalne.
 * Ich materiał może trafić do alertu nawet bez słowa-klucza zdarzenia,
 * bo sam kanał jest wystarczającym potwierdzeniem wagi.
 */
export const OFFICIAL_SOURCES = new Set([
  'moj-tr',            // Ministerstwo Sprawiedliwości TR
  'polis-tr',          // Policja Stambuł
  'aa-tr-arrest',      // AA - oficjalny komunikat o zatrzymaniu
  'courtlistener',     // akta sądowe SEC v. Schueler
  'sec-press',         // komunikaty SEC
  'justice-news',      // komunikaty US DOJ
  'x-prof-interpol',   // @INTERPOL_HQ
  'x-prof-sec',        // @SECGov
  'x-prof-gurlek',     // minister sprawiedliwości TR
  'gn-tr-official',    // Google News: komunikaty MS/CTE/MSW/EGM/adliye (TR)
]);

/**
 * Czy wpis zasługuje na powiadomienie.
 *
 * Tryb "important" (domyślny): oficjalne źródła + zdarzenia o wysokim
 * priorytecie (zatrzymanie/areszt, zarzuty, sąd, ekstradycja, komunikat
 * ministra, ochrona). Komentarze, kursy i zwykłe wzmianki zostają w
 * archiwum, ale nie zaśmiecają Discorda.
 *
 * Tryb "all": każde trafienie matchera (zachowanie z poprzedniej wersji).
 */
export function isImportantAlert(item = {}, mode = 'important') {
  if (mode === 'all') return true;
  const source = String(item.source || '');
  if (OFFICIAL_SOURCES.has(source)) return true;
  return isHighSignal(`${item.title || ''}\n${item.text || ''}`);
}
