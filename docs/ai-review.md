# AI Review Record

## Purpose

This record separates repository evidence from independent-review evidence. It intentionally does not
claim that a Gemini, Claude Code, or external reviewer ran when no raw response or session export exists.

## Review Inputs

- `AGENTS.md` repository boundary and work-order safety rules.
- `docs/requirements.md` business scope and explicit Java-service decision.
- `docs/work-orders/design.md` consistency, authorization, diagnosis, and queue rules.
- Java API, React work-order UI, migrations, and focused test results.
- Source PDF extracts retained under the local temporary workspace for analysis only.

## Current Evidence

| Review control                     | Current evidence                                                                                                                                                                                                                   | Status                                               |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Independent reviewer configuration | Ticket, learning, and alert reviewer prompts are stored under `.claude/agents/`                                                                                                                                                    | Ready to run                                         |
| Deterministic regression           | Java Maven suite passed after the education catalogue update                                                                                                                                                                       | Passed locally                                       |
| Work-order harness                 | Root lint, work-order UI type check, and Java `verify` passed after this change set; they were run as the three commands in `scripts/check-work-orders.ps1` because the combined shell invocation exceeded the terminal time limit | Passed locally                                       |
| Browser regression                 | Positive and negative Playwright work-order flows passed through Vite and the local Java API                                                                                                                                       | Passed locally; `artifacts/loop-1/e2e-2026-08-11.md` |
| Concurrent ticket retry            | Two simultaneous status requests and two simultaneous assignee requests, each with one idempotency key, produced one operation event and one version increment per ticket                                                          | Passed locally; `TicketIdempotencyConcurrencyTest`   |
| Fault injection                    | Alert queue tests simulate an asynchronous writer failure; a controlled learning-plan mutation also failed the new duplicate-day regression and then passed after restoration                                                      | Passed locally; `artifacts/loop-1/mutation-test.log` |
| Independent raw reviewer response  | No external reviewer transcript was supplied or generated in this workspace                                                                                                                                                        | Open                                                 |
| Human final diff review            | No signed review record was supplied                                                                                                                                                                                               | Open                                                 |

The repository now includes ten synthetic, labelled cases and a local-only evaluator at
`tools/evaluate-learning-golden-cases.mjs`. It records provider output, automatic label matching, and
blank teacher-score fields under `artifacts/eval/`; it never confirms or publishes the attempts. The
evaluator requires an explicitly configured local real-model profile and is not run against an unapproved
environment.

## Required Independent Review Prompt

Use the matching reviewer file in a fresh context and provide only the approved requirements, current
uncommitted diff, relevant source, and real test output. Ask: `Review the current uncommitted diff. Report
only actionable P0/P1/P2 findings with file and line references. Do not modify files.` Preserve the raw
reply in `artifacts/loop-1/review-round-N.md`; do not replace it with a summary.

## Exit Rule

No P0 or P1 finding may remain unresolved. A reviewer result or human decision must be linked to the exact
diff and verification command before declaring the process loop complete.

## Code Issue Cases Found During Local Review

These are repository findings, not substituted raw replies from an independent agent. They are included so
the next independent reviewer can verify the exact remediation rather than rediscover the same classes of issue.

| Case                          | Observed risk                                                                                                                                                       | Local remediation                                                                                                                                                     | Verification                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Learning prompt injection     | Learner reasoning was concatenated into a natural-language model prompt, allowing text such as `ignore previous instructions` to compete with the task instruction. | `OpenAiCompatibleDiagnosisProvider` now serializes untrusted learner reasoning inside a structured data object with an explicit system instruction not to execute it. | `OpenAiCompatibleDiagnosisProviderTest.sendsLearnerReasoningAsEscapedDataInsteadOfPromptInstructions` |
| Invalid seven-day plans       | A model candidate can look plausible while omitting or duplicating a day.                                                                                           | `DiagnosisValidator` requires days 1 through 7 exactly once before persistence or staff confirmation.                                                                 | `DiagnosisValidatorTest` and the controlled local mutation record                                     |
| Shutdown data loss visibility | The queue interrupted workers on timeout without reporting the accepted work still queued or in progress.                                                           | `AlertQueue` now attempts a bounded graceful drain, then logs queued and active counts before forced termination.                                                     | `AlertQueueTest.drainsAcceptedEventsBeforeCompletingShutdown`                                         |

Independent review and human sign-off remain open. Preserve raw reviewer output verbatim under
`artifacts/loop-1/review-round-N.md`; do not replace it with this summary.
