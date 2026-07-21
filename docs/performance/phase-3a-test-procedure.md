# Phase 3A Lip Sync Performance Procedure

## Startup

Run the lab from the repository root:

```powershell
npm --workspace apps/web run dev -- --host 127.0.0.1 --port 5174 --strictPort
```

Open:

```text
http://127.0.0.1:5174/lab/lip-sync?phase3a-debug=1
```

The debug query exposes the read-only `window.__LIP_SYNC_DEBUG__` snapshot used by the browser acceptance test. It does not expose renderer, controller, or audio mutation methods.

## Prerequisites

- Browser: Microsoft Edge 150.0.4078.83, headless through Playwright.
- Device: MECHREVO Jiaolong16Q Series GM6BG7X.
- CPU: AMD Ryzen 7 7435H, 8 cores / 16 logical processors.
- GPU: NVIDIA GeForce RTX 4070 Laptop GPU.
- Memory: 16 GB system memory.
- Test date: 2026-07-21, Asia/Shanghai.

## Test Cases

- Preset audio: select the default preset, click Play, verify nonblank WebGL output, mouth response, completion close, metrics, and route cleanup.
- Local file: select local file mode, load an `audio/*` file, verify playback state and lip-sync metrics update.
- Audio URL: select URL mode, submit an `http:` or `https:` audio URL, verify invalid protocols are rejected and successful URLs follow the same playback path.
- Layout: verify desktop `1440x900` and mobile `390x844` have no horizontal overflow or overlapping controls.
- Runtime controls: change sensitivity, threshold, maximum open, attack, and release sliders and verify stage bounds remain stable.
- Cleanup: navigate away from `/lab/lip-sync` and verify the audio context closes and the WebGL canvas is removed.

## Metric Definitions

- Average FPS: `1000 / average(frameDurationMs)` over the bounded performance window.
- P95 frame time: 95th percentile of recorded frame durations.
- Response latency: first mouth opening above `0.01` minus the first audio RMS frame above the configured threshold.
- Draw calls and triangles: `renderer.info.render.calls` and `renderer.info.render.triangles`.
- Heap MB: `performance.memory.usedJSHeapSize`, rounded to one decimal, or unsupported when unavailable.
- Quality tier: active `low`, `medium`, or `high` rendering profile.

## Automated Commands

Smoke browser acceptance:

```powershell
npm --workspace apps/web run test -- phase3a.browser.test.js
```

Repeatable benchmark run:

```powershell
$env:PHASE3A_BROWSER_MODE='bench'
npm --workspace apps/web run test -- phase3a.browser.test.js
Remove-Item Env:\PHASE3A_BROWSER_MODE
```

The smoke test uses a short deterministic preset run. The benchmark mode runs three 60-second desktop sessions, three 60-second mobile sessions, and one 10-minute stability session.

## 60-Second Results

| Run       | Viewport | Browser            | Quality | Avg FPS | P95 Frame | Response | Draw Calls | Triangles |   Heap | Auto Degradation |
| --------- | -------- | ------------------ | ------- | ------: | --------: | -------: | ---------: | --------: | -----: | ---------------- |
| desktop-1 | 1440x900 | Edge 150.0.4078.83 | medium  |   165.0 |     6.2ms |   12.1ms |         10 |    17,313 | 27.6MB | Yes              |
| desktop-2 | 1440x900 | Edge 150.0.4078.83 | medium  |   165.0 |     6.2ms |   12.0ms |         10 |    17,313 | 43.9MB | Yes              |
| desktop-3 | 1440x900 | Edge 150.0.4078.83 | medium  |   165.0 |     6.2ms |   12.1ms |         10 |    17,313 | 31.5MB | Yes              |
| mobile-1  | 390x844  | Edge 150.0.4078.83 | medium  |   165.0 |     6.2ms |   12.1ms |         10 |    17,313 | 40.5MB | Yes              |
| mobile-2  | 390x844  | Edge 150.0.4078.83 | medium  |   165.0 |     6.2ms |   12.0ms |         10 |    17,313 | 39.1MB | Yes              |
| mobile-3  | 390x844  | Edge 150.0.4078.83 | medium  |   165.0 |     6.2ms |   11.9ms |         10 |    17,313 | 43.3MB | Yes              |

## Stability Result

| Run           | Viewport | Duration | Quality | Avg FPS | P95 Frame | Response | Draw Calls | Triangles | Heap End | Mouth End |
| ------------- | -------- | -------: | ------- | ------: | --------: | -------: | ---------: | --------: | -------: | --------: |
| stability-10m | 1440x900 |      10m | medium  |   165.0 |     6.2ms |   12.1ms |         10 |    17,313 |   47.0MB |         0 |

Heap was supported in this Edge run. The 10-minute run completed without a crash, persistent flashing, visible layout overlap, or unbounded heap growth signal in the captured end value.

## Target Deviations

- Desktop target: at least 55 FPS. All desktop runs exceeded the target at medium quality.
- Mobile target: at least 30 FPS. All mobile viewport runs exceeded the target at medium quality.
- Mouth response target: at or below 200ms. All measured runs were 12.1ms or lower.
- Quality tier: the lab starts at medium by default. The recorded `automaticDegradation` field is true because the active tier is not high; no FPS-driven downgrade below medium occurred during these runs.

## XFYUN Concurrency Note

The `/lab/lip-sync` route uses the local Three.js renderer and in-memory preset audio for Phase 3A measurement. It does not start or occupy the production XFYUN online-avatar session. Keep `/` reserved for XFYUN-first visitor verification and use `/lab/lip-sync` for local lip-sync/performance acceptance.
