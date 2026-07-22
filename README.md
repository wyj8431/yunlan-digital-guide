# 云岚古镇 AI 数字导游

文旅导览场景下的 3D AI 数字人应用。左侧是导游问答和景区信息，右侧优先接入讯飞星火数字人；当讯飞虚拟人不可用时，页面会切换到本地 Three.js 数字人兜底。

## 当前能力

- React 19 + Vite + TypeScript 前端
- Koa + TypeScript 后端
- 云岚古镇 JSON 景区资料
- OpenAI-compatible LLM 导游问答
- WebSocket 流式回答，文字像打字机一样逐步出现
- 讯飞虚拟人 SDK 接入，支持动作切换和说话
- 本地 Three.js 数字人兜底，支持估算口型同步
- 语音输入：浏览器录音后提交到后端讯飞 ASR
- 语音回复：优先后端讯飞 TTS + WebAudio 播放时钟，失败时回退浏览器朗读
- 播放开始/结束事件驱动本地数字人口型，避免文字和语音明显不同步

## 快速启动

```powershell
npm install
npm run dev
```

默认地址：

- 前端：http://localhost:5173
- 后端：http://localhost:8787
- 口型实验室：http://localhost:5173/lab/lip-sync

## 环境变量

复制 `.env.example` 到 `.env`，然后按需填写真实密钥。不要提交真实 `.env`。

```text
PORT=8787
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=replace-with-your-api-key
LLM_MODEL=gpt-4o-mini

XFYUN_VIRTUAL_HUMAN_ENABLED=false
XFYUN_VIRTUAL_HUMAN_APP_ID=
XFYUN_VIRTUAL_HUMAN_API_KEY=
XFYUN_VIRTUAL_HUMAN_API_SECRET=
XFYUN_VIRTUAL_HUMAN_APP_SECRET=
XFYUN_VIRTUAL_HUMAN_SERVICE_ID=
XFYUN_VIRTUAL_HUMAN_AVATAR_ID=201165002
XFYUN_VIRTUAL_HUMAN_TTS_VOICE=x4_lingxiaoxuan_oral

XFYUN_TTS_APP_ID=
XFYUN_TTS_API_KEY=
XFYUN_TTS_API_SECRET=
XFYUN_TTS_VOICE=xiaoyan
```

普通 TTS 音色默认是 `xiaoyan`。不要直接把虚拟人音色当成普通 TTS 音色使用，否则讯飞可能返回授权错误，例如 `licc failed`。

## 语音链路

文字提问流程：

```text
问题输入 -> /api/guide/chat/stream -> 流式文字 -> 数字人说话
```

语音提问流程：

```text
麦克风录音 -> /api/speech/transcribe -> 自动提交问题 -> 流式回答 -> 数字人说话
```

语音回复流程：

```text
导游回答 -> /api/speech/synthesize -> MP3 -> WebAudio 播放 -> 播放事件同步口型
```

如果右侧已经是讯飞在线数字人，它会优先自己说话，页面不会再额外播放一条普通 TTS，避免出现两个声音。

## 常用命令

```powershell
npm run dev
npm run build
npm run typecheck
npm run test
npm --workspace apps/server run test -- api env
npm --workspace apps/web run test -- useSpeechSynthesis QuestionInput
```

## 第三阶段验收重点

- 麦克风提问能识别并自动发送
- 回答文字流式打印
- 数字人语音和文字尽量同时开始、同时结束
- 讯飞在线数字人模式下只有一个数字人声音
- 本地 Three.js 兜底模式下口型能跟随播放事件关闭和打开
- TTS、ASR 或麦克风失败后，文字输入仍然可用
- 不在日志、localStorage 或 IndexedDB 保存原始录音

## 文档

- 设计规格：`docs/superpowers/specs/2026-07-19-yunlan-ancient-town-digital-guide-design.md`
- 第三阶段规格：`docs/superpowers/specs/2026-07-20-phase-three-voice-lip-sync-performance-design.md`
- 第三阶段联调清单：`docs/integration/phase-3b-xfyun-voice.md`
