import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'schueler-story-'));
process.env.DATA_DIR = tmp;
process.env.DB_FILE = path.join(tmp, 'test.db');
process.env.AI_CACHE_FILE = path.join(tmp, 'ai-cache.json');

const { db, getStory, markStoryNotified, isPublicSuppression } = await import('../src/db.js');

test('zdarzenie jest zapamietywane z poziomem szczegolowosci', () => {
  assert.equal(getStory('arrest'), null);
  markStoryNotified('arrest', 'item:1', 'Schueler zatrzymany', 1);
  const s = getStory('arrest');
  assert.ok(s, 'zdarzenie istnieje');
  assert.equal(s.detail_level, 1);
});

test('podniesienie poziomu szczegolowosci nie obniza go', () => {
  markStoryNotified('arrest', 'item:2', 'Ujawniono kwoty', 2);
  assert.equal(getStory('arrest').detail_level, 2);

  // Wpis o nizszym poziomie nie moze obnizyć poziomu zdarzenia.
  markStoryNotified('arrest', 'item:3', 'Krotka wzmianka', 1);
  assert.equal(getStory('arrest').detail_level, 2, 'poziom zdarzenia nie maleje');
});

test('rozne zdarzenia sa niezalezne', () => {
  markStoryNotified('court', 'item:4', 'Proces w Helsinkach', 1);
  assert.ok(getStory('court'), 'zdarzenie procesu istnieje');
  assert.equal(getStory('extradition'), null, 'brak nieznanego zdarzenia');
});

test('wyciszenia zdarzen i bootstrapu nie chowaja wpisow z archiwum', () => {
  assert.equal(isPublicSuppression('story:court'), true);
  assert.equal(isPublicSuppression('story:arrest'), true);
  assert.equal(isPublicSuppression('bootstrap-old'), true);
  assert.equal(isPublicSuppression('off-topic'), false);
  assert.equal(isPublicSuppression('duplicate-content'), false);
  assert.equal(isPublicSuppression(null), true, 'wpis niewyciszony jest publiczny');
});

test('cleanup', () => {
  db.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});
