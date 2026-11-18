import test from 'node:test';
import assert from 'node:assert/strict';
import { renderHome } from '../src/web-public.js';
import { TIMELINE } from '../src/facts.js';

function datesInTimeline(html) {
  const block = (html.match(/id="os-czasu"[\s\S]*?<\/section>/) || [''])[0];
  return [...block.matchAll(/<div class="tl-date"><b>([^<]+)<\/b>(?:<span>([^<]+)<\/span>)?/g)]
    .map((m) => `${m[1]} ${m[2] || ''}`.trim());
}

test('os czasu pokazuje najnowsze zdarzenia na gorze', () => {
  const html = renderHome({
    latest: [],
    market: null,
    archive: { items: [], total: 0, pageNo: 1, pageCount: 1, q: '' },
    methodology: { sourceCount: 64, archiveTotal: 0, lastRunAt: null },
  });
  const dates = datesInTimeline(html);
  assert.equal(dates.length, TIMELINE.length);
  // Wpis przeglądu ma datę bieżącą (auto), nie zaszyte 10.11.
  const today = new Intl.DateTimeFormat('pl-PL', {
    timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit',
  }).format(new Date());
  assert.equal(dates[0], today);
  assert.equal(dates.at(-1), '14.10');
});
