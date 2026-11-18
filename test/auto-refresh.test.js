import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { page } from '../src/web-ui.js';
import { renderHome } from '../src/web-public.js';
import { REVIEWED_AT } from '../src/facts.js';

const review = {
  media: 12,
  social: 30,
  total: 42,
  latestMedia: {
    title: 'Test relacji', url: 'https://example.com/a', published_at: Date.now() - 3_600_000,
  },
  generatedAt: Date.parse('2026-11-12T20:00:00Z'),
  lastRunAt: Date.parse('2026-11-12T19:59:00Z'),
  sourcesOk: 117,
  sourcesTotal: 117,
  archiveTotal: 500,
};

const home = renderHome({
  lang: 'pl',
  theme: 'editorial',
  latest: [],
  archive: { items: [], total: 0, pageNo: 1, pageCount: 1, q: '', src: '' },
  market: null,
  review,
  methodology: { sourceCount: 117, archiveTotal: 500, lastRunAt: review.lastRunAt, review },
});

test('przegląd monitora renderuje się z danych bieżących, nie ze stałej daty', () => {
  assert.match(home, /id="przeglad"/);
  assert.match(home, /id="statystyki"/);
  assert.match(home, /117\/117/);
  assert.match(home, /Test relacji/);
  // Sekcja „Przegląd” pokazuje datę wygenerowania z danych renderu,
  // a stopka metodologii — stałą datę ostatniej weryfikacji redakcyjnej.
  assert.match(home, /12\.11\.2026/);
  const reviewed = REVIEWED_AT.replace(/\./g, '\\.');
  assert.match(home, new RegExp(`Ostatnia weryfikacja redakcyjna:[^<]*<b>[^<]*${reviewed}`));
});

test('strona główna ładuje skrypt automatycznego odświeżania', () => {
  const html = page({ title: 't', description: 'd', body: '', live: true });
  assert.match(html, /src="\/live\.js"/);
  assert.match(html, /src="\/auto\.js"/);
  const js = fs.readFileSync(new URL('../src/auto.js', import.meta.url), 'utf8');
  for (const id of ['sprawa', 'przeglad', 'rynek', 'archiwum', 'statystyki']) {
    assert.ok(js.includes(id), `auto.js odświeża sekcję ${id}`);
  }
});
