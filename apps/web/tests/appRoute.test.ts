import { describe, expect, it } from 'vitest';
import { resolveAppRoute } from '../src/routing/appRoute';

describe('resolveAppRoute', () => {
  it('resolves the lip sync lab route', () => {
    expect(resolveAppRoute('/lab/lip-sync')).toBe('lip-sync-lab');
  });

  it('falls back to the guide route', () => {
    expect(resolveAppRoute('/')).toBe('guide');
    expect(resolveAppRoute('/lab/unknown')).toBe('guide');
  });
});
