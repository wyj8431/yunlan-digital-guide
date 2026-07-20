import Router from '@koa/router';
import { getScenicAreaSummary } from './scenic-data.js';

export function createScenicRouter(): Router {
  const router = new Router();

  router.get('/api/scenic-area', (ctx) => {
    ctx.body = getScenicAreaSummary();
  });

  return router;
}
