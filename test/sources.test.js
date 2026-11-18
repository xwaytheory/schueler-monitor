import test from 'node:test';
import assert from 'node:assert/strict';
import { PAGE_SOURCES, RSS_SOURCES, RELEASE_QUERIES, FAST_SOURCE_IDS, allSources } from '../src/sources.js';

/**
 * Strona tagu/archiwum/kategorii zmienia sie przy kazdym nowym artykule -
 * jako versioned: true generowalaby alert przy kazdej takiej zmianie.
 */
const LISTING_PATH = /\/(etiket|tag|kategori|category|arsiv|archive|arama|search|yazar|author)(\/|$)/i;

test('zrodla typu page wskazuja artykuly, nie strony indeksu', () => {
  for (const s of PAGE_SOURCES) {
    const { pathname } = new URL(s.url);
    assert.ok(!LISTING_PATH.test(pathname), s.id + ' wskazuje strone listy: ' + s.url);
  }
});

test('zapytania newsowe: Bing podstawowo, Google jako zapas', () => {
  const sources = allSources();
  const queries = sources.filter((s) => s.kind === 'gnews' || s.kind === 'xsite');
  assert.ok(queries.length > 20, 'zapytania newsowe są podpięte');
  for (const s of queries) {
    assert.match(s.url, /^https:\/\/www\.bing\.com\/news\/search\?q=/, s.id + ': dostawcą podstawowym jest Bing');
    assert.equal(s.fallbacks?.length, 1, s.id + ': jest jeden zapas');
    assert.match(s.fallbacks[0], /^https:\/\/news\.google\.com\/rss\/search\?q=/, s.id + ': zapas to Google News');
  }
});

test('zapytania o wypuszczenie są w szybkiej ścieżce', () => {
  const ids = new Set(allSources().map((s) => s.id));
  for (const q of RELEASE_QUERIES) {
    assert.ok(ids.has(q.id), 'zapytanie podpięte: ' + q.id);
    assert.ok(FAST_SOURCE_IDS.includes(q.id), 'zapytanie w szybkiej ścieżce: ' + q.id);
  }
  assert.ok(FAST_SOURCE_IDS.includes('interpol-red'), 'rejestr Interpolu w szybkiej ścieżce');
  for (const id of FAST_SOURCE_IDS) assert.ok(ids.has(id), 'szybka ścieżka wskazuje istniejące źródło: ' + id);
  const tr = RELEASE_QUERIES.find((q) => q.id === 'gn-release-tr');
  assert.match(tr.q, /tahliye/);
  assert.match(tr.q, /iade/);
});

test('nowe zrodla: Turkish Minute i Interpol sa podpiete', () => {
  const ids = new Set(allSources().map((s) => s.id));
  assert.ok(ids.has('turkishminute-tr-rss'));
  assert.ok(ids.has('interpol-red'));
  const tm = RSS_SOURCES.find((s) => s.id === 'turkishminute-tr-rss');
  assert.equal(tm.url, 'https://www.turkishminute.com/feed/');
  const interpol = allSources().find((s) => s.id === 'interpol-red');
  assert.equal(interpol.kind, 'interpol');
  assert.equal(interpol.versioned, true);
  assert.match(interpol.url, /^https:\/\/r\.jina\.ai\//);
});
