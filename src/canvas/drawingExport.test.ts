import test from 'node:test';
import assert from 'node:assert/strict';
import { StrokeHistory } from './strokeHistory';

test('StrokeHistory differentiates pen strokes from eraser strokes for isolated compositing', () => {
  const history = new StrokeHistory();

  // Draw two ink strokes
  history.startStroke('pen', '#4f46e5', 6, { x: 0.2, y: 0.2 });
  history.appendPoint({ x: 0.25, y: 0.25 });
  history.endStroke();

  history.startStroke('highlighter', '#facc15', 12, { x: 0.3, y: 0.3 });
  history.appendPoint({ x: 0.35, y: 0.35 });
  history.endStroke();

  // Perform an eraser stroke
  history.startStroke('eraser', '#000000', 48, { x: 0.22, y: 0.22 });
  history.appendPoint({ x: 0.24, y: 0.24 });
  history.endStroke();

  const strokes = history.getStrokes();
  assert.equal(strokes.length, 3);
  assert.equal(strokes[0].tool, 'pen');
  assert.equal(strokes[1].tool, 'highlighter');
  assert.equal(strokes[2].tool, 'eraser');

  // Verify ink strokes vs eraser tool classification
  const inkStrokes = strokes.filter((s) => s.tool !== 'eraser');
  const eraserStrokes = strokes.filter((s) => s.tool === 'eraser');
  assert.equal(inkStrokes.length, 2);
  assert.equal(eraserStrokes.length, 1);
});
