import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hexToLab, deltaE, estimateUndertone } from '../lib/color.js';
import { recommendFoundations, recommendLipsticks, FOUNDATIONS } from '../lib/catalog.js';

test('hexToLab: white and black', () => {
  assert.ok(Math.abs(hexToLab('#ffffff').L - 100) < 0.5);
  assert.ok(Math.abs(hexToLab('#000000').L) < 0.5);
});

test('deltaE is zero for identical colors', () => assert.equal(deltaE('#b9947c', '#b9947c'), 0));

test('undertone: yellowish skin is warm, pinkish skin is cool', () => {
  assert.equal(estimateUndertone('#d9b38c'), 'warm');
  assert.equal(estimateUndertone('#d9a5a0'), 'cool');
});

test('foundation recommendation returns the exact catalog shade first', () => {
  const f = FOUNDATIONS[7];
  const recs = recommendFoundations(f.hex, f.undertone);
  assert.equal(recs[0].id, f.id);
  assert.equal(recs.length, 3);
});

test('lipstick recommendation prefers matching undertone', () => {
  const recs = recommendLipsticks('#d9b38c', 'warm');
  assert.equal(recs[0].undertone, 'warm');
});
