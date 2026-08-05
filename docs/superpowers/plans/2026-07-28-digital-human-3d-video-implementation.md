# 数字人、3D 展馆与视频中心 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有数字人文旅项目中交付右上角独立入口、视频弹幕中心和可漫游的西湖风格 3D 展馆。

**Architecture:** 保留现有旅游页路由和数字人能力，新增两个顶级路由 `/exhibition` 与 `/videos`。视频模块通过 Koa API 和 SQLite 保存数据，React 端用 Redux Toolkit 管理远程视频状态；3D 展馆使用现有 Three.js 依赖，以独立渲染器封装场景、键盘移动和碰撞。

**Tech Stack:** React 19、TypeScript、Vite、Redux Toolkit、Koa、SQLite（better-sqlite3）、Three.js、Vitest、React Testing Library、Playwright。

---

## 文件结构

| 文件 | 职责 |
| --- | --- |
| `apps/web/src/routing/appRoute.ts` | 解析 `/exhibition` 与 `/videos` 顶级路由。 |
| `apps/web/src/components/HomeDestinationLinks.tsx` | 首页右上角两个低透明度入口。 |
| `apps/web/src/components/VideoCenterPage.tsx` | 视频中心页面组合、加载与错误状态。 |
| `apps/web/src/video/VideoPlayer.tsx` | 视频时钟、字幕和弹幕显示层。 |
| `apps/web/src/video/danmaku.ts` | 弹幕时间窗口与敏感词显示无关的纯函数。 |
| `apps/web/src/store/videoStore.ts` | Redux Toolkit 视频、弹幕和字幕状态。 |
| `apps/web/src/components/ExhibitionPage.tsx` | 3D 展馆页面、返回导航和客服入口。 |
| `apps/web/src/exhibition/ExhibitionRenderer.ts` | Three.js 场景、第一人称相机、键盘与资源释放。 |
| `apps/web/src/exhibition/collision.ts` | 房间和展品 AABB 碰撞计算。 |
| `apps/server/src/modules/video/*` | 视频数据、SQLite、参数校验、敏感词与 Koa 路由。 |
| `apps/server/src/modules/docs/openapi.ts` | 视频接口的 OpenAPI 说明。 |

### Task 1: 顶级路由与首页右上角入口

**Files:**
- Create: `apps/web/src/components/HomeDestinationLinks.tsx`
- Modify: `apps/web/src/routing/appRoute.ts`
- Modify: `apps/web/src/RootApp.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/styles.css`
- Test: `apps/web/tests/appRoute.test.ts`
- Test: `apps/web/tests/HomeDestinationLinks.test.tsx`

- [ ] **Step 1: 写出路由和入口的失败测试**

```ts
expect(resolveAppRoute('/exhibition')).toEqual({ kind: 'exhibition' });
expect(resolveAppRoute('/videos')).toEqual({ kind: 'video-center' });
render(<HomeDestinationLinks onNavigate={navigate} />);
fireEvent.click(screen.getByRole('link', { name: '3D 展馆' }));
expect(navigate).toHaveBeenCalledWith('/exhibition');
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm --workspace apps/web run test -- appRoute HomeDestinationLinks`

Expected: `resolveAppRoute('/exhibition')` 回退到旅游首页，且入口组件不存在。

- [ ] **Step 3: 扩展路由并实现入口组件**

```ts
export type AppRoute =
  | { kind: 'lip-sync-lab' }
  | { kind: 'tourism'; view: TourismView }
  | { kind: 'exhibition' }
  | { kind: 'video-center' };

if (normalizedPathname === '/exhibition') return { kind: 'exhibition' };
if (normalizedPathname === '/videos') return { kind: 'video-center' };
```

```tsx
export function HomeDestinationLinks({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <nav className="home-destination-links" aria-label="特色页面入口">
      <a href="/exhibition" onClick={(event) => { event.preventDefault(); onNavigate('/exhibition'); }}>
        <Landmark aria-hidden="true" /><span>3D 展馆</span><small>EXHIBITION</small>
      </a>
      <a href="/videos" onClick={(event) => { event.preventDefault(); onNavigate('/videos'); }}>
        <PlaySquare aria-hidden="true" /><span>视频中心</span><small>VIDEO</small>
      </a>
    </nav>
  );
}
```

`App` 接收 `onNavigatePath(pathname: string)` 并在标题区域后渲染 `HomeDestinationLinks`。`RootApp` 通过 `history.pushState`、`setRoute(resolveAppRoute(pathname))` 实现顶级页面跳转。CSS 将入口固定在右上角安全区；默认 `opacity: .14`，`:hover` 和 `:focus-visible` 使用 `#b1e1bf`、深绿色文字和金色边框，且不使用下拉层。

- [ ] **Step 4: 运行测试并确认通过**

Run: `npm --workspace apps/web run test -- appRoute HomeDestinationLinks RootApp`

Expected: PASS。

- [ ] **Step 5: 提交路由入口**

```bash
git add apps/web/src/routing/appRoute.ts apps/web/src/RootApp.tsx apps/web/src/App.tsx apps/web/src/components/HomeDestinationLinks.tsx apps/web/src/styles.css apps/web/tests/appRoute.test.ts apps/web/tests/HomeDestinationLinks.test.tsx
git commit -m "feat(web): add exhibition and video entry routes"
```

### Task 2: 视频 SQLite 数据层与后端校验

**Files:**
- Modify: `apps/server/package.json`
- Create: `apps/server/src/modules/video/video.types.ts`
- Create: `apps/server/src/modules/video/video.seed.ts`
- Create: `apps/server/src/modules/video/video.repository.ts`
- Create: `apps/server/src/modules/video/video.service.ts`
- Test: `apps/server/tests/video.service.test.ts`

- [ ] **Step 1: 写出敏感词、时间范围和持久化的失败测试**

```ts
const service = createVideoService({ databasePath });
const record = service.createDanmaku('west-lake-bridge', {
  content: '这段违禁词内容很好看', timestampMs: 12_000, color: '#ffffff', position: 'scroll'
});
expect(record.content).toBe('这段****内容很好看');
expect(service.listDanmaku('west-lake-bridge', 10_000, 15_000)).toHaveLength(1);
expect(createVideoService({ databasePath }).listDanmaku('west-lake-bridge', 10_000, 15_000)).toHaveLength(1);
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm --workspace apps/server run test -- video.service`

Expected: FAIL，模块尚不存在。

- [ ] **Step 3: 添加 SQLite 依赖和明确的数据类型**

```bash
npm --workspace apps/server install better-sqlite3
npm --workspace apps/server install --save-dev @types/better-sqlite3
```

```ts
export type DanmakuPosition = 'scroll' | 'top' | 'bottom';
export type DanmakuRecord = {
  id: string; videoId: string; timestampMs: number; content: string; nickname: string;
  color: '#ffffff' | '#f5d76e' | '#aee7ff' | '#ffc0cb'; position: DanmakuPosition; createdAt: string;
};
export type CreateDanmakuInput = Pick<DanmakuRecord, 'content' | 'timestampMs' | 'color' | 'position'>;
```

`video.repository.ts` 使用 `better-sqlite3` 在首次打开时创建 `videos`、`danmaku`、`sensitive_keywords`、`subtitle_cues` 四张表，并在空库时写入 6 条视频、字幕和敏感词。`video.service.ts` 只接受 `0 <= timestampMs <= durationMs`、长度 1 到 80 的内容和上述联合类型中的颜色、位置；用 `split(keyword).join('****')` 替换每个预置敏感词，再生成 `游客 ${1000 + count}` 昵称。

- [ ] **Step 4: 运行服务测试并确认通过**

Run: `npm --workspace apps/server run test -- video.service`

Expected: PASS，重开同一路径数据库后仍可读到弹幕。

- [ ] **Step 5: 提交数据层**

```bash
git add apps/server/package.json package-lock.json apps/server/src/modules/video apps/server/tests/video.service.test.ts
git commit -m "feat(server): persist videos and danmaku in sqlite"
```

### Task 3: 视频 API 与 OpenAPI 文档

**Files:**
- Create: `apps/server/src/modules/video/video.routes.ts`
- Modify: `apps/server/src/app.ts`
- Modify: `apps/server/src/modules/docs/openapi.ts`
- Test: `apps/server/tests/video.routes.test.ts`
- Test: `apps/server/tests/api.test.ts`

- [ ] **Step 1: 写出 API 契约失败测试**

```ts
await request(createApp().callback()).get('/api/videos').expect(200).expect(({ body }) => {
  expect(body.videos).toHaveLength(6);
});
await request(createApp().callback()).post('/api/videos/west-lake-bridge/danmaku').send({
  content: '违禁词', timestampMs: 1_000, color: '#ffffff', position: 'scroll'
}).expect(201).expect(({ body }) => expect(body.danmaku.content).toBe('****'));
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm --workspace apps/server run test -- video.routes api`

Expected: 404。

- [ ] **Step 3: 实现 Koa 路由与文档路径**

```ts
router.get('/api/videos', (ctx) => { ctx.body = { videos: service.listVideos() }; });
router.get('/api/videos/:videoId/danmaku', (ctx) => {
  ctx.body = { danmaku: service.listDanmaku(ctx.params.videoId, Number(ctx.query.from), Number(ctx.query.to)) };
});
router.post('/api/videos/:videoId/danmaku', (ctx) => {
  const danmaku = service.createDanmaku(ctx.params.videoId, ctx.request.body as CreateDanmakuInput);
  ctx.status = 201; ctx.body = { danmaku };
});
```

所有 `VideoValidationError` 返回 `400`，未知视频返回 `404`，错误体固定为 `{ code, message }`。在 `createApp` 中挂载 `videoRouter.routes()` 和 `allowedMethods()`；在 OpenAPI 中加入 `Video` 标签和 5 个规格文件列出的端点。

- [ ] **Step 4: 运行接口与文档测试**

Run: `npm --workspace apps/server run test -- video.routes api`

Expected: PASS，`/api/docs/openapi.json` 含有 `/api/videos` 和 `Video` 标签。

- [ ] **Step 5: 提交 API**

```bash
git add apps/server/src/app.ts apps/server/src/modules/video/video.routes.ts apps/server/src/modules/docs/openapi.ts apps/server/tests/video.routes.test.ts apps/server/tests/api.test.ts
git commit -m "feat(server): expose video and danmaku api"
```

### Task 4: Redux Toolkit、视频 API 客户端和基础页面

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/src/main.tsx`
- Create: `apps/web/src/types/video.ts`
- Create: `apps/web/src/api/videoApi.ts`
- Create: `apps/web/src/store/videoStore.ts`
- Create: `apps/web/src/components/VideoCenterPage.tsx`
- Modify: `apps/web/src/RootApp.tsx`
- Test: `apps/web/tests/videoStore.test.ts`
- Test: `apps/web/tests/VideoCenterPage.test.tsx`

- [ ] **Step 1: 写出 Redux 加载、成功和失败状态的失败测试**

```ts
await store.dispatch(loadVideos()).unwrap();
expect(store.getState().video.status).toBe('ready');
expect(store.getState().video.videos).toHaveLength(6);
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm --workspace apps/web run test -- videoStore VideoCenterPage`

Expected: FAIL，store 和页面不存在。

- [ ] **Step 3: 添加 Redux 依赖并实现最小状态树**

```bash
npm --workspace apps/web install @reduxjs/toolkit react-redux
```

```ts
export const loadVideos = createAsyncThunk('video/loadVideos', fetchVideos);
const slice = createSlice({ name: 'video', initialState, reducers: { selectVideo(state, action: PayloadAction<string>) { state.selectedVideoId = action.payload; } }, extraReducers: (builder) => {
  builder.addCase(loadVideos.pending, (state) => { state.status = 'loading'; state.error = null; });
  builder.addCase(loadVideos.fulfilled, (state, action) => { state.status = 'ready'; state.videos = action.payload; state.selectedVideoId ??= action.payload[0]?.id ?? null; });
  builder.addCase(loadVideos.rejected, (state) => { state.status = 'error'; state.error = '视频列表加载失败，请稍后重试。'; });
}});
```

`main.tsx` 用 `<Provider store={store}>` 包裹 `<RootApp />`。`RootApp` 在 `{ kind: 'video-center' }` 时渲染 `VideoCenterPage`。页面应包含返回首页、列表加载骨架、重试按钮和空数据提示。

- [ ] **Step 4: 运行前端单测**

Run: `npm --workspace apps/web run test -- videoStore VideoCenterPage appRoute`

Expected: PASS。

- [ ] **Step 5: 提交基础视频页面**

```bash
git add apps/web/package.json package-lock.json apps/web/src/main.tsx apps/web/src/types/video.ts apps/web/src/api/videoApi.ts apps/web/src/store/videoStore.ts apps/web/src/components/VideoCenterPage.tsx apps/web/src/RootApp.tsx apps/web/tests/videoStore.test.ts apps/web/tests/VideoCenterPage.test.tsx
git commit -m "feat(web): add redux video center shell"
```

### Task 5: 播放器、字幕、弹幕和显示设置

**Files:**
- Create: `apps/web/src/video/danmaku.ts`
- Create: `apps/web/src/video/VideoPlayer.tsx`
- Create: `apps/web/src/video/DanmakuComposer.tsx`
- Create: `apps/web/src/video/danmakuPreferences.ts`
- Modify: `apps/web/src/components/VideoCenterPage.tsx`
- Modify: `apps/web/src/styles.css`
- Test: `apps/web/tests/danmaku.test.ts`
- Test: `apps/web/tests/VideoPlayer.test.tsx`

- [ ] **Step 1: 写出视频时钟行为的失败测试**

```ts
expect(danmakuInWindow(records, 12_000, 1_000).map((item) => item.id)).toEqual(['at-12-seconds']);
fireEvent.pause(video);
expect(screen.getByTestId('danmaku-layer')).toHaveAttribute('data-paused', 'true');
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm --workspace apps/web run test -- danmaku VideoPlayer`

Expected: FAIL，弹幕纯函数和播放器不存在。

- [ ] **Step 3: 实现以视频为唯一时钟的播放器**

```ts
export function danmakuInWindow(records: DanmakuRecord[], currentMs: number, windowMs: number) {
  return records.filter((record) => Math.abs(record.timestampMs - currentMs) <= windowMs);
}
```

```tsx
<video ref={videoRef} onTimeUpdate={(event) => setCurrentMs(event.currentTarget.currentTime * 1000)} onPause={() => setPaused(true)} onPlay={() => setPaused(false)} />
<DanmakuLayer records={danmakuInWindow(records, currentMs, 900)} paused={paused} preferences={preferences} />
<SubtitleLayer cues={cues} currentMs={currentMs} />
```

`DanmakuComposer` 提交 `{ content, timestampMs: currentMs, color, position }`，成功后把后端返回记录加入当前视频状态。偏好项 `speed`、`fontSize`、`opacity`、`density` 使用 `localStorage` 键 `yunlan-video-danmaku-preferences-v1` 保存。实时识别开关只在能力可用时显示实时结果；其他情况继续渲染预置字幕。

- [ ] **Step 4: 运行播放器测试**

Run: `npm --workspace apps/web run test -- danmaku VideoPlayer VideoCenterPage`

Expected: PASS，暂停时图层冻结，跳转后只显示目标时间窗口记录。

- [ ] **Step 5: 提交视频交互**

```bash
git add apps/web/src/video apps/web/src/components/VideoCenterPage.tsx apps/web/src/styles.css apps/web/tests/danmaku.test.ts apps/web/tests/VideoPlayer.test.tsx
git commit -m "feat(web): add synchronized danmaku and subtitles"
```

### Task 6: 3D 碰撞纯函数和场景渲染器

**Files:**
- Create: `apps/web/src/exhibition/collision.ts`
- Create: `apps/web/src/exhibition/ExhibitionRenderer.ts`
- Test: `apps/web/tests/exhibitionCollision.test.ts`
- Test: `apps/web/tests/ExhibitionRenderer.test.ts`

- [ ] **Step 1: 写出房间边界和物体阻挡的失败测试**

```ts
expect(clampToRoom({ x: 12, z: 0 }, ROOM_BOUNDS, PLAYER_RADIUS)).toEqual({ x: 7.6, z: 0 });
expect(canMoveTo({ x: 0, z: 0 }, { x: 1, z: 0 }, [{ minX: 0.5, maxX: 1.5, minZ: -1, maxZ: 1 }], PLAYER_RADIUS)).toBe(false);
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm --workspace apps/web run test -- exhibitionCollision ExhibitionRenderer`

Expected: FAIL，碰撞模块不存在。

- [ ] **Step 3: 实现碰撞契约和 Three.js 生命周期**

```ts
export type Point2 = { x: number; z: number };
export type Collider = { minX: number; maxX: number; minZ: number; maxZ: number };
export const ROOM_BOUNDS = { minX: -8, maxX: 8, minZ: -10, maxZ: 10 };
export const PLAYER_RADIUS = 0.4;
export function clampToRoom(point: Point2, bounds: Collider, radius: number): Point2 {
  return {
    x: Math.min(bounds.maxX - radius, Math.max(bounds.minX + radius, point.x)),
    z: Math.min(bounds.maxZ - radius, Math.max(bounds.minZ + radius, point.z))
  };
}
export function canMoveTo(point: Point2, delta: Point2, colliders: Collider[], radius: number): boolean {
  const candidate = { x: point.x + delta.x, z: point.z + delta.z };
  return !colliders.some((collider) =>
    candidate.x + radius > collider.minX && candidate.x - radius < collider.maxX &&
    candidate.z + radius > collider.minZ && candidate.z - radius < collider.maxZ
  );
}
```

`ExhibitionRenderer` 负责创建 `Scene`、`PerspectiveCamera`、`WebGLRenderer`、室内六面体、半球光、吊灯、展桌、壁画、自行车、汽车和绿植。它接收 `onExhibitSelect(exhibitId)`，注册 `keydown`、`keyup`、`pointermove`、`ResizeObserver` 和动画帧；`dispose()` 必须移除所有监听、取消帧循环、调用现有 `disposeObject3D(scene)` 并释放 renderer。

- [ ] **Step 4: 运行 3D 单测**

Run: `npm --workspace apps/web run test -- exhibitionCollision ExhibitionRenderer`

Expected: PASS。

- [ ] **Step 5: 提交 3D 核心**

```bash
git add apps/web/src/exhibition/collision.ts apps/web/src/exhibition/ExhibitionRenderer.ts apps/web/tests/exhibitionCollision.test.ts apps/web/tests/ExhibitionRenderer.test.ts
git commit -m "feat(web): add exhibition renderer and collisions"
```

### Task 7: 展馆页面、西湖场景与浏览器验证

**Files:**
- Create: `apps/web/src/components/ExhibitionPage.tsx`
- Create: `apps/web/src/exhibition/westLakeScene.ts`
- Modify: `apps/web/src/RootApp.tsx`
- Modify: `apps/web/src/styles.css`
- Test: `apps/web/tests/ExhibitionPage.test.tsx`
- Test: `apps/web/tests/exhibition.browser.test.js`

- [ ] **Step 1: 写出页面和场景切换的失败测试**

```ts
render(<ExhibitionPage onNavigate={navigate} />);
fireEvent.click(screen.getByRole('button', { name: '查看西湖数字沙盘' }));
expect(screen.getByText('西湖漫游')).toBeInTheDocument();
fireEvent.click(screen.getByRole('button', { name: '返回展馆' }));
expect(screen.getByText('西湖当代展馆')).toBeInTheDocument();
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm --workspace apps/web run test -- ExhibitionPage`

Expected: FAIL，页面不存在。

- [ ] **Step 3: 实现独立展馆页面和西湖切换**

```tsx
const [sceneMode, setSceneMode] = useState<'hall' | 'west-lake'>('hall');
return <main className="exhibition-page">
  <button onClick={() => onNavigate('/')}>返回首页</button>
  {sceneMode === 'hall' ? <ExhibitionStage onOpenWestLake={() => setSceneMode('west-lake')} /> : <WestLakeStage onExit={() => setSceneMode('hall')} />}
  <button className="exhibition-guide-trigger" aria-label="打开数字人客服">
    <MessageCircle aria-hidden="true" /><span>数字人客服</span>
  </button>
</main>;
```

`westLakeScene.ts` 创建低多边形湖面、断桥风格桥梁、树木和远景山体；复用相机移动与资源释放模式。展馆内的沙盘展项点击后切换场景，展品介绍弹层提供链接到 `/videos`，但不自动跳转。

- [ ] **Step 4: 执行单测、构建和浏览器检查**

Run: `npm --workspace apps/web run test -- ExhibitionPage && npm --workspace apps/web run build && node apps/web/tests/exhibition.browser.test.js`

Expected: PASS；浏览器检查确认 canvas 非空、`/exhibition` 可访问、桌面布局不重叠、相机不穿出房间。

- [ ] **Step 5: 提交展馆页面**

```bash
git add apps/web/src/components/ExhibitionPage.tsx apps/web/src/exhibition/westLakeScene.ts apps/web/src/RootApp.tsx apps/web/src/styles.css apps/web/tests/ExhibitionPage.test.tsx apps/web/tests/exhibition.browser.test.js
git commit -m "feat(web): add interactive west lake exhibition"
```

### Task 8: 全量验证、素材归属和运行文档

**Files:**
- Create: `docs/integration/digital-human-3d-video.md`
- Modify: `README.md`
- Modify: `apps/server/docs/api.md`
- Test: `apps/web/tests/home-entry.browser.test.js`

- [ ] **Step 1: 写出右上角入口不遮挡的浏览器断言**

```js
await page.goto('http://127.0.0.1:5173/');
const entry = page.getByRole('link', { name: '3D 展馆' });
await expect(entry).toHaveCSS('opacity', '0.14');
await entry.hover();
await expect(entry).toHaveCSS('opacity', '1');
expect(await entry.boundingBox()).not.toBeNull();
```

- [ ] **Step 2: 运行测试并确认失败或缺失**

Run: `node apps/web/tests/home-entry.browser.test.js`

Expected: 首次若未启动双端服务则明确提示服务地址；启动后应能执行断言。

- [ ] **Step 3: 编写运行、素材和降级说明**

`docs/integration/digital-human-3d-video.md` 必须列出 `npm run dev`、SQLite 文件位置、视频素材来源和许可证、实时识别的配置项、字幕降级行为、OpenAPI 地址 `/api/docs` 和回归命令。`README.md` 增加三条主要路由和演示步骤。

- [ ] **Step 4: 执行完整质量门禁**

Run: `npm run typecheck && npm run test && npm run build && npm run lint`

Expected: 四个命令全部退出码为 0。

- [ ] **Step 5: 提交文档与验证**

```bash
git add docs/integration/digital-human-3d-video.md README.md apps/server/docs/api.md apps/web/tests/home-entry.browser.test.js
git commit -m "docs: document 3d exhibition and video center"
```

## 计划自检

- 规格中的首页入口、悬停、两个独立路由、数字人复用、室内展馆、碰撞、可点击展品、西湖场景、视频列表、Redux Toolkit、SQLite、弹幕、敏感词、字幕降级、OpenAPI、测试和交付文档均对应 Task 1 至 Task 8。
- 前端与后端的 `DanmakuRecord`、`CreateDanmakuInput`、`DanmakuPosition` 名称在数据层、路由和播放器中保持一致。
- 每个任务都有失败测试、失败确认、最小实现、通过确认和独立提交步骤。
