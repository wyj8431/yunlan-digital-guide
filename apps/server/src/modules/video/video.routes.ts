import Router from '@koa/router';
import { VideoService, VideoServiceError } from './video.service.js';

function parseQueryInteger(value: unknown): number | undefined {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)$/.test(value)) {
    return undefined;
  }

  return Number(value);
}

function respondToVideoError(ctx: Router.RouterContext, caught: unknown): void {
  if (caught instanceof VideoServiceError) {
    ctx.status = caught.status;
    ctx.body = { code: caught.code, message: caught.message };
    return;
  }

  ctx.status = 500;
  ctx.body = { code: 'INTERNAL_ERROR', message: '视频服务暂时不可用，请稍后再试。' };
}

export function createVideoRouter(service: VideoService): Router {
  const router = new Router();

  router.get('/api/videos', (ctx) => {
    try {
      ctx.body = { videos: service.listVideos() };
    } catch (caught) {
      respondToVideoError(ctx, caught);
    }
  });

  router.get('/api/videos/:videoId', (ctx) => {
    try {
      ctx.body = { video: service.getVideoDetail(ctx.params.videoId) };
    } catch (caught) {
      respondToVideoError(ctx, caught);
    }
  });

  router.get('/api/videos/:videoId/subtitles', (ctx) => {
    try {
      ctx.body = { subtitles: service.getVideoDetail(ctx.params.videoId).subtitleCues };
    } catch (caught) {
      respondToVideoError(ctx, caught);
    }
  });

  router.get('/api/videos/:videoId/danmaku', (ctx) => {
    try {
      ctx.body = {
        danmaku: service.listDanmaku(
          ctx.params.videoId,
          parseQueryInteger(ctx.query.from),
          parseQueryInteger(ctx.query.to)
        )
      };
    } catch (caught) {
      respondToVideoError(ctx, caught);
    }
  });

  router.post('/api/videos/:videoId/danmaku', (ctx) => {
    try {
      const danmaku = service.createDanmaku(ctx.params.videoId, ctx.request.body);
      ctx.status = 201;
      ctx.body = { danmaku };
    } catch (caught) {
      respondToVideoError(ctx, caught);
    }
  });

  return router;
}
