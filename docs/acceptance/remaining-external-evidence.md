# Work-Order External Acceptance Handoff

Updated: 2026-08-12 (Asia/Shanghai)

All repository-local implementation, automated regression coverage, local drills, and reproducible
evidence that can be produced without an external system or a human decision have been completed. This
document is the release gate for evidence that cannot be truthfully generated from source code.

| Work order             | External owner/action                                                                                                                                                          | Required original evidence                                                                                                       | Local completion boundary                                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 Ticket collaboration | Run independent requirements reviews and final owner acceptance; create an approved linked commit history.                                                                     | Verbatim Gemini/Codex reviews, `review-round-N.md`, signed diff/acceptance record, commit links.                                 | Ticket create idempotency, permission, optimistic-lock, and harness coverage are implemented.                                                          |
| 1 Ticket collaboration | Run an approved target-environment concurrent benchmark.                                                                                                                       | Target configuration, raw five-minute result JSON, command log, and owner interpretation.                                        | Local and Compose load commands and report validation are documented.                                                                                  |
| 2 Learning diagnosis   | Run the ten golden cases against an approved real model and obtain teaching-staff scoring.                                                                                     | Raw provider answers, evaluator JSON, at least eight accepted combinations, and all three staff scores per accepted process.     | Deterministic validation, prompt-data isolation, rejected-state UI, and local `learning-submit` smoke evidence are implemented.                        |
| 2 Learning diagnosis   | Obtain independent reviewer and owner acceptance.                                                                                                                              | Verbatim reviewer output and signed final diff/acceptance record.                                                                | Local loop, test, mutation, and database-failure evidence is retained under `artifacts/loop-1/`.                                                       |
| 3 Alert refactor       | Supply the historical Koa endpoint, authentication behavior, payload/schema contract, and fixtures; have the owner approve the `202 Accepted` semantics.                       | Historical contract/fixtures, compatibility comparison result, and explicit approval record.                                     | `/api/alerts/compat/v1` is documented as a new contract only; queue, aggregation, saturation, shutdown, and controlled mutation tests are implemented. |
| 4 LLM integration      | Execute the Coze platform 15-question evaluation and browser matrix on the approved target.                                                                                    | Raw platform conversation/evaluation export, elapsed-time measurements, Chrome/Edge/Firefox/Safari evidence, and owner decision. | Stop/resend, timeout transparency, fallback alignment, WebSocket coverage, request limits, and syntax highlighting are implemented.                    |
| 5 Coze agent           | Deploy the plugin to a stable HTTPS address, update its configured root URL, import and export the Bot/workflow/knowledge-base configuration, and run the official evaluation. | Stable URL and health proof, platform-export bundle, 15-question raw result, and deployment acceptance record.                   | The application integration and Coze knowledge-base preparation documentation are present.                                                             |
| 5 Coze agent           | Obtain the production Live2D model and Cubism distribution authorization.                                                                                                      | Model license, Cubism distribution license, model provenance, and production-enabled verification.                               | The Live2D adapter remains explicitly opt-in until those rights are supplied.                                                                          |
| 6 Lip sync             | Install and run Firefox and WebKit, then execute the manual browser/real-device portions of the test list.                                                                     | Browser versions, recordings/screenshots, real-device results, and any failures.                                                 | Microphone input, Live2D mouth driving, cleanup, unit tests, browser test procedure, and local performance instrumentation are implemented.            |
| 7 Review Skills        | Run the three commands repeatedly in Cursor Desktop and record timing/stability.                                                                                               | Five runs per command, screenshots or screen recording, timing table, and environment/version record.                            | Static command and output-contract validation plus an independent test-case list are implemented.                                                      |

## Evidence Rules

- Retain raw platform output and reviewer replies verbatim. A summary is not a substitute.
- Keep the environment, command, timestamp, software version, and target URL with every measurement.
- Do not treat a local H2 smoke test, static validation, temporary tunnel, or synthetic fixture as
  production, platform, legacy-compatibility, or human-acceptance evidence.
- Add results under the relevant `artifacts/` or `docs/acceptance/` path without storing secrets,
  production credentials, personal data, or production logs.

## Useful Local Entry Points

- `npm run check:work-orders`
- `npm --workspace apps/web run test:e2e:work-orders`
- `npm --workspace apps/web run test:e2e:work-orders:negative`
- `npm --workspace apps/server run test`
- `npm run review:skills`
- `docs/work-orders/load-testing.md`
- `docs/performance/lip-sync-test-cases.md`
- `docs/tooling/code-review-skills-test-cases.md`
