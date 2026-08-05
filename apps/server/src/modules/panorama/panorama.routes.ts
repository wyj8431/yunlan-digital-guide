import Router from '@koa/router';
import sharp from 'sharp';
import { PANORAMA_SOURCES } from './panorama-data.js';

type FetchImplementation = typeof fetch;
type CubeFace = 'left' | 'right' | 'front' | 'back' | 'up' | 'down';

const CUBE_FACES = new Set<CubeFace>(['left', 'right', 'front', 'back', 'up', 'down']);
const cubeFaceCache = new Map<string, Promise<Buffer>>();
const tileFetchQueue: Array<() => void> = [];
let activeTileFetches = 0;
const MAX_CONCURRENT_TILE_FETCHES = 3;

function getCubeTileUrl(sourceUrl: string, face: CubeFace, level: number, row: number, column: number) {
  const baseUrl = sourceUrl.replace('/equirect/6.jpg', '');
  return `${baseUrl}/cube/${face}/tile/512/${level}/${row}/${column}.jpg?orig=`;
}

async function withTileFetchSlot<T>(task: () => Promise<T>) {
  if (activeTileFetches >= MAX_CONCURRENT_TILE_FETCHES) {
    await new Promise<void>((resolve) => tileFetchQueue.push(resolve));
  }
  activeTileFetches += 1;
  try {
    return await task();
  } finally {
    activeTileFetches -= 1;
    tileFetchQueue.shift()?.();
  }
}

async function fetchCubeTile(fetchImplementation: FetchImplementation, url: string) {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await withTileFetchSlot(async () => {
        const response = await fetchImplementation(url);
        if (!response.ok || !response.body) throw new Error(`Upstream tile response ${response.status}`);
        return Buffer.from(await response.arrayBuffer());
      });
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Upstream tile request failed');
      await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
    }
  }
  throw lastError;
}

export function createPanoramaRouter(fetchImplementation: FetchImplementation = fetch): Router {
  const router = new Router();
  router.get('/api/panoramas/:panoramaId/cube/:face', async (ctx) => {
    const source = PANORAMA_SOURCES[ctx.params.panoramaId];
    const face = ctx.params.face as CubeFace;
    if (!source || !source.cubeTiles || !CUBE_FACES.has(face)) {
      ctx.status = 404;
      ctx.body = { code: 'PANORAMA_CUBE_NOT_FOUND', message: '全景高清图块不存在。' };
      return;
    }

    const { level, dimension } = source.cubeTiles;
    const tileSize = 512;
    const gridSize = Math.ceil(dimension / tileSize);
    const cacheKey = `${ctx.params.panoramaId}:${face}`;
    let imagePromise = cubeFaceCache.get(cacheKey);
    if (!imagePromise) {
      imagePromise = (async () => {
      const tiles: Array<{ input: Buffer; left: number; top: number }> = [];
      // 360Cities throttles bursts of simultaneous tile downloads. Fetching in order
      // keeps the official high-resolution source reliable on a first visit.
      for (let row = 0; row < gridSize; row += 1) {
        for (let column = 0; column < gridSize; column += 1) {
          const input = await fetchCubeTile(fetchImplementation, getCubeTileUrl(source.sourceUrl, face, level, row, column));
          tiles.push({
            input,
            left: column * tileSize,
            top: row * tileSize
          });
        }
      }
      const image = await sharp({
        create: { width: dimension, height: dimension, channels: 3, background: { r: 0, g: 0, b: 0 } }
      }).composite(tiles).jpeg({ quality: 94, chromaSubsampling: '4:4:4' }).toBuffer();
      return image;
      })();
      cubeFaceCache.set(cacheKey, imagePromise);
    }
    try {
      const image = await imagePromise;
      ctx.status = 200;
      ctx.type = 'image/jpeg';
      ctx.set('Cache-Control', 'public, max-age=604800');
      ctx.body = image;
    } catch {
      cubeFaceCache.delete(cacheKey);
      ctx.status = 502;
      ctx.body = { code: 'PANORAMA_CUBE_UNAVAILABLE', message: '全景高清图块暂时无法取得。', originalUrl: source.originalUrl };
    }
  });
  router.get('/api/panoramas/:panoramaId/:variant', async (ctx) => {
    const source = PANORAMA_SOURCES[ctx.params.panoramaId];
    const variant = ctx.params.variant;
    if (!source) {
      ctx.status = 404;
      ctx.body = { code: 'PANORAMA_NOT_FOUND', message: '全景资源不存在。' };
      return;
    }
    if (variant !== 'texture' && variant !== 'preview') {
      ctx.status = 404;
      ctx.body = { code: 'PANORAMA_VARIANT_NOT_FOUND', message: '全景资源版本不存在。' };
      return;
    }
    const sourceUrl = variant === 'preview' ? source.sourceUrl.replace('/equirect/6.jpg', '/equirect_crop_3_1/6.jpg') : source.sourceUrl;
    try {
      const response = await fetchImplementation(sourceUrl);
      if (!response.ok || !response.body) throw new Error(`Upstream response ${response.status}`);
      const sourceImage = Buffer.from(await response.arrayBuffer());
      const image = variant === 'texture'
        ? await sharp(sourceImage)
            .resize({ width: 4096, withoutEnlargement: false, kernel: sharp.kernel.lanczos3 })
            .sharpen({ sigma: 0.55, m1: 0.35, m2: 0.2 })
            .jpeg({ quality: 94, chromaSubsampling: '4:4:4' })
            .toBuffer()
        : sourceImage;
      ctx.status = 200;
      ctx.type = response.headers.get('content-type') || 'image/jpeg';
      ctx.set('Cache-Control', 'public, max-age=86400');
      ctx.body = image;
    } catch {
      ctx.status = 502;
      ctx.body = { code: 'PANORAMA_SOURCE_UNAVAILABLE', message: '全景图片暂时无法取得。', originalUrl: source.originalUrl };
    }
  });
  return router;
}
