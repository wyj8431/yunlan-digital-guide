import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const apiBaseUrl = (process.env.LEARNING_EVAL_API_URL ?? 'http://127.0.0.1:8080').replace(/\/+$/, '');
const learnerEmail = process.env.LEARNING_EVAL_LEARNER_EMAIL ?? 'learner@example.com';
const learnerPassword = process.env.LEARNING_EVAL_LEARNER_PASSWORD ?? 'change-me';
const teacherEmail = process.env.LEARNING_EVAL_TEACHER_EMAIL ?? 'teacher@example.com';
const teacherPassword = process.env.LEARNING_EVAL_TEACHER_PASSWORD ?? 'change-me';
const casesPath = resolve(process.cwd(), process.env.LEARNING_EVAL_CASES ?? 'artifacts/eval/learning-golden-cases.json');
const outputPath = resolve(
  process.cwd(),
  process.env.LEARNING_EVAL_OUTPUT ?? `artifacts/eval/learning-golden-evaluation-${timestamp()}.json`
);

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function assertLocalTarget() {
  const hostname = new URL(apiBaseUrl).hostname;
  const isLocal = hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1';
  if (!isLocal && process.env.LEARNING_EVAL_ALLOW_REMOTE !== 'true') {
    throw new Error('Refusing to create evaluation attempts on a remote API. Set LEARNING_EVAL_ALLOW_REMOTE=true after approval.');
  }
}

export function validateGoldenCases(document) {
  if (!Array.isArray(document?.cases) || document.cases.length !== 10) {
    throw new Error('The golden-case document must contain exactly ten cases.');
  }
  for (const [index, item] of document.cases.entries()) {
    const required = [
      'questionId',
      'selectedAnswer',
      'expectedKnowledgePointId',
      'expectedErrorTypeId',
      'labelRationale'
    ];
    if (required.some((key) => typeof item[key] !== 'string' || item[key].trim() === '')) {
      throw new Error(`Golden case ${index + 1} is missing a required label.`);
    }
  }
  return document.cases;
}

async function request(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: { Accept: 'application/json', ...options.headers }
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Request to ${path} failed with HTTP ${response.status}.`);
  }
  return body;
}

async function login(email, password) {
  const response = await request('/api/platform/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!response?.token) {
    throw new Error('Login response did not contain a token.');
  }
  return response.token;
}

function bearerHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

export function scoreCandidate(goldenCase, attempt) {
  const candidate = attempt?.diagnosisJson ? JSON.parse(attempt.diagnosisJson) : null;
  const automatic = {
    diagnosisWasValidated: attempt?.diagnosisStatus === 'VALID',
    knowledgePointMatched: candidate?.knowledgePointId === goldenCase.expectedKnowledgePointId,
    errorTypeMatched: candidate?.errorTypeId === goldenCase.expectedErrorTypeId,
    hasStandardAnswerField: candidate !== null && Object.hasOwn(candidate, 'standardAnswer')
  };
  return {
    case: goldenCase,
    attemptId: attempt?.id ?? null,
    diagnosisStatus: attempt?.diagnosisStatus ?? null,
    reviewStatus: attempt?.reviewStatus ?? null,
    candidate,
    automatic,
    humanScore: {
      errorAccuracy: null,
      evidenceQuality: null,
      planActionability: null,
      reviewer: null,
      notes: null
    }
  };
}

export function summarise(results) {
  const count = (predicate) => results.filter(predicate).length;
  return {
    caseCount: results.length,
    validDiagnosisCount: count((result) => result.automatic.diagnosisWasValidated),
    knowledgePointMatchCount: count((result) => result.automatic.knowledgePointMatched),
    errorTypeMatchCount: count((result) => result.automatic.errorTypeMatched),
    combinedMatchCount: count(
      (result) => result.automatic.knowledgePointMatched && result.automatic.errorTypeMatched
    ),
    standardAnswerPollutionCount: count((result) => result.automatic.hasStandardAnswerField),
    humanScoringComplete: results.every(
      (result) =>
        Number.isFinite(result.humanScore.errorAccuracy) &&
        Number.isFinite(result.humanScore.evidenceQuality) &&
        Number.isFinite(result.humanScore.planActionability)
    )
  };
}

async function main() {
  assertLocalTarget();
  const document = JSON.parse(await readFile(casesPath, 'utf8'));
  const cases = validateGoldenCases(document);
  const learnerToken = await login(learnerEmail, learnerPassword);
  const teacherToken = await login(teacherEmail, teacherPassword);
  const results = [];

  for (const goldenCase of cases) {
    const submitted = await request('/api/learning/attempts', {
      method: 'POST',
      headers: { ...bearerHeaders(learnerToken), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionId: goldenCase.questionId,
        selectedAnswer: goldenCase.selectedAnswer,
        reasoning: goldenCase.reasoning ?? null
      })
    });
    const staffView = await request(`/api/learning/attempts/${submitted.id}`, {
      headers: bearerHeaders(teacherToken)
    });
    results.push(scoreCandidate(goldenCase, staffView));
  }

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    target: { apiBaseUrl, casesPath },
    results,
    summary: summarise(results)
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ outputPath, summary: report.summary }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Learning golden-case evaluation failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
