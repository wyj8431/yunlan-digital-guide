# Work-Order Load Testing

`npm run load:work-orders` is a dependency-free Node load-test utility for the Java work-order API.
It records warmup and measurement phases independently, including request volume, QPS, P95 latency,
HTTP status counts, error rate, 503 count, and a post-run health result. It never writes the login
token or password into the report.

## Prerequisites

- Start the Java API with the local seed data, or point `WORK_ORDERS_API_URL` at an approved test
  environment.
- Use a non-production account. The status scenario creates one persistent test ticket per worker.
- Do not use the default local credentials outside of the local seeded environment.

## Scenarios

| Scenario        | Endpoint mix                     | Authentication | State change                       |
| --------------- | -------------------------------- | -------------- | ---------------------------------- |
| `ticket-list`   | `GET /api/tickets?projectId=...` | Required       | No                                 |
| `ticket-status` | `POST /api/tickets/{id}/status`  | Required       | Creates isolated load-test tickets |
| `alert-submit`  | `POST /api/alerts`               | Required       | Creates alert aggregate group(s)   |
| `alert-list`    | `GET /api/alerts`                | Required       | No                                 |

The status scenario gives each virtual user an independent ticket and refreshes that ticket after an
unsuccessful status request. This prevents an uncertain timeout outcome from inflating subsequent
optimistic-lock conflicts.

## Run A Short Local Smoke

```powershell
$env:WORK_ORDERS_LOAD_SCENARIO = 'ticket-list'
$env:WORK_ORDERS_LOAD_WARMUP_SECONDS = '1'
$env:WORK_ORDERS_LOAD_DURATION_SECONDS = '3'
$env:WORK_ORDERS_LOAD_CONCURRENCY = '2'
$env:LOAD_OUTPUT = 'artifacts/work-orders/ticket-list-smoke.json'
npm run load:work-orders
```

Run the alert ingestion smoke in the same way:

```powershell
$env:WORK_ORDERS_LOAD_SCENARIO = 'alert-submit'
$env:LOAD_OUTPUT = 'artifacts/work-orders/alert-submit-smoke.json'
npm run load:work-orders
```

For the status-change test, optionally constrain the account to a known project:

```powershell
$env:WORK_ORDERS_LOAD_SCENARIO = 'ticket-status'
$env:WORK_ORDERS_LOAD_PROJECT_ID = '<accessible-project-uuid>'
$env:LOAD_OUTPUT = 'artifacts/work-orders/ticket-status-smoke.json'
npm run load:work-orders
```

## Five-Minute Acceptance Run

Run each required scenario against an isolated environment after a 30-second warmup. Retain the JSON
report from every invocation with the deployment evidence.

```powershell
$env:WORK_ORDERS_LOAD_WARMUP_SECONDS = '30'
$env:WORK_ORDERS_LOAD_DURATION_SECONDS = '300'
$env:WORK_ORDERS_LOAD_CONCURRENCY = '4'
$env:WORK_ORDERS_LOAD_TIMEOUT_MS = '10000'
$env:WORK_ORDERS_LOAD_SCENARIO = 'ticket-list'
$env:LOAD_OUTPUT = 'artifacts/work-orders/ticket-list-acceptance.json'
npm run load:work-orders
```

Repeat after changing `WORK_ORDERS_LOAD_SCENARIO` to `ticket-status`, `alert-submit`, and
`alert-list`. Set `WORK_ORDERS_API_URL`, `WORK_ORDERS_LOAD_EMAIL`, and
`WORK_ORDERS_LOAD_PASSWORD` only for an approved non-local environment. `alert-submit` additionally
reports whether the asynchronous aggregate repeat total reached every accepted submission before the
drain timeout. Since alerts are grouped in configured time buckets, a run that crosses a bucket boundary
can create multiple groups; the report preserves each group and validates their combined repeat count.
Adjust the drain timeout with `WORK_ORDERS_ALERT_DRAIN_TIMEOUT_MS` when necessary.

Set `WORK_ORDERS_LOAD_PACE_MS` to a non-zero per-worker delay only when a write scenario must be
stability-tested against a shared local development database. The default value is `0` and should be used
for isolated acceptance benchmarks. For example, `WORK_ORDERS_LOAD_PACE_MS=1000` limits each worker to
approximately one completed request per second.

## Summarize Reports

Combine raw JSON results into one Markdown report for the deployment record. The summary identifies
short smoke runs, failed alert aggregation, and unhealthy post-run checks instead of treating them as
acceptance evidence.

```powershell
$env:LOAD_SUMMARY_OUTPUT = 'artifacts/work-orders/acceptance-summary.md'
npm run summarize:work-orders-load -- artifacts/work-orders/ticket-list-acceptance.json artifacts/work-orders/ticket-status-acceptance.json artifacts/work-orders/alert-submit-acceptance.json artifacts/work-orders/alert-list-acceptance.json
```

## Report Interpretation

- `measurement.qps` and `measurement.p95LatencyMs` are the primary load measurements; use the warmup
  block only to show the system reached a steady state first.
- `measurement.status503Count` is explicit because queue saturation is a defined alert-ingestion
  behavior. It is included in `measurement.errorRatePercent`.
- `postRunHealth` must have a successful response before treating the run as deployment evidence.
- Preserve the exact target configuration and the JSON artifact. Do not treat a short smoke run as the
  required five-minute benchmark.
