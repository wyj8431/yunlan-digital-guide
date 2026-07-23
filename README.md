# 乌镇景区 AI 数字导游

面向景区导览场景的 3D AI 数字人应用。前端提供文字、语音和图片提问；后端构建全球景区旅游垂直智能体，通过 OpenAI-compatible LLM 流式回答世界范围内的景区旅游问题，并以内置真实乌镇景区资料作为当前项目默认数据源。右侧优先接入讯飞虚拟人，失败时切换到本地 Three.js 数字人兜底。

## 当前能力

- React 19 + Vite + TypeScript 前端
- Koa + TypeScript 后端
- 真实乌镇景区 JSON 数据：开放时间、票务参考、推荐景点、路线、服务和 FAQ
- 后台景区旅游智能体：回答全球景区旅游路线、票务、交通住宿、亲子游、拍照点和服务问题；非景区旅游问题会拒答
- 图片提问：上传 PNG/JPG/WebP 后，后端把图片传给支持视觉的 LLM 分析
- WebSocket 流式回答，文字像打字机一样逐步出现
- 讯飞虚拟人 SDK 接入，支持动作切换和说话
- 本地 Three.js 数字人兜底，支持估算口型同步
- 语音输入：浏览器录音后提交到后端讯飞 ASR
- 语音回复：优先后端讯飞 TTS + WebAudio 播放时钟，失败时回退浏览器朗读

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

复制 `.env.example` 到 `.env`，然后填入真实密钥。不要提交真实 `.env`。

```text
PORT=8787

# 推荐：hybrid 会优先使用扣子 Coze，失败或超时后自动使用火山方舟兜底。
LLM_PROVIDER=hybrid
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
ARK_API_KEY=replace-with-your-ark-api-key
ARK_MODEL=glm-5-2-260617

# 扣子 Coze 智能体。hybrid/coze 模式会使用这些配置。
COZE_API_BASE=https://api.coze.cn
COZE_API_TOKEN=replace-with-your-coze-token
COZE_BOT_ID=replace-with-your-coze-bot-id
COZE_USER_ID=wyj-guide-user

# 可选：其他 OpenAI-compatible 平台。
LLM_BASE_URL=
LLM_API_KEY=
LLM_MODEL=

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

火山方舟接入时，`ARK_MODEL` 填控制台里的模型 ID 或推理接入点 ID；当前示例已按你的接入点配置为 `glm-5-2-260617`。后端会自动把 `ARK_*` 映射成现有 LLM 调用配置；当 `LLM_PROVIDER=ark` 时，即使旧的 `LLM_*` 还在，也会优先使用 `ARK_*`。

扣子接入时，在扣子控制台创建智能体并发布 API，把 `COZE_API_TOKEN` 和 `COZE_BOT_ID` 填到 `.env`。`LLM_PROVIDER=hybrid` 时会优先调用扣子；扣子失败、返回空内容或 15 秒无响应时，会自动切到火山方舟兜底。也可以改成 `coze` 只用扣子，或 `ark` 只用火山。

图片分析依赖模型支持视觉输入。如果接入的模型不支持图片，后端会退回纯文本景区资料回答。智能体只处理景区旅游相关图片线索，非旅游问题会被后端拦截。

## 数据来源

当前默认内置景区为乌镇景区，数据来自乌镇旅游官方网站和乌镇旅游官方预订网公开信息。智能体可以回答世界范围内的景区旅游问题；涉及票价、开放时间、演出排期和优惠政策等会变化的信息，产品回答会提示以官方当天公告或官方购票页为准。

## 问答链路

文字和图片提问：

```text
问题/图片 -> /api/guide/chat/stream -> 后台导游智能体 -> 流式文字 -> 数字人语音和口型
```

语音提问：

```text
麦克风录音 -> /api/speech/transcribe -> 自动提交问题 -> 流式回答 -> 数字人说话
```

语音回复：

```text
导游回答 -> /api/speech/synthesize -> MP3 -> WebAudio 播放 -> 播放事件同步口型和文字速度
```

如果右侧已经是讯飞在线数字人，它会优先自己说话，页面不会额外播放一条普通 TTS，避免出现两个声音。

## 常用命令

```powershell
npm run dev
npm run build
npm run typecheck
npm run test
npm --workspace apps/server run test
npm --workspace apps/web run test -- useGuideChat QuestionInput
```

## 验收重点

- 文字提问和图片提问都能触发后台景区旅游智能体回答
- 全球景区旅游相关问题可以回答，非景区旅游问题会拒答且不会调用 LLM
- 支持上传 PNG/JPG/WebP，超过 4MB 的图片会被前端拒绝
- 回答文字流式打印，并与语音播放尽量同步
- 语音输入识别后自动提交问题
- 讯飞在线数字人模式下只有一个数字人声音
- 本地 Three.js 兜底模式下口型能跟随播放事件
- TTS、ASR、虚拟人或麦克风失败后，文字输入仍然可用
- 不在日志、localStorage 或 IndexedDB 保存原始录音和真实密钥

## 文档

- 第三阶段联调清单：`docs/integration/phase-3b-xfyun-voice.md`
- 设计规格：`docs/superpowers/specs/2026-07-19-yunlan-ancient-town-digital-guide-design.md`
- 语音口型性能规格：`docs/superpowers/specs/2026-07-20-phase-three-voice-lip-sync-performance-design.md`
