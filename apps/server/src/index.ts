// 服务启动入口：创建 HTTP 服务并挂载普通接口与 WebSocket 会话。
import { createServer } from 'node:http';
import { createApp } from './app.js';
import { readEnv } from './config/env.js';
import { attachGuideWebSocketServer } from './modules/guide/guide.websocket.js';
import { getScenicAreaSummary } from './modules/scenic/scenic-data.js';
import { ScenicLiveService } from './modules/scenic/scenic-live.service.js';
import { attachVoiceWebSocketServer } from './modules/voice/voice-websocket.js';

const env = readEnv();
const scenicLiveService = new ScenicLiveService({
  feedUrl: env.scenicLiveFeedUrl,
  ttlMs: env.scenicLiveTtlMs,
  fallback: getScenicAreaSummary
});
const app = createApp({
  scenicLiveService
});
const server = createServer(app.callback());

server.once('close', () => app.close());

attachGuideWebSocketServer(server, { scenicLiveService });
attachVoiceWebSocketServer(server, { scenicLiveService });

server.listen(env.port, () => {
  console.log(`Yunlan guide API listening on http://localhost:${env.port}`);
});
