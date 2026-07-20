import cors from '@koa/cors';
import Router from '@koa/router';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import { createGuideRouter } from './modules/guide/guide.routes.js';
import { createScenicRouter } from './modules/scenic/scenic.routes.js';

export function createApp(): Koa {
  const app = new Koa();
  const router = new Router();
  const guideRouter = createGuideRouter();
  const scenicRouter = createScenicRouter();

  router.get('/api/health', (ctx) => {
    ctx.body = { ok: true, service: 'yunlan-guide-api' };
  });

  app.use(cors());
  app.use(bodyParser());
  app.use(router.routes());
  app.use(router.allowedMethods());
  app.use(scenicRouter.routes());
  app.use(scenicRouter.allowedMethods());
  app.use(guideRouter.routes());
  app.use(guideRouter.allowedMethods());

  return app;
}
