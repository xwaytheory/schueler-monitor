import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from '../src/matcher.js';

const CASES = [
  // Trafienia - sprawa Schuelera
  ['Richard James Schueler, founder of HEX, arrested in Istanbul', true],
  ['Interpol red notice for US citizen Richard James Schueler', true],
  ['Richard Heart detained in Istanbul; HEX tanks 60%', true],
  ['HEX PulseChain founder Richard Heart faces crypto fraud charges', true],
  ["Adalet Bakanı Akın Gürlek: ABD vatandaşı Richard James Schueler İstanbul'da yakalandı", true],
  ['The SEC is charging Richard Heart (aka Richard Schueler)', true],
  ['Richard Heart arrested for crypto fraud', true],
  ['Finland requests arrest of Richard James Schueler', true],
  ['Balina James and Richard James Schueler detained', true],
  ['Pulsechain founder Schueler trial set for December', true],
  ['Richard Heart sentenced to prison in absentia', true],
  ['Turkish police seize $7.15M from Richard James Schueler', true],
  ['Interpol red notice issued for HEX founder', true],

  // Odpada - szum homonimow
  ['TÜRKİYE, SINIR AŞAN SUÇLARIN VE ARANAN ŞÜPHELİLERİN SIĞINAĞI OLMAYACAKTIR', false],
  ['Game 3 vs Adrian College at Schueler Field Sept 19', false],
  ['Jon Schueler - Six West Coast Works On Display', false],
  ['Beth Schueler research on democratic governance', false],
  ['Richard had a heart transplant at Royal Papworth Hospital', false],
  ['HEX color code for the design', false],
  ['Es ist ein HEX Wert von 0xFF', false],
  ['Man arrested in Istanbul for fraud', false],
  ['Interpol announces 1200 red notices worldwide this year', false],
  ['HEX and PulseChain tokens listed on new exchange', false],
  ['HEX price surges after listing', false],
  ['Richard Heart spoke about PulseChain', false],
  ['Richard Heart talks about HEX price', false],

  // Homonimy nazwiska: same nazwisko bez kontekstu sprawy
  ['Stephanie M. Schueler | Angelcrest Inc. | Valparaiso IN USA', false],
  ['Impactful Storytelling: The Blueprint for Social Change from Emmy Winner Chris Schueler', false],
  ['ELLA SCHUELER EARNS ALL-AMERICA HONORS AT NCAA DII INDOOR TRACK & FIELD CHAMPIONSHIPS', false],
  ['Schueler records three hits, two RBI to lead Somerville bats - Softball recap', false],
  ['Former Maersk boss Schueler buys into US biocrude bunker venture', false],
  ['Shipping investor Stephen Schueler leads team buying AS Monaco basketball club', false],
  ['Escaping war, embracing service: Great Neck Ruth Schueler reflects on the American Dream at 100', false],
  ['Collin Schueler - FloWrestling', false],
  ['Mark Schueler (@Mark_Schueler) - X', false],
  ['Both Jim Leyland and pitching coach Ron Schueler were tossed from the game', false],
  ['Schueler ist in Istanbul festgenommen worden', true],
  ['Schueler İstanbul’da yakalandı', true],
  ['Richard Schueler’s detention in Istanbul', true],
  ['Schueler’in iadesi talebi Ankara’ya ulaştı', true],
  ['Richard Heart davasında mahkeme tutuklama kararı verdi', true],
  ['Balina James hakkında yeni gözaltı kararı', true],
  ['Schueler hakkında iddianame kabul edildi', true],

  // Nekrologi - nazwisk Schueler jest bardzo popularne
  ['Vernon C. "Sonny" Schueler Obituary Sep 29, 2026 - Watkowski-Mulyck Funeral Home', false],
  ['Carole Schueler Obituary - Ashland, VA - Dignity Memorial', false],
  ['Randy Schueler Obituary (1961 - 2026) - Ottawa, IL - My Web Times - Legacy', false],
  ['Obituary for Sheila M. Schueler - Valley Funeral Home - Appleton', false],
  ['Richard Schueler died on March 3, 2026', false],

  // Analizy rynkowe, nie wiadomosci o sprawie
  ['Richard Heart caught with his pants down during arrest, report - Protos', true],
];

test('klasyfikacja wpisow o sprawie', () => {
  for (const [text, expected] of CASES) {
    const r = evaluate(text);
    assert.equal(r.relevant, expected, `"${text}" -> ${r.relevant} (${r.reason}), oczekiwano ${expected}`);
  }
});

test('nazwisko daje wiekszy score niz pseudonim', () => {
  const surname = evaluate('Richard James Schueler arrested');
  const pseudo = evaluate('Richard Heart arrested');
  assert.ok(surname.score > pseudo.score);
});

test('trafienie zwraca liste terminow', () => {
  const r = evaluate('Richard James Schueler zatrzymany w Stambule');
  assert.ok(r.terms.length > 0);
  assert.ok(r.terms.some((t) => t.includes('schueler')));
});

test('relacja z konta sprawy bez nazwiska: HEX + Istanbul + zatrzymanie', () => {
  const text = 'Day 14. Two weeks since the Istanbul raid. No court ruling published. '
    + 'No public confirmation of an extradition request yet. No statement from Richard. '
    + 'Detained, not convicted. HEX still runs. PulseChain still produces blocks.';
  assert.equal(evaluate(text).relevant, true);
});

test('samo HEX i Istanbul bez wydarzenia to nadal szum', () => {
  assert.equal(evaluate('HEX price surges in Istanbul after exchange listing').relevant, false);
});

test('pusty tekst nie jest trafieniem', () => {
  assert.equal(evaluate('').relevant, false);
  assert.equal(evaluate(null).relevant, false);
});

test('diakrytyki nie przeszkadzaja w dopasowaniu', () => {
  assert.equal(evaluate('kripto dolandırıcılığı Richard James Schueler').relevant, true);
  assert.equal(evaluate('Schueler ist in Istanbul festgenommen worden').relevant, true);
});
