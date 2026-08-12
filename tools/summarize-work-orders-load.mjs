import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';

const inputPaths = process.argv.slice(2);
const outputPath = process.env.LOAD_SUMMARY_OUTPUT;

if (inputPaths.length === 0) {
  throw new Error('Provide one or more work-order load JSON report paths.');
}

async function readReport(inputPath) {
  const resolvedPath = resolve(process.cwd(), inputPath);
  let report;
  try {
    report = JSON.parse(await readFile(resolvedPath, 'utf8'));
  } catch (error) {
    throw new Error(
      `Unable to read '${inputPath}': ${error instanceof Error ? error.message : String(error)}`
    );
  }
  if (
    report?.schemaVersion !== 1 ||
    typeof report?.target?.scenario !== 'string' ||
    typeof report?.measurement?.requestCount !== 'number'
  ) {
    throw new Error(`'${inputPath}' is not a schema version 1 work-order load report.`);
  }
  return { inputPath, report };
}

function formatNumber(value) {
  return typeof value === 'number'
    ? value.toLocaleString('en-US', { maximumFractionDigits: 2 })
    : 'n/a';
}

function formatAggregate(aggregate) {
  if (aggregate === null || aggregate === undefined) {
    return 'n/a';
  }
  const counts = `${aggregate.observedRepeatCount}/${aggregate.expectedAcceptedCount}`;
  return aggregate.complete ? `${counts} complete` : `${counts} incomplete`;
}

function formatHealth(health) {
  if (!health) {
    return 'missing';
  }
  return health.status === 200 && health.body?.ok === true
    ? '200 healthy'
    : `${health.status ?? 'network'} unhealthy`;
}

function warningsFor(report, inputPath) {
  const warnings = [];
  if (report.target.measurementSeconds < 300) {
    warnings.push(
      `${basename(inputPath)} is a short smoke run, not a five-minute acceptance benchmark.`
    );
  }
  if (report.alertAggregate && !report.alertAggregate.complete) {
    warnings.push(
      `${basename(inputPath)} did not drain every accepted alert into its aggregate group.`
    );
  }
  if (report.postRunHealth?.status !== 200 || report.postRunHealth?.body?.ok !== true) {
    warnings.push(`${basename(inputPath)} did not finish with a healthy API response.`);
  }
  return warnings;
}

function buildSummary(entries) {
  const warnings = entries.flatMap(({ inputPath, report }) => warningsFor(report, inputPath));
  const lines = [
    '# Work-Order Load Summary',
    '',
    `Generated at ${new Date().toISOString()} from ${entries.length} JSON report(s).`,
    '',
    '| Report | Scenario | Workers | Measurement | Requests | QPS | P95 | Error rate | 503 | Alert aggregate | Health |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |'
  ];

  for (const { inputPath, report } of entries) {
    const measurement = report.measurement;
    lines.push(
      `| ${basename(inputPath)} | ${report.target.scenario} | ${report.target.concurrency} | ${report.target.measurementSeconds}s | ${formatNumber(measurement.requestCount)} | ${formatNumber(measurement.qps)} | ${formatNumber(measurement.p95LatencyMs)}ms | ${formatNumber(measurement.errorRatePercent)}% | ${formatNumber(measurement.status503Count)} | ${formatAggregate(report.alertAggregate)} | ${formatHealth(report.postRunHealth)} |`
    );
  }

  lines.push('', '## Interpretation', '');
  if (warnings.length === 0) {
    lines.push('All supplied reports meet the summary checks.');
  } else {
    for (const warning of warnings) {
      lines.push(`- ${warning}`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

const entries = await Promise.all(inputPaths.map(readReport));
const summary = buildSummary(entries);

if (outputPath) {
  const resolvedOutputPath = resolve(process.cwd(), outputPath);
  await mkdir(dirname(resolvedOutputPath), { recursive: true });
  await writeFile(resolvedOutputPath, `${summary}\n`, 'utf8');
  console.log(`Wrote work-order load summary to ${resolvedOutputPath}`);
} else {
  console.log(summary);
}
