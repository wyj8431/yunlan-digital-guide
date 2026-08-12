import { createServer } from 'node:http';
import Koa from 'koa';
import Router from '@koa/router';
import { readEnv } from '../config/env.js';
import { getScenicAreaSummary } from '../modules/scenic/scenic-data.js';
import { getOfficialNoticePluginResponse } from '../modules/scenic/scenic.routes.js';
import { ScenicLiveService } from '../modules/scenic/scenic-live.service.js';

const port = Number(process.env.COZE_PLUGIN_PORT ?? 9797);

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error('COZE_PLUGIN_PORT must be a valid TCP port.');
}

const env = readEnv();
const scenicLiveService = new ScenicLiveService({
  feedUrl: env.scenicLiveFeedUrl,
  ttlMs: env.scenicLiveTtlMs,
  fallback: getScenicAreaSummary
});
const app = new Koa();
const router = new Router();

router.get('/api/coze/plugins/official-notices/:spotId', async (ctx) => {
  const response = await getOfficialNoticePluginResponse(scenicLiveService, ctx.params.spotId);
  ctx.status = response.status;
  ctx.body = response.body;
});

app.use(router.routes());
app.use(router.allowedMethods());
app.use((ctx) => {
  ctx.status = 404;
  ctx.body = {
    code: 'PLUGIN_ROUTE_NOT_FOUND',
    message: 'This temporary service only exposes Coze plugin routes.'
  };
});

const server = createServer(app.callback());
server.listen(port, '127.0.0.1', () => {
  console.log(`Coze plugin-only service listening on http://127.0.0.1:${port}`);
});

function stop(): void {
  server.close(() => process.exit(0));
}

process.once('SIGINT', stop);
process.once('SIGTERM', stop);
