import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { getExhibitionCatalog } from '../src/modules/exhibition/exhibition-data';

describe('exhibition api', () => {
  it('exposes the full Excel-backed catalog and marks P0 objects', async () => {
    const catalog = getExhibitionCatalog();
    expect(catalog.zones).toHaveLength(8);
    expect(catalog.items).toHaveLength(34);
    expect(catalog.items.filter((item) => item.priority === 'P0')).toHaveLength(8);
    expect(catalog.items.filter((item) => item.implemented)).toHaveLength(34);

    const app = createApp();
    await request(app.callback())
      .get('/api/exhibition')
      .expect(200)
      .expect(({ body }) => {
        expect(body.source).toContain('3D展厅物件清单.xlsx');
        expect(body.items).toHaveLength(34);
        expect(body.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: 'entrance-hologram', priority: 'P0' }),
            expect.objectContaining({ id: 'itinerary-diy', interaction: 'custom-route' })
          ])
        );
      });
  });

  it('returns one catalog item and a stable not-found error', async () => {
    const app = createApp();

    await request(app.callback())
      .get('/api/exhibition/items/global-globe')
      .expect(200)
      .expect(({ body }) => {
        expect(body.item).toMatchObject({
          id: 'global-globe',
          zoneId: 'global',
          name: '东栅水乡路线沙盘'
        });
      });

    await request(app.callback())
      .get('/api/exhibition/items/missing')
      .expect(404)
      .expect(({ body }) => {
        expect(body).toEqual({
          code: 'EXHIBITION_ITEM_NOT_FOUND',
          message: '展厅物件不存在。'
        });
      });
  });
});
