# Phase 3B 讯飞语音与数字人联调清单

本文档记录第三阶段真实环境验收步骤。不要在这里粘贴 API Key、签名 URL、原始录音、完整用户语音转写或隐私内容。

## 需要开通的讯飞能力

- 讯飞虚拟人 Web SDK，用于右侧在线数字人展示、动作和说话。
- 讯飞语音听写 IAT，用于 `/api/speech/transcribe`。
- 讯飞在线语音合成 TTS，用于 `/api/speech/synthesize` 和本地数字人兜底语音。

虚拟人 SDK 的授权不等于普通 ASR/TTS 一定可用。普通 TTS 音色建议先用 `xiaoyan` 验证，虚拟人音色如 `x4_lingxiaoxuan_oral` 可能只在虚拟人产品内授权。

## 环境变量

在项目根目录 `.env` 配置，值不要提交：

```text
PORT=
LLM_BASE_URL=
LLM_API_KEY=
LLM_MODEL=

XFYUN_VIRTUAL_HUMAN_ENABLED=
XFYUN_VIRTUAL_HUMAN_APP_ID=
XFYUN_VIRTUAL_HUMAN_API_KEY=
XFYUN_VIRTUAL_HUMAN_API_SECRET=
XFYUN_VIRTUAL_HUMAN_APP_SECRET=
XFYUN_VIRTUAL_HUMAN_SERVICE_ID=
XFYUN_VIRTUAL_HUMAN_AVATAR_ID=
XFYUN_VIRTUAL_HUMAN_SDK_SCRIPT_URL=
XFYUN_VIRTUAL_HUMAN_TTS_VOICE=
XFYUN_VIRTUAL_HUMAN_ACTIONS=

XFYUN_ASR_APP_ID=
XFYUN_ASR_API_KEY=
XFYUN_ASR_API_SECRET=

XFYUN_TTS_APP_ID=
XFYUN_TTS_API_KEY=
XFYUN_TTS_API_SECRET=
XFYUN_TTS_VOICE=xiaoyan
```

## 本地启动

```powershell
npm run dev
```

打开：

- 访客页：http://localhost:5173
- 健康检查：http://localhost:8787/api/health
- 口型实验室：http://localhost:5173/lab/lip-sync

麦克风权限需要安全上下文。`localhost` 可以直接使用；如果换成真机访问局域网地址，浏览器可能要求 HTTPS。

## 协议与数据格式

- 录音上传接口：`POST /api/speech/transcribe`
- 音频合成接口：`POST /api/speech/synthesize`
- 问答流接口：`WS /api/guide/chat/stream`
- ASR 输入由浏览器录音为 `audio/webm` 或兼容格式，后端用 ffmpeg 转成 16 kHz 单声道 PCM 后发给讯飞 IAT。
- TTS 输出为 MP3，前端通过 WebAudio 解码并播放。
- 当前页面使用回答播放事件同步本地数字人口型，不保存原始麦克风音频。

## 手工验收步骤

1. 关闭其他正在占用同一讯飞虚拟人账号的测试页面。
2. 启动 `npm run dev`。
3. 打开 `http://localhost:5173`。
4. 确认右侧数字人加载；若讯飞不可用，应显示本地 Three.js 兜底。
5. 点击文字输入框，输入一个景区问题，确认回答流式打印。
6. 确认数字人只发出一个声音。
7. 点击麦克风，说一句普通话景区问题。
8. 停顿后确认问题自动发送，且没有重复生成用户消息。
9. 确认回答文字和数字人语音基本同时开始，并在同一轮回答结束。
10. 测试麦克风拒绝权限后，文字输入仍可继续使用。
11. 断网或关闭后端后重试，确认页面能显示失败状态且可再次输入。
12. 打开 `/lab/lip-sync`，验证本地模型口型实验不影响访客页。

## 真实 TTS 快速检查

后端启动后可发送一条短文本，只看状态和音频大小，不打印密钥：

```powershell
Invoke-WebRequest -UseBasicParsing `
  'http://localhost:8787/api/speech/synthesize' `
  -Method Post `
  -ContentType 'application/json' `
  -Body '{"text":"欢迎来到云岚古镇。"}'
```

期望：

- HTTP 状态为 `200`
- `Content-Type` 包含 `audio/mpeg`
- 响应体大小大于 `0`

如果返回 `licc failed`，优先检查 `XFYUN_TTS_VOICE` 是否使用了未授权音色。

## 故障矩阵

| 场景               | 期望表现                                |
| ------------------ | --------------------------------------- |
| 麦克风权限拒绝     | 显示简短错误，文字输入仍可用            |
| 没有录到声音       | 不发送问题，允许重试                    |
| ASR 未配置         | 显示识别配置缺失，文字输入仍可用        |
| TTS 未配置         | 保留回答文本，回退浏览器朗读或静默      |
| TTS 音色未授权     | 返回 provider 错误，改用 `xiaoyan` 复测 |
| 讯飞虚拟人失败     | 切换本地 3D 数字人兜底                  |
| LLM 失败           | 保持用户问题，显示导游回答错误          |
| 重复点击或重复事件 | 不应生成重复用户消息或重复回答          |

## 隐私与日志

- 不把原始录音写入 localStorage、IndexedDB 或应用日志。
- 不记录完整语音转写文本到服务端日志。
- 不把讯飞签名 URL、API Key、API Secret 写入文档或提交历史。
- 手工验收只记录延迟、状态码、是否成功、是否出现双声音。

## 记录模板

```text
日期：
浏览器/设备：
ASR 首次结果延迟：
静音后自动发送延迟：
回答首字出现延迟：
TTS 首音延迟：
是否重复提交：
是否只有一个数字人声音：
麦克风拒绝恢复：
TTS 音色：
备注：
```
