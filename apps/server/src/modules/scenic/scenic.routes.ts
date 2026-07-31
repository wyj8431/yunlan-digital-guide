// 提供景区概要和完整详情的只读接口。
import Router from '@koa/router';
import { getScenicAreaSummary } from './scenic-data.js';

export function createScenicRouter(): Router {
  const router = new Router();

  router.get('/api/scenic-area', (ctx) => {
    ctx.body = getScenicAreaSummary();
  });

  return router;
}
