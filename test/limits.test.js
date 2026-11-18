import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'schueler-limits-'));
process.env.DATA_DIR = tmp;
process.env.DB_FILE = path.join(tmp, 'test.db');
process.env.AI_CACHE_FILE = path.join(tmp, 'ai-cache.json');
process.env.OPENROUTER_API_KEY = '';       // bez AI w tescie
process.env.DISCORD_WEBHOOK_URL = '';       // bez Discorda w tescie

const { db, getKV, setKV, countSentToday, logNotification } = await import('../src/db.js');
const { parseFeed } = await import('../src/feed-parser.js');

test('liczba wysylek dzisiejszych liczy tylko status sent', () => {
  assert.equal(countSentToday(), 0);
  logNotification('x:1', 'discord', 'sent', null);
  logNotification('x:2', 'discord', 'error', 'boom');
  assert.equal(countSentToday(), 1, 'bledne wysylki nie licza sie do limitu');
});

test('kv przechowuje wartosc miedzy wywolaniami', () => {
  assert.equal(getKV('bootstrapped'), null);
  setKV('bootstrapped', '1');
  assert.equal(getKV('bootstrapped'), '1');
  setKV('bootstrapped', '2');
  assert.equal(getKV('bootstrapped'), '2', 'nadpisuje wartosc');
});

test('parser feedu przycina tytul i tekst z niezaufanego zrodla', () => {
  const longTitle = 'T'.repeat(1000);
  const longDesc = 'D'.repeat(20000);
  const xml = `<rss><channel><item>
    <title>${longTitle}</title>
    <link>https://example.com/a</link>
    <description>${longDesc}</description>
    <pubDate>Wed, 21 Oct 2026 10:00:00 GMT</pubDate>
  </item></channel></rss>`;
  const items = parseFeed(xml, { source: 'test', label: 'Test', maxItems: 5 });
  assert.equal(items.length, 1);
  assert.ok(items[0].title.length <= 300, 'tytul jest ograniczony');
  assert.ok(items[0].text.length <= 6000, 'tekst jest ograniczony');
  assert.equal(items[0].url, 'https://example.com/a');
});

test('parser feedu respektuje twardy limit liczby wpisow', () => {
  const block = (i) => `<item><title>Wpis ${i}</title><link>https://example.com/${i}</link></item>`;
  const xml = `<rss><channel>${Array.from({ length: 150 }, (_, i) => block(i)).join('')}</channel></rss>`;
  const items = parseFeed(xml, { source: 'test', label: 'Test', maxItems: 500 });
  assert.equal(items.length, 100, 'maksymalnie 100 wpisow na zrodlo');
});

test('parser feedu nie wywraca sie na zlych encjach numerycznych', () => {
  const xml = `<rss><channel><item>
    <title>Test &#x110000; &#xD800; &#9999999999; ok</title>
    <link>https://example.com/entity</link>
  </item></channel></rss>`;
  const items = parseFeed(xml, { source: 'test', label: 'Test' });
  assert.equal(items.length, 1);
  assert.match(items[0].title, /Test\s+ok/);
});

test('cleanup', () => {
  db.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});
