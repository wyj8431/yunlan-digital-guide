import test from 'node:test';
import assert from 'node:assert/strict';

import { totalAlertRepeats } from './work-orders-load-test.mjs';

test('sums alert repeats across aggregation buckets', () => {
  assert.equal(
    totalAlertRepeats([
      { bucketStart: '2026-08-10T07:55:00Z', repeatCount: 311 },
      { bucketStart: '2026-08-10T08:00:00Z', repeatCount: 17 }
    ]),
    328
  );
});

test('returns zero when no matching alert groups exist', () => {
  assert.equal(totalAlertRepeats([]), 0);
});
