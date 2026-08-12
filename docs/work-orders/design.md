# Java Work-Order Design

## Scope And Service Boundary

The source work orders describe React and Koa implementations. The approved repository decision is
to keep the existing Node/Koa digital-human product intact and add a Java 21/Spring Boot service for
the three work-order domains. Vite proxies the Java routes during local development.

| Domain               | Java route      | Core responsibility                                                                        |
| -------------------- | --------------- | ------------------------------------------------------------------------------------------ |
| Ticket collaboration | `/api/tickets`  | Projects, members, tickets, comments, notifications, versioned status and assignee changes |
| Learning diagnosis   | `/api/learning` | Deterministic grading, model candidate validation, staff review, publication               |
| Device alerts        | `/api/alerts`   | Bounded asynchronous ingestion and five-minute aggregation                                 |

## Data And Consistency Rules

### Tickets

- A non-admin may access only projects in `project_members`.
- Creation and reassignment reject assignees outside the ticket project.
- Status and assignee updates require the current optimistic version plus an idempotency key.
- The corresponding ticket row is locked for the duration of each status or assignee write, so concurrent
  retries with the same idempotency key replay the committed operation instead of racing into a version conflict.
- Ticket status events and assignee events use separate append-only records so operation history stays
  semantically correct.
- Ticket, event, and notification writes occur in one Spring transaction.

### Learning Diagnosis

- Correctness is calculated from controlled question data, not model output.
- A model candidate must reference controlled catalog IDs and contain a valid seven-day study plan.
- A failed provider does not invalidate the recorded answer; it stores a failed diagnosis candidate.
- Only teaching staff can review pending candidates. Learners receive valid JSON only after confirmation.

### Device Alerts

- Queue capacity, consumer count, bucket width, and drain timeout are configuration values with safe
  defaults of 100, 4, 5 minutes, and 10 seconds.
- The aggregation key is device ID, alert type, and UTC bucket start.
- PostgreSQL aggregation uses a unique constraint and atomic upsert. Local H2 uses its dedicated
  synchronized writer only for single-process development.

## Current Verification Boundary

The repository has Java API tests for ticket collaboration, learning validation, alert queue behavior,
and local alert persistence. The work-order harness runs root lint, work-order UI type checking, and
the Java verification suite. The Playwright smoke test covers ticket creation/reassignment/status,
incorrect-answer submission and teacher confirmation, and alert submission/group rendering through the
Vite proxy. Docker business-flow verification, load-test results, and legacy alert compatibility
evidence remain open rather than being claimed as complete.

## Known Blocker

The device-alert source work order requires compatibility with a pre-existing Koa alert system. This
repository does not contain that route, request/response contract, or historical schema. The
repository-owned [`/api/alerts/compat/v1`](legacy-alert-compatibility.md) migration contract now gives
new adopters a versioned snake_case intake with the existing JWT and queue semantics. It is not evidence
of compatibility with an unseen historical system; a supplied historical contract still requires
fixture-based comparison tests before any claim of legacy compatibility.
