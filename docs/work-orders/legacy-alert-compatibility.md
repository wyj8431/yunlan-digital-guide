# Alert Compatibility Baseline

The repository contains no historical Koa alert route or payload. This document therefore defines a
repository-owned migration contract; it must not be represented as verified compatibility with an
unseen production system.

## Endpoint

`POST /api/alerts/compat/v1`

The route is covered by the existing `/api/alerts` proxy and uses the existing Bearer JWT policy. It
returns `202 Accepted` after an event enters the bounded queue. A `202` does not mean aggregation has
finished.

## Request

```json
{
  "device_id": "plant-room-sensor-07",
  "alert_type": "temperature",
  "severity": "WARN",
  "message": "Temperature exceeded the configured threshold.",
  "occurred_at": "2026-08-11T00:05:00Z"
}
```

All fields are required. `device_id` and `alert_type` are at most 120 characters, `severity` is at
most 32 characters, and `message` is at most 5,000 characters. `occurred_at` must be an ISO-8601 UTC
instant.

| Compatibility severity | Canonical level |
| ---------------------- | --------------- |
| `INFO`                 | `INFO`          |
| `WARN`                 | `WARNING`       |
| `WARNING`              | `WARNING`       |
| `CRITICAL`             | `CRITICAL`      |

Any other severity returns `400` with `INVALID_ALERT_LEVEL`. Invalid or missing fields return the
existing stable `VALIDATION_FAILED` response. A request with no JWT is rejected by the existing
security policy with `403`; invalid JWT handling remains governed by the shared authentication filter.

## Response And Data Boundary

```json
{
  "status": "accepted",
  "queuedCount": 0
}
```

The compatibility route maps into the same `AlertEvent`, queue capacity, consumer count, UTC bucket
aggregation, and database writer used by `POST /api/alerts`. It adds no tables, migrations, or data
retention rules. Queue saturation returns `503 ALERT_QUEUE_FULL`; callers must retry with bounded
backoff.

## Historical-System Adoption

When a real historical Koa contract becomes available, compare it with this baseline before changing
the route. Add fixture-based compatibility tests first, retain `/compat/v1` for existing adopters, and
introduce a new version only for incompatible changes.

Use [legacy-alert-evidence-request.md](legacy-alert-evidence-request.md) to request and redact the
minimum evidence needed for that comparison.

The repository-owned migration baseline has separate synthetic verification in
[legacy-alert-synthetic-verification.md](legacy-alert-synthetic-verification.md); it is not a
historical compatibility claim.
