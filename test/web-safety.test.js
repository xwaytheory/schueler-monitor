import test from 'node:test';
import assert from 'node:assert/strict';
import { esc, safeUrl, hostOf, money, cleanTitle, plural, relTime } from '../src/web-ui.js';
import { canonicalUrl, titleKey, dedupKey, contentKey } from '../src/dedup.js';

test('safeUrl blokuje javascript: i data:', () => {
  assert.equal(safeUrl('javascript:alert(1)'), '#');
  assert.equal(safeUrl('JavaScript:alert(1)'), '#');
  assert.equal(safeUrl('data:text/html,<script>alert(1)</script>'), '#');
  assert.equal(safeUrl('vbscript:msgbox(1)'), '#');
  assert.equal(safeUrl(''), '#');
  assert.equal(safeUrl(null), '#');
});

test('safeUrl przepuszcza http i https', () => {
  assert.equal(safeUrl('https://example.com/a?b=1'), 'https://example.com/a?b=1');
  assert.equal(safeUrl('http://example.com/'), 'http://example.com/');
});

test('esc escapuje wszystkie znaki HTML', () => {
  assert.equal(esc('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
  assert.equal(esc(null), '');
  assert.equal(hostOf('https://www.example.com/a'), 'example.com');
  assert.equal(hostOf('javascript:alert(1)'), '');
});

test('money formatuje ceny bez wywolywania wyjatku', () => {
  assert.equal(money(null), '—');
  assert.equal(money('abc'), '—');
  assert.match(money(0.00061234), /^\$0,000612$/);
  assert.match(money(12.345), /^\$12,35$/);
});

test('polska liczba mnoga i czas względny', () => {
  assert.equal(plural(1, 'relacja', 'relacje', 'relacji'), 'relacja');
  assert.equal(plural(2, 'relacja', 'relacje', 'relacji'), 'relacje');
  assert.equal(plural(5, 'relacja', 'relacje', 'relacji'), 'relacji');
  assert.equal(plural(12, 'relacja', 'relacje', 'relacji'), 'relacji');
  assert.equal(plural(22, 'relacja', 'relacje', 'relacji'), 'relacje');
  assert.equal(relTime(Date.now() - 86400_000), '1 dzień temu');
  assert.equal(relTime(Date.now() - 2 * 86400_000), '2 dni temu');
});

test('cleanTitle nie ujawnia danych osoby prywatnej', () => {
  assert.equal(cleanTitle('Alina Kara detained with Richard Heart'), 'A.K. detained with Richard Heart');
});

test('canonicalUrl normalizuje host, ale nie sciezke', () => {
  assert.equal(
    canonicalUrl('https://WWW.Example.com/Path/Article?utm_source=x&id=5'),
    'https://example.com/Path/Article?id=5',
  );
  assert.equal(canonicalUrl('not a url'), 'not a url');
});

test('cleanTitle usuwa osierocone nawiasy z X, ale nie koncowke zdania', () => {
  assert.equal(cleanTitle('Official confirmation: detained. ['), 'Official confirmation: detained.');
  assert.equal(cleanTitle('Schueler (detained)'), 'Schueler (detained)');
  assert.equal(cleanTitle('   '), '(bez tytułu)');
});

test('titleKey zachowuje litery unicode i sklada diakrytyki', () => {
  const key = titleKey('Łukasz Żółć — Richard Heart!');
  assert.match(key, /łukasz/i);
  assert.match(key, /zo/);
  assert.ok(!key.includes('—'));
});

test('dedupKey preferuje URL, nie tytul', () => {
  assert.equal(
    dedupKey({ url: 'https://www.example.com/a?utm_source=x', title: 'Ten sam tytul' }),
    'url:https://example.com/a',
  );
  assert.notEqual(
    dedupKey({ url: 'https://a.example.com/x', title: 'Identyczny tytul' }),
    dedupKey({ url: 'https://b.example.com/x', title: 'Identyczny tytul' }),
    'ten sam tytul pod roznymi URL-ami to nie duplikat',
  );
  assert.match(dedupKey({ url: '', title: 'Bez adresu' }), /^title:/);
});

test('contentKey scala identyczna tresc mimo roznych URL-i', () => {
  const a = contentKey({
    url: 'https://a.example.com/post',
    title: 'Richard Heart detained in Istanbul',
    text: 'Turkish police detained Richard Heart on 14 October.',
  });
  const b = contentKey({
    url: 'https://b.example.com/post',
    title: 'Richard Heart detained in Istanbul',
    text: 'Turkish police detained Richard Heart on 14 October.',
  });
  assert.equal(a, b);
  assert.notEqual(a, contentKey({
    title: 'Richard Heart detained in Istanbul',
    text: 'Turkish police detained a different person.',
  }), 'ten sam tytul i inna tresc to nie duplikat');
});

test('dedupKey Google News normalizuje wielkosc liter', () => {
  const upper = dedupKey({ url: 'https://news.google.com/rss/articles/CBMiABC_def-123?oc=5' });
  const lower = dedupKey({ url: 'https://news.google.com/rss/articles/cbmIabc_DEF-123?oc=5' });
  assert.equal(upper, 'gnews:cbmiabc_def-123');
  assert.equal(upper, lower);
});
