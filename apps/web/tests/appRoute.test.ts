import { describe, expect, it } from 'vitest';
import { pathForTourismView, resolveAppRoute } from '../src/routing/appRoute';

describe('resolveAppRoute', () => {
  it('resolves every tourism page to a dedicated route', () => {
    expect(resolveAppRoute('/')).toEqual({ kind: 'tourism', view: 'explore' });
    expect(resolveAppRoute('/home')).toEqual({ kind: 'tourism', view: 'home' });
    expect(resolveAppRoute('/guide')).toEqual({ kind: 'tourism', view: 'guide' });
    expect(resolveAppRoute('/narration')).toEqual({ kind: 'tourism', view: 'narration' });
    expect(resolveAppRoute('/map')).toEqual({ kind: 'tourism', view: 'map' });
    expect(resolveAppRoute('/itinerary')).toEqual({ kind: 'tourism', view: 'itinerary' });
    expect(resolveAppRoute('/voice')).toEqual({ kind: 'tourism', view: 'voice' });
    expect(resolveAppRoute('/profile')).toEqual({ kind: 'tourism', view: 'profile' });
    expect(resolveAppRoute('/history')).toEqual({ kind: 'tourism', view: 'history' });
  });

  it('resolves the exhibition and video center routes', () => {
    expect(resolveAppRoute('/exhibition')).toEqual({ kind: 'exhibition' });
    expect(resolveAppRoute('/videos')).toEqual({ kind: 'videos' });
  });

  it('normalizes trailing slashes and keeps the lip sync lab route', () => {
    expect(resolveAppRoute('/map/')).toEqual({ kind: 'tourism', view: 'map' });
    expect(resolveAppRoute('/lab/lip-sync')).toEqual({ kind: 'lip-sync-lab' });
    expect(resolveAppRoute('/exhibition/')).toEqual({ kind: 'exhibition' });
    expect(resolveAppRoute('/videos/')).toEqual({ kind: 'videos' });
  });

  it('falls back to Explore for unknown paths', () => {
    expect(resolveAppRoute('/lab/unknown')).toEqual({ kind: 'tourism', view: 'explore' });
    expect(resolveAppRoute('/anything')).toEqual({ kind: 'tourism', view: 'explore' });
  });

  it('returns the canonical path for every tourism view', () => {
    expect(pathForTourismView('explore')).toBe('/');
    expect(pathForTourismView('home')).toBe('/home');
    expect(pathForTourismView('guide')).toBe('/guide');
    expect(pathForTourismView('narration')).toBe('/narration');
    expect(pathForTourismView('map')).toBe('/map');
    expect(pathForTourismView('itinerary')).toBe('/itinerary');
    expect(pathForTourismView('voice')).toBe('/voice');
    expect(pathForTourismView('profile')).toBe('/profile');
    expect(pathForTourismView('history')).toBe('/history');
  });
});
