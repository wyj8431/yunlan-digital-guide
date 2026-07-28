import cors from '@koa/cors';
import Router from '@koa/router';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import { createDocsRouter } from './modules/docs/docs.routes.js';
import { createGuideRouter } from './modules/guide/guide.routes.js';
import { createScenicRouter } from './modules/scenic/scenic.routes.js';
import { createSpeechRouter } from './modules/speech/speech.routes.js';
import { createVirtualHumanRouter } from './modules/virtual-human/virtual-human.routes.js';

export function createApp(): Koa {
  const app = new Koa();
  const router = new Router();
  const docsRouter = createDocsRouter();
  const guideRouter = createGuideRouter();
  const scenicRouter = createScenicRouter();
  const speechRouter = createSpeechRouter();
  const virtualHumanRouter = createVirtualHumanRouter();

  router.get('/api/health', (ctx) => {
    ctx.body = { ok: true, service: 'yunlan-guide-api' };
  });

  app.use(cors());
  app.use(bodyParser({ jsonLimit: '15mb' }));
  app.use(router.routes());
  app.use(router.allowedMethods());
  app.use(docsRouter.routes());
  app.use(docsRouter.allowedMethods());
  app.use(scenicRouter.routes());
  app.use(scenicRouter.allowedMethods());
  app.use(guideRouter.routes());
  app.use(guideRouter.allowedMethods());
  app.use(speechRouter.routes());
  app.use(speechRouter.allowedMethods());
  app.use(virtualHumanRouter.routes());
  app.use(virtualHumanRouter.allowedMethods());

  return app;
}
