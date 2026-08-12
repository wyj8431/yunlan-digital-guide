# Work-Order Verification Record - 2026-08-10

## Scope

This record captures reproducible local verification of the Java work-order service, React work-order
screen, Vite proxy, and an isolated Docker Compose stack with PostgreSQL. It is not a production
acceptance record. The four final H2 load scenarios ran for five minutes, but the two write scenarios were
intentionally paced to one worker for local database stability verification.

## Regression Results

| Command                                                      | Result               | Evidence                                                                                                                                                                  |
| ------------------------------------------------------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check:work-orders`                                  | Passed in 71 seconds | Root lint, web typecheck, and Maven `verify` completed. Maven reported 22 passing tests and one PostgreSQL-only test skipped because no PostgreSQL URL was configured.    |
| `npm --workspace apps/web run test:e2e:work-orders`          | Passed               | Browser positive flow covers ticket creation, reassignment, status change, learning review, and alert aggregation through the Vite proxy.                                 |
| `npm --workspace apps/web run test:e2e:work-orders:negative` | Passed               | Browser session verifies non-reporter reassignment is forbidden, stale ticket versions conflict, and malformed teacher diagnosis edits remain unpublished.                |
| Alert test group                                             | Passed               | Nine tests cover alert HTTP behavior, queue capacity, fixed consumer concurrency, recovery after a simulated async writer failure, and local concurrent aggregation.      |
| Docker Compose browser flows                                 | Passed               | Docker Desktop 29.7.2 ran PostgreSQL 16.14, Java API, and Nginx work-order UI on isolated ports. Both positive and negative browser flows passed through the Nginx proxy. |
| PostgreSQL alert upsert concurrency                          | Passed               | `AlertGroupPostgresConcurrencyTest` connected to the Compose PostgreSQL instance and atomically merged 32 concurrent events into one critical alert group.                |

The queue recovery test deliberately logs one simulated writer exception. The test passes only after the
following event is consumed, so that log entry is expected test evidence rather than a failed build.

## Local Runtime Evidence

All runs used `http://127.0.0.1:8080`. Each report contains its status-code distribution and post-run
health response. The four final five-minute results are collected in the
[local load summary](../../artifacts/work-orders/local-load-summary-2026-08-10.md).

| Scenario                                          | Measurement | Result                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alert list, five-minute local run                 | 300 seconds | 434,663 requests, 1,448.86 QPS, P95 4.95ms, 0% errors, and a healthy post-run API. This confirms local H2 read stability only. [JSON](../../artifacts/work-orders/alert-list-5m-local-20260810.json)                                                                                                                                     |
| Ticket list, five-minute local run                | 300 seconds | 303,074 requests, 1,010.24 QPS, P95 6.59ms, 0% errors, and a healthy post-run API. This confirms local H2 read stability only. [JSON](../../artifacts/work-orders/ticket-list-5m-local-20260810.json)                                                                                                                                    |
| Ticket status, five-minute paced local run        | 300 seconds | One worker at approximately 1 request/second completed 298 status changes, P95 10.37ms, 0% errors, no recovery reads, and a healthy post-run API. This is local H2 write stability evidence, not a concurrent-write benchmark. [JSON](../../artifacts/work-orders/ticket-status-5m-paced-local-20260810.json)                            |
| Alert submit, five-minute paced local run         | 300 seconds | One worker at approximately 1 request/second received 298 measurement `202` responses, P95 5.67ms, 0% errors, and a healthy post-run API. Including warmup, all 328 accepted events were present across two five-minute aggregate groups. [JSON](../../artifacts/work-orders/alert-submit-5m-paced-local-after-bucket-fix-20260810.json) |
| Ticket status, five-minute PostgreSQL Compose run | 300 seconds | Four concurrent isolated tickets completed 141,935 status writes, 473.11 QPS, P95 11.11ms, 0% errors, and zero recovery reads. [JSON](../../artifacts/work-orders/ticket-status-5m-postgres-compose-20260810.json)                                                                                                                       |
| Alert submit, five-minute PostgreSQL Compose run  | 300 seconds | Four workers received 123,945 measurement `202` responses and 59,432 expected queue-full `503` responses; all 136,006 accepted events were aggregated across two groups, with 0% loss and a healthy API. [JSON](../../artifacts/work-orders/alert-submit-5m-postgres-compose-20260810.json)                                              |
| Ticket list                                       | 3 seconds   | 1,992 requests, 663.37 QPS, P95 4.20ms, 0% errors. [JSON](../../artifacts/work-orders/ticket-list-smoke.json)                                                                                                                                                                                                                            |
| Ticket status                                     | 2 seconds   | 924 requests, 461.32 QPS, P95 5.83ms, 0% errors; two isolated load tickets and no recovery reads. [JSON](../../artifacts/work-orders/ticket-status-smoke.json)                                                                                                                                                                           |
| Alert list                                        | 2 seconds   | 1,767 requests, 883.25 QPS, P95 3.39ms, 0% errors. [JSON](../../artifacts/work-orders/alert-list-smoke.json)                                                                                                                                                                                                                             |
| Alert submit, after fix                           | 3 seconds   | 1,925 accepted and 59 bounded-queue `503` responses during measurement; every 2,211 accepted request across warmup and measurement appeared in the aggregate group. [JSON](../../artifacts/work-orders/alert-submit-smoke-after-local-writer-fix.json)                                                                                   |
| Alert submit, report fix smoke                    | 2 seconds   | Three accepted events were aggregated into one reported group, validating the expanded report schema. [JSON](../../artifacts/work-orders/alert-submit-smoke-after-bucket-fix.json)                                                                                                                                                       |

The `503` responses in the alert-submit run are expected under overload because alert ingestion uses a
bounded queue. They are counted as errors by the report, not treated as successful delivery.

## Resolved Local Alert Defect

The first alert-submit smoke accepted 3,268 events but observed an aggregate repeat count of 3,164.
The preserved [pre-fix artifact](../../artifacts/work-orders/alert-submit-smoke.json) exposed that a local
H2 writer released its synchronization lock before its transaction committed. Concurrent consumers could
therefore race to create the same aggregation key, and the queue swallowed the resulting processing
exception after logging it.

The local writer now executes and commits its transaction inside the synchronized section. A concurrent
H2 regression test submits 64 events for one aggregation key and requires one group with a repeat count
of 64. The subsequent real smoke confirmed `observedRepeatCount == expectedAcceptedCount`.

## Load Report Correction

The original five-minute paced alert report showed 17 of 328 events because the first version of the
Node load tool inspected only the most recently updated aggregate group. That run crossed the `08:00`
five-minute bucket boundary, so 311 earlier events were in the preceding group. This was a reporting
defect, not another event-loss observation. The tool now totals every matching device/type group, records
the individual buckets, and has a Node regression test for a two-bucket total. The original
[superseded report](../../artifacts/work-orders/alert-submit-5m-paced-local-20260810.json) is retained;
the corrected five-minute run recorded 328 of 328 events across two groups.

## Remaining Acceptance Work

- All four five-minute local H2 scenarios and both five-minute concurrent PostgreSQL Compose write
  scenarios are complete. The PostgreSQL write results are summarized in
  [postgres-compose-load-summary-2026-08-10.md](../../artifacts/work-orders/postgres-compose-load-summary-2026-08-10.md).
- These are isolated local acceptance runs, not a production-scale benchmark with external traffic,
  deployment approval, or capacity targets.
- Docker Desktop 29.7.2 is now installed. The isolated Compose stack built Java and Web images, applied
  PostgreSQL 16.14 migrations, and reported healthy database, API, and Web containers. The verification
  used generated transient credentials and ports 18080/15173 so the existing local services remained
  undisturbed.
- The PostgreSQL atomic-upsert concurrency test is now verified against that Compose database. It remains
  conditional for ordinary local Maven runs that do not provide `JAVA_DATABASE_URL`.
- The legacy Koa alert route, authentication, payload, response, and historical schema contract have not
  been supplied. A compatibility adapter must wait for that approved contract.
- No requirements, independent review, deployment approval, or retrospective sign-off was provided for
  this run. This document records verifiable commands and outcomes only; it does not represent those
  approvals.
