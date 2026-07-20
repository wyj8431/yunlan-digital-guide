import Router from '@koa/router';
import { readEnv } from '../../config/env.js';
import { createGuideResponse, GuideServiceError } from './guide.service.js';

type ChatRequestBody = {
  message?: unknown;
};

export function createGuideRouter(): Router {
  const router = new Router();

  router.post('/api/guide/chat', async (ctx) => {
    const body = ctx.request.body as ChatRequestBody | undefined;
    const message = typeof body?.message === 'string' ? body.message : '';

    try {
      ctx.body = await createGuideResponse({ message, env: readEnv() });
    } catch (caught) {
      if (caught instanceof GuideServiceError) {
        ctx.status = caught.status;
        ctx.body = { code: caught.code, message: caught.message };
        return;
      }

      ctx.status = 500;
      ctx.body = { code: 'INTERNAL_ERROR', message: '服务暂时不可用，请稍后再试。' };
    }
  });

  return router;
}
