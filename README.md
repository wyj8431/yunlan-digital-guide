# 云岚古镇 AI 数字导游

文旅导览场景下的 3D AI 数字人 MVP。左侧是导游问答面板，右侧是 Three.js 数字人舞台。游客可以点击快捷问题或自由输入，后端基于云岚古镇 JSON 资料调用 OpenAI-compatible LLM 生成回答，前端使用 Web Speech API 朗读回答并驱动简单嘴部动画。

## 第一版范围

- React 19 + Vite + TypeScript 前端
- Koa 后端
- OpenAI-compatible LLM 接入
- 云岚古镇 JSON 景区资料
- 路线步骤卡片
- Web Speech API 朗读
- Three.js 数字人舞台

## 快速开始

```powershell
npm install
Copy-Item .env.example apps/server/.env
npm run dev
```

前端默认运行在 `http://localhost:5173`，后端默认运行在 `http://localhost:8787`。

## 演示路径

1. 启动后端和前端：`npm run dev`
2. 打开 `http://localhost:5173`
3. 点击快捷问题“帮我规划一条半日游路线”
4. 查看聊天回答、路线步骤卡片和右侧数字人说话动画

如果没有配置真实 `LLM_API_KEY`，`POST /api/guide/chat` 会返回后端错误提示；健康检查和景区资料接口仍可验证。

## 常用命令

```powershell
npm run dev
npm run build
npm run lint
npm run format
npm run typecheck
npm run test
```

## 环境变量

后端读取 `apps/server/.env`：

```text
PORT=8787
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=replace-with-your-api-key
LLM_MODEL=gpt-4o-mini
```

## Phase 3A Lip Sync Lab

- Lab URL: `http://localhost:5173/lab/lip-sync`
- Isolated test URL: `http://127.0.0.1:5174/lab/lip-sync?phase3a-debug=1`
- Smoke check: `npm --workspace apps/web run test -- phase3a.browser.test.js`
- Benchmark mode: set `PHASE3A_BROWSER_MODE=bench`, then run the same test command.
- Performance report: `docs/performance/phase-3a-test-procedure.md`

## 文档

- 设计规格：`docs/superpowers/specs/2026-07-19-yunlan-ancient-town-digital-guide-design.md`
- 接口文档：`apps/server/docs/api.md`
