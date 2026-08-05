import { describe, expect, it } from 'vitest';
import { EXHIBITION_TOUR_ORDER, getNextTourExhibit } from '../src/exhibition/exhibitionTour';

describe('exhibition auto tour', () => {
  it('visits every exhibit in a stable curated order', () => {
    expect(EXHIBITION_TOUR_ORDER).toEqual(['tea-set', 'silk-garment', 'shuttle', 'carved-window']);
  });

  it('wraps to the first exhibit after the final stop', () => {
    expect(getNextTourExhibit('tea-set')).toBe('silk-garment');
    expect(getNextTourExhibit('shuttle')).toBe('carved-window');
    expect(getNextTourExhibit('carved-window')).toBe('tea-set');
  });
});
