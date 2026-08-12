# Learning Golden-Case Evaluation

`artifacts/eval/learning-golden-cases.json` contains ten synthetic, labelled incorrect-answer cases. The
labels are evaluation targets only and are never sent to the diagnosis model. Running the evaluator creates
pending attempts; it does not confirm, publish, or modify a learner-visible diagnosis.

## Run Locally

Start the Java API in an isolated local profile with both model variables configured outside the repository:

```powershell
$env:SPRING_PROFILES_ACTIVE = 'local,real-learning-model'
$env:LEARNING_MODEL_BASE_URL = 'https://approved-model-endpoint.example'
$env:LEARNING_MODEL_API_KEY = '<local-secret>'
$env:LEARNING_MODEL = 'approved-model-name'
Set-Location apps/java-api
.\mvnw.cmd spring-boot:run -Plocal
```

In another terminal, run the evaluator from the repository root:

```powershell
npm run evaluate:learning-golden
```

The default target is `http://127.0.0.1:8080`. A remote target is rejected unless
`LEARNING_EVAL_ALLOW_REMOTE=true` is set after explicit approval, because the evaluator writes ten synthetic
attempt records. Login and model secrets are read from environment variables and never included in the JSON
report.

## Score And Retain Evidence

The evaluator writes `artifacts/eval/learning-golden-evaluation-<timestamp>.json`, containing each returned
candidate, automatic knowledge-point/error-type comparisons, and blank teacher fields for error accuracy,
evidence quality, and plan actionability. A teacher must fill those three scores from 0 to 2 for every case
and record their reviewer identifier and notes outside of sensitive learner data.

Do not claim acceptance until the report shows all of the following:

- At least eight of ten cases match both the expected knowledge point and error type.
- No returned candidate includes a standard-answer field or an uncontrolled catalog ID.
- The three teacher-score averages are each at least 1.5.
- The original JSON output is retained in the local evaluation evidence directory without credentials.

## Latest Local Result

The latest single-stage local run used the local `qwen2.5-local-7b` model and retained its output at
`artifacts/eval/learning-golden-evaluation-2026-08-11T10-06-49-008Z.json`. It produced 9 valid
diagnoses, 9 knowledge-point matches, 7 error-type matches, and 7 combined matches out of 10. No
candidate contained a standard-answer field. This does not meet the eight combined-match gate, and
the teacher-score fields remain intentionally blank. It is evaluation evidence only, not an
acceptance record.

Once the automatic gate is met, use
[learning-teacher-review-template.md](learning-teacher-review-template.md) to record the required
human review without placing reviewer identity or scores in the generated model report.

A separate two-stage error-type-review experiment produced 5 combined matches and is retained at
`artifacts/eval/learning-golden-evaluation-2026-08-11T10-54-23-537Z.json` as rejected regression
evidence. That experiment was removed from the provider; the 7/10 report remains the current
single-stage baseline.

## Offline Checks

```powershell
npm run test:learning-golden-evaluator
.\apps\java-api\mvnw.cmd -Dtest=DiagnosisGoldenCaseTest,DiagnosisValidatorTest,OpenAiCompatibleDiagnosisProviderTest test
```
