import { test } from 'node:test';
import assert from 'node:assert';
import { clampHudPosition, getCornerDockPosition } from './hudPosition.ts';

test('clampHudPosition keeps position strictly inside viewport boundaries', () => {
  const screenW = 1280;
  const screenH = 800;
  const hudW = 280;
  const hudH = 260;

  // Normal position inside bounds
  const pos1 = clampHudPosition(500, 300, hudW, hudH, screenW, screenH);
  assert.strictEqual(pos1.x, 500);
  assert.strictEqual(pos1.y, 300);

  // Position too far left / top
  const pos2 = clampHudPosition(-50, 10, hudW, hudH, screenW, screenH);
  assert.strictEqual(pos2.x, 12); // config.marginX
  assert.strictEqual(pos2.y, 64); // config.marginTop

  // Position too far right / bottom
  const pos3 = clampHudPosition(2000, 1500, hudW, hudH, screenW, screenH);
  assert.strictEqual(pos3.x, 1280 - 280 - 12); // 988
  assert.strictEqual(pos3.y, 800 - 260 - 88); // 452
});

test('getCornerDockPosition calculates accurate dock corners', () => {
  const screenW = 1200;
  const screenH = 800;
  const hudW = 260;
  const hudH = 240;

  const tl = getCornerDockPosition('top-left', hudW, hudH, screenW, screenH);
  assert.strictEqual(tl.x, 12);
  assert.strictEqual(tl.y, 64);

  const tr = getCornerDockPosition('top-right', hudW, hudH, screenW, screenH);
  assert.strictEqual(tr.x, 1200 - 260 - 12);
  assert.strictEqual(tr.y, 64);

  const bl = getCornerDockPosition('bottom-left', hudW, hudH, screenW, screenH);
  assert.strictEqual(bl.x, 12);
  assert.strictEqual(bl.y, 800 - 240 - 88);

  const br = getCornerDockPosition('bottom-right', hudW, hudH, screenW, screenH);
  assert.strictEqual(br.x, 1200 - 260 - 12);
  assert.strictEqual(br.y, 800 - 240 - 88);
});
