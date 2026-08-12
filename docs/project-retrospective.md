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
