# Yunlan Guide API

## GET /api/health

Returns service health.

```json
{ "ok": true, "service": "yunlan-guide-api" }
```

## GET /api/scenic-area

Returns public scenic-area data for page initialization. Long story fields are intentionally omitted.

## POST /api/guide/chat

Request:

```json
{ "message": "帮我规划一条半日游路线" }
```

Response:

```json
{
  "answer": "推荐你从南门牌坊进入...",
  "cards": [
    {
      "type": "route-step",
      "title": "从南门牌坊进入",
      "duration": "20 分钟",
      "description": "先了解古镇整体历史和水路商贸起源。"
    }
  ],
  "source": "llm"
}
```

Errors include `EMPTY_MESSAGE`, `LLM_CONFIG_MISSING`, and `LLM_REQUEST_FAILED`.

## 视频与弹幕 API

默认 SQLite 文件位于 `apps/server/data/videos.sqlite`。完整请求参数、响应 Schema 和错误码请查看在线 OpenAPI 文档：`http://localhost:8787/api/docs`。

| 方法   | 路径                                          | 说明                                 |
| ------ | --------------------------------------------- | ------------------------------------ |
| `GET`  | `/api/videos`                                 | 获取六条视频种子数据。               |
| `GET`  | `/api/videos/:videoId`                        | 获取视频详情。                       |
| `GET`  | `/api/videos/:videoId/danmaku?from=0&to=7000` | 按播放时间范围获取弹幕。             |
| `POST` | `/api/videos/:videoId/danmaku`                | 发布弹幕；后端校验字段并替换敏感词。 |
| `GET`  | `/api/videos/:videoId/subtitles`              | 获取预置字幕时间轴。                 |

发布弹幕示例：

```json
{
  "content": "水乡夜景很好看",
  "timestampMs": 12000,
  "color": "#ffffff",
  "position": "scroll"
}
```

业务错误统一返回 `{ "code": "...", "message": "..." }`：非法输入为 `400`，视频不存在为 `404`，未处理错误为 `500`。六条种子记录中的 `/media/videos/*` 是演示占位路径，仓库当前不包含对应媒体文件。
