import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

const apiBaseUrl = (process.env.WORK_ORDERS_API_URL ?? 'http://127.0.0.1:8080').replace(/\/+$/, '');
const scenario = process.env.WORK_ORDERS_LOAD_SCENARIO ?? 'ticket-list';
const email = process.env.WORK_ORDERS_LOAD_EMAIL ?? 'member@example.com';
const password = process.env.WORK_ORDERS_LOAD_PASSWORD ?? 'change-me';
const warmupSeconds = readPositiveNumber('WORK_ORDERS_LOAD_WARMUP_SECONDS', 30);
const durationSeconds = readPositiveNumber('WORK_ORDERS_LOAD_DURATION_SECONDS', 300);
const concurrency = readPositiveInteger('WORK_ORDERS_LOAD_CONCURRENCY', 4);
const timeoutMs = readPositiveInteger('WORK_ORDERS_LOAD_TIMEOUT_MS', 10_000);
const paceMs = readNonNegativeInteger('WORK_ORDERS_LOAD_PACE_MS', 0);
const outputPath = process.env.LOAD_OUTPUT;
const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`;

const supportedScenarios = new Set(['ticket-list', 'ticket-status', 'alert-submit', 'alert-list']);

if (!supportedScenarios.has(scenario)) {
  throw new Error(
    `Unsupported WORK_ORDERS_LOAD_SCENARIO '${scenario}'. Use one of: ${[...supportedScenarios].join(', ')}.`
  );
}

function readPositiveNumber(name, defaultValue) {
  const value = process.env[name];
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative number.`);
  }
  return parsed;
}

function readPositiveInteger(name, defaultValue) {
  const value = readPositiveNumber(name, defaultValue);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}

function readNonNegativeInteger(name, defaultValue) {
  const value = readPositiveNumber(name, defaultValue);
  if (!Number.isInteger(value)) {
    throw new Error(`${name} must be a non-negative integer.`);
  }
  return value;
}

function createMetrics() {
  return {
    requestCount: 0,
    successCount: 0,
    errorCount: 0,
    statusCodes: {},
    errors: {},
    latenciesMs: []
  };
}

function addResult(metrics, result) {
  metrics.requestCount += 1;
  metrics.latenciesMs.push(result.latencyMs);
  if (result.status === null) {
    metrics.errorCount += 1;
    metrics.errors[result.errorName] = (metrics.errors[result.errorName] ?? 0) + 1;
    return;
  }

  metrics.statusCodes[result.status] = (metrics.statusCodes[result.status] ?? 0) + 1;
  if (result.status >= 200 && result.status < 300) {
    metrics.successCount += 1;
  } else {
    metrics.errorCount += 1;
  }
}

function summariseMetrics(metrics, elapsedMs) {
  const sortedLatencies = [...metrics.latenciesMs].sort((left, right) => left - right);
  const p95Index = Math.max(0, Math.ceil(sortedLatencies.length * 0.95) - 1);
  const elapsedSeconds = elapsedMs / 1000;

  return {
    requestCount: metrics.requestCount,
    successCount: metrics.successCount,
    errorCount: metrics.errorCount,
    statusCodes: metrics.statusCodes,
    errorTypes: metrics.errors,
    errorRatePercent: round(
      metrics.requestCount === 0 ? 0 : (metrics.errorCount / metrics.requestCount) * 100
    ),
    status503Count: metrics.statusCodes['503'] ?? 0,
    qps: round(elapsedSeconds === 0 ? 0 : metrics.requestCount / elapsedSeconds),
    p95LatencyMs: round(sortedLatencies[p95Index] ?? 0),
    elapsedMs: round(elapsedMs)
  };
}

function round(value) {
  return Math.round(value * 100) / 100;
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = performance.now();
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...options.headers
      }
    });
    const text = await response.text();
    return {
      status: response.status,
      latencyMs: performance.now() - startedAt,
      body: text ? tryParseJson(text) : null
    };
  } catch (error) {
    return {
      status: null,
      latencyMs: performance.now() - startedAt,
      errorName: error instanceof Error ? error.name : 'UnknownError',
      body: null
    };
  } finally {
    clearTimeout(timer);
  }
}

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function login() {
  const response = await request('/api/platform/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (response.status !== 200 || !response.body?.token) {
    throw new Error(`Load-test login failed with status ${response.status ?? 'network error'}.`);
  }
  return response.body.token;
}

function bearerHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

async function selectProject(token) {
  const response = await request('/api/tickets/projects', { headers: bearerHeaders(token) });
  if (response.status !== 200 || !Array.isArray(response.body?.projects)) {
    throw new Error(
      `Unable to load ticket projects (status ${response.status ?? 'network error'}).`
    );
  }

  const requestedProjectId = process.env.WORK_ORDERS_LOAD_PROJECT_ID;
  const project = requestedProjectId
    ? response.body.projects.find((item) => item.id === requestedProjectId)
    : response.body.projects[0];
  if (!project) {
    throw new Error(
      requestedProjectId
        ? 'WORK_ORDERS_LOAD_PROJECT_ID is not accessible to the load-test account.'
        : 'The load-test account does not have an accessible ticket project.'
    );
  }
  return project;
}

function createTicketListOperation(token, projectId) {
  return () =>
    request(`/api/tickets?projectId=${encodeURIComponent(projectId)}`, {
      headers: bearerHeaders(token)
    });
}

function nextStatus(status) {
  switch (status) {
    case 'OPEN':
      return 'IN_PROGRESS';
    case 'IN_PROGRESS':
      return 'RESOLVED';
    case 'RESOLVED':
      return 'IN_PROGRESS';
    default:
      throw new Error(`Cannot continue the status load scenario from ${status}.`);
  }
}

async function createStatusWorkers(token, projectId) {
  const workers = [];
  for (let index = 0; index < concurrency; index += 1) {
    const response = await request('/api/tickets', {
      method: 'POST',
      headers: { ...bearerHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        title: `Load test status ${runId}-${index + 1}`,
        description:
          'Created by tools/work-orders-load-test.mjs for isolated status-change load testing.',
        assigneeId: null
      })
    });
    if (response.status !== 200 || !response.body?.id) {
      throw new Error(
        `Unable to create status test ticket ${index + 1} (status ${response.status ?? 'network error'}).`
      );
    }
    workers.push({
      ticketId: response.body.id,
      status: response.body.status,
      version: response.body.version,
      recoveries: 0,
      recoveryFailures: 0
    });
  }
  return workers;
}

function createTicketStatusOperation(token, worker) {
  return async () => {
    const response = await request(`/api/tickets/${worker.ticketId}/status`, {
      method: 'POST',
      headers: {
        ...bearerHeaders(token),
        'Content-Type': 'application/json',
        'Idempotency-Key': `${runId}-${worker.ticketId}-${worker.version}-${Date.now()}`
      },
      body: JSON.stringify({
        status: nextStatus(worker.status),
        expectedVersion: worker.version
      })
    });
    if (response.status >= 200 && response.status < 300 && response.body?.status) {
      worker.status = response.body.status;
      worker.version = response.body.version;
      return response;
    }

    // A timeout can still have committed server-side. Refreshing prevents one failure from turning the
    // remaining worker operations into artificial optimistic-lock conflicts.
    worker.recoveries += 1;
    const refresh = await request(`/api/tickets/${worker.ticketId}`, {
      headers: bearerHeaders(token)
    });
    if (refresh.status === 200 && refresh.body?.status) {
      worker.status = refresh.body.status;
      worker.version = refresh.body.version;
    } else {
      worker.recoveryFailures += 1;
    }
    return response;
  };
}

function createAlertSubmitOperation(token, deviceId) {
  return () =>
    request('/api/alerts', {
      method: 'POST',
      headers: { ...bearerHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        alertType: 'LOAD_TEST',
        level: 'WARNING',
        message: `Synthetic load-test alert ${runId}`,
        occurredAt: new Date().toISOString()
      })
    });
}

function createAlertListOperation(token) {
  return () => request('/api/alerts', { headers: bearerHeaders(token) });
}

async function runPhase(name, seconds, operations) {
  const metrics = createMetrics();
  const startedAt = performance.now();
  const deadline = startedAt + seconds * 1000;
  await Promise.all(
    operations.map(async (operation) => {
      while (performance.now() < deadline) {
        const operationStartedAt = performance.now();
        const result = await operation();
        addResult(metrics, result);
        const remainingPaceMs = paceMs - (performance.now() - operationStartedAt);
        if (remainingPaceMs > 0) {
          await new Promise((resolveDelay) => setTimeout(resolveDelay, remainingPaceMs));
        }
      }
    })
  );
  return {
    name,
    configuredSeconds: seconds,
    ...summariseMetrics(metrics, performance.now() - startedAt)
  };
}

async function readHealth() {
  const response = await request('/api/health');
  return {
    status: response.status,
    latencyMs: round(response.latencyMs),
    body: response.body,
    errorType: response.status === null ? response.errorName : undefined
  };
}

async function waitForAlertAggregate(token, deviceId, expectedAcceptedCount) {
  const deadline =
    performance.now() + readPositiveInteger('WORK_ORDERS_ALERT_DRAIN_TIMEOUT_MS', 10_000);
  let matchingGroups = [];
  while (performance.now() < deadline) {
    const response = await request('/api/alerts', { headers: bearerHeaders(token) });
    if (response.status === 200 && Array.isArray(response.body?.alerts)) {
      matchingGroups = response.body.alerts.filter(
        (alert) => alert.deviceId === deviceId && alert.alertType === 'LOAD_TEST'
      );
      if (totalAlertRepeats(matchingGroups) >= expectedAcceptedCount) {
        break;
      }
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
  }
  const latest = matchingGroups[0] ?? null;
  return {
    deviceId,
    expectedAcceptedCount,
    observedRepeatCount: totalAlertRepeats(matchingGroups),
    groupCount: matchingGroups.length,
    groups: matchingGroups.map((alert) => ({
      bucketStart: alert.bucketStart,
      repeatCount: alert.repeatCount,
      firstSeenAt: alert.firstSeenAt,
      lastSeenAt: alert.lastSeenAt
    })),
    firstSeenAt: latest?.firstSeenAt ?? null,
    lastSeenAt: latest?.lastSeenAt ?? null,
    complete: totalAlertRepeats(matchingGroups) >= expectedAcceptedCount
  };
}

function totalAlertRepeats(groups) {
  return groups.reduce((total, group) => total + group.repeatCount, 0);
}

async function main() {
  const startedAt = new Date().toISOString();
  const token = await login();
  const project = scenario.startsWith('ticket-') ? await selectProject(token) : null;
  const statusWorkers =
    scenario === 'ticket-status' ? await createStatusWorkers(token, project.id) : [];
  const alertDeviceId = scenario === 'alert-submit' ? `load-device-${runId}` : null;

  const operations =
    scenario === 'ticket-list'
      ? Array.from({ length: concurrency }, () => createTicketListOperation(token, project.id))
      : scenario === 'ticket-status'
        ? statusWorkers.map((worker) => createTicketStatusOperation(token, worker))
        : scenario === 'alert-submit'
          ? Array.from({ length: concurrency }, () =>
              createAlertSubmitOperation(token, alertDeviceId)
            )
          : Array.from({ length: concurrency }, () => createAlertListOperation(token));

  const warmup = await runPhase('warmup', warmupSeconds, operations);
  const measurement = await runPhase('measurement', durationSeconds, operations);
  const acceptedAlerts = (warmup.statusCodes['202'] ?? 0) + (measurement.statusCodes['202'] ?? 0);
  const alertAggregate =
    alertDeviceId === null
      ? null
      : await waitForAlertAggregate(token, alertDeviceId, acceptedAlerts);

  const report = {
    schemaVersion: 1,
    runId,
    startedAt,
    finishedAt: new Date().toISOString(),
    target: {
      apiBaseUrl,
      scenario,
      concurrency,
      warmupSeconds,
      measurementSeconds: durationSeconds,
      timeoutMs,
      paceMs
    },
    setup:
      project === null
        ? { createdStatusTickets: 0 }
        : {
            projectId: project.id,
            projectName: project.name,
            createdStatusTickets: statusWorkers.length,
            statusRecoveryCount: statusWorkers.reduce(
              (total, worker) => total + worker.recoveries,
              0
            ),
            statusRecoveryFailureCount: statusWorkers.reduce(
              (total, worker) => total + worker.recoveryFailures,
              0
            )
          },
    warmup,
    measurement,
    alertAggregate,
    postRunHealth: await readHealth()
  };

  if (outputPath) {
    const resolvedOutputPath = resolve(process.cwd(), outputPath);
    await mkdir(dirname(resolvedOutputPath), { recursive: true });
    await writeFile(resolvedOutputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    report.artifactPath = resolvedOutputPath;
  }

  console.log(JSON.stringify(report, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(
      `Work-order load test failed: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exitCode = 1;
  });
}

export { totalAlertRepeats };
