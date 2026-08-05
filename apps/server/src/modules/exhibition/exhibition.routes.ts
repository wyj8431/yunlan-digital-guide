import Router from '@koa/router';
import { findExhibitionItem, getExhibitionCatalog } from './exhibition-data.js';

export function createExhibitionRouter(): Router {
  const router = new Router();

  router.get('/api/exhibition', (ctx) => {
    ctx.body = getExhibitionCatalog();
  });

  router.get('/api/exhibition/zones', (ctx) => {
    ctx.body = { zones: getExhibitionCatalog().zones };
  });

  router.get('/api/exhibition/items', (ctx) => {
    ctx.body = { items: getExhibitionCatalog().items };
  });

  router.get('/api/exhibition/items/:itemId', (ctx) => {
    const item = findExhibitionItem(ctx.params.itemId);
    if (!item) {
      ctx.status = 404;
      ctx.body = { code: 'EXHIBITION_ITEM_NOT_FOUND', message: '展厅物件不存在。' };
      return;
    }

    ctx.body = { item };
  });

  return router;
}
