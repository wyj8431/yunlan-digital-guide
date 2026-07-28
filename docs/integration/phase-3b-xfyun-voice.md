# Phase 3B 讯飞实时语音联调清单

本文记录第三阶段浏览器语音输入与讯飞 ASR 的真实联调方法。真实密钥只放在本地 `.env`，不要写入仓库、截图、日志或文档。

## 当前链路

实时语音输入使用：

```text
浏览器麦克风
  -> AudioWorklet
  -> 16 kHz / 单声道 / PCM16
  -> WS /api/voice
  -> 讯飞实时 ASR
  -> 景区导游问答服务
  -> transcript.final / answer.final
  -> 页面只创建一条用户消息和一条助手消息
```

旧的 `POST /api/speech/transcribe` 仍保留给兼容回退路径；它不是 Phase 3B 的主链路。

## 本地配置

在项目根目录 `.env` 配置真实讯飞 ASR 参数：

```text
XFYUN_ASR_ENABLED=true
XFYUN_ASR_APP_ID=
XFYUN_ASR_API_KEY=
XFYUN_ASR_API_SECRET=
XFYUN_ASR_URL=wss://iat-api.xfyun.cn/v2/iat
XFYUN_TTS_URL=
```

请同时确认 `PORT`、LLM 或景区导游智能体配置已经可用。API Key、API Secret、签名 URL 和完整请求内容只能在服务端使用。

## 启动与浏览器条件

```powershell
npm install
npm run dev
```

访问：

- 前端：`http://localhost:5173`
- 后端健康检查：`http://localhost:8787/api/health`

麦克风需要安全上下文。`localhost` 可以直接使用；换成局域网或公网地址时，应使用 HTTPS，并在浏览器中允许麦克风权限。

## WebSocket 协议

客户端开始会话：

```json
{
  "type": "session.start",
  "sessionId": "client-generated-id",
  "sequence": 1,
  "outputMode": "xfyun-avatar",
  "sampleRate": 16000
}
```

之后客户端发送二进制 PCM16 音频块。服务端事件顺序为：

```text
session.created
transcript.partial*
transcript.final
answer.final
response.done
```

客户端停止或取消时发送 `session.cancel`。服务端和客户端都按 `sessionId` 与递增 `sequence` 丢弃过期事件。当前静音结束阈值为 `vad_eos=1200` 毫秒。

## 浏览器验收

先跑自动化验收：

```powershell
npm --workspace apps/web run test -- phase3b.browser.test.js
```

自动化测试会注入假的麦克风、AudioWorklet 和 WebSocket，覆盖：

- 麦克风启动后进入 listening/recognizing；
- partial 转写进入输入框；
- final 转写自动提交；
- 重复 final 或 answer 不生成重复消息；
- WebSocket 断开后文字提问仍可用；
- 麦克风拒绝后文字提问仍可用；
- 不向 localStorage 或 IndexedDB 写入原始录音或完整转写；
- 桌面和移动视口没有明显横向溢出。

## 真实讯飞联调步骤

1. 确认 `.env` 中 ASR 配置齐全，重启后端。
2. 打开 `http://localhost:5173`，确认右侧数字人或本地 3D 兜底正常。
3. 允许浏览器麦克风权限。
4. 点击语音输入，说一个完整的景区旅游问题，例如“乌镇西栅半天怎么安排”。
5. 观察状态从连接、监听、识别进入思考和回答。
6. 确认只出现一条用户问题和一条导游回答。
7. 确认文字回答、数字人语音和口型只播放一份，不出现双重声音。
8. ASR 失败、断网或拒绝权限后，直接测试文字输入是否仍可发送。

人工记录以下信息即可，不要记录原始录音或完整语音转写：

```text
日期：
浏览器/版本：
设备：
ASR 首字延迟：
静音自动发送延迟：
是否重复提交：
是否出现双重声音：
麦克风失败后的文字回退：
备注：
```

## 故障处理

| 场景                      | 预期行为                             |
| ------------------------- | ------------------------------------ |
| 麦克风权限拒绝            | 显示简短错误，文字输入继续可用       |
| 浏览器不支持 AudioWorklet | 仅禁用实时语音，文字输入继续可用     |
| ASR 未配置                | 返回稳定的配置错误，不提交空问题     |
| ASR 超时或断线            | 结束当前会话，忽略迟到事件，允许重试 |
| 空转写                    | 不创建用户消息，不调用问答           |
| 重复 final/answer         | 只处理第一次                         |
| TTS 未配置                | 保留文字回答，按现有回退策略处理     |
| 讯飞数字人失败            | 切换本地 Three.js 数字人             |

## 隐私要求

- 不把原始麦克风音频写入 localStorage、IndexedDB、应用日志或分析系统。
- 不在服务端日志打印完整语音转写、API Key、API Secret 或签名 URL。
- 不把真实密钥提交到 Git。
- 测试和验收只记录延迟、状态、成功/失败和是否重复发声。
