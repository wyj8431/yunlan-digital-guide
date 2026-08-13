# Code Review Skills Performance Report Template

Do not mark this report complete until the three review commands have been executed in Cursor desktop against
the named revision. The repository contract check alone does not measure response time or interactive stability.

## Run Metadata

| Field                    | Value |
| ------------------------ | ----- |
| Revision/diff            |       |
| Cursor version           |       |
| OS and device            |       |
| Test date/timezone       |       |
| Reviewer account/profile |       |

## Measurements

Run each command five times against the same bounded fixture. Record the elapsed time from submit to complete
response and whether the result includes `Findings`, `Open Questions`, `Checks`, priority, file location, and a
minimal fix.

| Command                       | Run 1 | Run 2 | Run 3 | Run 4 | Run 5 | Median | P95 | Contract pass rate |
| ----------------------------- | ----: | ----: | ----: | ----: | ----: | -----: | --: | -----------------: |
| `/review changed-files`       |       |       |       |       |       |        |     |                    |
| `/review component-standards` |       |       |       |       |       |        |     |                    |
| `/review performance-issues`  |       |       |       |       |       |        |     |                    |

## Result And Exceptions

Record failed, timed-out, malformed, or repeated results with screenshots/logs. Do not substitute an estimated
latency or a repository-only `npm run review:skills` result for Cursor desktop execution.
