// 提供景区概要和完整详情的只读接口。
import Router from '@koa/router';
import { getScenicAreaSummary } from './scenic-data.js';
import { ScenicLiveService } from './scenic-live.service.js';

export function createScenicRouter(
  service = new ScenicLiveService({ feedUrl: '', fallback: getScenicAreaSummary })
): Router {
  const router = new Router();

  router.get('/api/scenic-area', async (ctx) => {
    ctx.body = await service.getSummary();
  });

  return router;
}
