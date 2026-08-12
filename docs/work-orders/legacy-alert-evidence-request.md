# Legacy Alert Contract Evidence Request

## Purpose

The repository has a tested migration intake at `POST /api/alerts/compat/v1`, but it does not
contain the historical Koa alert contract. This package collects evidence needed to verify that
contract without inventing an endpoint, payload, or authentication scheme.

## Copyable Request

Please provide one of the following for the retired or existing Koa alert service:

1. The route handler and its request-validation middleware.
2. An OpenAPI, Postman collection, API gateway export, or internal interface document.
3. One successful request and response plus one validation-failure response, with all sensitive
   values replaced by stable placeholders.
4. The authentication rule for the route: required header or cookie names, token type, required
   role, and expected unauthenticated status code.

Do not include production tokens, passwords, personal information, production device identifiers,
or raw logs. Replace sensitive values consistently, for example `device-demo-001` and
`token-redacted`.

## Minimum Evidence Record

For each route, record the following information:

| Item            | Required evidence                                                                    |
| --------------- | ------------------------------------------------------------------------------------ |
| Method and path | Exact HTTP method and path, including any version prefix                             |
| Authentication  | Required header or cookie names, token format, role rule, and missing-token response |
| Request         | Field names, JSON types, required/optional status, and one redacted example          |
| Response        | Success status/body and one validation-failure status/body                           |
| Semantics       | Whether a successful response means accepted, queued, persisted, or aggregated       |
| Retry behavior  | Idempotency key, duplicate behavior, queue-full behavior, and retry guidance         |

## Safe Sample Shape

Use this form for a redacted request/response pair. Do not fill values from memory; copy them from
an approved source and replace sensitive values only.

```text
Source: <handler | OpenAPI | gateway export | approved redacted capture>
Captured at: <UTC timestamp>
Route: <METHOD> <PATH>
Authentication: <redacted rule>

Request headers:
<redacted headers>

Request body:
<redacted JSON>

Success response:
<status and redacted body>

Validation-failure response:
<status and redacted body>
```

## Adoption Steps

1. Compare the evidence with the repository-owned migration baseline in
   `docs/work-orders/legacy-alert-compatibility.md`.
2. Add a fixture-based controller test before changing any compatibility route.
3. Keep `/api/alerts/compat/v1` unchanged for compatible additions.
4. Introduce `/compat/v2` only when the verified historical contract requires incompatible
   behavior.
5. Record the source and redaction method in the test or acceptance record. Never commit raw
   production captures or credentials.

## Current Status

No historical Koa evidence has been supplied or found in this repository. Until a source supplies
one of the items above, the migration baseline is verifiable but historical compatibility is not.

For local migration testing only, use
`apps/java-api/src/test/resources/fixtures/legacy-alert-synthetic-v1.json`. It is deliberately
synthetic and must never be presented as a historical Koa capture.
