import assert from 'node:assert/strict';
import test from 'node:test';
import { funnelWidths } from '../src/admin/components/funnelGeometry';

test('funnel layers narrow with the people left and never widen again', () => {
  const widths = funnelWidths([{ people: 1000 }, { people: 640 }, { people: 700 }, { people: 90 }, { people: 0 }]);
  assert.equal(widths[0], 100);
  for (let i = 1; i < widths.length; i++) assert.ok(widths[i]! <= widths[i - 1]!, `layer ${i} widened`);
  assert.equal(widths[2], widths[1]); // more people than the step before still can't widen the funnel
  assert.equal(widths[4], 26); // empty stage keeps the minimum readable width
});

test('an empty funnel stays at the minimum width', () => {
  assert.deepEqual(funnelWidths([{ people: 0 }, { people: 0 }]), [26, 26]);
});
