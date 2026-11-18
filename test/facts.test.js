import test from 'node:test';
import assert from 'node:assert/strict';
import { checkClaims, CONFIRMED_FACTS, CLAIMED_FACTS, TIMELINE, CONTRADICTIONS, CASE_STATUS, redactPrivate } from '../src/facts.js';

test('oznacza blad: "aresztowany" zamiast "gözaltı"', () => {
  const r = checkClaims('Richard Heart arrested in Istanbul by Turkish police');
  assert.equal(r.level, 'error');
  assert.ok(r.flags.some((f) => f.id === 'arrested-vs-detained'));
});

test('oznacza blad: kwota 1 mld USD oszustwa', () => {
  const r = checkClaims('Minister: 1 billion USD crypto fraud in the US');
  assert.ok(r.flags.some((f) => f.id === 'billion-crypto-fraud'));
});

test('oznacza blad: 64 Rolex', () => {
  const r = checkClaims('Police seized 64 Rolex watches from the mansion');
  assert.ok(r.flags.some((f) => f.id === 'watches'));
});

test('oznacza blad: badacze MIT zamiast MİT', () => {
  const r = checkClaims('Officials collaborated with researchers at the Massachusetts Institute of Technology');
  assert.ok(r.flags.some((f) => f.id === 'mit-university'));
});

test('oznacza blad: skazany na 4 lata', () => {
  const r = checkClaims('Schueler was convicted and sentenced to 4 years in prison');
  assert.ok(r.flags.some((f) => f.id === 'convicted'));
});

test('oznacza blad: Yediemin Otoparkı', () => {
  const r = checkClaims('The cars were taken to the Yediemin Otoparkı depot');
  assert.ok(r.flags.some((f) => f.id === 'seventh-depot'));
});

test('oznacza blad: 1,5 mld USD funduszu', () => {
  const r = checkClaims('Forbes traced the remaining 1.5 billion USD fund');
  assert.ok(r.flags.some((f) => f.id === 'fund-1-5bn'));
});

test('poprawny material nie jest oznaczany jako blad', () => {
  const r = checkClaims('Richard James Schueler was detained (gözaltı) in Beşiktaş, Istanbul. The official Interpol record lists aggravated tax fraud. Police seized 28 watches and USD 7.15 million.');
  assert.equal(r.level, 'clean', `oczekiwano clean, a bylo ${r.level}: ${JSON.stringify(r.flags)}`);
});

test('twierdzenie o budynku bez atrybucji jest oznaczane', () => {
  const r = checkClaims('He was found at Çiftçi Towers in Beşiktaş');
  assert.equal(r.level, 'claimed');
  assert.ok(r.flags.some((f) => f.id === 'building'));
});

test('twierdzenie o budynku z atrybucja nie jest oznaczane', () => {
  const r = checkClaims('According to Yeni Şafak, he was found at Çiftçi Towers in Beşiktaş');
  assert.equal(r.level, 'clean');
});

test('imie zony bez atrybucji jest oznaczane', () => {
  const r = checkClaims('His wife Alina Kara was also detained');
  assert.ok(r.flags.some((f) => f.id === 'wife-name'));
});

test('pakiet faktow jest spojny', () => {
  assert.ok(CONFIRMED_FACTS.length >= 8, 'co najmniej 8 potwierdzonych faktow');
  assert.ok(CLAIMED_FACTS.length >= 3, 'co najmniej 3 twierdzenia z jednego zrodla');
  assert.ok(TIMELINE.length >= 8, 'os czasu obejmuje caly okres 14-21.10');
  assert.ok(CONTRADICTIONS.length >= 3, 'co najmniej 3 sekcje sprzecznosci');
  for (const f of CONFIRMED_FACTS) {
    assert.ok(f.pl && f.en && f.source, `fakt ${f.id} musi miec tresc PL, EN i zrodlo`);
    assert.equal(f.level, 'confirmed');
  }
  for (const t of TIMELINE) {
    assert.ok(['confirmed', 'claimed'].includes(t.level), `os czasu: zly poziom ${t.level}`);
    assert.ok(t.pl && t.en, `os czasu ${t.date}: brak tresci`);
  }
});

test('status sprawy ma poprawny zarzut', () => {
  assert.equal(CASE_STATUS.charge, 'ciężkie oszustwo podatkowe (aggravated tax fraud)');
  assert.equal(CASE_STATUS.redNotice, '2024/65212');
  assert.equal(CASE_STATUS.requestingCountry, 'Finlandia');
  assert.equal(CASE_STATUS.taxRank, 24);
});

test('negacja nie jest oznaczana jako blad', () => {
  const r = checkClaims('Schueler nie został aresztowany ani skazany. Nie ma wyroku w żadnej jurysdykcji.');
  assert.equal(r.level, 'clean', JSON.stringify(r.flags));
});

test('kwota 1 mld USD zebrana przez SEC nie jest bledem', () => {
  const r = checkClaims('The SEC complaint said the project raised more than 1 billion USD from investors.');
  assert.ok(!r.flags.some((f) => f.id === 'billion-crypto-fraud'));
});

test('maksimum kary to nie wyrok', () => {
  const r = checkClaims('Za ciężkie oszustwo podatkowe grozi od 4 miesięcy do 4 lat pozbawienia wolności.');
  assert.equal(r.level, 'clean', JSON.stringify(r.flags));
});

test('MİT i oficjalne 28 zegarków nie sa bledami', () => {
  const r = checkClaims('Turecki wywiad MİT brał udział w operacji. Na oficjalnej liście jest 28 zegarków.');
  assert.equal(r.level, 'clean', JSON.stringify(r.flags));
});

test('imie zony z atrybucja nie jest oznaczane', () => {
  const r = checkClaims('Według Yeni Şafak jego żona Alina Kara została zatrzymana.');
  assert.ok(!r.flags.some((f) => f.id === 'wife-name'));
});

test('dane osoby prywatnej sa redagowane', () => {
  assert.equal(redactPrivate('Zatrzymano Alina Kara i jej męża.'), 'Zatrzymano A.K. i jej męża.');
  assert.equal(redactPrivate('Alina Kara’nın eşi'), 'A.K.’nın eşi');
  assert.equal(redactPrivate('Richard James Schueler'), 'Richard James Schueler');
  assert.equal(redactPrivate(null), '');
});

test('finski areszt zaoczny to nie tureckie gözaltı', () => {
  const r = checkClaims('Fiński sąd 13.09.2024 zarządził tymczasowe aresztowanie zaoczne.');
  assert.equal(r.level, 'clean', JSON.stringify(r.flags));
  assert.ok(!r.flags.some((f) => f.id === 'arrested-vs-detained'));
});

test('aresztowanie w Turcji nadal jest bledem', () => {
  const r = checkClaims('Został aresztowany w Stambule po nalocie tureckiej policji.');
  assert.ok(r.flags.some((f) => f.id === 'arrested-vs-detained'));
});

test('wiele zdan: blad w jednym zdaniu nie ukrywa czystego drugiego', () => {
  const r = checkClaims('Policja zatrzymała go w Stambule. Został skazany na 4 lata.');
  assert.ok(r.flags.some((f) => f.id === 'convicted'));
});
