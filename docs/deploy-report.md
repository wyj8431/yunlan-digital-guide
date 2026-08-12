# Work-Order Deployment Report

## Delivery Target

The reproducible delivery target is `docker-compose.java.yml`: PostgreSQL 16, the Java work-order API,
and the Nginx-served React work-order UI. It is an isolated verification deployment, not production.

## Required Configuration

Copy `.env.java.example` to a local, untracked `.env.java` and set non-demo values for
`JAVA_DATABASE_PASSWORD` and `JAVA_JWT_SECRET`. Keep `APP_DEV_SEED_ENABLED=false` unless an isolated
demo environment explicitly needs seeded users and questions. Do not place those values in this report,
test artifacts, browser traces, or commits.

## Deployment Procedure

```powershell
docker compose --env-file .env.java -f docker-compose.java.yml up --build -d
docker compose --env-file .env.java -f docker-compose.java.yml ps
npm run check:work-orders
```

The Compose health checks cover PostgreSQL readiness, `GET /api/health` from the Java API container, and
the web route served by Nginx. The application runs Flyway validation and append-only migrations on boot.
Rollback is performed by stopping this isolated stack and restoring the previous container image and
database backup; it is not performed by editing an already-applied Flyway migration.

## Recorded Verification

The isolated Compose deployment ran with PostgreSQL 16.14, Java API, and web containers healthy. Positive
and negative browser flows passed through Nginx, and the PostgreSQL atomic alert-upsert test combined 32
concurrent events into one aggregate group. The reproducible commands, limits, and load artifacts are in
`docs/work-orders/verification-2026-08-10.md` and `docs/work-orders/load-testing.md`.

## Production Gate

Production deployment approval, production credentials, external traffic targets, and a production backup
restore drill have not been supplied. This report must not be used as a production release approval until
an owner attaches those records and confirms the target environment.
