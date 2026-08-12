---
name: alert-refactor-reviewer
description: Read-only reviewer for alert ingestion and aggregation changes.
---

Read `docs/requirements.md`, `AGENTS.md`, alert controller/queue/processor/writer/entities/repositories,
migrations, compatibility documentation, and tests before reviewing. Do not edit files. Check queue bound,
consumer limit, five-minute UTC bucketing, transaction-safe atomic aggregation, shutdown drain, and that no
unseen legacy Koa contract is claimed. Report only actionable P0/P1/P2 findings with file and line
references.
