import test from 'node:test';
import assert from 'node:assert/strict';
import { storyKey, storyDetailLevel, primarySignals, detailSignals, isHighSignal } from '../src/story.js';

test('wiele artykulow o jednym aresztowaniu to jedno zdarzenie', () => {
  const titles = [
    'Richard Heart’s arrest is confirmed. Turkish authorities reported $7.15m in cash, seven guns and six cold wallets',
    '🚨 PulseX founder Richard Heart arrested in Istanbul Turkish authorities detained Heart on Oct 14, seizing $7.15M cash',
    'Turkey confirms Hex founder Richard Heart arrest, police seized $7.15 million and six cold wallets',
    'Hex and PulseChain Founder Richard Heart Detained in Istanbul as Turkey Confirms Arrest and Major Seizures',
  ];
  const keys = new Set(titles.map((t) => storyKey(t)));
  assert.equal(keys.size, 1, `wszystkie artykuly o jednym aresztowaniu daja jeden klucz, a bylo: ${[...keys]}`);
});

test('szczegolowy artykul ma wyzszy poziom niz ogolny', () => {
  const general = storyDetailLevel('Richard James Schueler arrested in Istanbul');
  const detailed = storyDetailLevel('Richard Heart Arrest Update: Police Seize $7.15M Cash and 64 Luxury Watches');
  assert.equal(general, 1);
  assert.equal(detailed, 2);
  assert.ok(detailed > general, 'ujawnienie kwot musi byc wyzszym poziomem');
});

test('proces po aresztowaniu to inne zdarzenie', () => {
  const arrest = storyKey('Richard James Schueler arrested in Istanbul');
  const court = storyKey('Helsinki court starts trial of Richard Heart');
  assert.notEqual(arrest, court, 'rozwój procesu musi dac nowe powiadomienie');
});

test('rozprawa po zatrzymaniu to proces, a nie kolejne aresztowanie', () => {
  const text = 'The Helsinki court opened the hearing in the case of Richard Heart. '
    + 'He was detained in Istanbul on 14 October.';
  assert.equal(storyKey(text, 'Court hearing after Richard Heart detained in Istanbul'), 'court');
});

test('ekstradycja w tytule wygrywa ze wzmianka o zatrzymaniu', () => {
  assert.equal(
    storyKey('He was detained in Istanbul earlier.', 'Extradition of detained Richard Heart approved'),
    'extradition',
  );
});

test('zaprzeczenie nie tworzy zdarzenia sadowego', () => {
  assert.equal(
    storyKey('No court decision yet in the case of detained Richard Heart'),
    'arrest',
    '"brak decyzji sadu" to nie rozprawa',
  );
});

test('wzmianka o prokuratorze nie zmienia zatrzymania w proces', () => {
  const text = 'Istanbul prosecutors said Richard Heart was detained on 14 October.';
  assert.equal(storyKey(text, 'Richard Heart detained in Istanbul'), 'arrest');
});

test('podsumowanie "no confirmed extradition" nie tworzy zdarzenia ekstradycyjnego', () => {
  const title = 'Richard Heart, 12 days in. What we actually know: Detained in Istanbul on Oct 14. '
    + 'No court decision made public. No confirmed extradition request from Finland. No conviction.';
  assert.equal(storyKey(title), 'arrest');
});

test('"no public confirmation of an extradition request" nie tworzy ekstradycji', () => {
  const title = 'Day 14. Two weeks since the Istanbul raid. No court ruling published. '
    + 'No public confirmation of an extradition request yet. No statement from Richard. '
    + 'Detained, not convicted. HEX still runs.';
  assert.equal(storyKey(title), 'arrest');
});

test('ekstradycja to osobne zdarzenie', () => {
  const arrest = storyKey('Richard James Schueler arrested in Istanbul');
  const ex = storyKey('Turkey agrees extradition of Richard Heart to Finland');
  assert.notEqual(arrest, ex);
});

test('zatrzymanie jest waznym sygnalem', () => {
  assert.ok(isHighSignal('Richard James Schueler arrested in Istanbul'));
  assert.ok(!isHighSignal('Richard Heart price analysis for QDay'), 'kurs to nie wazny sygnal');
});

test('finskie zatrzymanie jest waznym sygnalem', () => {
  const t = 'Suomen etsintäkuuluttama kryptomiljonääri otettu kiinni Turkissa';
  assert.equal(storyKey(t), 'arrest');
  assert.ok(isHighSignal(t));
});

test('artykul bez zdarzenia nie generuje klucza', () => {
  assert.equal(storyKey('Who is Richard Heart, the HEX founder wanted by Interpol?'), null);
});

test('sygnaly sa wykrywane po polsku, turecku i angielsku', () => {
  assert.ok(primarySignals('Interpol tarafından kırmızı bültenle aranan Schueler yakalandı').includes('arrest'));
  assert.ok(primarySignals('Interpol tarafından kırmızı bültenle aranan Schueler yakalandı').includes('rednotice'));
  assert.ok(detailSignals('9 luksus araca el konuldu').includes('vehicles'));
  assert.ok(detailSignals('Police seized 4 rifles and 1400 rounds of ammunition').includes('weapons'));
  assert.ok(detailSignals('6 cold wallets seized').includes('wallets'));
  assert.ok(detailSignals('zabezpieczono 7 milyon 150 tysięcy dolarów').includes('cash'));
  assert.ok(detailSignals('24 zegarki Rolexa zabezpieczono').includes('watches'));
});

test('9 aut i broni to rozne zdarzenia niz samo zatrzymanie', () => {
  const vehicles = storyKey('9 luksus araç el konuldu operasyonda');
  const arrest = storyKey('Schueler yakalandı ve gözaltına alındı');
  assert.notEqual(vehicles, arrest);
});
