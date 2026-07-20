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
