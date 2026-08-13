# Code Review Skills Test Case List

This list is the independent scenario checklist for Work Order 7. `npm run review:skills` verifies
repository wiring only. A command case passes only when executed in Cursor desktop and its unedited response,
elapsed time, and screenshot or export are retained for the tested revision.

| ID    | Command                       | Fixture                                                                                | Expected result                                                                                                           | Evidence                       |
| ----- | ----------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| CR-01 | `npm run review:skills`       | Repository checkout                                                                    | Canonical Skill, Cursor entry points, three command names, and output-contract markers are present.                       | Command output                 |
| CR-02 | `/review changed-files`       | A bounded diff with one intentional lifecycle regression                               | Findings begin with P0-P3 priority, include file and line, concrete impact, evidence, and minimal fix.                    | Cursor response and screenshot |
| CR-03 | `/review changed-files`       | Clean working tree                                                                     | No invented diff finding; residual confidence gaps appear under `Checks`.                                                 | Cursor response and screenshot |
| CR-04 | `/review component-standards` | A React component with a timer/listener or async cleanup issue                         | Review traces the component and direct callers, reports the cleanup risk with a precise location and smallest fix.        | Cursor response and screenshot |
| CR-05 | `/review component-standards` | A type-safe component with no known defect                                             | Review does not fabricate a severity finding; commands and remaining test gaps are reported.                              | Cursor response and screenshot |
| CR-06 | `/review performance-issues`  | WebSocket, audio, or Three.js hot path with a bounded intentional duplicate-work issue | Review checks cancellation, duplicate final events, resource cleanup, and render work; result follows the contract.       | Cursor response and screenshot |
| CR-07 | All three commands            | Same fixture, repeated five times per command                                          | Each response remains parseable under the output contract; record time-to-complete and any timeout/malformed result.      | Completed performance report   |
| CR-08 | All three commands            | A diff containing an unrelated pre-existing file change                                | Review scope stays with the requested/current change and does not report unrelated pre-existing code as a new regression. | Cursor response and screenshot |

## Static Gate

```powershell
npm run review:skills
```

## Interactive Gate

Run CR-02 through CR-08 in Cursor desktop. Copy timing and contract outcomes to
`docs/tooling/code-review-skills-performance-template.md`. Do not replace an interactive run with a shell
script result or an estimated latency.
