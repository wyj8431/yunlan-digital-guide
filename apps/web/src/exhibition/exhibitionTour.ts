import type { HallExhibitId } from './ThreeExhibition';

export const EXHIBITION_TOUR_ORDER: HallExhibitId[] = ['tea-set', 'silk-garment', 'shuttle', 'carved-window'];
export const EXHIBITION_TOUR_DWELL_MS = 4200;

export function getNextTourExhibit(current: HallExhibitId): HallExhibitId {
  const index = EXHIBITION_TOUR_ORDER.indexOf(current);
  return EXHIBITION_TOUR_ORDER[(index + 1) % EXHIBITION_TOUR_ORDER.length] ?? EXHIBITION_TOUR_ORDER[0];
}
