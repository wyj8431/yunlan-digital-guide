# Repository Guide

## Scope

This repository contains the existing Node/Koa digital-human product and a Java 21/Spring Boot
implementation of three work-order domains. Keep the two systems isolated:

- `apps/server` remains the Node/Koa digital-human service.
- `apps/java-api` owns ticket collaboration, learning diagnosis, and device-alert processing.
- `apps/web` owns the React UI and proxies `/api/platform`, `/api/tickets`, `/api/learning`, and
  `/api/alerts` to the Java service during local development.

Do not move the digital-human APIs into the Java service or replace the existing Node/Koa application.

## Required Workflow

1. Read the affected controller, service, entity, repository, migration, and test before editing.
2. Describe the affected API, authorization, data, and rollback boundary before changing a Java
   write path or a database migration.
3. Add request validation, stable API errors, and focused tests for every new Java endpoint.
4. Keep React loading, error, refresh, and duplicate-submission states connected to real Java APIs.
5. Run the relevant focused tests before the full work-order harness.

## Java Work-Order Rules

- Ticket writes use project membership checks. Status and assignee changes must use optimistic
  versions and idempotency keys, and they must record the corresponding operation atomically.
- A ticket assignee must be a member of the ticket project. Only the reporter or an administrator
  may reassign an existing ticket.
- Learning grading stays deterministic. Model output is untrusted until it passes the controlled
  catalog and seven-day plan validation; learners see a diagnosis only after staff confirmation.
- Alert processing remains bounded: defaults are a queue of 100, four consumers, five-minute UTC
  buckets, atomic database aggregation, and graceful drain during shutdown.
- Flyway migrations are append-only. Never change an applied migration or bypass schema validation.

## Secrets And Data

- Do not place production keys, JWTs, connection strings, personal data, device identifiers, or
  production logs in source, tests, documentation, or AI prompts.
- Use the local H2 profile and seeded demo accounts only for local verification.
- Keep `.env` local. Update `.env.example` only with non-sensitive variable names and examples.

## Validation

Use the work-order harness after changes that touch the Java API or work-order UI:

```powershell
npm run check:work-orders
npm --workspace apps/web run test:e2e:work-orders
```

The E2E command requires the local Vite and Java services to be running. On a machine with GNU Make,
the static harness equivalent is `make check`. The harness runs root lint, work-order UI type checking,
and the Java Maven verification suite.

## Out Of Scope Without Approval

- Changing the Java/Node service boundary or the Vite proxy contract.
- Changing authentication, role semantics, migration history, or alert response semantics.
- Guessing a legacy alert endpoint or payload contract that is not present in this repository.
- Adding external queues, worker threads, microservices, CI/CD, or Kubernetes.
