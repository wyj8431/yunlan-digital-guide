// 命令行评测入口，使用黄金用例检查导游回答的基本质量。
import { readEnv } from '../config/env.js';
import { createGuideResponse } from '../modules/guide/guide.service.js';
import {
  offlineDetailedGoldenCases,
  runGoldenEvaluation
} from '../modules/guide/guide-evaluation.js';

const env = {
  ...readEnv(),
  llmBaseUrl: '',
  llmApiKey: '',
  llmModel: ''
};

const summary = await runGoldenEvaluation(offlineDetailedGoldenCases, async (message) => {
  const response = await createGuideResponse({ message, env });

  return response.answer;
});

console.log(
  `Guide golden evaluation: ${summary.passed}/${summary.total} passed, ${summary.failed.length} failed.`
);

for (const failure of summary.failed) {
  console.log(`- ${failure.name}`);
  console.log(`  message: ${failure.message}`);
  console.log(`  missing includes: ${failure.missingIncludes.join(', ') || 'none'}`);
  console.log(`  present excludes: ${failure.presentExcludes.join(', ') || 'none'}`);
}

if (summary.failed.length > 0) {
  process.exitCode = 1;
}
