import { test } from 'node:test';
import assert from 'node:assert';
import { ExportOptions } from './drawingEngine';

test('ExportOptions configurations for with and without background', () => {
  // 1. Without background (transparent PNG)
  const withoutBgOpts: ExportOptions = {
    transparentBackground: true,
    backgroundWhite: false,
    includeGrid: false,
  };
  assert.strictEqual(withoutBgOpts.transparentBackground, true);
  assert.strictEqual(withoutBgOpts.backgroundWhite, false);

  // 2. With background (clean solid white)
  const withWhiteBgOpts: ExportOptions = {
    transparentBackground: false,
    backgroundWhite: true,
    includeGrid: false,
  };
  assert.strictEqual(withWhiteBgOpts.transparentBackground, false);
  assert.strictEqual(withWhiteBgOpts.backgroundWhite, true);
  assert.strictEqual(withWhiteBgOpts.includeGrid, false);

  // 3. With background (board grid style)
  const withGridBgOpts: ExportOptions = {
    transparentBackground: false,
    backgroundWhite: true,
    includeGrid: true,
  };
  assert.strictEqual(withGridBgOpts.transparentBackground, false);
  assert.strictEqual(withGridBgOpts.includeGrid, true);
});
