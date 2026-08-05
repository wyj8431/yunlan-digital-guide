export type PanoramaSource = {
  sourceUrl: string;
  originalUrl: string;
  // The supplied 360Cities panorama exposes official multi-resolution cube tiles.
  cubeTiles?: { level: number; dimension: number };
};

export const PANORAMA_SOURCES: Record<string, PanoramaSource> = {
  'wuzhen-xishan-scenic-35-2013': { sourceUrl: 'https://cloudflare1.360gigapixels.com/pano/landeshow/00978553_IMG_3780.jpg/equirect/6.jpg', originalUrl: 'https://www.360cities.net/image/wuzhen-xishan-scenic-35-2013' },
  'wuzhen-scenic-2-2013': { sourceUrl: 'https://cloudflare1.360gigapixels.com/pano/landeshow/00933580_IMG_2586.jpg/equirect/6.jpg', originalUrl: 'https://www.360cities.net/image/wuzhen-scenic-2-2013' },
  'wuzhen-xishan-scenic-41-2013': { sourceUrl: 'https://cloudflare1.360gigapixels.com/pano/landeshow/00978684_IMG_3976.jpg/equirect/6.jpg', originalUrl: 'https://www.360cities.net/image/wuzhen-xishan-scenic-41-2013' },
  'jiaxing-wuzhen-xishan-street-zhejiang-province-zhejiang': { sourceUrl: 'https://cloudflare1.360gigapixels.com/pano/landeshow/00701254_IMG_9674.jpg/equirect/6.jpg', originalUrl: 'https://www.360cities.net/image/jiaxing-wuzhen-xishan-street-zhejiang-province-zhejiang' },
  'wuzhen-scenic-night-6-2013': {
    sourceUrl: 'https://cloudflare1.360gigapixels.com/pano/landeshow/01220200_IMG_4362.jpg/equirect/6.jpg',
    originalUrl: 'https://www.360cities.net/image/wuzhen-scenic-night-6-2013',
    cubeTiles: { level: 2, dimension: 1749 }
  },
  'wuzhen-xishan-scenic-45-2013': { sourceUrl: 'https://cloudflare1.360gigapixels.com/pano/landeshow/00978689_IMG_4113_.jpg/equirect/6.jpg', originalUrl: 'https://www.360cities.net/image/wuzhen-xishan-scenic-45-2013' },
  'wuzhen-scenic-night-7-2013': { sourceUrl: 'https://cloudflare1.360gigapixels.com/pano/landeshow/01220400_IMG_4407.jpg/equirect/6.jpg', originalUrl: 'https://www.360cities.net/image/wuzhen-scenic-night-7-2013' },
  'wuzhen-xishan-scenic-12-2013': { sourceUrl: 'https://cloudflare1.360gigapixels.com/pano/landeshow/00978236_IMG_2947_.jpg/equirect/6.jpg', originalUrl: 'https://www.360cities.net/image/wuzhen-xishan-scenic-12-2013' },
  'wuzhen-xishan-scenic-18-2013': { sourceUrl: 'https://cloudflare1.360gigapixels.com/pano/landeshow/01016831_IMG_3157_1.jpg/equirect/6.jpg', originalUrl: 'https://www.360cities.net/image/wuzhen-xishan-scenic-18-2013' },
  'wuzhen-xishan-scenic-21-2013': { sourceUrl: 'https://cloudflare1.360gigapixels.com/pano/landeshow/00978993_IMG_3293_.jpg/equirect/6.jpg', originalUrl: 'https://www.360cities.net/image/wuzhen-xishan-scenic-21-2013' },
  'jiaxing-wzdy-damen': { sourceUrl: 'https://cloudflare1.360gigapixels.com/pano/landeshow/00700711_IMG_9756.jpg/equirect/6.jpg', originalUrl: 'https://www.360cities.net/image/jiaxing-wzdy-damen' },
  'wuzhen-xishan-scenic-22-2013': { sourceUrl: 'https://cloudflare1.360gigapixels.com/pano/landeshow/00979066_IMG_3307_.jpg/equirect/6.jpg', originalUrl: 'https://www.360cities.net/image/wuzhen-xishan-scenic-22-2013' },
  'wuzhen-xishan-scenic-24-2013': { sourceUrl: 'https://cloudflare1.360gigapixels.com/pano/landeshow/00978521_IMG_3377_.jpg/equirect/6.jpg', originalUrl: 'https://www.360cities.net/image/wuzhen-xishan-scenic-24-2013' },
  'wuzhen-scenic-6-2013': { sourceUrl: 'https://cloudflare1.360gigapixels.com/pano/landeshow/00933550_IMG_2736.jpg/equirect/6.jpg', originalUrl: 'https://www.360cities.net/image/wuzhen-scenic-6-2013' },
  'wuzhen-xishan-scenic-31-2013': { sourceUrl: 'https://cloudflare1.360gigapixels.com/pano/landeshow/00986458_IMG_3660.jpg/equirect/6.jpg', originalUrl: 'https://www.360cities.net/image/wuzhen-xishan-scenic-31-2013' }
};

// Dimensions are read from each panorama's official 360Cities KRPano manifest.
// Level 2 is the native high-resolution layer while keeping initial VR loading practical.
const HD_CUBE_TILES: Record<string, NonNullable<PanoramaSource['cubeTiles']>> = {
  'wuzhen-xishan-scenic-35-2013': { level: 2, dimension: 1625 },
  'wuzhen-scenic-2-2013': { level: 2, dimension: 1500 },
  'wuzhen-xishan-scenic-41-2013': { level: 2, dimension: 1625 },
  'jiaxing-wuzhen-xishan-street-zhejiang-province-zhejiang': { level: 2, dimension: 1924 },
  'wuzhen-scenic-night-6-2013': { level: 2, dimension: 1749 },
  'wuzhen-xishan-scenic-45-2013': { level: 2, dimension: 1625 },
  'wuzhen-scenic-night-7-2013': { level: 2, dimension: 1745 },
  'wuzhen-xishan-scenic-12-2013': { level: 2, dimension: 1625 },
  'wuzhen-xishan-scenic-18-2013': { level: 2, dimension: 1625 },
  'wuzhen-xishan-scenic-21-2013': { level: 2, dimension: 1625 },
  'jiaxing-wzdy-damen': { level: 2, dimension: 1938 },
  'wuzhen-xishan-scenic-22-2013': { level: 2, dimension: 1625 },
  'wuzhen-xishan-scenic-24-2013': { level: 2, dimension: 1625 },
  'wuzhen-scenic-6-2013': { level: 2, dimension: 1500 },
  'wuzhen-xishan-scenic-31-2013': { level: 2, dimension: 1625 }
};

for (const [panoramaId, cubeTiles] of Object.entries(HD_CUBE_TILES)) {
  PANORAMA_SOURCES[panoramaId].cubeTiles = cubeTiles;
}
