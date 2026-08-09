# Phase 3A Local TTS Lip Sync Acceptance

This procedure validates the production local-avatar fallback, not the vendor-managed online avatar.
Keep credentials in the root `.env`; never paste them into this document, screenshots, logs, or issue
comments.

## Configuration

Set the following locally, using real XFYUN TTS credentials:

```text
XFYUN_TTS_APP_ID=<local-only value>
XFYUN_TTS_API_KEY=<local-only value>
XFYUN_TTS_API_SECRET=<local-only value>
XFYUN_TTS_VOICE=xiaoyan
XFYUN_VIRTUAL_HUMAN_ENABLED=false
VIRTUAL_HUMAN_PROVIDER=local
```

Restart the server after changing `.env`:

```powershell
npm run dev
```

Open `http://127.0.0.1:5173/` and keep the online avatar disabled so the browser/server TTS fallback
is the only audio owner.

## Manual Run

1. Submit a short Chinese answer from text chat.
2. Confirm the browser produces one audible response.
3. Confirm the local Three.js model opens its mouth from the audible playback, including a pause and
   the final close.
4. Press stop or navigate away during playback; confirm the mouth closes and no audio continues.
5. Repeat with a long answer that crosses multiple TTS chunks; confirm there is no mouth reset between
   chunks.
6. Disable or break TTS credentials; confirm text remains visible and the browser speech fallback does
   not crash the stage.

## Record Only These Metrics

```text
date:
browser:
device:
first-mouth-response-ms:
duplicate-audio: yes/no
mouth-closed-after-stop: yes/no
mouth-closed-after-navigation: yes/no
chunk-switch-continuity: pass/fail
tts-fallback: pass/fail
notes:
```

Do not record raw audio, full transcripts, API responses, signed URLs, or secret values.
