import test from 'node:test';
import assert from 'node:assert/strict';
import { isImportantAlert } from '../src/alert-policy.js';
import { isHighSignal } from '../src/story.js';

test('oficjalne źródło przechodzi nawet bez słowa zdarzenia', () => {
  assert.equal(isImportantAlert({
    source: 'moj-tr',
    title: 'Richard Heart — komunikat',
    text: 'Ministerstwo Sprawiedliwości opublikowało komunikat.',
  }), true);
});

test('fallback site:x.com nie jest źródłem oficjalnym', () => {
  assert.equal(isImportantAlert({
    source: 'xprof-abakingurlek',
    title: 'Dear Turkish Minister of Justice, Richard Heart is innocent',
    text: 'Richard Heart is innocent.',
  }), false);
});

test('komentarz z mediów nie jest alertem', () => {
  assert.equal(isImportantAlert({
    source: 'x-heart',
    title: 'Richard Heart discusses HEX community',
    text: 'Richard Heart spoke about HEX at a community event.',
  }), false);
});

test('sąd, zarzuty i ekstradycja są alertem', () => {
  assert.ok(isHighSignal('Helsinki court sets a hearing in the Richard Heart case'));
  assert.ok(isHighSignal('Prosecutors filed charges against Richard Heart'));
  assert.ok(isHighSignal('Turkey agrees extradition of Richard Heart to Finland'));
});

test('kurs i analiza nie są alertem', () => {
  assert.equal(isImportantAlert({
    source: 'coindesk',
    title: 'HEX price analysis: where Richard Heart’s token goes next',
    text: 'HEX price analysis and market outlook.',
  }), false);
});

test('tryb all przepuszcza każde trafienie', () => {
  assert.equal(isImportantAlert({
    source: 'x-heart',
    title: 'Richard Heart discusses HEX community',
    text: 'Richard Heart spoke about HEX.',
  }, 'all'), true);
});
