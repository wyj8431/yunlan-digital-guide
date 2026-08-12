# Work-Order Completion Plan

## Completed Product Work

- Ticket login, visible projects, member lookup, ticket creation, assignee selection and reassignment,
  status transitions, comments, notifications, statistics, and operation history.
- Learning question attempts, deterministic grading, validated diagnosis candidates, staff review, and
  published learner results.
- Alert bounded queue, four consumers, five-minute aggregation, database upsert, local persistence,
  malformed-request handling, and graceful drain behavior.
- Docker Compose delivery for PostgreSQL, Java API, and the Nginx-served work-order UI. The isolated
  stack completed database migrations, all container health checks, positive and negative browser flows,
  and the PostgreSQL atomic alert-upsert concurrency test.
- Playwright browser coverage for ticket project selection, creation, reassignment, status change,
  learning candidate review, and alert group rendering through the Java API proxy.
- Negative Playwright coverage for non-reporter reassignment, stale status versions, and invalid diagnosis
  publication. The alert queue tests cover deterministic queue saturation and recovery after an asynchronous
  writer failure; the load-test artifacts capture real HTTP `503` behavior under sustained submission.

## Remaining Delivery Work

1. Add repeatable load scripts for ticket list/status and alert submit/list, then capture environment,
   concurrency, QPS, P95, error rate, 503 count, and post-run health evidence.
   A dependency-free runner now covers all four scenarios and writes JSON evidence through `LOAD_OUTPUT`.
   Four five-minute local results are recorded in
   [verification-2026-08-10.md](verification-2026-08-10.md): four-worker reads plus one-worker,
   one-second-paced ticket-status and alert-submit stability runs. The alert report totals repeats across
   time buckets and preserves bucket-level values.
   Completion: the concurrent PostgreSQL Compose runs are now recorded in
   [verification-2026-08-10.md](verification-2026-08-10.md) and
   [postgres-compose-load-summary-2026-08-10.md](../../artifacts/work-orders/postgres-compose-load-summary-2026-08-10.md).
   Production-scale capacity targets still require an approved environment. See [load-testing.md](load-testing.md).
2. Produce approved requirements, review, implementation, deployment, and retrospective records from
   real commands and decisions. Keep failed-test, mutation-test, debug, and independent-review evidence
   separate from generated summaries.
   Local command and debug evidence is recorded in [verification-2026-08-10.md](verification-2026-08-10.md).
   Completion: every claimed result links to a reproducible command, log, test, or review response.
3. Obtain the legacy Koa alert endpoint, authentication, payload, response, and migration contract.
   Completion: compatibility tests are added before a Java adapter changes the alert API.

## Validation Commands

```powershell
npm run check:work-orders
.\apps\java-api\mvnw.cmd -Dtest=TicketApiTest test
npm --workspace apps/web run typecheck
npm run check:work-orders:e2e:negative
npm run load:work-orders
```
