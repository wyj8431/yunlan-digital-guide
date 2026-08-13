# Yunlan Java API

This service owns the Java implementations of the three work-order domains:

- `/api/tickets`: visible projects and project members, ticket status transitions, optimistic version checks, and idempotent operation records. `POST /api/tickets` requires an `Idempotency-Key` (1-120 characters); replaying the same actor/key/body returns the original ticket, while a changed body returns `409 IDEMPOTENCY_KEY_REUSED`.
- `/api/learning`: deterministic question grading, mock diagnosis provider, controlled catalog validation, pending teacher review, and confirmed diagnosis publication.
- `/api/alerts`: bounded in-process queue, fixed consumers, five-minute aggregation, graceful shutdown,
  and the versioned `/api/alerts/compat/v1` snake_case migration intake.

The existing Node/Koa service remains responsible for the digital-human tourism product. The React application can call this service through the `/api/platform`, `/api/tickets`, `/api/learning`, and `/api/alerts` prefixes after the frontend proxy is added.

## Local development

Requirements: Java 21 and PostgreSQL. The Maven Wrapper downloads Maven automatically.

```powershell
.\mvnw.cmd spring-boot:run
```

For a local demo without Docker or PostgreSQL, run the explicit H2 profile instead:

```powershell
.\mvnw.cmd -Plocal spring-boot:run -Dspring-boot.run.profiles=local
```

This creates a local database at `.local/yunlan` and enables development accounts. Use `member@example.com`, `teacher@example.com`, or `learner@example.com` with the password `change-me`. The local alert writer is synchronized for a single process; production continues to use PostgreSQL `ON CONFLICT` aggregation.

The service uses Flyway migrations and validates the JPA schema at startup. Development-only accounts are created only when `APP_DEV_SEED_ENABLED=true`, with the password `change-me`; never enable that flag in a shared deployment.

## Verification

```powershell
.\mvnw.cmd test
.\mvnw.cmd verify
```

The root `docker-compose.java.yml` starts PostgreSQL, the Java API, and a static work-order frontend
that proxies the Java routes. Copy `.env.java.example` to `.env.java` and replace the database password
and JWT secret. Compose refuses to start if either value is absent. The Compose build compiles the Java
service in a container, so it does not depend on a prebuilt local JAR:

```powershell
docker compose --env-file .env.java -f docker-compose.java.yml up --build
```

Open `http://localhost:5173/work-orders`. The Compose topology covers the Java work-order UI only;
the existing Node/Koa digital-human product remains a separate runtime.

`APP_DEV_SEED_ENABLED` is disabled in `.env.java.example`. Set it to `true` only for an isolated local
demo when the seeded `change-me` accounts are required; never enable it in a shared environment.

The alert endpoint intentionally returns `202 Accepted`: the event has entered the bounded queue, not necessarily finished database processing.

`POST /api/alerts/compat/v1` accepts a versioned snake_case alert body for migration clients and uses
the same JWT protection and bounded queue as the canonical alert endpoint. Its field mapping, severity
normalization, and error behavior are documented in
[legacy-alert-compatibility.md](../../docs/work-orders/legacy-alert-compatibility.md). This is a
repository-owned baseline, not a claim that an unseen historical Koa API has been verified.

With the local Java API and Vite server running, execute the primary browser regression flow from the
repository root:

```powershell
npm --workspace apps/web run test:e2e:work-orders
```

Teaching staff can load pending diagnosis candidates from `GET /api/learning/reviews/pending`. A `CONFIRMED` review may include an edited `candidateJson`; the server re-validates its shape, controlled knowledge point, error type, resources, and seven-day plan before publication. Learners can only see the candidate after confirmation.

## PDF requirement deviation

The source work orders describe a Node.js/Koa implementation. This repository keeps the existing Node/Koa digital-human service and implements the three new work-order domains as an independent Java 21/Spring Boot service so the Java requirement is isolated behind the same React/Vite proxy. PostgreSQL remains the production database; H2 is used only for automated tests.

The device-alert work order also refers to an older alert system that is not present in this repository. The Java service therefore exposes the new bounded alert contract and PostgreSQL aggregation, but old-system compatibility still needs the legacy endpoint and payload specification before it can be signed off.
