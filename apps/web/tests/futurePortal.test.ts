import { describe, expect, it } from 'vitest';
import {
  isFuturePortalEntry,
  isFutureReturnPortalEntry,
  isHistoryPortalEntry,
  isHistoryReturnPortalEntry
} from '../src/exhibition/futurePortal';

describe('future Wuzhen portal', () => {
  it('opens only at the Future Wuzhen door on the rear wall', () => {
    expect(isFuturePortalEntry({ x: 11.25, z: -16.8 })).toBe(true);
    expect(isFuturePortalEntry({ x: 3.75, z: -16.8 })).toBe(false);
    expect(isFuturePortalEntry({ x: 11.25, z: -16.4 })).toBe(false);
  });

  it('uses the future scene moon gate as the return route', () => {
    expect(isFutureReturnPortalEntry({ x: 0, z: 17.4 })).toBe(true);
    expect(isFutureReturnPortalEntry({ x: 5, z: 17.4 })).toBe(false);
    expect(isFutureReturnPortalEntry({ x: 0, z: 16.8 })).toBe(false);
  });

  it('opens only at the History Archive door on the rear wall', () => {
    expect(isHistoryPortalEntry({ x: -11.25, z: -16.8 })).toBe(true);
    expect(isHistoryPortalEntry({ x: -3.75, z: -16.8 })).toBe(false);
    expect(isHistoryPortalEntry({ x: -11.25, z: -16.4 })).toBe(false);
  });

  it('returns from the history hall through its entry side', () => {
    expect(isHistoryReturnPortalEntry({ x: 0, z: -15.6 })).toBe(true);
    expect(isHistoryReturnPortalEntry({ x: 5, z: -15.6 })).toBe(false);
    expect(isHistoryReturnPortalEntry({ x: 0, z: -15.2 })).toBe(false);
  });
});
