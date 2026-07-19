# Yunlan Digital Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first MVP of the 云岚古镇 AI 数字导游: a React 19 + Vite + TypeScript frontend, a Koa backend, OpenAI-compatible LLM chat, JSON scenic data, route cards, Web Speech API narration, and a simple Three.js digital human stage.

**Architecture:** Use a small npm workspace monorepo with `apps/web` for the visitor-facing React app and `apps/server` for the Koa API. Keep scenic-area content in backend JSON so the virtual景区 can be replaced by a real景区 without changing frontend or LLM integration boundaries.

**Tech Stack:** React 19, Vite, TypeScript, Koa, Three.js, Vitest, React Testing Library, Supertest, ESLint, Prettier, Husky, lint-staged, OpenAI-compatible chat completions API, browser Web Speech API.

---

## File Structure

Create this structure from the repository root:

```text
.
├── .editorconfig
├── .env.example
├── .gitignore
├── .prettierrc
├── eslint.config.js
├── package.json
├── README.md
├── tsconfig.base.json
├── apps/
│   ├── server/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   ├── docs/
│   │   │   └── api.md
│   │   ├── src/
│   │   │   ├── app.ts
│   │   │   ├── index.ts
│   │   │   ├── config/env.ts
│   │   │   ├── data/yunlan-town.json
│   │   │   ├── modules/guide/guide.routes.ts
│   │   │   ├── modules/guide/guide.service.ts
│   │   │   ├── modules/guide/llm-client.ts
│   │   │   ├── modules/scenic/scenic-data.ts
│   │   │   ├── modules/scenic/scenic.routes.ts
│   │   │   └── types/scenic.ts
│   │   └── tests/
│   │       ├── guide.service.test.ts
│   │       ├── scenic-data.test.ts
│   │       └── api.test.ts
│   └── web/
│       ├── index.html
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── vitest.config.ts
│       ├── src/
│       │   ├── App.tsx
│       │   ├── main.tsx
│       │   ├── styles.css
│       │   ├── api/guideApi.ts
│       │   ├── components/ChatMessages.tsx
│       │   ├── components/DigitalHumanStage.tsx
│       │   ├── components/GuidePanel.tsx
│       │   ├── components/QuestionInput.tsx
│       │   ├── components/QuickQuestions.tsx
│       │   ├── components/RouteCards.tsx
│       │   ├── hooks/useGuideChat.ts
│       │   ├── hooks/useSpeechSynthesis.ts
│       │   └── types/guide.ts
│       └── tests/
│           ├── GuidePanel.test.tsx
│           └── useSpeechSynthesis.test.tsx
└── docs/
    └── superpowers/
        ├── plans/2026-07-19-yunlan-digital-guide-implementation.md
        └── specs/2026-07-19-yunlan-ancient-town-digital-guide-design.md
```

Boundaries:

- `apps/server/src/modules/scenic/*` owns scenic JSON loading and typed scenic data.
- `apps/server/src/modules/guide/*` owns question handling, LLM prompting, and route-card response shaping.
- `apps/web/src/api/*` owns HTTP calls.
- `apps/web/src/hooks/*` owns stateful browser/API behavior.
- `apps/web/src/components/*` owns rendering only.
- `DigitalHumanStage` should not know about LLM or chat state; it only receives `speaking: boolean`.

---

### Task 1: Root Workspace And Engineering Baseline

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `eslint.config.js`
- Create: `.prettierrc`
- Create: `.editorconfig`
- Modify: `.gitignore`
- Create: `.env.example`
- Create: `README.md`

- [ ] **Step 1: Write root workspace files**

Create `package.json`:

```json
{
  "name": "yunlan-digital-guide",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "workspaces": [
    "apps/server",
    "apps/web"
  ],
  "scripts": {
    "dev": "npm-run-all --parallel dev:server dev:web",
    "dev:server": "npm --workspace apps/server run dev",
    "dev:web": "npm --workspace apps/web run dev",
    "build": "npm --workspaces run build",
    "lint": "eslint .",
    "format": "prettier . --write",
    "typecheck": "npm --workspaces run typecheck",
    "test": "npm --workspaces run test",
    "prepare": "husky"
  },
  "devDependencies": {
    "@eslint/js": "^9.31.0",
    "eslint": "^9.31.0",
    "eslint-config-prettier": "^10.1.5",
    "globals": "^16.3.0",
    "husky": "^9.1.7",
    "lint-staged": "^16.1.2",
    "npm-run-all": "^4.1.5",
    "prettier": "^3.6.2",
    "typescript": "^5.8.3",
    "typescript-eslint": "^8.37.0"
  },
  "lint-staged": {
    "*.{ts,tsx,js,jsx,json,md,css}": [
      "prettier --write"
    ],
    "*.{ts,tsx,js,jsx}": [
      "eslint --fix"
    ]
  }
}
```

Create `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true
  }
}
```

Create `eslint.config.js`:

```js
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['dist', 'coverage', 'node_modules', '.superpowers']
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
    }
  },
  prettier
);
```

Create `.prettierrc`:

```json
{
  "singleQuote": true,
  "semi": true,
  "printWidth": 100,
  "trailingComma": "none"
}
```

Create `.editorconfig`:

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true
```

Update `.gitignore`:

```text
.superpowers/
node_modules/
dist/
coverage/
.env
*.local
```

Create `.env.example`:

```text
PORT=8787
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=replace-with-your-api-key
LLM_MODEL=gpt-4o-mini
```

Create `README.md`:

```md
# 云岚古镇 AI 数字导游

文旅导览场景下的 3D AI 数字人 MVP。左侧为导览面板，右侧为 Three.js 数字人。用户可以点击快捷问题或自由输入，后端基于云岚古镇 JSON 资料调用 OpenAI-compatible LLM 生成回答，前端使用 Web Speech API 朗读回答并驱动简单嘴部动画。

## 第一版范围

- React 19 + Vite + TypeScript 前端
- Koa 后端
- OpenAI-compatible LLM 接入
- 云岚古镇 JSON 资料
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

## 常用命令

```powershell
npm run dev
npm run build
npm run lint
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

## 文档

- 设计规格：`docs/superpowers/specs/2026-07-19-yunlan-ancient-town-digital-guide-design.md`
- 接口文档：`apps/server/docs/api.md`
```

- [ ] **Step 2: Install root dependencies**

Run:

```powershell
npm install
```

Expected: `package-lock.json` is created and npm exits with code 0.

- [ ] **Step 3: Initialize Husky pre-commit hook**

Run:

```powershell
npm run prepare
npx husky init
```

Replace `.husky/pre-commit` content with:

```sh
npx lint-staged
```

Expected: `.husky/pre-commit` exists.

- [ ] **Step 4: Verify baseline tools**

Run:

```powershell
npm run lint
npm run format
```

Expected: lint has no errors; format exits with code 0.

- [ ] **Step 5: Commit**

```powershell
git add package.json package-lock.json tsconfig.base.json eslint.config.js .prettierrc .editorconfig .gitignore .env.example README.md .husky
git commit -m "chore: set up workspace tooling"
```

---

### Task 2: Server Scaffold And Health API

**Files:**
- Create: `apps/server/package.json`
- Create: `apps/server/tsconfig.json`
- Create: `apps/server/vitest.config.ts`
- Create: `apps/server/src/app.ts`
- Create: `apps/server/src/index.ts`
- Create: `apps/server/src/config/env.ts`
- Create: `apps/server/tests/api.test.ts`

- [ ] **Step 1: Write failing server health test**

Create `apps/server/tests/api.test.ts`:

```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';

describe('server api', () => {
  it('returns health status', async () => {
    const app = createApp();

    await request(app.callback())
      .get('/api/health')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ ok: true, service: 'yunlan-guide-api' });
      });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm --workspace apps/server run test -- api.test.ts
```

Expected: command fails because `apps/server/package.json` and `createApp` do not exist.

- [ ] **Step 3: Create server package and config**

Create `apps/server/package.json`:

```json
{
  "name": "@yunlan/server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@koa/cors": "^5.0.0",
    "@koa/router": "^13.1.0",
    "dotenv": "^16.4.7",
    "koa": "^2.16.1",
    "koa-bodyparser": "^4.4.1"
  },
  "devDependencies": {
    "@types/koa": "^2.15.0",
    "@types/koa__cors": "^5.0.0",
    "@types/koa__router": "^12.0.4",
    "@types/koa-bodyparser": "^4.3.12",
    "@types/node": "^22.13.1",
    "@types/supertest": "^6.0.2",
    "supertest": "^7.0.0",
    "tsx": "^4.19.2",
    "vitest": "^3.0.5"
  }
}
```

Create `apps/server/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "types": ["node"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["dist", "tests"]
}
```

Create `apps/server/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false
  }
});
```

Create `apps/server/src/config/env.ts`:

```ts
import dotenv from 'dotenv';

dotenv.config();

export type ServerEnv = {
  port: number;
  llmBaseUrl: string;
  llmApiKey: string;
  llmModel: string;
};

export function readEnv(): ServerEnv {
  return {
    port: Number(process.env.PORT ?? 8787),
    llmBaseUrl: process.env.LLM_BASE_URL ?? '',
    llmApiKey: process.env.LLM_API_KEY ?? '',
    llmModel: process.env.LLM_MODEL ?? 'gpt-4o-mini'
  };
}
```

Create `apps/server/src/app.ts`:

```ts
import cors from '@koa/cors';
import Router from '@koa/router';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';

export function createApp(): Koa {
  const app = new Koa();
  const router = new Router();

  router.get('/api/health', (ctx) => {
    ctx.body = { ok: true, service: 'yunlan-guide-api' };
  });

  app.use(cors());
  app.use(bodyParser());
  app.use(router.routes());
  app.use(router.allowedMethods());

  return app;
}
```

Create `apps/server/src/index.ts`:

```ts
import { createApp } from './app.js';
import { readEnv } from './config/env.js';

const env = readEnv();
const app = createApp();

app.listen(env.port, () => {
  console.log(`Yunlan guide API listening on http://localhost:${env.port}`);
});
```

- [ ] **Step 4: Install workspace dependencies**

Run:

```powershell
npm install
```

Expected: npm exits with code 0 and updates `package-lock.json`.

- [ ] **Step 5: Run test to verify it passes**

Run:

```powershell
npm --workspace apps/server run test -- api.test.ts
```

Expected: one test passes.

- [ ] **Step 6: Commit**

```powershell
git add apps/server package.json package-lock.json
git commit -m "feat: scaffold koa api"
```

---

### Task 3: Scenic Data Module

**Files:**
- Create: `apps/server/src/types/scenic.ts`
- Create: `apps/server/src/data/yunlan-town.json`
- Create: `apps/server/src/modules/scenic/scenic-data.ts`
- Create: `apps/server/src/modules/scenic/scenic.routes.ts`
- Modify: `apps/server/src/app.ts`
- Create: `apps/server/tests/scenic-data.test.ts`

- [ ] **Step 1: Write failing scenic data tests**

Create `apps/server/tests/scenic-data.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getScenicAreaSummary, loadScenicData } from '../src/modules/scenic/scenic-data';

describe('scenic data', () => {
  it('loads Yunlan town data with required content counts', () => {
    const data = loadScenicData();

    expect(data.scenicArea.name).toBe('云岚古镇');
    expect(data.spots).toHaveLength(5);
    expect(data.routes).toHaveLength(2);
    expect(data.services).toHaveLength(5);
    expect(data.faqs.length).toBeGreaterThanOrEqual(4);
  });

  it('returns a public summary without long story fields', () => {
    const summary = getScenicAreaSummary();

    expect(summary.scenicArea.id).toBe('yunlan-town');
    expect(summary.spots[0]).toEqual({
      id: 'south-gate',
      name: '南门牌坊',
      summary: '云岚古镇的入口地标，牌坊纹样记录着古镇水路商贸的起源。'
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm --workspace apps/server run test -- scenic-data.test.ts
```

Expected: FAIL because scenic module files do not exist.

- [ ] **Step 3: Add scenic types**

Create `apps/server/src/types/scenic.ts`:

```ts
export type ScenicAreaInfo = {
  id: string;
  name: string;
  description: string;
  openingHours: string;
  ticketInfo: string;
};

export type ScenicSpot = {
  id: string;
  name: string;
  summary: string;
  story: string;
  recommendedDurationMinutes: number;
};

export type RouteStep = {
  spotId: string;
  title: string;
  durationMinutes: number;
  description: string;
};

export type ScenicRoute = {
  id: string;
  name: string;
  duration: string;
  description: string;
  steps: RouteStep[];
};

export type ScenicService = {
  id: string;
  name: string;
  type: 'visitor-center' | 'parking' | 'restroom' | 'food' | 'medical';
  description: string;
};

export type ScenicFaq = {
  question: string;
  answer: string;
};

export type ScenicData = {
  scenicArea: ScenicAreaInfo;
  spots: ScenicSpot[];
  routes: ScenicRoute[];
  services: ScenicService[];
  faqs: ScenicFaq[];
};

export type ScenicAreaSummary = {
  scenicArea: ScenicAreaInfo;
  spots: Pick<ScenicSpot, 'id' | 'name' | 'summary'>[];
  routes: Pick<ScenicRoute, 'id' | 'name' | 'duration' | 'description'>[];
  services: ScenicService[];
  quickQuestions: string[];
};
```

- [ ] **Step 4: Add Yunlan scenic JSON**

Create `apps/server/src/data/yunlan-town.json`:

```json
{
  "scenicArea": {
    "id": "yunlan-town",
    "name": "云岚古镇",
    "description": "一座以水巷、古桥、茶坊、灯巷和戏台文化为特色的虚拟古镇。",
    "openingHours": "09:00-21:00",
    "ticketInfo": "成人票 60 元，儿童与老人按景区规则优惠。"
  },
  "spots": [
    {
      "id": "south-gate",
      "name": "南门牌坊",
      "summary": "云岚古镇的入口地标，牌坊纹样记录着古镇水路商贸的起源。",
      "story": "南门牌坊建在古镇南侧水陆交汇处。相传早年商船沿云岚河停靠，茶叶、丝绸和木雕都从这里进入镇中。牌坊上的云纹和水纹象征古镇因水而兴。",
      "recommendedDurationMinutes": 20
    },
    {
      "id": "yunlan-bridge",
      "name": "云岚古桥",
      "summary": "横跨内河的石拱桥，是古镇最适合听故事和拍照的位置。",
      "story": "云岚古桥以青石砌成，桥身微拱。传说镇上的第一家茶坊就开在桥边，往来商旅常在桥头交换消息，因此这里也被称作古镇的消息口。",
      "recommendedDurationMinutes": 30
    },
    {
      "id": "tea-lane",
      "name": "茶坊小巷",
      "summary": "保留老茶坊和手作铺的巷子，适合休息与体验非遗。",
      "story": "茶坊小巷两侧是低矮木楼，午后常有茶香。巷内的老茶坊会演示云岚烘茶和木印糕制作，是了解古镇生活气息的地方。",
      "recommendedDurationMinutes": 40
    },
    {
      "id": "river-lantern-lane",
      "name": "河畔灯巷",
      "summary": "沿河灯笼与白墙黛瓦相映，是傍晚拍照的推荐点。",
      "story": "河畔灯巷在傍晚最有氛围。过去居民会在节庆时把手写愿望挂在灯笼下，灯影映在水面上，被称为云岚夜色。",
      "recommendedDurationMinutes": 35
    },
    {
      "id": "rain-listening-stage",
      "name": "听雨戏台",
      "summary": "古镇公共演艺空间，适合收尾休息并了解地方戏曲。",
      "story": "听雨戏台面向一片小广场。雨天时瓦檐落雨声会和戏腔混在一起，因此得名。现在这里常安排评弹、折子戏和民俗小演出。",
      "recommendedDurationMinutes": 45
    }
  ],
  "routes": [
    {
      "id": "half-day-classic",
      "name": "半日经典路线",
      "duration": "约 3 小时",
      "description": "适合第一次到访的游客，覆盖入口、古桥、茶坊、灯巷和戏台。",
      "steps": [
        {
          "spotId": "south-gate",
          "title": "从南门牌坊进入",
          "durationMinutes": 20,
          "description": "先了解古镇整体历史和游览动线。"
        },
        {
          "spotId": "yunlan-bridge",
          "title": "到云岚古桥听古镇起源故事",
          "durationMinutes": 30,
          "description": "这里适合拍照，也适合讲水路商贸和古桥传说。"
        },
        {
          "spotId": "tea-lane",
          "title": "在茶坊小巷休息",
          "durationMinutes": 40,
          "description": "可以体验茶点和手作铺，节奏轻松。"
        },
        {
          "spotId": "river-lantern-lane",
          "title": "沿河畔灯巷慢走",
          "durationMinutes": 35,
          "description": "傍晚灯笼亮起时最适合拍照。"
        },
        {
          "spotId": "rain-listening-stage",
          "title": "在听雨戏台收尾",
          "durationMinutes": 45,
          "description": "休息并了解地方戏曲和民俗演出。"
        }
      ]
    },
    {
      "id": "family-easy",
      "name": "亲子轻松路线",
      "duration": "约 2 小时",
      "description": "适合带小孩的游客，减少长距离步行，增加休息点。",
      "steps": [
        {
          "spotId": "south-gate",
          "title": "南门牌坊集合",
          "durationMinutes": 15,
          "description": "用简单故事介绍古镇入口。"
        },
        {
          "spotId": "tea-lane",
          "title": "茶坊小巷体验手作",
          "durationMinutes": 45,
          "description": "孩子可以了解木印糕和茶点制作。"
        },
        {
          "spotId": "rain-listening-stage",
          "title": "听雨戏台看小演出",
          "durationMinutes": 40,
          "description": "坐下休息，观看短时民俗演出。"
        }
      ]
    }
  ],
  "services": [
    {
      "id": "visitor-center",
      "name": "游客中心",
      "type": "visitor-center",
      "description": "位于南门内侧，提供咨询、寄存和失物招领。"
    },
    {
      "id": "south-parking",
      "name": "南门停车场",
      "type": "parking",
      "description": "靠近南门牌坊，适合自驾游客停车。"
    },
    {
      "id": "bridge-restroom",
      "name": "古桥公共厕所",
      "type": "restroom",
      "description": "位于云岚古桥东侧，距离主游线较近。"
    },
    {
      "id": "snack-street",
      "name": "云岚小吃街",
      "type": "food",
      "description": "靠近茶坊小巷，提供茶点、糕团和简餐。"
    },
    {
      "id": "service-station",
      "name": "医务点/服务站",
      "type": "medical",
      "description": "位于听雨戏台旁，提供基础应急帮助。"
    }
  ],
  "faqs": [
    {
      "question": "云岚古镇几点开放？",
      "answer": "云岚古镇开放时间为 09:00-21:00。"
    },
    {
      "question": "门票多少钱？",
      "answer": "成人票 60 元，儿童与老人按景区规则优惠。"
    },
    {
      "question": "哪里适合拍照？",
      "answer": "推荐云岚古桥和河畔灯巷，傍晚灯巷氛围最好。"
    },
    {
      "question": "带小孩怎么玩？",
      "answer": "推荐亲子轻松路线：南门牌坊、茶坊小巷、听雨戏台。"
    }
  ]
}
```

- [ ] **Step 5: Implement scenic data loader and route**

Create `apps/server/src/modules/scenic/scenic-data.ts`:

```ts
import scenicJson from '../../data/yunlan-town.json' assert { type: 'json' };
import type { ScenicAreaSummary, ScenicData } from '../../types/scenic.js';

const scenicData = scenicJson as ScenicData;

export function loadScenicData(): ScenicData {
  return scenicData;
}

export function getScenicAreaSummary(): ScenicAreaSummary {
  return {
    scenicArea: scenicData.scenicArea,
    spots: scenicData.spots.map(({ id, name, summary }) => ({ id, name, summary })),
    routes: scenicData.routes.map(({ id, name, duration, description }) => ({
      id,
      name,
      duration,
      description
    })),
    services: scenicData.services,
    quickQuestions: [
      '帮我规划一条半日游路线',
      '这里有什么必看的景点？',
      '给我讲讲云岚古桥的故事',
      '附近哪里有厕所和吃饭的地方？',
      '我带小孩来玩，有什么推荐？'
    ]
  };
}
```

Create `apps/server/src/modules/scenic/scenic.routes.ts`:

```ts
import Router from '@koa/router';
import { getScenicAreaSummary } from './scenic-data.js';

export function createScenicRouter(): Router {
  const router = new Router({ prefix: '/api/scenic-area' });

  router.get('/', (ctx) => {
    ctx.body = getScenicAreaSummary();
  });

  return router;
}
```

Modify `apps/server/src/app.ts`:

```ts
import cors from '@koa/cors';
import Router from '@koa/router';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import { createScenicRouter } from './modules/scenic/scenic.routes.js';

export function createApp(): Koa {
  const app = new Koa();
  const router = new Router();

  router.get('/api/health', (ctx) => {
    ctx.body = { ok: true, service: 'yunlan-guide-api' };
  });

  app.use(cors());
  app.use(bodyParser());
  app.use(router.routes());
  app.use(router.allowedMethods());
  app.use(createScenicRouter().routes());
  app.use(createScenicRouter().allowedMethods());

  return app;
}
```

- [ ] **Step 6: Run scenic tests**

Run:

```powershell
npm --workspace apps/server run test -- scenic-data.test.ts
```

Expected: two tests pass.

- [ ] **Step 7: Add API test for scenic endpoint**

Append to `apps/server/tests/api.test.ts`:

```ts
it('returns scenic area summary', async () => {
  const app = createApp();

  await request(app.callback())
    .get('/api/scenic-area')
    .expect(200)
    .expect(({ body }) => {
      expect(body.scenicArea.name).toBe('云岚古镇');
      expect(body.quickQuestions).toContain('帮我规划一条半日游路线');
    });
});
```

- [ ] **Step 8: Run API tests**

Run:

```powershell
npm --workspace apps/server run test -- api.test.ts
```

Expected: health and scenic endpoint tests pass.

- [ ] **Step 9: Commit**

```powershell
git add apps/server/src apps/server/tests
git commit -m "feat: add yunlan scenic data"
```

---

### Task 4: Guide Service, LLM Client, And Chat API

**Files:**
- Create: `apps/server/src/modules/guide/llm-client.ts`
- Create: `apps/server/src/modules/guide/guide.service.ts`
- Create: `apps/server/src/modules/guide/guide.routes.ts`
- Modify: `apps/server/src/app.ts`
- Create: `apps/server/tests/guide.service.test.ts`
- Modify: `apps/server/tests/api.test.ts`

- [ ] **Step 1: Write failing guide service tests**

Create `apps/server/tests/guide.service.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { LlmClient } from '../src/modules/guide/llm-client';
import { createGuideService } from '../src/modules/guide/guide.service';
import { loadScenicData } from '../src/modules/scenic/scenic-data';

describe('guide service', () => {
  it('returns route cards for the half-day route question', async () => {
    const llm: LlmClient = {
      complete: async () => '推荐你走半日经典路线，从南门牌坊开始，到云岚古桥、茶坊小巷、河畔灯巷，最后在听雨戏台收尾。'
    };
    const service = createGuideService({ llm, scenicData: loadScenicData() });

    const result = await service.ask('帮我规划一条半日游路线');

    expect(result.answer).toContain('半日经典路线');
    expect(result.cards).toHaveLength(5);
    expect(result.cards[0]).toEqual({
      type: 'route-step',
      title: '从南门牌坊进入',
      duration: '20 分钟',
      description: '先了解古镇整体历史和游览动线。'
    });
  });

  it('limits unrelated questions to Yunlan town scope', async () => {
    const llm: LlmClient = {
      complete: async () => '当前资料里没有明确记录，我只能回答云岚古镇相关的导览问题。'
    };
    const service = createGuideService({ llm, scenicData: loadScenicData() });

    const result = await service.ask('帮我写一段股票投资建议');

    expect(result.answer).toContain('云岚古镇');
    expect(result.cards).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm --workspace apps/server run test -- guide.service.test.ts
```

Expected: FAIL because guide module files do not exist.

- [ ] **Step 3: Add LLM client**

Create `apps/server/src/modules/guide/llm-client.ts`:

```ts
export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type LlmClient = {
  complete(messages: ChatMessage[]): Promise<string>;
};

export type OpenAiCompatibleClientOptions = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

export function createOpenAiCompatibleClient(options: OpenAiCompatibleClientOptions): LlmClient {
  return {
    async complete(messages) {
      if (!options.baseUrl || !options.apiKey || !options.model) {
        throw new Error('LLM configuration is missing');
      }

      const response = await fetch(`${options.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: options.model,
          messages,
          temperature: 0.4
        })
      });

      if (!response.ok) {
        throw new Error(`LLM request failed with status ${response.status}`);
      }

      const data = (await response.json()) as ChatCompletionResponse;
      const content = data.choices?.[0]?.message?.content?.trim();

      if (!content) {
        throw new Error('LLM response did not include answer content');
      }

      return content;
    }
  };
}
```

- [ ] **Step 4: Add guide service**

Create `apps/server/src/modules/guide/guide.service.ts`:

```ts
import type { ScenicData, ScenicRoute } from '../../types/scenic.js';
import type { LlmClient } from './llm-client.js';

export type RouteCard = {
  type: 'route-step';
  title: string;
  duration: string;
  description: string;
};

export type GuideAnswer = {
  answer: string;
  cards: RouteCard[];
  source: 'llm';
};

export type GuideService = {
  ask(message: string): Promise<GuideAnswer>;
};

type GuideServiceOptions = {
  llm: LlmClient;
  scenicData: ScenicData;
};

export function createGuideService(options: GuideServiceOptions): GuideService {
  return {
    async ask(message) {
      const trimmed = message.trim();

      if (!trimmed) {
        throw new Error('EMPTY_MESSAGE');
      }

      const answer = await options.llm.complete([
        {
          role: 'system',
          content: createSystemPrompt(options.scenicData)
        },
        {
          role: 'user',
          content: trimmed
        }
      ]);

      return {
        answer,
        cards: shouldReturnHalfDayRoute(trimmed) ? routeToCards(findHalfDayRoute(options.scenicData)) : [],
        source: 'llm'
      };
    }
  };
}

function createSystemPrompt(data: ScenicData): string {
  return [
    '你是云岚古镇的 AI 数字导游，性格像年轻旅伴，但回答要准确、清楚、有导游专业感。',
    '你只能回答云岚古镇相关问题。遇到资料中没有的信息，请说“当前资料里没有明确记录”。',
    '不要编造门票、开放时间、医疗、停车等关键事实。',
    '游客询问路线时，优先使用资料中的路线。',
    `景区资料：${JSON.stringify(data)}`
  ].join('\n');
}

function shouldReturnHalfDayRoute(message: string): boolean {
  return message.includes('半日') || message.includes('路线') || message.includes('规划');
}

function findHalfDayRoute(data: ScenicData): ScenicRoute {
  const route = data.routes.find((item) => item.id === 'half-day-classic');

  if (!route) {
    throw new Error('HALF_DAY_ROUTE_MISSING');
  }

  return route;
}

function routeToCards(route: ScenicRoute): RouteCard[] {
  return route.steps.map((step) => ({
    type: 'route-step',
    title: step.title,
    duration: `${step.durationMinutes} 分钟`,
    description: step.description
  }));
}
```

- [ ] **Step 5: Run guide service tests**

Run:

```powershell
npm --workspace apps/server run test -- guide.service.test.ts
```

Expected: two tests pass.

- [ ] **Step 6: Add guide API route**

Create `apps/server/src/modules/guide/guide.routes.ts`:

```ts
import Router from '@koa/router';
import { readEnv } from '../../config/env.js';
import { loadScenicData } from '../scenic/scenic-data.js';
import { createGuideService } from './guide.service.js';
import { createOpenAiCompatibleClient } from './llm-client.js';

type ChatRequestBody = {
  message?: string;
  conversationId?: string;
};

export function createGuideRouter(): Router {
  const router = new Router({ prefix: '/api/guide' });

  router.post('/chat', async (ctx) => {
    const body = ctx.request.body as ChatRequestBody;
    const message = body.message?.trim() ?? '';

    if (!message) {
      ctx.status = 400;
      ctx.body = {
        code: 'EMPTY_MESSAGE',
        message: '请输入想咨询的问题。'
      };
      return;
    }

    const env = readEnv();
    const service = createGuideService({
      scenicData: loadScenicData(),
      llm: createOpenAiCompatibleClient({
        baseUrl: env.llmBaseUrl,
        apiKey: env.llmApiKey,
        model: env.llmModel
      })
    });

    try {
      ctx.body = await service.ask(message);
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
      ctx.status = messageText === 'LLM configuration is missing' ? 500 : 502;
      ctx.body = {
        code: 'GUIDE_CHAT_FAILED',
        message: '数字导游暂时没有回答成功，请稍后再试。',
        detail: messageText
      };
    }
  });

  return router;
}
```

Modify `apps/server/src/app.ts`:

```ts
import cors from '@koa/cors';
import Router from '@koa/router';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import { createGuideRouter } from './modules/guide/guide.routes.js';
import { createScenicRouter } from './modules/scenic/scenic.routes.js';

export function createApp(): Koa {
  const app = new Koa();
  const router = new Router();
  const scenicRouter = createScenicRouter();
  const guideRouter = createGuideRouter();

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
```

- [ ] **Step 7: Add chat API validation test**

Append to `apps/server/tests/api.test.ts`:

```ts
it('rejects empty guide chat message', async () => {
  const app = createApp();

  await request(app.callback())
    .post('/api/guide/chat')
    .send({ message: '' })
    .expect(400)
    .expect(({ body }) => {
      expect(body.code).toBe('EMPTY_MESSAGE');
    });
});
```

- [ ] **Step 8: Run server tests**

Run:

```powershell
npm --workspace apps/server run test
```

Expected: all server tests pass.

- [ ] **Step 9: Commit**

```powershell
git add apps/server/src apps/server/tests
git commit -m "feat: add guide chat service"
```

---

### Task 5: API Documentation

**Files:**
- Create: `apps/server/docs/api.md`
- Modify: `README.md`

- [ ] **Step 1: Write API documentation**

Create `apps/server/docs/api.md`:

```md
# 云岚古镇 API 文档

后端默认地址：`http://localhost:8787`

## GET /api/health

健康检查。

### 响应

```json
{
  "ok": true,
  "service": "yunlan-guide-api"
}
```

## GET /api/scenic-area

返回云岚古镇公开导览资料。

### 响应字段

- `scenicArea`：景区名称、介绍、开放时间、票务信息。
- `spots`：景点摘要列表。
- `routes`：路线摘要列表。
- `services`：服务点列表。
- `quickQuestions`：前端快捷问题。

## POST /api/guide/chat

向数字导游提问。

### 请求

```json
{
  "message": "帮我规划一条半日游路线",
  "conversationId": "optional-session-id"
}
```

### 成功响应

```json
{
  "answer": "推荐你走半日经典路线，从南门牌坊开始，到云岚古桥、茶坊小巷、河畔灯巷，最后在听雨戏台收尾。",
  "cards": [
    {
      "type": "route-step",
      "title": "从南门牌坊进入",
      "duration": "20 分钟",
      "description": "先了解古镇整体历史和游览动线。"
    }
  ],
  "source": "llm"
}
```

### 错误响应

空问题：

```json
{
  "code": "EMPTY_MESSAGE",
  "message": "请输入想咨询的问题。"
}
```

LLM 调用失败：

```json
{
  "code": "GUIDE_CHAT_FAILED",
  "message": "数字导游暂时没有回答成功，请稍后再试。",
  "detail": "LLM request failed with status 401"
}
```
```

- [ ] **Step 2: Update README doc links**

Ensure `README.md` contains:

```md
## 文档

- 设计规格：`docs/superpowers/specs/2026-07-19-yunlan-ancient-town-digital-guide-design.md`
- 实施计划：`docs/superpowers/plans/2026-07-19-yunlan-digital-guide-implementation.md`
- 接口文档：`apps/server/docs/api.md`
```

- [ ] **Step 3: Commit**

```powershell
git add README.md apps/server/docs/api.md
git commit -m "docs: add api documentation"
```

---

### Task 6: Web Scaffold And API Client

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/index.html`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/src/types/guide.ts`
- Create: `apps/web/src/api/guideApi.ts`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/styles.css`

- [ ] **Step 1: Create web package**

Create `apps/web/package.json`:

```json
{
  "name": "@yunlan/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -p tsconfig.json && vite build",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "lucide-react": "^0.468.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "three": "^0.171.0",
    "vite": "^6.0.7"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^19.0.2",
    "@types/react-dom": "^19.0.2",
    "@types/three": "^0.171.0",
    "jsdom": "^25.0.1",
    "vitest": "^3.0.5"
  }
}
```

Create `apps/web/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "types": ["vite/client", "vitest/globals"]
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "tests/**/*.ts", "tests/**/*.tsx", "vite.config.ts", "vitest.config.ts"]
}
```

Create `apps/web/vite.config.ts`:

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8787'
    }
  }
});
```

Create `apps/web/vitest.config.ts`:

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: []
  }
});
```

Create `apps/web/index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>云岚古镇 AI 数字导游</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Add guide types and API client**

Create `apps/web/src/types/guide.ts`:

```ts
export type ScenicAreaInfo = {
  id: string;
  name: string;
  description: string;
  openingHours: string;
  ticketInfo: string;
};

export type RouteCard = {
  type: 'route-step';
  title: string;
  duration: string;
  description: string;
};

export type ScenicAreaSummary = {
  scenicArea: ScenicAreaInfo;
  spots: Array<{ id: string; name: string; summary: string }>;
  routes: Array<{ id: string; name: string; duration: string; description: string }>;
  services: Array<{ id: string; name: string; type: string; description: string }>;
  quickQuestions: string[];
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export type GuideChatResponse = {
  answer: string;
  cards: RouteCard[];
  source: 'llm';
};
```

Create `apps/web/src/api/guideApi.ts`:

```ts
import type { GuideChatResponse, ScenicAreaSummary } from '../types/guide';

export async function fetchScenicArea(): Promise<ScenicAreaSummary> {
  const response = await fetch('/api/scenic-area');

  if (!response.ok) {
    throw new Error('景区资料加载失败');
  }

  return (await response.json()) as ScenicAreaSummary;
}

export async function askGuide(message: string): Promise<GuideChatResponse> {
  const response = await fetch('/api/guide/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ message })
  });

  if (!response.ok) {
    throw new Error('数字导游暂时没有回答成功');
  }

  return (await response.json()) as GuideChatResponse;
}
```

- [ ] **Step 3: Add minimal React entry**

Create `apps/web/src/App.tsx`:

```tsx
import './styles.css';

export function App() {
  return (
    <main className="app-shell">
      <section className="guide-panel">
        <p className="eyebrow">Yunlan Ancient Town</p>
        <h1>云岚古镇 AI 数字导游</h1>
        <p>正在准备导览服务...</p>
      </section>
      <section className="digital-human-panel" aria-label="3D 数字人展示区">
        <div className="stage-placeholder">3D 数字人</div>
      </section>
    </main>
  );
}
```

Create `apps/web/src/main.tsx`:

```tsx
import { createRoot } from 'react-dom/client';
import { App } from './App';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

createRoot(root).render(<App />);
```

Create `apps/web/src/styles.css`:

```css
:root {
  color: #15201d;
  background: #f5f1e8;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
}

button,
input {
  font: inherit;
}

.app-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(360px, 0.9fr) minmax(420px, 1.1fr);
  background:
    linear-gradient(120deg, rgba(255, 255, 255, 0.82), rgba(236, 242, 231, 0.72)),
    #f5f1e8;
}

.guide-panel {
  padding: 32px;
  border-right: 1px solid rgba(42, 70, 56, 0.16);
  overflow-y: auto;
}

.digital-human-panel {
  min-height: 100vh;
  display: flex;
  align-items: stretch;
  justify-content: stretch;
  background: #dbe6db;
}

.stage-placeholder {
  flex: 1;
  display: grid;
  place-items: center;
  color: #315548;
}

.eyebrow {
  margin: 0 0 8px;
  color: #60756a;
  font-size: 0.82rem;
  text-transform: uppercase;
}

h1 {
  margin: 0 0 12px;
  font-size: 2rem;
  line-height: 1.2;
}

@media (max-width: 860px) {
  .app-shell {
    grid-template-columns: 1fr;
  }

  .digital-human-panel {
    min-height: 420px;
  }
}
```

- [ ] **Step 4: Install and build web**

Run:

```powershell
npm install
npm --workspace apps/web run build
```

Expected: `apps/web/dist` is created and build exits with code 0.

- [ ] **Step 5: Commit**

```powershell
git add apps/web package.json package-lock.json
git commit -m "feat: scaffold react app"
```

---

### Task 7: Guide Panel Components And Chat State

**Files:**
- Create: `apps/web/src/hooks/useGuideChat.ts`
- Create: `apps/web/src/components/QuickQuestions.tsx`
- Create: `apps/web/src/components/ChatMessages.tsx`
- Create: `apps/web/src/components/RouteCards.tsx`
- Create: `apps/web/src/components/QuestionInput.tsx`
- Create: `apps/web/src/components/GuidePanel.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/styles.css`
- Create: `apps/web/tests/GuidePanel.test.tsx`

- [ ] **Step 1: Write failing GuidePanel test**

Create `apps/web/tests/GuidePanel.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GuidePanel } from '../src/components/GuidePanel';
import type { ScenicAreaSummary } from '../src/types/guide';

const scenicArea: ScenicAreaSummary = {
  scenicArea: {
    id: 'yunlan-town',
    name: '云岚古镇',
    description: '虚拟古镇',
    openingHours: '09:00-21:00',
    ticketInfo: '成人票 60 元'
  },
  spots: [],
  routes: [],
  services: [],
  quickQuestions: ['帮我规划一条半日游路线']
};

describe('GuidePanel', () => {
  it('submits a quick question', async () => {
    const onAsk = vi.fn();

    render(
      <GuidePanel
        scenicArea={scenicArea}
        messages={[]}
        routeCards={[]}
        loading={false}
        error={null}
        onAsk={onAsk}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: '帮我规划一条半日游路线' }));

    expect(onAsk).toHaveBeenCalledWith('帮我规划一条半日游路线');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm --workspace apps/web run test -- GuidePanel.test.tsx
```

Expected: FAIL because `GuidePanel` does not exist.

- [ ] **Step 3: Implement chat hook**

Create `apps/web/src/hooks/useGuideChat.ts`:

```ts
import { useCallback, useState } from 'react';
import { askGuide } from '../api/guideApi';
import type { ChatMessage, RouteCard } from '../types/guide';

export function useGuideChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [routeCards, setRouteCards] = useState<RouteCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = useCallback(async (message: string) => {
    const trimmed = message.trim();

    if (!trimmed || loading) {
      return;
    }

    setLoading(true);
    setError(null);
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: 'user', content: trimmed }
    ]);

    try {
      const response = await askGuide(trimmed);
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: 'assistant', content: response.answer }
      ]);
      setRouteCards(response.cards);
    } catch (caught) {
      const messageText = caught instanceof Error ? caught.message : '数字导游暂时没有回答成功';
      setError(messageText);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  return {
    messages,
    routeCards,
    loading,
    error,
    ask
  };
}
```

- [ ] **Step 4: Implement components**

Create `apps/web/src/components/QuickQuestions.tsx`:

```tsx
type QuickQuestionsProps = {
  questions: string[];
  disabled: boolean;
  onAsk: (question: string) => void;
};

export function QuickQuestions({ questions, disabled, onAsk }: QuickQuestionsProps) {
  return (
    <div className="quick-questions" aria-label="快捷问题">
      {questions.map((question) => (
        <button key={question} type="button" disabled={disabled} onClick={() => onAsk(question)}>
          {question}
        </button>
      ))}
    </div>
  );
}
```

Create `apps/web/src/components/ChatMessages.tsx`:

```tsx
import type { ChatMessage } from '../types/guide';

type ChatMessagesProps = {
  messages: ChatMessage[];
};

export function ChatMessages({ messages }: ChatMessagesProps) {
  return (
    <div className="chat-messages" aria-label="聊天记录">
      {messages.length === 0 ? (
        <p className="empty-state">可以先问我：“帮我规划一条半日游路线”。</p>
      ) : (
        messages.map((message) => (
          <article key={message.id} className={`message message-${message.role}`}>
            <span>{message.role === 'user' ? '游客' : '数字导游'}</span>
            <p>{message.content}</p>
          </article>
        ))
      )}
    </div>
  );
}
```

Create `apps/web/src/components/RouteCards.tsx`:

```tsx
import type { RouteCard } from '../types/guide';

type RouteCardsProps = {
  cards: RouteCard[];
};

export function RouteCards({ cards }: RouteCardsProps) {
  if (cards.length === 0) {
    return <p className="empty-state">路线卡片会在规划路线后出现。</p>;
  }

  return (
    <div className="route-cards" aria-label="路线步骤卡片">
      {cards.map((card, index) => (
        <article key={`${card.title}-${index}`} className="route-card">
          <span>{String(index + 1).padStart(2, '0')}</span>
          <div>
            <h3>{card.title}</h3>
            <p className="route-duration">{card.duration}</p>
            <p>{card.description}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
```

Create `apps/web/src/components/QuestionInput.tsx`:

```tsx
import { Send } from 'lucide-react';
import { FormEvent, useState } from 'react';

type QuestionInputProps = {
  disabled: boolean;
  onAsk: (question: string) => void;
};

export function QuestionInput({ disabled, onAsk }: QuestionInputProps) {
  const [value, setValue] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = value.trim();

    if (!trimmed) {
      return;
    }

    onAsk(trimmed);
    setValue('');
  }

  return (
    <form className="question-input" onSubmit={handleSubmit}>
      <input
        aria-label="输入问题"
        value={value}
        disabled={disabled}
        placeholder="问问云岚古镇怎么玩..."
        onChange={(event) => setValue(event.target.value)}
      />
      <button type="submit" disabled={disabled || !value.trim()} aria-label="发送问题">
        <Send size={18} />
      </button>
    </form>
  );
}
```

Create `apps/web/src/components/GuidePanel.tsx`:

```tsx
import type { ChatMessage, RouteCard, ScenicAreaSummary } from '../types/guide';
import { ChatMessages } from './ChatMessages';
import { QuestionInput } from './QuestionInput';
import { QuickQuestions } from './QuickQuestions';
import { RouteCards } from './RouteCards';

type GuidePanelProps = {
  scenicArea: ScenicAreaSummary;
  messages: ChatMessage[];
  routeCards: RouteCard[];
  loading: boolean;
  error: string | null;
  onAsk: (question: string) => void;
};

export function GuidePanel({
  scenicArea,
  messages,
  routeCards,
  loading,
  error,
  onAsk
}: GuidePanelProps) {
  return (
    <section className="guide-panel">
      <p className="eyebrow">Yunlan Ancient Town</p>
      <h1>{scenicArea.scenicArea.name} AI 数字导游</h1>
      <p className="intro">{scenicArea.scenicArea.description}</p>
      <div className="meta-row">
        <span>{scenicArea.scenicArea.openingHours}</span>
        <span>{scenicArea.scenicArea.ticketInfo}</span>
      </div>
      <QuickQuestions questions={scenicArea.quickQuestions} disabled={loading} onAsk={onAsk} />
      <ChatMessages messages={messages} />
      {error ? <p className="error-text">{error}</p> : null}
      <QuestionInput disabled={loading} onAsk={onAsk} />
      <RouteCards cards={routeCards} />
    </section>
  );
}
```

- [ ] **Step 5: Wire App to scenic data and chat**

Modify `apps/web/src/App.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { fetchScenicArea } from './api/guideApi';
import { GuidePanel } from './components/GuidePanel';
import { useGuideChat } from './hooks/useGuideChat';
import type { ScenicAreaSummary } from './types/guide';
import './styles.css';

export function App() {
  const [scenicArea, setScenicArea] = useState<ScenicAreaSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const chat = useGuideChat();

  useEffect(() => {
    fetchScenicArea()
      .then(setScenicArea)
      .catch(() => setLoadError('景区资料加载失败，请确认后端服务已启动。'));
  }, []);

  if (loadError) {
    return <main className="app-shell app-centered">{loadError}</main>;
  }

  if (!scenicArea) {
    return <main className="app-shell app-centered">正在加载云岚古镇资料...</main>;
  }

  return (
    <main className="app-shell">
      <GuidePanel
        scenicArea={scenicArea}
        messages={chat.messages}
        routeCards={chat.routeCards}
        loading={chat.loading}
        error={chat.error}
        onAsk={chat.ask}
      />
      <section className="digital-human-panel" aria-label="3D 数字人展示区">
        <div className="stage-placeholder">3D 数字人</div>
      </section>
    </main>
  );
}
```

- [ ] **Step 6: Add component styles**

Append to `apps/web/src/styles.css`:

```css
.app-centered {
  display: grid;
  place-items: center;
  padding: 32px;
}

.intro {
  color: #4e655a;
  line-height: 1.7;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 18px 0;
}

.meta-row span,
.quick-questions button {
  border: 1px solid rgba(42, 70, 56, 0.18);
  background: rgba(255, 255, 255, 0.72);
  border-radius: 8px;
  padding: 8px 10px;
}

.quick-questions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 20px 0;
}

.quick-questions button,
.question-input button {
  cursor: pointer;
}

.quick-questions button:hover:not(:disabled),
.question-input button:hover:not(:disabled) {
  border-color: #4b7f62;
}

.chat-messages {
  display: grid;
  gap: 12px;
  min-height: 180px;
}

.message {
  border-radius: 8px;
  padding: 12px;
  line-height: 1.7;
}

.message span {
  display: block;
  margin-bottom: 6px;
  color: #60756a;
  font-size: 0.82rem;
}

.message p {
  margin: 0;
}

.message-user {
  background: #e9f1e7;
}

.message-assistant {
  background: rgba(255, 255, 255, 0.78);
}

.question-input {
  display: grid;
  grid-template-columns: 1fr 44px;
  gap: 8px;
  margin: 18px 0;
}

.question-input input {
  min-width: 0;
  border: 1px solid rgba(42, 70, 56, 0.2);
  border-radius: 8px;
  padding: 12px;
}

.question-input button {
  display: grid;
  place-items: center;
  border: 1px solid rgba(42, 70, 56, 0.2);
  border-radius: 8px;
  background: #315548;
  color: white;
}

.route-cards {
  display: grid;
  gap: 10px;
}

.route-card {
  display: grid;
  grid-template-columns: 40px 1fr;
  gap: 12px;
  border: 1px solid rgba(42, 70, 56, 0.16);
  background: rgba(255, 255, 255, 0.76);
  border-radius: 8px;
  padding: 12px;
}

.route-card span {
  color: #7b5f35;
  font-weight: 700;
}

.route-card h3 {
  margin: 0 0 4px;
  font-size: 1rem;
}

.route-card p {
  margin: 0;
  line-height: 1.6;
}

.route-duration {
  color: #60756a;
  font-size: 0.9rem;
}

.empty-state,
.error-text {
  color: #7d6251;
  line-height: 1.6;
}

.error-text {
  color: #a03c2f;
}
```

- [ ] **Step 7: Run GuidePanel test**

Run:

```powershell
npm --workspace apps/web run test -- GuidePanel.test.tsx
```

Expected: one test passes.

- [ ] **Step 8: Build web**

Run:

```powershell
npm --workspace apps/web run build
```

Expected: build exits with code 0.

- [ ] **Step 9: Commit**

```powershell
git add apps/web/src apps/web/tests
git commit -m "feat: add guide panel"
```

---

### Task 8: Speech Synthesis And Speaking State

**Files:**
- Create: `apps/web/src/hooks/useSpeechSynthesis.ts`
- Modify: `apps/web/src/hooks/useGuideChat.ts`
- Modify: `apps/web/src/App.tsx`
- Create: `apps/web/tests/useSpeechSynthesis.test.tsx`

- [ ] **Step 1: Write speech hook test**

Create `apps/web/tests/useSpeechSynthesis.test.tsx`:

```tsx
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSpeechSynthesis } from '../src/hooks/useSpeechSynthesis';

describe('useSpeechSynthesis', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        cancel: vi.fn(),
        speak: vi.fn((utterance: SpeechSynthesisUtterance) => {
          utterance.onstart?.(new SpeechSynthesisEvent('start'));
          utterance.onend?.(new SpeechSynthesisEvent('end'));
        })
      }
    });
  });

  it('toggles speaking while speaking text', () => {
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.speak('欢迎来到云岚古镇');
    });

    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm --workspace apps/web run test -- useSpeechSynthesis.test.tsx
```

Expected: FAIL because `useSpeechSynthesis` does not exist.

- [ ] **Step 3: Implement speech hook**

Create `apps/web/src/hooks/useSpeechSynthesis.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';

export function useSpeechSynthesis() {
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const speak = useCallback(
    (text: string) => {
      if (!supported) {
        setSpeaking(false);
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = 1;
      utterance.pitch = 1.02;
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utterance);
    },
    [supported]
  );

  useEffect(() => {
    return () => {
      if (supported) {
        window.speechSynthesis.cancel();
      }
    };
  }, [supported]);

  return {
    supported,
    speaking,
    speak
  };
}
```

- [ ] **Step 4: Expose latest assistant answer in chat hook**

Modify `apps/web/src/hooks/useGuideChat.ts` return state:

```ts
import { useCallback, useState } from 'react';
import { askGuide } from '../api/guideApi';
import type { ChatMessage, RouteCard } from '../types/guide';

export function useGuideChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [routeCards, setRouteCards] = useState<RouteCard[]>([]);
  const [latestAnswer, setLatestAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = useCallback(async (message: string) => {
    const trimmed = message.trim();

    if (!trimmed || loading) {
      return;
    }

    setLoading(true);
    setError(null);
    setLatestAnswer('');
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: 'user', content: trimmed }
    ]);

    try {
      const response = await askGuide(trimmed);
      setLatestAnswer(response.answer);
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: 'assistant', content: response.answer }
      ]);
      setRouteCards(response.cards);
    } catch (caught) {
      const messageText = caught instanceof Error ? caught.message : '数字导游暂时没有回答成功';
      setError(messageText);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  return {
    messages,
    routeCards,
    latestAnswer,
    loading,
    error,
    ask
  };
}
```

- [ ] **Step 5: Wire speech into App**

Modify `apps/web/src/App.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { fetchScenicArea } from './api/guideApi';
import { GuidePanel } from './components/GuidePanel';
import { useGuideChat } from './hooks/useGuideChat';
import { useSpeechSynthesis } from './hooks/useSpeechSynthesis';
import type { ScenicAreaSummary } from './types/guide';
import './styles.css';

export function App() {
  const [scenicArea, setScenicArea] = useState<ScenicAreaSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const chat = useGuideChat();
  const speech = useSpeechSynthesis();

  useEffect(() => {
    fetchScenicArea()
      .then(setScenicArea)
      .catch(() => setLoadError('景区资料加载失败，请确认后端服务已启动。'));
  }, []);

  useEffect(() => {
    if (chat.latestAnswer) {
      speech.speak(chat.latestAnswer);
    }
  }, [chat.latestAnswer, speech]);

  if (loadError) {
    return <main className="app-shell app-centered">{loadError}</main>;
  }

  if (!scenicArea) {
    return <main className="app-shell app-centered">正在加载云岚古镇资料...</main>;
  }

  return (
    <main className="app-shell">
      <GuidePanel
        scenicArea={scenicArea}
        messages={chat.messages}
        routeCards={chat.routeCards}
        loading={chat.loading}
        error={chat.error}
        onAsk={chat.ask}
      />
      <section className="digital-human-panel" aria-label="3D 数字人展示区">
        <div className="stage-placeholder">
          {speech.speaking ? '数字导游正在讲解' : '3D 数字人'}
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 6: Run web tests**

Run:

```powershell
npm --workspace apps/web run test
```

Expected: all web tests pass.

- [ ] **Step 7: Commit**

```powershell
git add apps/web/src apps/web/tests
git commit -m "feat: add speech narration"
```

---

### Task 9: Three.js Digital Human Stage

**Files:**
- Create: `apps/web/src/components/DigitalHumanStage.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/styles.css`

- [ ] **Step 1: Add DigitalHumanStage component**

Create `apps/web/src/components/DigitalHumanStage.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

type DigitalHumanStageProps = {
  speaking: boolean;
};

export function DigitalHumanStage({ speaking }: DigitalHumanStageProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const speakingRef = useRef(speaking);

  useEffect(() => {
    speakingRef.current = speaking;
  }, [speaking]);

  useEffect(() => {
    const host = hostRef.current;

    if (!host) {
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#dbe6db');

    const camera = new THREE.PerspectiveCamera(42, host.clientWidth / host.clientHeight, 0.1, 100);
    camera.position.set(0, 1.45, 4.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    host.appendChild(renderer.domElement);

    const ambient = new THREE.HemisphereLight('#fff7e8', '#66806f', 2.4);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight('#ffffff', 2.2);
    keyLight.position.set(3, 4, 3);
    scene.add(keyLight);

    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.48, 1.15, 8, 18),
      new THREE.MeshStandardMaterial({ color: '#6f8b72', roughness: 0.72 })
    );
    body.position.y = 0.72;
    scene.add(body);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 32, 32),
      new THREE.MeshStandardMaterial({ color: '#f0c7a5', roughness: 0.62 })
    );
    head.position.y = 1.63;
    scene.add(head);

    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: '#2f2a25', roughness: 0.8 })
    );
    hair.position.y = 1.7;
    scene.add(hair);

    const mouth = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.035, 0.018),
      new THREE.MeshStandardMaterial({ color: '#7f3a32' })
    );
    mouth.position.set(0, 1.49, 0.36);
    scene.add(mouth);

    const sash = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.12, 0.04),
      new THREE.MeshStandardMaterial({ color: '#b98f4f', roughness: 0.68 })
    );
    sash.position.set(0, 1.08, 0.5);
    scene.add(sash);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.1, 0.08, 48),
      new THREE.MeshStandardMaterial({ color: '#b8c7b3', roughness: 0.9 })
    );
    base.position.y = -0.05;
    scene.add(base);

    let frameId = 0;
    const clock = new THREE.Clock();

    function render() {
      const elapsed = clock.getElapsedTime();
      const idleBob = Math.sin(elapsed * 1.4) * 0.025;
      body.position.y = 0.72 + idleBob;
      head.position.y = 1.63 + idleBob;
      hair.position.y = 1.7 + idleBob;
      sash.position.y = 1.08 + idleBob;
      mouth.position.y = 1.49 + idleBob;
      mouth.scale.y = speakingRef.current ? 1 + Math.abs(Math.sin(elapsed * 16)) * 4.4 : 1;
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(render);
    }

    function resize() {
      const width = host.clientWidth;
      const height = host.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    render();

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="digital-human-stage">
      <div ref={hostRef} className="three-host" />
      <div className="stage-caption">{speaking ? '正在讲解云岚古镇' : '云岚古镇数字导游'}</div>
    </div>
  );
}
```

- [ ] **Step 2: Wire stage into App**

Modify `apps/web/src/App.tsx` import and right panel:

```tsx
import { DigitalHumanStage } from './components/DigitalHumanStage';
```

Replace the right-side section with:

```tsx
<section className="digital-human-panel" aria-label="3D 数字人展示区">
  <DigitalHumanStage speaking={speech.speaking} />
</section>
```

- [ ] **Step 3: Add stage styles**

Append to `apps/web/src/styles.css`:

```css
.digital-human-stage {
  position: relative;
  flex: 1;
  min-height: 100vh;
}

.three-host {
  position: absolute;
  inset: 0;
}

.stage-caption {
  position: absolute;
  left: 24px;
  bottom: 24px;
  border: 1px solid rgba(42, 70, 56, 0.18);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.72);
  padding: 10px 12px;
  color: #315548;
}
```

- [ ] **Step 4: Build web**

Run:

```powershell
npm --workspace apps/web run build
```

Expected: build exits with code 0.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src
git commit -m "feat: add three digital human stage"
```

---

### Task 10: End-To-End Verification And Final Polish

**Files:**
- Modify: `README.md`
- Modify: `apps/server/docs/api.md`
- Modify: code files only if verification finds mismatches

- [ ] **Step 1: Run all static checks**

Run:

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
```

Expected: all commands exit with code 0.

- [ ] **Step 2: Start both apps**

Run:

```powershell
npm run dev
```

Expected:

```text
Yunlan guide API listening on http://localhost:8787
VITE v... ready in ...
```

- [ ] **Step 3: Manually verify health and scenic endpoints**

Run in a second terminal:

```powershell
Invoke-RestMethod http://localhost:8787/api/health
Invoke-RestMethod http://localhost:8787/api/scenic-area
```

Expected:

- Health returns `ok: true`.
- Scenic response contains `scenicArea.name = 云岚古镇`.

- [ ] **Step 4: Manually verify chat endpoint with configured LLM**

Ensure `apps/server/.env` contains a valid OpenAI-compatible config:

```text
PORT=8787
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=replace-with-your-api-key
LLM_MODEL=gpt-4o-mini
```

Run:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://localhost:8787/api/guide/chat `
  -ContentType 'application/json' `
  -Body '{"message":"帮我规划一条半日游路线"}'
```

Expected:

- Response has an `answer` string.
- Response has 5 `cards`.
- First card title is `从南门牌坊进入`.

- [ ] **Step 5: Manually verify browser flow**

Open `http://localhost:5173`.

Expected:

- Left side shows 云岚古镇 title, quick questions, chat area, input, and route-card area.
- Right side shows a nonblank Three.js digital human stage.
- Clicking `帮我规划一条半日游路线` adds user and assistant messages.
- Route cards appear.
- Browser reads the answer aloud when speech synthesis is available.
- Digital human mouth animation changes while speaking.

- [ ] **Step 6: Update README with final run notes**

Ensure `README.md` includes:

```md
## 演示路径

1. 启动后端和前端：`npm run dev`
2. 打开 `http://localhost:5173`
3. 点击快捷问题“帮我规划一条半日游路线”
4. 查看聊天回答、路线步骤卡片和右侧数字人说话动画

如果没有配置真实 `LLM_API_KEY`，`POST /api/guide/chat` 会返回后端错误提示；健康检查和景区资料接口仍可验证。
```

- [ ] **Step 7: Commit verification docs**

```powershell
git add README.md apps/server/docs/api.md
git commit -m "docs: add verification notes"
```

- [ ] **Step 8: Push final branch**

Run:

```powershell
git status --short
git push
```

Expected:

- `git status --short` prints no tracked code changes.
- `git push` updates `origin/main`.

---

## Self-Review

Spec coverage:

- React 19 + Vite + TypeScript frontend: Task 6.
- Koa backend: Task 2.
- ESLint, Prettier, Husky: Task 1.
- Left guide panel and right digital human layout: Tasks 6, 7, 9.
- Quick questions and free input: Task 7.
- Backend JSON scenic data: Task 3.
- OpenAI-compatible LLM: Task 4.
- LLM scope constraint: Task 4 system prompt.
- Structured route cards: Task 4 service and Task 7 frontend cards.
- Web Speech API narration: Task 8.
- Simple speaking animation: Task 9.
- README and API docs: Tasks 1, 5, 10.
- Verification commands: Task 10.

Placeholder scan result:

- Placeholder-token scan passed. The plan contains complete task steps, concrete file paths, and code sections for created modules.

Type consistency:

- Backend route cards use `type: 'route-step'`, `title`, `duration`, `description`.
- Frontend `RouteCard` uses the same fields.
- `GuideChatResponse` matches `POST /api/guide/chat`.
- `DigitalHumanStage` receives only `speaking: boolean`.
