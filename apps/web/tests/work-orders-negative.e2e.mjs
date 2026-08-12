import { chromium } from 'playwright';

const baseUrl = process.env.WORK_ORDERS_BASE_URL ?? 'http://127.0.0.1:5173/work-orders';
const password = process.env.WORK_ORDERS_E2E_PASSWORD ?? 'change-me';
let idempotencySequence = 0;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function nextIdempotencyKey() {
  idempotencySequence += 1;
  return `negative-e2e-${Date.now()}-${idempotencySequence}`;
}

async function signIn(page, email) {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page
    .getByRole('heading', { name: 'Work orders' })
    .waitFor({ state: 'visible', timeout: 15_000 });
}

async function apiRequest(page, path, options = {}) {
  return page.evaluate(
    async ({ path, options }) => {
      const token = localStorage.getItem('yunlan-java-api-token');
      const headers = {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers ?? {})
      };
      const response = await fetch(path, { ...options, headers });
      const body = await response.json().catch(() => ({}));
      return { status: response.status, body };
    },
    { path, options }
  );
}

async function firstProjectId(page) {
  const response = await apiRequest(page, '/api/tickets/projects');
  assert(response.status === 200, `Unable to list projects, received ${response.status}.`);
  const project = response.body.projects?.[0];
  assert(project?.id, 'The signed-in test account has no accessible project.');
  return project.id;
}

async function createTicket(page, projectId, title) {
  const response = await apiRequest(page, '/api/tickets', {
    method: 'POST',
    body: JSON.stringify({
      projectId,
      title,
      description: 'Created by the negative browser regression suite.',
      assigneeId: null
    })
  });
  assert(
    response.status === 200 && response.body.id,
    `Ticket creation failed with ${response.status}.`
  );
  return response.body;
}

async function createIncorrectAttempt(page) {
  const questionResponse = await apiRequest(page, '/api/learning/questions');
  assert(
    questionResponse.status === 200,
    `Unable to load learning questions (${questionResponse.status}).`
  );
  const question = questionResponse.body.questions?.[0];
  assert(question?.id, 'No learning question is available for negative diagnosis coverage.');

  for (const selectedAnswer of ['A', 'B', 'C', 'D']) {
    const response = await apiRequest(page, '/api/learning/attempts', {
      method: 'POST',
      body: JSON.stringify({
        questionId: question.id,
        selectedAnswer,
        reasoning: 'Negative browser regression.'
      })
    });
    assert(response.status === 200, `Learning attempt failed with ${response.status}.`);
    if (!response.body.correct) {
      return response.body;
    }
  }
  throw new Error(
    'Every supported answer was marked correct; an incorrect diagnosis candidate could not be created.'
  );
}

const browser = await chromium.launch({ headless: true });
const adminPage = await browser.newPage();
const memberPage = await browser.newPage();
const teacherPage = await browser.newPage();

try {
  await signIn(adminPage, 'admin@example.com');
  const adminProjectId = await firstProjectId(adminPage);
  const adminTicket = await createTicket(
    adminPage,
    adminProjectId,
    `Negative assignment ${Date.now()}`
  );

  await signIn(memberPage, 'member@example.com');
  const memberProjectId = await firstProjectId(memberPage);
  const forbiddenAssignment = await apiRequest(
    memberPage,
    `/api/tickets/${adminTicket.id}/assignee`,
    {
      method: 'POST',
      headers: { 'Idempotency-Key': nextIdempotencyKey() },
      body: JSON.stringify({ assigneeId: null, expectedVersion: adminTicket.version })
    }
  );
  assert(
    forbiddenAssignment.status === 403 && forbiddenAssignment.body.code === 'FORBIDDEN',
    `Non-reporter reassignment should be forbidden, received ${forbiddenAssignment.status}.`
  );

  const memberTicket = await createTicket(
    memberPage,
    memberProjectId,
    `Negative version ${Date.now()}`
  );
  const firstStatusChange = await apiRequest(memberPage, `/api/tickets/${memberTicket.id}/status`, {
    method: 'POST',
    headers: { 'Idempotency-Key': nextIdempotencyKey() },
    body: JSON.stringify({ status: 'IN_PROGRESS', expectedVersion: memberTicket.version })
  });
  assert(
    firstStatusChange.status === 200,
    `Initial status change failed with ${firstStatusChange.status}.`
  );
  const staleStatusChange = await apiRequest(memberPage, `/api/tickets/${memberTicket.id}/status`, {
    method: 'POST',
    headers: { 'Idempotency-Key': nextIdempotencyKey() },
    body: JSON.stringify({ status: 'IN_PROGRESS', expectedVersion: memberTicket.version })
  });
  assert(
    staleStatusChange.status === 409 && staleStatusChange.body.code === 'VERSION_CONFLICT',
    `Stale ticket version should return VERSION_CONFLICT, received ${staleStatusChange.status}.`
  );

  const incorrectAttempt = await createIncorrectAttempt(memberPage);
  await signIn(teacherPage, 'teacher@example.com');
  const invalidReview = await apiRequest(
    teacherPage,
    `/api/learning/attempts/${incorrectAttempt.id}/review`,
    {
      method: 'POST',
      body: JSON.stringify({ status: 'CONFIRMED', candidateJson: '{not valid JSON' })
    }
  );
  assert(
    invalidReview.status === 422 && invalidReview.body.code === 'INVALID_DIAGNOSIS',
    `Invalid diagnosis publication should return INVALID_DIAGNOSIS, received ${invalidReview.status}.`
  );
  const unpublishedAttempt = await apiRequest(
    memberPage,
    `/api/learning/attempts/${incorrectAttempt.id}`
  );
  assert(
    unpublishedAttempt.status === 200,
    `Unable to reload pending diagnosis (${unpublishedAttempt.status}).`
  );
  assert(
    unpublishedAttempt.body.reviewStatus === 'PENDING' &&
      unpublishedAttempt.body.diagnosisJson === null,
    'Invalid diagnosis publication exposed or confirmed the learner diagnosis.'
  );

  console.log('Work-order negative browser flow passed.');
} finally {
  await browser.close();
}
