import source from '../config/wuzhenExhibition.json';
import tourSource from '../config/wuzhenTours.json';

export type WeatherMode = 'sun' | 'night' | 'rain';
export type DistrictId = 'overview' | 'xizha' | 'dyeworks' | 'night-river';
export type TourId = 'water-street' | 'indigo-craft' | 'lantern-night';

export type District = {
  id: DistrictId;
  label: string;
  frame: string;
  eyebrow: string;
  title: string;
  description: string;
  process?: string[];
  camera: {
    position: [number, number, number];
    target: [number, number, number];
  };
  bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
  marker: [number, number, number];
};

type WeatherSetting = {
  label: string;
  sky: string;
  fog: string;
  sunColor: string;
  sunIntensity: number;
  ambientIntensity: number;
  water: string;
  lanternIntensity: number;
  rain: boolean;
};

type ExhibitionConfig = {
  title: string;
  assets: { aerial: string; street: string };
  weather: Record<WeatherMode, WeatherSetting>;
  districts: District[];
  tour: { intervalMs: number; order: DistrictId[] };
};

export type WuzhenTour = {
  id: TourId;
  label: string;
  description: string;
  intervalMs: number;
  order: DistrictId[];
};

export const WUZHEN_EXHIBITION = source as ExhibitionConfig;
export const WUZHEN_DISTRICTS = WUZHEN_EXHIBITION.districts;
export const WUZHEN_WEATHER = WUZHEN_EXHIBITION.weather;
export const WUZHEN_TOURS = tourSource.routes as WuzhenTour[];

export function getDistrict(id: DistrictId): District {
  const district = WUZHEN_DISTRICTS.find((item) => item.id === id);
  if (!district) throw new Error(`Unknown Wuzhen district: ${id}`);
  return district;
}

export function getTour(id: TourId): WuzhenTour {
  const tour = WUZHEN_TOURS.find((item) => item.id === id);
  if (!tour) throw new Error(`Unknown Wuzhen tour: ${id}`);
  return tour;
}
