import assert from 'node:assert/strict';
import test from 'node:test';

import { scoreCandidate, summarise, validateGoldenCases } from './evaluate-learning-golden-cases.mjs';

const goldenCase = {
  questionId: '20000000-0000-0000-0000-000000000001',
  selectedAnswer: 'A',
  expectedKnowledgePointId: 'equation-one-variable',
  expectedErrorTypeId: 'ARITHMETIC_ERROR',
  labelRationale: 'Synthetic labelled case.'
};

test('requires exactly ten complete golden cases', () => {
  assert.throws(() => validateGoldenCases({ cases: [goldenCase] }), /exactly ten/);
  assert.deepEqual(validateGoldenCases({ cases: Array.from({ length: 10 }, () => goldenCase) }), [
    goldenCase,
    goldenCase,
    goldenCase,
    goldenCase,
    goldenCase,
    goldenCase,
    goldenCase,
    goldenCase,
    goldenCase,
    goldenCase
  ]);
});

test('scores catalog-valid candidate fields without retaining credentials', () => {
  const result = scoreCandidate(goldenCase, {
    id: 'attempt-1',
    diagnosisStatus: 'VALID',
    reviewStatus: 'PENDING',
    diagnosisJson: JSON.stringify({
      knowledgePointId: 'equation-one-variable',
      errorTypeId: 'ARITHMETIC_ERROR',
      evidence: 'The final division is incorrect.',
      plan: []
    })
  });

  assert.equal(result.automatic.knowledgePointMatched, true);
  assert.equal(result.automatic.errorTypeMatched, true);
  assert.deepEqual(summarise([result]), {
    caseCount: 1,
    validDiagnosisCount: 1,
    knowledgePointMatchCount: 1,
    errorTypeMatchCount: 1,
    combinedMatchCount: 1,
    standardAnswerPollutionCount: 0,
    humanScoringComplete: false
  });
});
