import test from 'node:test';
import assert from 'node:assert/strict';
import { StrokeHistory } from './strokeHistory';

test('StrokeHistory manages active stroke lifecycle and undo/redo', () => {
  const history = new StrokeHistory();

  assert.equal(history.canUndo(), false);
  assert.equal(history.canRedo(), false);

  // Start stroke
  const stroke1 = history.startStroke('pen', '#4f46e5', 6, { x: 0.1, y: 0.1 });
  assert.equal(stroke1.tool, 'pen');
  assert.equal(stroke1.points.length, 1);

  // Append points
  history.appendPoint({ x: 0.15, y: 0.15 });
  history.appendPoint({ x: 0.2, y: 0.2 });
  assert.equal(history.getActiveStroke()?.points.length, 3);

  // End stroke
  const finished = history.endStroke();
  assert.ok(finished);
  assert.equal(history.getActiveStroke(), null);
  assert.equal(history.strokeCount(), 1);
  assert.equal(history.canUndo(), true);

  // Second stroke (eraser)
  history.startStroke('eraser', '#000000', 30, { x: 0.5, y: 0.5 });
  history.appendPoint({ x: 0.55, y: 0.55 });
  history.endStroke();
  assert.equal(history.strokeCount(), 2);

  // Undo
  const undone = history.undo();
  assert.equal(undone?.tool, 'eraser');
  assert.equal(history.strokeCount(), 1);
  assert.equal(history.canRedo(), true);

  // Redo
  const redone = history.redo();
  assert.equal(redone?.tool, 'eraser');
  assert.equal(history.strokeCount(), 2);
  assert.equal(history.canRedo(), false);

  // Clear
  history.clear();
  assert.equal(history.strokeCount(), 0);
  assert.equal(history.canUndo(), false);
});
