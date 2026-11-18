import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed, directFeedUrl } from '../src/feed-parser.js';

test('linki Bing News prowadzą do artykułu wydawcy, nie do przekierowania', () => {
  const wrapped = 'http://www.bing.com/news/apiclick.aspx?ref=FexRss&aid=&tid=abc&url='
    + encodeURIComponent('https://www.ntv.com.tr/turkiye/przyklad-1746294') + '&c=1&mkt=tr-tr';
  assert.equal(directFeedUrl(wrapped), 'https://www.ntv.com.tr/turkiye/przyklad-1746294');
  assert.equal(directFeedUrl('https://www.aa.com.tr/tr/gundem/x/1'), 'https://www.aa.com.tr/tr/gundem/x/1');

  const xml = `<rss><channel><item><title>Test</title><link>${wrapped.replace(/&/g, '&amp;')}</link>`
    + '<pubDate>Wed, 14 Oct 2026 07:37:00 GMT</pubDate></item></channel></rss>';
  const [item] = parseFeed(xml, { source: 'gn-test' });
  assert.equal(item.url, 'https://www.ntv.com.tr/turkiye/przyklad-1746294');
});
