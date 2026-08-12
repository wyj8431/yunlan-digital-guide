# Synthetic Alert Migration Verification

## Scope

This record verifies the repository-owned migration intake at
`POST /api/alerts/compat/v1` using synthetic data. It is not evidence that the route matches an
unavailable historical Koa service.

## Fixture

The test cases are stored in
`apps/java-api/src/test/resources/fixtures/legacy-alert-synthetic-v1.json`.

All device identifiers, messages, and timestamps in that file are fictional. The fixture covers:

- accepted `WARN` input and its canonical `WARNING` mapping;
- accepted `CRITICAL` input;
- rejection of an unsupported severity with `INVALID_ALERT_LEVEL`;
- rejection of a request missing a required field with `VALIDATION_FAILED`.

## Verification

The focused Java checks were run with:

```powershell
Set-Location apps/java-api
.\mvnw.cmd -q -Plocal "-Dtest=AlertControllerTest,AlertLocalApiTest" test
```

The command passed on 2026-08-11. The checks verify the compatibility payload mapping, the existing
JWT protection, invalid-severity handling, and local queue persistence.

## Acceptance Boundary

Synthetic migration verification is complete. Historical Koa compatibility remains unverified until
an approved route handler, OpenAPI document, or redacted request/response capture is supplied. Do
not use this record to claim historical-system compatibility.
