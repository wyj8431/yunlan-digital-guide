// Koa 应用装配入口：初始化共享依赖、注册中间件和各业务路由。
import cors from '@koa/cors';
import Router from '@koa/router';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import { createDocsRouter } from './modules/docs/docs.routes.js';
import { createGuideRouter } from './modules/guide/guide.routes.js';
import { createScenicRouter } from './modules/scenic/scenic.routes.js';
import { getScenicAreaSummary } from './modules/scenic/scenic-data.js';
import { ScenicLiveService } from './modules/scenic/scenic-live.service.js';
import { createSpeechRouter } from './modules/speech/speech.routes.js';
import { VideoRepository } from './modules/video/video.repository.js';
import { createVideoRouter } from './modules/video/video.routes.js';
import { VideoService } from './modules/video/video.service.js';
import { createVirtualHumanRouter } from './modules/virtual-human/virtual-human.routes.js';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_VIDEO_DATABASE_PATH = path.resolve(currentDirectory, '../data/videos.sqlite');

export type CreateAppOptions = {
  videoDatabasePath?: string;
  videoService?: VideoService;
  scenicLiveService?: ScenicLiveService;
  scenicLiveFeedUrl?: string;
  scenicLiveTtlMs?: number;
};

export type ServerApp = Koa & {
  close: () => void;
};

function isMalformedJsonError(caught: unknown): boolean {
  return (
    caught instanceof SyntaxError &&
    typeof caught === 'object' &&
    'status' in caught &&
    caught.status === 400
  );
}

function isVideoDanmakuSubmission(ctx: Koa.Context): boolean {
  return ctx.method === 'POST' && /^\/api\/videos\/[^/]+\/danmaku\/?$/.test(ctx.path);
}

export function createApp(options: CreateAppOptions = {}): ServerApp {
  let videoRepository: VideoRepository | undefined;
  const videoService =
    options.videoService ??
    (() => {
      const databasePath =
        options.videoDatabasePath ??
        (process.env.NODE_ENV === 'test' ? ':memory:' : DEFAULT_VIDEO_DATABASE_PATH);

      if (databasePath !== ':memory:') {
        mkdirSync(path.dirname(databasePath), { recursive: true });
      }

      videoRepository = new VideoRepository(databasePath);
      return new VideoService(videoRepository);
    })();

  const app = new Koa() as ServerApp;
  const router = new Router();
  const docsRouter = createDocsRouter();
  const guideRouter = createGuideRouter();
  const scenicLiveService =
    options.scenicLiveService ??
    new ScenicLiveService({
      feedUrl: options.scenicLiveFeedUrl ?? '',
      ttlMs: options.scenicLiveTtlMs,
      fallback: getScenicAreaSummary
    });
  const scenicRouter = createScenicRouter(scenicLiveService);
  const speechRouter = createSpeechRouter();
  const videoRouter = createVideoRouter(videoService);
  const virtualHumanRouter = createVirtualHumanRouter();

  app.close = () => videoRepository?.close();

  router.get('/api/health', (ctx) => {
    ctx.body = { ok: true, service: 'yunlan-guide-api' };
  });

  app.use(cors());
  app.use(async (ctx, next) => {
    try {
      await next();
    } catch (caught) {
      if (isMalformedJsonError(caught) && isVideoDanmakuSubmission(ctx)) {
        ctx.status = 400;
        ctx.body = { code: 'INVALID_JSON', message: '请求 JSON 格式无效。' };
        return;
      }

      throw caught;
    }
  });
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
  app.use(videoRouter.routes());
  app.use(videoRouter.allowedMethods());
  app.use(virtualHumanRouter.routes());
  app.use(virtualHumanRouter.allowedMethods());

  return app;
}
