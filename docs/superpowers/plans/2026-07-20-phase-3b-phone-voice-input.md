# Phase 3B Phone-Style Voice Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tap-to-dictate voice input that streams microphone PCM to XFYUN ASR, shows interim text in the existing question field, auto-submits after provider endpoint detection, receives the DeepSeek answer over the same session, and lets the XFYUN online avatar produce the only audible production response.

**Architecture:** Attach a typed `ws` server to the existing Koa HTTP server and keep vendor details behind XFYUN ASR/TTS adapters. The browser captures microphone samples with AudioWorklet, converts them to 16 kHz PCM16, and sends binary frames; a React voice-session hook maps protocol events into the existing guide-chat state. `xfyun-avatar` sessions return text only, while `local-avatar` sessions additionally stream XFYUN TTS PCM for the Phase 3A lab and use audio-energy mouth fallback when no viseme timeline exists.

**Tech Stack:** React 19, TypeScript 5.8, Web Audio AudioWorklet, WebSocket, Koa 2, `ws`, XFYUN IAT WebSocket API, XFYUN TTS WebSocket API, existing DeepSeek OpenAI-compatible client, Vitest, React Testing Library, Supertest, Playwright browser verification.

**Prerequisite:** Complete and verify `docs/superpowers/plans/2026-07-20-phase-3a-lip-sync-performance.md` first.

**Design Reference:** `docs/superpowers/specs/2026-07-20-phase-three-voice-lip-sync-performance-design.md`

---

## File Map

### New Server Files

- `apps/server/src/server.ts` - creates the HTTP server and attaches voice WebSocket handling.
- `apps/server/src/modules/voice/voice.types.ts` - typed JSON protocol and output modes.
- `apps/server/src/modules/voice/voice-session.ts` - one-session state machine and orchestration.
- `apps/server/src/modules/voice/voice-websocket.ts` - WebSocket upgrade, binary input, JSON output, cleanup.
- `apps/server/src/modules/voice/xfyun-auth.ts` - HMAC-signed XFYUN WebSocket URLs.
- `apps/server/src/modules/voice/xfyun-asr.ts` - streaming ASR provider adapter and transcript assembly.
- `apps/server/src/modules/voice/xfyun-tts.ts` - PCM TTS provider adapter for local-avatar sessions.
- `apps/server/tests/xfyun-auth.test.ts` - deterministic signature tests.
- `apps/server/tests/env.test.ts` - ASR/TTS environment parsing tests.
- `apps/server/tests/xfyun-asr.test.ts` - ASR frame and transcript tests.
- `apps/server/tests/xfyun-tts.test.ts` - TTS frame tests.
- `apps/server/tests/voice-session.test.ts` - state, orchestration, and degradation tests.
- `apps/server/tests/voice-websocket.test.ts` - real local WebSocket integration tests.

### New Web Files

- `apps/web/src/types/voice.ts` - mirrored browser protocol types.
- `apps/web/src/voice/audio/pcmEncoding.ts` - pure downsampling and PCM16 conversion.
- `apps/web/src/voice/audio/pcm-capture.worklet.js` - AudioWorklet sample forwarding.
- `apps/web/src/voice/audio/PcmCapture.ts` - microphone lifecycle and chunk callback.
- `apps/web/src/voice/audio/PcmPlaybackQueue.ts` - local-mode PCM scheduling and energy exposure.
- `apps/web/src/voice/viseme/VisemeScheduler.ts` - timestamped viseme blending for providers that supply frames.
- `apps/web/src/voice/VoiceSessionClient.ts` - browser WebSocket protocol client.
- `apps/web/src/voice/useVoiceGuideSession.ts` - React state and callbacks.
- `apps/web/src/components/VoiceInputButton.tsx` - microphone button and status UI.
- `apps/web/tests/pcmEncoding.test.ts` - PCM conversion tests.
- `apps/web/tests/PcmCapture.test.ts` - permission and cleanup tests.
- `apps/web/tests/VoiceSessionClient.test.ts` - event, cancellation, and duplicate-final tests.
- `apps/web/tests/useVoiceGuideSession.test.tsx` - hook transition tests.
- `apps/web/tests/VoiceInputButton.test.tsx` - accessible interaction tests.
- `apps/web/tests/QuestionInput.voice.test.tsx` - interim transcript and auto-send behavior.
- `apps/web/tests/VisemeScheduler.test.ts` - optional viseme timing and energy fallback tests.
- `apps/web/tests/phase3b.browser.test.js` - mobile/desktop voice-input acceptance checks.
- `docs/integration/phase-3b-xfyun-voice.md` - setup, privacy, protocol, and real-provider checklist.

### Modified Files

- `apps/server/package.json` - add `ws` and `@types/ws`.
- `apps/server/src/index.ts` - listen through `createHttpServer`.
- `apps/server/src/config/env.ts` - ASR/TTS settings.
- `.env.example` - non-secret voice configuration example values.
- `apps/web/src/App.tsx` - connect voice-session events to guide state.
- `apps/web/src/hooks/useGuideChat.ts` - support externally orchestrated question/answer completion.
- `apps/web/src/components/GuidePanel.tsx` - pass voice input state to the question control.
- `apps/web/src/components/QuestionInput.tsx` - show interim text and microphone action.
- `apps/web/src/styles.css` - stable microphone/status styles.
- `apps/web/src/lab/lip-sync/LipSyncLab.tsx` - local-avatar voice output integration.
- `apps/web/tests/GuidePanel.test.tsx` - preserve existing text/quick-question behavior.
- `apps/server/tests/api.test.ts` - HTTP API remains unaffected by attached WebSocket support.
- `README.md` - voice startup and fallback behavior.

---

### Task 1: Add Voice Configuration, Dependencies, and Protocol Types

**Files:**

- Modify: `apps/server/package.json`
- Modify: `apps/server/src/config/env.ts`
- Modify: `.env.example`
- Create: `apps/server/src/modules/voice/voice.types.ts`
- Create: `apps/web/src/types/voice.ts`
- Test: `apps/server/tests/env.test.ts`

- [ ] **Step 1: Install WebSocket dependencies**

Run:

```powershell
npm --workspace apps/server install ws
npm --workspace apps/server install --save-dev @types/ws
```

Expected: npm exits 0 and package manifests/lockfile contain `ws` and `@types/ws`.

- [ ] **Step 2: Write a failing environment test**

Create `apps/server/tests/env.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readEnv } from '../src/config/env';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('voice environment', () => {
  it('reads separate XFYUN ASR and TTS configuration', () => {
    vi.stubEnv('XFYUN_ASR_ENABLED', 'true');
    vi.stubEnv('XFYUN_ASR_APP_ID', 'asr-app');
    vi.stubEnv('XFYUN_TTS_APP_ID', 'tts-app');
    const env = readEnv();
    expect(env.xfyunAsrEnabled).toBe(true);
    expect(env.xfyunAsrAppId).toBe('asr-app');
    expect(env.xfyunTtsAppId).toBe('tts-app');
  });
});
```

- [ ] **Step 3: Verify RED**

Run:

```powershell
npm --workspace apps/server run test -- env.test.ts
```

Expected: FAIL because the new fields do not exist.

- [ ] **Step 4: Add exact server configuration**

Extend `ServerEnv` and `readEnv()` with:

```ts
xfyunAsrEnabled: boolean;
xfyunAsrAppId: string;
xfyunAsrApiKey: string;
xfyunAsrApiSecret: string;
xfyunAsrUrl: string;
xfyunTtsEnabled: boolean;
xfyunTtsAppId: string;
xfyunTtsApiKey: string;
xfyunTtsApiSecret: string;
xfyunTtsUrl: string;
xfyunTtsVoice: string;
```

Defaults:

```ts
xfyunAsrUrl: process.env.XFYUN_ASR_URL ?? 'wss://iat-api.xfyun.cn/v2/iat';
xfyunTtsUrl: process.env.XFYUN_TTS_URL ?? 'wss://tts-api.xfyun.cn/v2/tts';
xfyunTtsVoice: process.env.XFYUN_TTS_VOICE ?? 'xiaoyan';
```

Add corresponding entries to `.env.example`. Never put real credentials in the example or tests.

- [ ] **Step 5: Define the protocol identically on server and web**

Both `voice.types.ts` files use these discriminated unions:

```ts
export type VoiceOutputMode = 'xfyun-avatar' | 'local-avatar';

export type VoiceClientEvent =
  | {
      type: 'session.start';
      sessionId: string;
      sequence: number;
      outputMode: VoiceOutputMode;
      sampleRate: 16000;
    }
  | { type: 'session.cancel'; sessionId: string; sequence: number };

export type VoiceServerEvent =
  | { type: 'session.created'; sessionId: string; sequence: number }
  | { type: 'transcript.partial'; sessionId: string; sequence: number; text: string }
  | { type: 'transcript.final'; sessionId: string; sequence: number; text: string }
  | {
      type: 'answer.final';
      sessionId: string;
      sequence: number;
      answer: string;
      cards: Array<{ type: 'route-step'; title: string; duration: string; description: string }>;
    }
  | {
      type: 'viseme.batch';
      sessionId: string;
      sequence: number;
      frames: Array<{ offsetMs: number; name: string; weight: number }>;
    }
  | { type: 'response.done'; sessionId: string; sequence: number }
  | {
      type: 'error';
      sessionId: string;
      sequence: number;
      code: string;
      message: string;
      recoverable: boolean;
    };
```

Binary client frames are PCM16 mono at 16 kHz. Binary server frames are PCM16 mono at 16 kHz and are emitted only for `local-avatar`.

At the end of the server `voice.types.ts` only, define the TTS dependency before the session orchestrator is implemented:

```ts
export type SpeechSynthesisProvider = {
  synthesize(
    text: string,
    callbacks: { onAudio(pcm: Buffer): void; onComplete(): void; onError(error: Error): void }
  ): Promise<{ cancel(): void }>;
};
```

- [ ] **Step 6: Verify GREEN and commit**

```powershell
npm --workspace apps/server run test -- env.test.ts
npm --workspace apps/server run typecheck
npm --workspace apps/web run typecheck
git add apps/server/package.json package-lock.json apps/server/src/config/env.ts .env.example apps/server/src/modules/voice/voice.types.ts apps/web/src/types/voice.ts apps/server/tests/env.test.ts
git commit -m "feat(voice): define voice session configuration"
```

---

### Task 2: Capture 16 kHz PCM Audio in the Browser

**Files:**

- Create: `apps/web/src/voice/audio/pcmEncoding.ts`
- Create: `apps/web/src/voice/audio/pcm-capture.worklet.js`
- Create: `apps/web/src/voice/audio/PcmCapture.ts`
- Test: `apps/web/tests/pcmEncoding.test.ts`
- Test: `apps/web/tests/PcmCapture.test.ts`

- [ ] **Step 1: Write failing PCM tests**

Create `apps/web/tests/pcmEncoding.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { downsampleFloat32, floatToPcm16 } from '../src/voice/audio/pcmEncoding';

describe('PCM encoding', () => {
  it('downsamples 48 kHz to 16 kHz deterministically', () => {
    const input = Float32Array.from([0, 0.3, 0.6, 0.6, 0.3, 0, -0.3, -0.6, -0.6]);
    expect(Array.from(downsampleFloat32(input, 48000, 16000))).toEqual([0.3, 0.3, -0.5]);
  });

  it('clamps float samples into signed PCM16', () => {
    expect(Array.from(floatToPcm16(Float32Array.from([-2, -1, 0, 1, 2])))).toEqual([
      -32768, -32768, 0, 32767, 32767
    ]);
  });
});
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
npm --workspace apps/web run test -- pcmEncoding.test.ts
```

Expected: FAIL because the encoding module does not exist.

- [ ] **Step 3: Implement deterministic encoding**

`downsampleFloat32` rejects output rates greater than input rates, averages each source range into one output sample, and returns the input unchanged when rates match. `floatToPcm16` clamps to `[-1, 1]`, maps negative samples with `0x8000`, positive samples with `0x7fff`, and returns `Int16Array`.

- [ ] **Step 4: Implement the AudioWorklet processor**

`pcm-capture.worklet.js` copies channel zero into a new `Float32Array`, posts its transferable buffer to the main thread, and returns `true`. It never stores samples across calls.

```js
class PcmCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel?.length) {
      const copy = new Float32Array(channel);
      this.port.postMessage(copy.buffer, [copy.buffer]);
    }
    return true;
  }
}

registerProcessor('pcm-capture', PcmCaptureProcessor);
```

- [ ] **Step 5: Write failing microphone lifecycle tests**

Mock `navigator.mediaDevices.getUserMedia`, `AudioContext`, worklet loading, source disconnection, track stopping, and context closing. Assert `start()` calls `onChunk` with an `ArrayBuffer`, while `stop()` stops every media track and closes the context exactly once.

- [ ] **Step 6: Implement `PcmCapture`**

Public API:

```ts
export class PcmCapture {
  constructor(options: { onChunk: (pcm: ArrayBuffer) => void; targetSampleRate?: 16000 });
  start(): Promise<void>;
  stop(): Promise<void>;
  get active(): boolean;
}
```

`start()` obtains mono audio with echo cancellation and noise suppression, loads the worklet via `new URL('./pcm-capture.worklet.js', import.meta.url)`, downscales each message, encodes PCM16, and emits the exact byte range rather than the backing buffer of a larger view. A second `start()` while active is ignored. `stop()` is idempotent.

- [ ] **Step 7: Verify GREEN and commit**

```powershell
npm --workspace apps/web run test -- pcmEncoding.test.ts PcmCapture.test.ts
npm --workspace apps/web run typecheck
git add apps/web/src/voice/audio apps/web/tests/pcmEncoding.test.ts apps/web/tests/PcmCapture.test.ts
git commit -m "feat(web): capture streaming pcm microphone audio"
```

---

### Task 3: Sign XFYUN Requests and Implement Streaming ASR

**Files:**

- Create: `apps/server/src/modules/voice/xfyun-auth.ts`
- Create: `apps/server/src/modules/voice/xfyun-asr.ts`
- Test: `apps/server/tests/xfyun-auth.test.ts`
- Test: `apps/server/tests/xfyun-asr.test.ts`

- [ ] **Step 1: Write a deterministic failing signature test**

Inject a fixed RFC 1123 date and assert the signed URL contains `authorization`, `date`, and `host`; decode `authorization` and assert it includes the API key, `hmac-sha256`, and `host date request-line` headers. Never snapshot a real secret.

- [ ] **Step 2: Verify RED**

```powershell
npm --workspace apps/server run test -- xfyun-auth.test.ts
```

Expected: FAIL because `xfyun-auth.ts` is missing.

- [ ] **Step 3: Implement the shared signer**

Use `node:crypto` HMAC SHA-256. Derive the request line from the URL path and query, sign:

```text
host: {host}
date: {date}
GET {path} HTTP/1.1
```

Base64-encode the signature and authorization origin, then return a URL with encoded `authorization`, `date`, and `host` parameters.

- [ ] **Step 4: Write failing ASR frame and transcript tests**

Use an injected fake WebSocket. Assert:

- first audio uses status `0`, `audio/L16;rate=16000`, and includes `common`/`business`;
- middle audio uses status `1`;
- `finish()` sends status `2` with empty audio;
- `vad_eos` is `1200`;
- `pgs: 'rpl'` replaces the XFYUN range instead of duplicating words;
- final status emits one final transcript and closes the provider.

- [ ] **Step 5: Implement `XfyunAsrSession`**

Public provider contract:

```ts
export type AsrCallbacks = {
  onPartial(text: string): void;
  onFinal(text: string): void;
  onError(error: Error): void;
};

export type AsrSession = {
  open(): Promise<void>;
  pushAudio(pcm: Buffer): void;
  finish(): void;
  cancel(): void;
};
```

Set business parameters to Chinese Mandarin, dynamic correction, and `vad_eos: 1200`. Validate upstream XFYUN `code === 0`; cap queued audio while connecting; reject writes after finish/cancel; emit only changed partial text and exactly one final text.

- [ ] **Step 6: Verify GREEN and commit**

```powershell
npm --workspace apps/server run test -- xfyun-auth.test.ts xfyun-asr.test.ts
npm --workspace apps/server run typecheck
git add apps/server/src/modules/voice/xfyun-auth.ts apps/server/src/modules/voice/xfyun-asr.ts apps/server/tests/xfyun-auth.test.ts apps/server/tests/xfyun-asr.test.ts
git commit -m "feat(server): integrate xfyun streaming asr"
```

---

### Task 4: Orchestrate One Voice Session Test-First

**Files:**

- Create: `apps/server/src/modules/voice/voice-session.ts`
- Test: `apps/server/tests/voice-session.test.ts`

- [ ] **Step 1: Write failing orchestration tests with fake providers**

Cover these cases:

1. `start()` emits `session.created` and opens ASR.
2. Partial transcripts are forwarded with increasing sequence values.
3. One final transcript emits `transcript.final`, calls `createGuideResponse` once, then emits `answer.final` and `response.done`.
4. Duplicate ASR finals are ignored.
5. Empty final text emits recoverable `EMPTY_TRANSCRIPT` and no guide request.
6. `cancel()` prevents all late provider events.
7. `xfyun-avatar` never calls TTS.
8. `local-avatar` calls TTS after `answer.final`.

- [ ] **Step 2: Verify RED**

```powershell
npm --workspace apps/server run test -- voice-session.test.ts
```

Expected: FAIL because `VoiceSession` is missing.

- [ ] **Step 3: Implement the state machine**

States are `created`, `listening`, `answering`, `synthesizing`, `done`, and `cancelled`. Only these transitions are valid:

```text
created -> listening
listening -> answering | cancelled | done(error)
answering -> synthesizing(local) | done(xfyun) | cancelled
synthesizing -> done | cancelled
```

The constructor receives `sessionId`, `outputMode`, `emitJson`, `emitAudio`, `createAsr`, `createTts`, `createGuideResponse`, and `env`. It owns sequence assignment. It does not parse WebSocket frames.

- [ ] **Step 4: Map failures explicitly**

Use stable codes: `ASR_CONFIG_MISSING`, `ASR_FAILED`, `EMPTY_TRANSCRIPT`, `GUIDE_FAILED`, `TTS_CONFIG_MISSING`, `TTS_FAILED`, and `SESSION_CANCELLED`. ASR/guide failures end the session; TTS failures preserve the answer and end with an error followed by `response.done`.

- [ ] **Step 5: Verify GREEN and commit**

```powershell
npm --workspace apps/server run test -- voice-session.test.ts
git add apps/server/src/modules/voice/voice-session.ts apps/server/tests/voice-session.test.ts
git commit -m "feat(server): orchestrate voice guide sessions"
```

---

### Task 5: Attach the Voice WebSocket Server to Koa

**Files:**

- Create: `apps/server/src/modules/voice/voice-websocket.ts`
- Create: `apps/server/src/server.ts`
- Modify: `apps/server/src/index.ts`
- Test: `apps/server/tests/voice-websocket.test.ts`
- Modify: `apps/server/tests/api.test.ts`

- [ ] **Step 1: Write a failing local WebSocket integration test**

Start an ephemeral HTTP server on port `0`, connect `ws://127.0.0.1:{port}/api/voice`, send `session.start`, wait for `session.created`, send one binary PCM frame, and assert the injected ASR fake receives the exact bytes. Also test malformed JSON, binary-before-start, mismatched session IDs, duplicate starts, cancel, and socket close cleanup.

- [ ] **Step 2: Verify RED**

```powershell
npm --workspace apps/server run test -- voice-websocket.test.ts
```

Expected: FAIL because the HTTP/WebSocket composition does not exist.

- [ ] **Step 3: Implement WebSocket parsing and limits**

Create `attachVoiceWebSocketServer(server, dependencies)` using `WebSocketServer({ server, path: '/api/voice', maxPayload: 128 * 1024 })`. Accept one active session per socket. JSON frames must parse as `session.start` or `session.cancel`; binary frames are accepted only after start and are capped at 64 KiB each. On close/error, cancel the active session and remove listeners.

- [ ] **Step 4: Create the HTTP server boundary**

`createHttpServer()` returns:

```ts
export function createHttpServer(options?: VoiceServerDependencies) {
  const app = createApp();
  const server = createServer(app.callback());
  const voice = attachVoiceWebSocketServer(server, options);
  return { app, server, voice };
}
```

Modify `index.ts` to call `createHttpServer()` and `server.listen(env.port)`. Keep `createApp()` unchanged so Supertest HTTP tests remain fast.

- [ ] **Step 5: Verify GREEN and HTTP regression**

```powershell
npm --workspace apps/server run test -- voice-websocket.test.ts api.test.ts
npm --workspace apps/server run typecheck
```

Expected: WebSocket and all existing HTTP tests pass.

- [ ] **Step 6: Commit**

```powershell
git add apps/server/src/modules/voice/voice-websocket.ts apps/server/src/server.ts apps/server/src/index.ts apps/server/tests/voice-websocket.test.ts apps/server/tests/api.test.ts
git commit -m "feat(server): expose voice websocket endpoint"
```

---

### Task 6: Refactor Guide Chat for External Voice Responses

**Files:**

- Modify: `apps/web/src/hooks/useGuideChat.ts`
- Create: `apps/web/tests/useGuideChat.test.tsx`

- [ ] **Step 1: Write failing hook tests**

Assert:

- `beginExternalQuestion('你好')` adds one user message, clears old answer/error, and sets loading;
- a second begin while loading returns `false` and adds nothing;
- `completeExternalQuestion(response)` adds one assistant message, sets cards/latest answer, and clears loading;
- duplicate completion for the same session ID is ignored;
- `failExternalQuestion(message)` clears loading and preserves the user message;
- existing REST `ask()` behavior remains unchanged.

- [ ] **Step 2: Verify RED**

```powershell
npm --workspace apps/web run test -- useGuideChat.test.tsx
```

Expected: FAIL because external methods do not exist.

- [ ] **Step 3: Implement explicit external methods**

Return these additions from `useGuideChat`:

```ts
beginExternalQuestion(sessionId: string, message: string): boolean;
completeExternalQuestion(sessionId: string, response: GuideChatResponse): void;
failExternalQuestion(sessionId: string, message: string): void;
```

Track the active external session in a ref. Only that session may complete or fail. Use one shared `beginQuestion` helper and one shared `completeQuestion` helper so REST and voice paths produce identical message/card state.

- [ ] **Step 4: Verify GREEN and commit**

```powershell
npm --workspace apps/web run test -- useGuideChat.test.tsx
npm --workspace apps/web run typecheck
git add apps/web/src/hooks/useGuideChat.ts apps/web/tests/useGuideChat.test.tsx
git commit -m "refactor(web): support external guide responses"
```

---

### Task 7: Implement the Browser Voice Session Client and Hook

**Files:**

- Create: `apps/web/src/voice/VoiceSessionClient.ts`
- Create: `apps/web/src/voice/useVoiceGuideSession.ts`
- Test: `apps/web/tests/VoiceSessionClient.test.ts`
- Test: `apps/web/tests/useVoiceGuideSession.test.tsx`

- [ ] **Step 1: Write failing protocol-client tests**

With fake WebSocket and fake `PcmCapture`, assert `start()` sends `session.start`, sends PCM as binary, forwards only matching-session events, rejects non-monotonic sequence values, calls final transcript once, calls answer once, and `cancel()` sends `session.cancel`, stops capture, closes the socket, and ignores late messages.

- [ ] **Step 2: Verify RED**

```powershell
npm --workspace apps/web run test -- VoiceSessionClient.test.ts
```

Expected: FAIL because the client does not exist.

- [ ] **Step 3: Implement `VoiceSessionClient`**

Public API:

```ts
export type VoiceSessionCallbacks = {
  onStatus(
    status: 'connecting' | 'listening' | 'recognizing' | 'thinking' | 'speaking' | 'idle'
  ): void;
  onPartial(text: string): void;
  onFinalTranscript(sessionId: string, text: string): void;
  onAnswer(sessionId: string, response: GuideChatResponse): void;
  onAudio?(pcm: ArrayBuffer): void;
  onVisemes?(frames: Array<{ offsetMs: number; name: string; weight: number }>): void;
  onError(message: string): void;
};

export class VoiceSessionClient {
  constructor(options: {
    url: string;
    outputMode: VoiceOutputMode;
    callbacks: VoiceSessionCallbacks;
  });
  start(): Promise<void>;
  cancel(): Promise<void>;
  dispose(): Promise<void>;
}
```

Generate the session ID with `crypto.randomUUID()`. Build the WebSocket URL from `window.location`, using `ws:` on HTTP and `wss:` on HTTPS. On `transcript.final`, stop `PcmCapture` before forwarding the final transcript so endpoint detection cannot continue sending audio. Convert `answer.final` to the existing `GuideChatResponse` shape by adding `source: 'llm'`. Do not log binary audio or transcript text.

- [ ] **Step 4: Write failing hook transition tests**

Assert first click starts, second click cancels, partial text updates, final transcript calls `beginExternalQuestion`, answer calls `completeExternalQuestion`, errors call `failExternalQuestion`, and unmount disposes the client.

- [ ] **Step 5: Implement `useVoiceGuideSession`**

Return:

```ts
export type VoiceGuideState = {
  supported: boolean;
  status: 'idle' | 'connecting' | 'listening' | 'recognizing' | 'thinking' | 'speaking' | 'error';
  transcript: string;
  error: string | null;
  toggle(): void;
  cancel(): void;
};
```

`supported` requires `navigator.mediaDevices?.getUserMedia`, `AudioWorkletNode`, and `WebSocket`. `toggle()` cancels while active and starts only from idle/error. Clear transcript after successful auto-submit, not while interim words are visible.

- [ ] **Step 6: Verify GREEN and commit**

```powershell
npm --workspace apps/web run test -- VoiceSessionClient.test.ts useVoiceGuideSession.test.tsx
npm --workspace apps/web run typecheck
git add apps/web/src/voice apps/web/tests/VoiceSessionClient.test.ts apps/web/tests/useVoiceGuideSession.test.tsx
git commit -m "feat(web): add realtime voice guide client"
```

---

### Task 8: Add the Phone-Style Microphone Control

**Files:**

- Create: `apps/web/src/components/VoiceInputButton.tsx`
- Modify: `apps/web/src/components/QuestionInput.tsx`
- Modify: `apps/web/src/components/GuidePanel.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/styles.css`
- Test: `apps/web/tests/VoiceInputButton.test.tsx`
- Test: `apps/web/tests/QuestionInput.voice.test.tsx`
- Modify: `apps/web/tests/GuidePanel.test.tsx`

- [ ] **Step 1: Write failing accessible interaction tests**

Assert:

- idle button uses Lucide `Mic`, label `开始语音输入`, and a stable 44x44 box;
- listening uses `Square`, label `取消语音输入`, and a visible live status;
- partial transcript replaces the input value as it arrives;
- final transcript is auto-submitted by the voice hook, not by a second form submit;
- permission/ASR error leaves typing and the text send button enabled;
- unsupported browsers hide or disable only the microphone control;
- button/status changes do not resize the form.

- [ ] **Step 2: Verify RED**

```powershell
npm --workspace apps/web run test -- VoiceInputButton.test.tsx QuestionInput.voice.test.tsx
```

Expected: FAIL because voice props and components do not exist.

- [ ] **Step 3: Implement `VoiceInputButton`**

Props:

```ts
type VoiceInputButtonProps = {
  supported: boolean;
  status: VoiceGuideState['status'];
  disabled: boolean;
  onToggle(): void;
};
```

Use icon-only buttons with `title`, `aria-label`, `aria-pressed`, and an adjacent `role="status"` element. On mobile, show `正在听...`; on desktop the same text remains screen-reader-visible unless space permits.

- [ ] **Step 4: Wire the hook at `App` level**

Create the voice hook with callbacks to `chat.beginExternalQuestion`, `chat.completeExternalQuestion`, and `chat.failExternalQuestion`. Pass the resulting state through `GuidePanel` to `QuestionInput`. Keep `DigitalHumanStage answerText={chat.latestAnswer}` unchanged so the XFYUN avatar remains the only production speaker.

- [ ] **Step 5: Update the question form layout**

Use grid columns `minmax(0, 1fr) 44px 44px` for text, microphone, and send. Preserve the independent left-panel scroll fix. Interim text remains editable only after the session ends; typing while listening is disabled to avoid mixing sources. On error, keep recognized text and restore editing.

- [ ] **Step 6: Verify GREEN and regression**

```powershell
npm --workspace apps/web run test -- VoiceInputButton.test.tsx QuestionInput.voice.test.tsx GuidePanel.test.tsx layoutCss.test.js
npm --workspace apps/web run typecheck
```

Expected: all voice, text input, guide, and layout tests pass.

- [ ] **Step 7: Commit**

```powershell
git add apps/web/src/App.tsx apps/web/src/components/VoiceInputButton.tsx apps/web/src/components/QuestionInput.tsx apps/web/src/components/GuidePanel.tsx apps/web/src/styles.css apps/web/tests/VoiceInputButton.test.tsx apps/web/tests/QuestionInput.voice.test.tsx apps/web/tests/GuidePanel.test.tsx
git commit -m "feat(web): add phone style voice input"
```

---

### Task 9: Implement XFYUN TTS for Local-Avatar Sessions

**Files:**

- Create: `apps/server/src/modules/voice/xfyun-tts.ts`
- Create: `apps/web/src/voice/audio/PcmPlaybackQueue.ts`
- Create: `apps/web/src/voice/viseme/VisemeScheduler.ts`
- Modify: `apps/web/src/lab/lip-sync/three/mouthMorphController.ts`
- Modify: `apps/web/src/lab/lip-sync/LipSyncLab.tsx`
- Test: `apps/server/tests/xfyun-tts.test.ts`
- Create: `apps/web/tests/PcmPlaybackQueue.test.ts`
- Create: `apps/web/tests/VisemeScheduler.test.ts`

- [ ] **Step 1: Write failing TTS provider tests**

With a fake upstream WebSocket, assert the first request includes app ID, text encoded as base64 UTF-8, `aue: 'raw'`, `auf: 'audio/L16;rate=16000'`, configured voice, and speed/pitch/volume. Assert each returned audio payload is decoded and emitted in order, upstream errors reject, and final status closes once.

- [ ] **Step 2: Verify RED**

```powershell
npm --workspace apps/server run test -- xfyun-tts.test.ts
```

Expected: FAIL because the TTS adapter is absent.

- [ ] **Step 3: Implement `XfyunTtsProvider`**

Implement the `SpeechSynthesisProvider` contract created in Task 1:

```ts
export class XfyunSpeechSynthesisProvider implements SpeechSynthesisProvider {
  constructor(private readonly env: ServerEnv) {}
  synthesize(
    text: string,
    callbacks: { onAudio(pcm: Buffer): void; onComplete(): void; onError(error: Error): void }
  ): Promise<{ cancel(): void }>;
}
```

Use the shared XFYUN signer, PCM16 16 kHz output, configured voice, bounded text length, and cancellation. Do not log answer text or audio.

- [ ] **Step 4: Write failing PCM playback and viseme tests**

Assert sequential chunks are scheduled without overlap, `stop()` cancels scheduled nodes, energy frames are available to the Phase 3A mouth filter, and queue completion returns energy to zero. In `VisemeScheduler.test.ts`, enqueue `viseme_aa` followed by `viseme_O`, sample between their timestamps, and assert the old target fades out while the new target fades in. Assert an empty queue reports no active viseme so RMS fallback remains enabled.

- [ ] **Step 5: Implement and connect local mode**

`PcmPlaybackQueue` converts each little-endian PCM16 chunk into an `AudioBuffer`, schedules it at `max(context.currentTime, nextStartTime)`, and exposes current normalized RMS. Extend `MouthMorphController` with `setViseme(name, weight)` and `clearVisemes()` by resolving named morph targets across every face mesh. `VisemeScheduler` maintains a bounded, timestamp-sorted frame queue and returns blended previous/current weights. Add a `语音问答` source to the lab only after 3A's original three sources remain working. Start `VoiceSessionClient` with `outputMode: 'local-avatar'`, enqueue binary server frames, drive scheduled visemes when present, and feed queue RMS into `LipSyncRenderer` only when the viseme queue is empty.

- [ ] **Step 6: Verify GREEN and commit**

```powershell
npm --workspace apps/server run test -- xfyun-tts.test.ts voice-session.test.ts
npm --workspace apps/web run test -- PcmPlaybackQueue.test.ts VisemeScheduler.test.ts LipSyncLab.test.tsx mouthMorphController.test.ts
npm run typecheck
git add apps/server/src/modules/voice/xfyun-tts.ts apps/server/tests/xfyun-tts.test.ts apps/web/src/voice/audio/PcmPlaybackQueue.ts apps/web/src/voice/viseme/VisemeScheduler.ts apps/web/src/lab/lip-sync/three/mouthMorphController.ts apps/web/src/lab/lip-sync/LipSyncLab.tsx apps/web/tests/PcmPlaybackQueue.test.ts apps/web/tests/VisemeScheduler.test.ts apps/web/tests/LipSyncLab.test.tsx apps/web/tests/mouthMorphController.test.ts
git commit -m "feat(voice): stream local avatar tts audio"
```

---

### Task 10: Real-Provider, Privacy, and Browser Acceptance

**Files:**

- Create: `apps/web/tests/phase3b.browser.test.js`
- Create: `docs/integration/phase-3b-xfyun-voice.md`
- Modify: `README.md`

- [ ] **Step 1: Add mocked browser acceptance scenarios**

Test at desktop `1440x900` and mobile `390x844`:

1. Tap microphone, receive two partial transcripts, and verify the input updates without layout shift.
2. Receive one final transcript and one answer; verify one user message, one assistant message, and one XFYUN `writeText` call.
3. Send a duplicate final and duplicate answer; verify no duplicate chat messages.
4. Cancel while listening; verify no question is sent.
5. Deny microphone permission; verify text input/send still work.
6. Disconnect WebSocket; verify the current session stops and can be retried.
7. Ensure document/left-panel scrolling and right-stage fixed positioning remain correct.
8. Assert no transcript or audio bytes are written to localStorage, IndexedDB, or application logs.

- [ ] **Step 2: Write the real-provider checklist before using credentials**

`docs/integration/phase-3b-xfyun-voice.md` must include:

- separate XFYUN ASR/TTS product activation requirements;
- `.env` key names without values;
- localhost/HTTPS microphone requirement;
- expected 16 kHz PCM format;
- protocol event order;
- 1.2-second `vad_eos` behavior;
- one-avatar-session concurrency constraint;
- privacy statement that application storage/logging excludes raw audio and transcripts;
- failure and retry matrix;
- steps to verify exactly one audible XFYUN-avatar response;
- local-avatar TTS fallback test.

- [ ] **Step 3: Run mocked automated gates**

```powershell
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: every command exits 0.

- [ ] **Step 4: Run real XFYUN integration manually**

With valid ASR/TTS permissions in `apps/server/.env`:

1. close all other XFYUN avatar test tabs;
2. start `npm run dev`;
3. open `http://localhost:5174`;
4. tap microphone and say a short Mandarin question;
5. verify partial text appears, silence finalizes near 1.2 seconds, and the question sends once;
6. verify DeepSeek answer appears and only the XFYUN avatar speaks;
7. test microphone denial, network interruption, empty speech, and retry;
8. open `/lab/lip-sync`, choose local voice mode, and verify TTS audio drives mouth energy without a viseme batch.

- [ ] **Step 5: Record measured integration results**

Document ASR first-partial latency, finalization latency after silence, answer latency, whether duplicate submission occurred, whether one or two audio outputs were heard, and every tested browser/device. Do not include API keys, authorization URLs, raw audio, or full user transcripts.

- [ ] **Step 6: Commit**

```powershell
git add apps/web/tests/phase3b.browser.test.js docs/integration/phase-3b-xfyun-voice.md README.md
git commit -m "test: document phase 3b voice acceptance"
```

---

## Phase 3B Completion Gate

Phase 3 is complete only when:

- tapping the production microphone produces live interim text and one auto-submitted final question;
- cancellation and every failure leave normal typing available;
- one session cannot create duplicate user or assistant messages;
- XFYUN online avatar remains primary and is the only audible production output;
- local-avatar mode receives XFYUN TTS PCM and uses energy mouth fallback without visemes;
- raw microphone audio is not persisted or logged;
- desktop/mobile layouts remain stable and independently scroll correctly;
- full tests, typecheck, lint, build, mocked browser checks, and real-provider checklist pass.
