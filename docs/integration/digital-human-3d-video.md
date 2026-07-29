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

- 3D 展馆、西湖沙盘、桥、山体、展台、车辆、自行车与绿植由 `ExhibitionRenderer.ts` 和 `westLakeScene.ts` 使用 Three.js 基础几何体、材质及程序化 Canvas 纹理生成，不包含下载的展馆模型或第三方贴图。该部分是本项目自有代码，随项目自身许可使用。
- 视频模块的六条标题、简介、时长、字幕和 `/media/videos/*` URL 来自项目自编种子数据 `video.seed.ts`。当前仓库**没有**这些路径对应的 MP4 或封面文件，也没有为它们声明第三方来源或许可证；它们是接口和界面占位数据，不能对外宣称为已授权视频素材。
- 对外或公开演示时，应将种子 URL 对应到组织自有拍摄素材，或逐条登记来源、作者、许可证与署名要求的素材；未经核验的网络视频不可直接加入仓库。
- 首页及视频中心使用的 `apps/web/public/images/wuzhen-water-town-bg.jpg` 是仓库内本地背景文件，但现有提交历史未记录作者或许可证。它只适合当前内部原型验证；公开发布前同样需要补齐权属证明或替换为明确授权素材。

## 字幕降级

视频中心使用浏览器原生 `SpeechRecognition` 或 `webkitSpeechRecognition`，语言设为 `zh-CN`。此能力没有项目环境变量；是否可用取决于浏览器、系统权限和浏览器所使用的在线识别服务。

浏览器不支持、用户拒绝权限、识别启动失败、运行中报错或无识别结果时，播放器继续按 SQLite 中的 `subtitle_cues` 显示预置字幕，视频播放不会中断。实时识别只增强字幕，不替代稳定的预置字幕。

## 3D 展馆降级与性能

点击“西湖数字沙盘”可进入包含湖面、苏堤、拱桥、树群、雷峰塔和远山的第一人称场景，使用相同的鼠标与键盘控制，底部“返回展馆”会释放当前 WebGL 资源后重建室内场景。室内展品和西湖水域均有边界碰撞。

页面会把设备像素比限制在 `2` 以内，并遵循 `prefers-reduced-motion` 停止湖面装饰动画。WebGL 初始化失败时，页面显示“3D 场景暂时无法加载”提示，顶部返回首页和数字人客服入口仍可使用。

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

浏览器用例会启动本地 Vite 服务并打开真实 Chromium/Edge。Windows 上多个浏览器验收并行时会竞争端口、CPU 和 WebGL 资源，可能出现与功能无关的导航超时；排查时应使用 `--maxWorkers=1` 单 worker 顺序运行。

开发服务启动后可检查：

```powershell
Invoke-WebRequest http://127.0.0.1:5173/ -UseBasicParsing
Invoke-RestMethod http://127.0.0.1:8787/api/health
Invoke-WebRequest http://127.0.0.1:8787/api/docs -UseBasicParsing
```
