# 数字人、3D 展馆与视频中心联调说明

## 启动与入口

在项目根目录执行：

```powershell
npm install
npm run dev
```

默认前端为 `http://localhost:5173`，后端为 `http://localhost:8787`。主要页面：

- `/`：数字人客服首页，右上角提供 3D 展馆和视频中心入口。
- `/exhibition`：室内 3D 展馆，可点击画布进入鼠标锁定观察，使用 `W/A/S/D` 或方向键移动并点击展品。打开展品详情后移动会暂停，按 `Escape` 可关闭详情。
- `/videos`：视频列表、预置字幕、可选实时识别字幕和持久化弹幕。

后端接口文档位于 `http://localhost:8787/api/docs`，OpenAPI JSON 位于 `http://localhost:8787/api/docs/openapi.json`。

## SQLite 数据

非测试环境默认数据库为 `apps/server/data/videos.sqlite`。后端首次启动时会创建并幂等补齐 `videos`、`danmaku`、`sensitive_keywords` 和 `subtitle_cues`。数据库属于运行时数据，不应作为演示素材或源代码提交；删除该文件后重启后端可恢复种子数据，但用户弹幕会同时丢失。

## 演示素材与许可证

以下说明以当前仓库实际文件为准：

- 3D 展馆使用本地 GLB 展品、HDR 环境、KTX2 PBR 材质和 IES 灯光配置；西湖地形、建筑、植被和水体由项目代码程序化生成。所有运行时文件都位于 `apps/web/public/exhibition/`，不会从第三方站点动态加载。逐项来源、作者、许可证、字节数和 SHA-256 见 `docs/licenses/exhibition-assets.md`。
- 视频模块的六条标题、简介、时长、字幕和 `/media/videos/*` URL 来自项目自编种子数据 `video.seed.ts`。当前仓库**没有**这些路径对应的 MP4 或封面文件，也没有为它们声明第三方来源或许可证；它们是接口和界面占位数据，不能对外宣称为已授权视频素材。
- 对外或公开演示时，应将种子 URL 对应到组织自有拍摄素材，或逐条登记来源、作者、许可证与署名要求的素材；未经核验的网络视频不可直接加入仓库。
- 首页及视频中心使用的 `apps/web/public/images/wuzhen-water-town-bg.jpg` 是仓库内本地背景文件，但现有提交历史未记录作者或许可证。它只适合当前内部原型验证；公开发布前同样需要补齐权属证明或替换为明确授权素材。

## 字幕降级

视频中心使用浏览器原生 `SpeechRecognition` 或 `webkitSpeechRecognition`，语言设为 `zh-CN`。此能力没有项目环境变量；是否可用取决于浏览器、系统权限和浏览器所使用的在线识别服务。

浏览器不支持、用户拒绝权限、识别启动失败、运行中报错或无识别结果时，播放器继续按 SQLite 中的 `subtitle_cues` 显示预置字幕，视频播放不会中断。实时识别只增强字幕，不替代稳定的预置字幕。

## 3D 展馆降级与性能

点击“西湖数字沙盘”可进入包含湖面、苏堤、拱桥、树群、雷峰塔和远山的第一人称场景，使用相同的鼠标与键盘控制，底部“返回展馆”会释放当前 WebGL 资源后重建室内场景。展馆和西湖之间使用分阶段淡出、切换、淡入，切换期间会冻结输入；目标场景失败时恢复来源场景。室内展品和西湖水域均有边界碰撞。

声音必须由用户点击扬声器按钮后解锁。解锁后会播放当前场景环境声，移动距离驱动石材脚步声，西湖水声使用位置音频；展品详情中的“语音讲解”会暂时压低环境声。扬声器按钮可随时静音或恢复，场景切换共用一个音频运行时，缺少音频文件时静默降级而不阻塞画面。

画质按钮在高、中、低三档间切换，分别控制像素比、阴影、后处理分辨率、AO、景深、光线和体积雾等预算。运行时每秒采样 FPS，连续低于目标后只向下自动降一级，并有 20 秒冷却时间；同一次访问不会自动升级。页面把设备像素比限制在 `2` 以内。

GLB、HDR、KTX2、IES 或音频中的单个文件加载失败时会显示可恢复提示并使用简化模型、程序化材质或静音继续运行；异步解码异常和 20 秒单资源超时不会让加载页永久挂起。WebGL 初始化或场景级加载失败时显示错误状态，顶部返回首页和数字人客服入口仍可使用。

`prefers-reduced-motion: reduce` 会缩短转场，并冻结湖面风场、植被和动画雾，关闭动态光线效果，同时保留静态水面、距离雾和基础色彩校正。

## 回归验证

完整质量门禁：

```powershell
npm run typecheck
npm run test
npm run build
npm run lint
```

浏览器验收：

```powershell
npm --workspace apps/web run test -- home-entry.browser.test.js --maxWorkers=1
npm --workspace apps/web run test -- exhibition.browser.test.js --maxWorkers=1
```

展馆性能基准默认不进入普通单元测试，需在带硬件加速的桌面 Edge/Chromium 上显式运行：

```powershell
$env:RUN_EXHIBITION_PERFORMANCE='1'
npm --workspace apps/web run test -- exhibition.performance.test.js --maxWorkers=1
Remove-Item Env:RUN_EXHIBITION_PERFORMANCE
```

基准包含 10 秒预热和至少 15 秒采样，要求展馆平均不低于 45 FPS、西湖平均不低于 40 FPS，并执行 5 次往返检查画布、事件监听器和纹理计数稳定性。远程桌面、软件 WebGL、后台标签页或并行 GPU 用例不适合作为发布性能证据。

浏览器用例会启动本地 Vite 服务并打开真实 Chromium/Edge。Windows 上多个浏览器验收并行时会竞争端口、CPU 和 WebGL 资源，可能出现与功能无关的导航超时；排查时应使用 `--maxWorkers=1` 单 worker 顺序运行。

生产构建仍可能报告 Vite 的大 chunk 警告，因为 Three.js、后处理模块和主应用目前打入同一入口包。警告不影响构建退出码；后续可通过展馆路由动态导入和 `manualChunks` 拆分，不能通过提高警告阈值掩盖。

开发服务启动后可检查：

```powershell
Invoke-WebRequest http://127.0.0.1:5173/ -UseBasicParsing
Invoke-RestMethod http://127.0.0.1:8787/api/health
Invoke-WebRequest http://127.0.0.1:8787/api/docs -UseBasicParsing
```
