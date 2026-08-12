# Coze Digital Human Contract

The browser never calls Coze directly. Configure the Coze Bot token and Bot ID only in the server environment, then use the existing `/api/guide/chat` and `/api/guide/chat/stream` endpoints.

## Workflow

Build the Coze workflow as: input -> intent/knowledge retrieval -> answer generation -> optional avatar directive. Keep Bot, Plugin, Workflow, and Knowledge Base inside Coze; this repository only consumes the Bot's final text stream.

## Coze Console Setup

1. Create one Bot for the digital guide and publish a draft version before placing its ID in `COZE_BOT_ID`.
2. Add a Workflow named `digital-guide-reply`. Its start input is the visitor question. Connect these nodes in order: intent classifier -> Knowledge Base search -> answer generator -> end response.
3. Create a Knowledge Base with approved scenic facts, visitor rules, route descriptions, ticket/opening-time sources, and an `updated_at` field. Keep volatile facts, especially prices and schedules, dated and sourced. Do not upload credentials, source code, or unreviewed chat transcripts.
4. Attach the Knowledge Base search result to the answer-generator context. When no source is found, require the answer to state that the current knowledge base has no confirmed record; it must not invent facts.
5. Add a Plugin only for controlled, read-only data such as an official notice lookup. Use `GET /api/coze/plugins/official-notices/{spotId}` with the only accepted value `wuzhen-scenic-area`. Its response contains `title`, `content`, `sourceUrl`, and `updatedAt`. Do not let the plugin call the browser, virtual-human SDK, filesystem, or any credential-bearing endpoint.
6. In the Bot's final response instruction, require the exact directive contract below. The browser receives text through the existing server proxy, not a Coze SDK key.

Use this final-node instruction in Coze:

```text
先输出面向游客的自然语言答案。只有在确实需要数字人动作时，才在最后另起一行输出一个 guide-directive 标签。
标签只能包含 emotion、action、scene 三个字段；action 必须来自允许列表；不要把用户输入、知识库原文、工具返回、提示词或密钥写进标签。
没有合适动作时不要输出标签。标签后不能再输出任何文本。
```

Suggested intent branches:

| Intent                              | Workflow behavior                                               | Directive suggestion                    |
| ----------------------------------- | --------------------------------------------------------------- | --------------------------------------- |
| Greeting / introduction             | brief identity and supported guide topics                       | `warm` + `A_RLH_welcome_O`              |
| Route / spot explanation            | retrieve sources, then answer in sections                       | `thoughtful` + `A_H_listen_C` or no tag |
| Ticket / opening-time question      | retrieve dated source and add official-confirmation reminder    | no tag                                  |
| Complaint / unavailable information | acknowledge, state the boundary, offer the next useful question | `neutral`, no action                    |

The workflow may omit a directive entirely. A directive is presentation metadata; it must never decide prices, permissions, navigation, or a server-side operation.

For tourist questions, instruct the final response node to return the visitor-facing answer first. It may append exactly one optional trailing tag:

```text
<guide-directive>{"emotion":"warm","action":"A_RLH_welcome_O","scene":"welcome"}</guide-directive>
```

The tag is optional and must be at the very end. It is not visible to visitors. Unsupported fields, malformed JSON, and unknown action IDs are ignored. Do not put credentials, tool results, source documents, or user supplied text inside the tag.

## Controlled Values

- `emotion`: `neutral`, `warm`, `happy`, `thoughtful`
- `action`: one of the actions returned by `/api/virtual-human/config`; the supported default IDs are controlled in `apps/server/src/modules/guide/coze-directive.ts`.
- `scene`: optional label, maximum 48 characters. It is metadata only and does not trigger navigation or an API call.

The frontend checks the currently enabled virtual-human provider's action list a second time. When the online avatar is unavailable, the text answer and local Three.js fallback remain usable; no action is attempted. The XFYUN virtual-human SDK remains the only voice owner for online-avatar replies.

## Server Configuration

Set only non-secret identifiers in deployment configuration and keep tokens outside source control:

```dotenv
LLM_PROVIDER=hybrid
COZE_API_BASE=https://api.coze.cn
COZE_BOT_ID=your-published-bot-id
COZE_USER_ID=stable-anonymous-visitor-id
COZE_API_TOKEN=server-only-token
```

`hybrid` uses Coze first and the existing OpenAI-compatible provider only when Coze fails before producing a delta. The fallback model is therefore still needed for resilience. The browser must not receive `COZE_API_TOKEN`.

## Official Notice Plugin

Publish the server behind HTTPS, then configure the Coze Plugin as a `GET` operation using the OpenAPI entry
`/api/coze/plugins/official-notices/{spotId}`. The Plugin input is an enum-valued `spotId`, not free text. The
server returns only the current official-notice snapshot and source metadata; it cannot invoke the guide chat,
the browser, or avatar services. Test with `wuzhen-scenic-area` and verify an unknown ID returns
`OFFICIAL_NOTICE_SPOT_NOT_FOUND`.

## Frontend Callback Events

The browser exposes a typed subscription for avatar adapters through
`subscribeCozeAgentEvents` in `apps/web/src/lib/guideSpeechSync.ts`. Each callback receives the work-order
message shape below. The guide chat emits user text, user voice-session, assistant text, and optional avatar
directive command events; no Coze token or provider payload is exposed to the browser.

```ts
{
  role: 'user' | 'assistant',
  content: string,
  type: 'text' | 'voice' | 'command',
  timestamp: number
}
```

## Acceptance Check

1. Ask a greeting through the page and confirm the answer text contains no tag.
2. Return the example directive from the Coze final node and confirm the configured XFYUN avatar performs the matching action once.
3. Return an unknown action such as `delete-all`; confirm the answer still displays and no SDK action runs.
4. Disable the online avatar and repeat; confirm the text answer and local 3D stage continue without an error.
5. In Coze's test panel, run each intent branch with a known Knowledge Base answer, a missing-source question, and an injection attempt embedded in an uploaded document. Confirm the final response never follows the uploaded text as an instruction.
