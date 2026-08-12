# Three Work-Order Requirements Record

## Record Boundary

This record consolidates the three supplied work-order PDFs. It records the business scope, the user's
architecture decision, and verifiable delivery status. It is not a substitute for a missing Gemini or
Claude conversation export, and it does not represent an unrecorded human approval.

The source PDFs prescribe React plus Koa. The user chose the repository's Java work-order service after
the difference was made explicit. The accepted repository boundary is therefore React UI plus Java 21 /
Spring Boot for tickets, learning diagnosis, and device alerts; the existing Node/Koa digital-human
service remains isolated. Strict source-PDF technical-stack acceptance remains unavailable without a
separate Koa implementation approval.

## Business Requirements

| Domain                | Users and outcome                                                                                                                   | Required business rules                                                                                                                                                            | Acceptance evidence                                                                                          |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Ticket collaboration  | Reporter, project member, administrator: create, assign, discuss, track and close project work                                      | Project membership gates access; assignee belongs to the project; only reporter or administrator reassigns; status and assignee writes are idempotent, versioned and auditable     | Java API and browser workflow tests; `docs/work-orders/verification-2026-08-10.md`                           |
| Learning diagnosis    | Learner, teacher, administrator: submit a labelled equation answer, review an AI candidate, publish only teacher-confirmed feedback | Correctness is deterministic; only incorrect answers reach the diagnosis provider; candidate IDs and seven-day plan are controlled; learner visibility requires staff confirmation | `LearningServiceTest`, `DiagnosisValidatorTest`, `DiagnosisGoldenCaseTest`, `DevLearningDataInitializerTest` |
| Device alert refactor | Operations user: submit device alerts and inspect five-minute aggregate groups                                                      | Intake is bounded; overload returns `503`; aggregation key is device, alert type and UTC bucket; drain on shutdown; historical compatibility cannot be inferred                    | Alert unit/API/concurrency tests; PostgreSQL Compose and load records                                        |

## Requirement Review And Decisions

| Topic                | Requirement-analysis observation                                                                   | Final decision                                                                                    | Basis                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Service ownership    | The source PDFs assume Koa, while this repository already contains an isolated Java work-order API | Retain the Java API and existing Vite proxy prefixes                                              | User confirmed the Java option; repository `AGENTS.md` protects the Node/Koa boundary |
| Ticket authorization | Assignment can expose work to unrelated users without a membership rule                            | Enforce project membership and limit reassignment to reporter/administrator                       | Repository business rule and focused API tests                                        |
| AI diagnosis         | A plausible model response is not a valid educational result                                       | Treat model output as untrusted; validate controlled IDs and require staff confirmation           | Source learning flow and `LearningService` validation boundary                        |
| Alert compatibility  | No historical Koa endpoint, payload, schema or fixture was supplied                                | Provide a new explicit versioned Java compatibility intake; do not claim historical compatibility | `docs/work-orders/legacy-alert-compatibility.md`                                      |
| Production evidence  | Local/Compose tests cannot prove production capacity or human approval                             | Retain measured local evidence and keep production approval open                                  | `docs/work-orders/verification-2026-08-10.md`                                         |

## AI Review Evidence Status

Codex requirement analysis is represented by this record and the linked implementation material. A
separate Gemini analysis, cross-review transcript, and human requirement-signoff record were not supplied
to this workspace. They are required for strict process-PDF acceptance and must be attached rather than
reconstructed from memory. The requested reviewer prompts are available under `.claude/agents/` for a
fresh, independent review session.

## Five-Day Work Breakdown

Each domain follows the same five-person-day MVP sequence; this is a planning baseline rather than a
claim that work occurred on those dates.

| Day | Ticket collaboration                            | Learning diagnosis                               | Device alerts                                 |
| --- | ----------------------------------------------- | ------------------------------------------------ | --------------------------------------------- |
| 1   | Roles, lifecycle, and scope review              | Labelled data and teacher-review scope           | Compatibility and backpressure boundary       |
| 2   | Data/API/UI design and tests                    | Controlled candidate contract and tests          | Current-state baseline and aggregation design |
| 3   | Creation, membership, history and notifications | Deterministic attempts and candidate validation  | Bounded intake and aggregate persistence      |
| 4   | Versioned status/reassignment and regression    | Review, publication and golden cases             | Fault, concurrency and compatibility checks   |
| 5   | Browser flow, review, deployment evidence       | Human diagnosis sampling and deployment evidence | Compose/load verification and retrospective   |

## Open Decisions

- Supply Gemini and Claude requirement-review exports, plus the human final decision, for strict process
  acceptance.
- Supply the historical Koa alert route, authentication, payload, response and schema fixtures before
  claiming legacy compatibility.
- Run the real diagnosis provider against the ten golden cases and have teaching staff score the results;
  the repository provides `docs/work-orders/learning-evaluation.md` and an offline evaluator but does not
  claim real-model or teaching-staff results yet.
