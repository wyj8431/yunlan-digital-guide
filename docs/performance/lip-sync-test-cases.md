# Lip Sync Test Case List

This is the independent acceptance list for Work Order 6. A case is passed only when its stated
evidence is retained for the current diff; a viewport emulation is not recorded as physical-device evidence.

| ID    | Scenario                   | Steps                                                                                      | Expected result                                                                                                                      | Evidence                                                      |
| ----- | -------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| LS-01 | Preset audio               | Select preset audio and play it.                                                           | The local renderer is nonblank; RMS drives a smoothed mouth value; completion returns the mouth to zero.                             | `phase3a.browser.test.js` and screenshot                      |
| LS-02 | Local audio file           | Select an `audio/*` file, play, pause, then reset.                                         | Playback state changes correctly; pause and reset close the mouth and release audio resources.                                       | Browser recording and console log                             |
| LS-03 | HTTP(S) audio URL          | Submit a reachable HTTPS audio URL, then a non-HTTP(S) URL.                                | Valid URL follows the normal analysis path; invalid protocol produces a recoverable error without a stuck mouth.                     | Browser recording                                             |
| LS-04 | Realtime microphone        | Select realtime microphone, grant permission, speak, then reset or revoke/deny permission. | `getUserMedia` audio drives RMS and mouth opening; the media track stops on reset/unmount; denial is recoverable.                    | Browser recording with permission state                       |
| LS-05 | Source switch while active | Start preset or microphone analysis, then switch source mode.                              | Previous session is disposed before the new source starts; no duplicate analyser, sound, or stale mouth movement remains.            | Browser recording and devtools media inspection               |
| LS-06 | Signal controls            | Change threshold, sensitivity, maximum open, attack, and release during active audio.      | Mouth values remain clamped and smooth; renderer/model is not recreated; silence closes naturally.                                   | Browser recording and debug snapshot                          |
| LS-07 | Three.js lifecycle         | Navigate away from the lab during playback and return.                                     | Animation frame, audio context, media tracks, canvas, geometry, material, and texture resources are cleaned up; a fresh visit works. | `phase3a.browser.test.js` plus browser memory/console capture |
| LS-08 | Live2D speech parameter    | Enable an authorized Cubism model and begin/end guide speech.                              | `ParamMouthOpenY` changes while speaking and is reset to `0` on stop, error, unmount, and model replacement.                         | Authorized-model browser recording                            |
| LS-09 | Audio and render failure   | Use an undecodable file/URL and force a model or WebGL loading error.                      | An actionable error is shown; active source is disposed and mouth is closed.                                                         | Browser recording and console capture                         |
| LS-10 | Long-run stability         | Run continuously for 10 minutes with representative audio.                                 | No crash, persistent flashing, runaway heap trend, or stuck-open mouth; final mouth value is zero.                                   | Benchmark report                                              |
| LS-11 | Performance                | Run three 60-second desktop sessions and three physical-device mobile sessions.            | Desktop average FPS is at least 55 and response is at most 200 ms; mobile result records its actual device and applicable target.    | Benchmark report with device details                          |
| LS-12 | Browser coverage           | Execute LS-01, LS-04, LS-07, and LS-09 on Chromium, Firefox, and WebKit.                   | The same lifecycle behavior holds, or engine-specific deviations are recorded with owner and remediation.                            | Per-engine test output/screenshots                            |

## Automated Baseline

```powershell
npm --workspace apps/web run test -- phase3a.browser.test.js audioSource.test.ts
```

The automated baseline covers deterministic signal and resource behavior. It does not grant microphone
permissions, prove a licensed Live2D production model, substitute viewport emulation for a physical mobile
device, or establish Firefox/WebKit execution. Those items remain evidence-dependent acceptance steps.
