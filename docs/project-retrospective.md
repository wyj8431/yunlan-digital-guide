# Three Work-Order Retrospective

## What Worked

- Keeping Java work-order domains separate from the existing Node/Koa digital-human service preserved the
  established service boundary.
- Ticket writes use membership checks, optimistic versions, idempotency keys, and atomic history records.
- Learning correctness stays deterministic and diagnosis output remains hidden until staff confirmation.
- Alert intake deliberately exposes bounded-queue overload through `503`; concurrency and aggregate tests
  found and then guarded a local H2 transaction-boundary defect.
- The Compose and load-test records distinguish local evidence from production claims.

## What Changed After Review

- The alert compatibility surface is now explicitly versioned and documented as a new Java contract rather
  than an unsupported claim about an unseen legacy endpoint.
- The learning demo catalogue grew from one to twelve manually labelled equation questions, six knowledge
  points, six error types, and twelve approved practice resources.
- Seven-day learning plans now require each day from 1 through 7 exactly once, closing a duplicate-day
  validation gap.

## Remaining Gaps

- The source PDFs' fixed Koa implementation direction is not met by the approved Java adaptation.
- Gemini/Claude raw requirement reviews, independent-review replies, human sign-off, and linked commits
  were not provided and cannot be fabricated.
- Real-model diagnosis quality and teaching-staff scoring of the ten golden cases remain an external,
  controlled evaluation step.
- Historical Koa alert compatibility remains open until the old contract and fixtures are supplied.
- The recorded load work is isolated local/Compose evidence, not a production capacity commitment.

## Next Review Cycle

Run the configured reviewer prompts in separate sessions, retain their unedited replies and command logs
under `artifacts/loop-1/`, then have the project owner review the resulting diff and release evidence.

## Interview Q&A Appendix

1. **Why does the ticket service use both optimistic versions and idempotency keys?** The version prevents stale writes; the key makes a client retry return the same successful operation instead of recording it twice.
2. **Why is ticket reassignment narrower than status changes?** Project membership is required for all writes, while reassignment also changes ownership and is restricted to the reporter or administrator.
3. **Why is the learning diagnosis hidden before staff confirmation?** Deterministic grading can be shown immediately, but model output remains untrusted until its controlled IDs, plan shape, and staff decision pass.
4. **What happens when the learning provider times out or returns invalid JSON?** The incorrect attempt is still stored deterministically and its diagnosis is saved as failed rather than exposing an unvalidated result.
5. **How is prompt injection reduced in the learning flow?** Learner reasoning is treated as serialized data, not an instruction; the model receives an explicit instruction to ignore instructions inside that data.
6. **Why does alert intake return 503 rather than buffer indefinitely?** The bounded queue protects JVM memory and makes overload visible to the caller for retry/backoff.
7. **How are alert aggregates safe under concurrency?** Events are grouped in five-minute UTC buckets and persisted by atomic database aggregation, with concurrency tests for the local and PostgreSQL writers.
8. **What is the alert shutdown tradeoff?** The service first stops accepting work and drains for a bounded time. If it times out, it force-stops and logs queued/active counts for recovery investigation.
9. **Why is `/api/alerts/compat/v1` not proof of legacy compatibility?** It is an explicit new migration contract. Historical compatibility requires the old endpoint, auth behavior, payloads, fixtures, and owner verification.
10. **What evidence cannot be generated from source code?** Platform evaluation outcomes, production SLA, commercial model licensing, third-party deployment availability, independent reviewer transcripts, and human acceptance signatures.
