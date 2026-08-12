import { chromium } from 'playwright';

const baseUrl = process.env.WORK_ORDERS_BASE_URL ?? 'http://127.0.0.1:5173/work-orders';
const email = process.env.WORK_ORDERS_E2E_EMAIL ?? 'member@example.com';
const password = process.env.WORK_ORDERS_E2E_PASSWORD ?? 'change-me';
const title = `E2E ticket ${Date.now()}`;

function requireVisible(locator, message) {
  return locator.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {
    throw new Error(message);
  });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await requireVisible(page.getByRole('heading', { name: 'Work orders' }), 'Work-order login did not complete.');

  const createForm = page.locator('.java-work-orders-grid > form').first();
  const projectSelect = createForm.locator('select').first();
  await projectSelect.selectOption({ label: 'Yunlan Work Orders' });
  await requireVisible(createForm.getByLabel('Assignee'), 'Project member list did not load after project selection.');

  await createForm.getByLabel('Title').fill(title);
  await createForm.getByLabel('Description').fill('Playwright verifies the ticket workflow through the Java API.');
  await createForm.getByRole('button', { name: 'Create ticket' }).click();

  const ticketButton = page.getByRole('button', { name: title });
  await requireVisible(ticketButton, 'Created ticket was not rendered.');
  await ticketButton.click();
  const ticketItem = page.locator('.java-work-orders-item').filter({ has: ticketButton });

  const assignmentForm = page.locator('form.java-work-orders-form').filter({
    has: page.getByRole('button', { name: 'Update assignee' })
  });
  await requireVisible(assignmentForm, 'Reporter cannot access the assignee form.');
  await assignmentForm.locator('select').selectOption({ label: 'admin@example.com (ADMIN)' });
  await assignmentForm.getByRole('button', { name: 'Update assignee' }).click();
  await requireVisible(page.getByText('Assignee updated.'), 'Assignee update did not finish.');
  await requireVisible(ticketItem.getByText('Assignee: admin@example.com'), 'Updated assignee was not rendered.');

  await ticketItem.getByRole('button', { name: 'Move to IN_PROGRESS' }).click();
  await requireVisible(page.getByText('Ticket moved to IN_PROGRESS.'), 'Ticket status did not update.');
  await requireVisible(ticketItem.getByText('IN_PROGRESS', { exact: true }), 'Updated ticket status was not rendered.');

  await page.getByRole('button', { name: 'Learning' }).click();
  const answerButtons = page.locator('.java-work-orders-options button');
  await requireVisible(answerButtons.first(), 'Learning question options did not load.');
  await answerButtons.first().click();
  await page.getByRole('button', { name: 'Submit answer' }).click();
  await requireVisible(
    page.getByText('Diagnosis candidate created for review.'),
    'Incorrect answer did not create a diagnosis candidate.'
  );

  const teacherPage = await browser.newPage();
  try {
    await teacherPage.goto(baseUrl, { waitUntil: 'networkidle' });
    await teacherPage.getByLabel('Email').fill('teacher@example.com');
    await teacherPage.getByLabel('Password').fill(password);
    await teacherPage.getByRole('button', { name: 'Sign in' }).click();
    await requireVisible(teacherPage.getByRole('heading', { name: 'Work orders' }), 'Teacher login did not complete.');
    await teacherPage.getByRole('button', { name: 'Learning' }).click();
    const pendingReview = teacherPage.locator('.java-work-orders-review-item').first();
    await requireVisible(pendingReview, 'Teacher pending-review queue is empty.');
    await pendingReview.click();
    await teacherPage.getByRole('button', { name: 'Confirm edited diagnosis' }).click();
    await requireVisible(teacherPage.getByText('Diagnosis confirmed.'), 'Teacher review did not complete.');
  } finally {
    await teacherPage.close();
  }

  await page.getByRole('button', { name: 'Alerts' }).click();
  const deviceId = `e2e-device-${Date.now()}`;
  const alertForm = page.locator('.java-work-orders-grid > form').first();
  await requireVisible(alertForm, 'Alert submission form did not render.');
  await alertForm.getByLabel('Device').fill(deviceId);
  await alertForm.getByLabel('Type').fill('e2e-temperature');
  await alertForm.getByLabel('Message').fill('Playwright alert aggregation verification.');
  await alertForm.getByRole('button', { name: 'Submit' }).click();
  await requireVisible(page.getByText('Alert accepted. Queue size:', { exact: false }), 'Alert was not accepted.');
  await page.waitForTimeout(500);
  const alertGroups = page.locator('.java-work-orders-panel').filter({ hasText: 'Alert groups' });
  await alertGroups.getByRole('button').click();
  await requireVisible(alertGroups.getByText(deviceId), 'Aggregated alert group was not rendered.');

  console.log(`Work-order browser flow passed for ${title}.`);
} finally {
  await browser.close();
}
