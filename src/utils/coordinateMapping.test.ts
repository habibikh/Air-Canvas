import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mapLandmarkToCanvas,
  euclideanDistance,
  PointFilter,
  getMidpoint,
} from './coordinateMapping';

test('mapLandmarkToCanvas mirrors X coordinate for natural interaction', () => {
  const point = { x: 0.2, y: 0.4 };
  const mappedMirrored = mapLandmarkToCanvas(point, 1000, 800, true);
  // Mirrored x: 1 - 0.2 = 0.8 -> 800
  assert.equal(mappedMirrored.x, 800);
  assert.equal(mappedMirrored.y, 320);

  const mappedUnmirrored = mapLandmarkToCanvas(point, 1000, 800, false);
  assert.equal(mappedUnmirrored.x, 200);
  assert.equal(mappedUnmirrored.y, 320);
});

test('euclideanDistance calculates 2D and 3D distance correctly', () => {
  const p1 = { x: 0, y: 0, z: 0 };
  const p2 = { x: 3, y: 4, z: 0 };
  assert.equal(euclideanDistance(p1, p2), 5);

  const p3 = { x: 0, y: 0, z: 12 };
  assert.equal(euclideanDistance(p1, p3), 12);
});

test('PointFilter smooths coordinates and resets properly', () => {
  const filter = new PointFilter('medium');
  const first = filter.filter(100, 100);
  assert.equal(first.x, 100);
  assert.equal(first.y, 100);

  const second = filter.filter(120, 120);
  // Smoothed coordinate should be between 100 and 120
  assert.ok(second.x > 100 && second.x <= 120);
  assert.ok(second.y > 100 && second.y <= 120);

  filter.reset();
  const resetFirst = filter.filter(50, 50);
  assert.equal(resetFirst.x, 50);
  assert.equal(resetFirst.y, 50);
});

test('getMidpoint finds exact midpoint', () => {
  const mid = getMidpoint({ x: 10, y: 20 }, { x: 30, y: 40 });
  assert.deepEqual(mid, { x: 20, y: 30 });
});
