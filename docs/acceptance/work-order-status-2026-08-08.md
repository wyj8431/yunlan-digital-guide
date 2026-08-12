# 工单状态

## 仓库内已完成

- 本地 Three.js 口型同步实验室，支持预设、文件和 URL 音频源。
- RMS 音量分析、阈值、灵敏度、最大张口、起音/释音平滑、形态键映射和质量档位。
- 带资源清理与时间线兜底的生产级本地 TTS `AnalyserNode` 桥接。
- Cursor 代码审查 Skill 文件、命令、统一输出约定和项目专属规则。
- 类型检查、代码检查、生产构建、聚焦测试，以及浏览器画布/布局冒烟检查。

## 当前环境验证

- 真实 XFYUN 凭证已配置在本地 `.env`，不会记录到仓库。
- 真实 TTS 冒烟测试通过：`POST /api/speech/synthesize` 返回 `200 audio/mpeg`，且音频非空。
- 真实 ASR 冒烟测试使用仓库 WAV 示例通过，返回了非空文本。
- 使用已配置本地服务的 Phase 3A 浏览器口型同步验收通过。
- 已通过固定版本的 `npm run openspec:validate` 使用 `@fission-ai/openspec@1.8.0` 进行 OpenSpec 校验；变更已通过 `doctor` 和 `validate`。
- 仓库内 Cursor Skill 约定检查可通过 `npm run review:skills` 执行。

## 外部验收

- 已于 2026-08-10 在 Cursor 桌面端完成 `/review changed-files`、`/review component-standards` 和 `/review performance-issues` 校验。
- 之前留存的 `/review component-standards` 截图产生于最新修复之前。其七项发现已在 `App.tsx`、`DigitalHumanStage.tsx`、`useSpeechSynthesis.ts` 和 `ExhibitionPage.tsx` 中处理；类型检查、代码检查和受影响的 34 项测试均通过。
- 最终 Cursor 运行还报告了既有 Java 工单模块问题。这些问题不属于本口型同步和 Cursor Skill 工单范围，仍需单独处理。

## 产品参考

- Figma 工作区：https://www.figma.com/files/team/1656316849219657021/folder/622739109?fuid=1656316846032677675
- NotebookLM 笔记本：https://notebook.google.com/notebook/ea284cd3-84eb-435a-b6e6-561cec05e6d0

可重复执行的 Phase 3A 基准测试已完成：三轮 60 秒桌面端、三轮 60 秒移动端和一轮 10 分钟稳定性测试。因为本地实验室基准测试刻意未启动 API 服务，运行中出现了不影响结果的景区 API 代理警告。留存报告为 `artifacts/phase3a-lip-sync-benchmark-2026-08-11.json`：桌面端和移动端均约为 165 FPS，嘴部响应为 0-12.3 ms，最终稳定性样本正确闭合了嘴部。

浏览器验收脚本支持 `PHASE3A_BROWSER=chromium|firefox|webkit`。Chrome 和 Edge 冒烟验收均于 2026-08-11 通过。当前环境未安装 Firefox 和 WebKit 引擎，因此不宣称跨引擎通过；WebKit 只能作为 Safari 内核代理，不能替代 macOS Safari 设备证据。

前端完整测试套件已通过，首页入口、响应式 CSS 和展馆碰撞测试均已与当前实现对齐。这些工单在仓库内没有遗留测试失败。
