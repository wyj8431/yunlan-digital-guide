import { describe, expect, it } from 'vitest';
import { evaluateGoldenAnswer, runGoldenEvaluation } from '../src/modules/guide/guide-evaluation';

describe('guide evaluation', () => {
  it('scores golden answers against required and forbidden terms', () => {
    const passing = evaluateGoldenAnswer(
      {
        name: 'west lake',
        message: '西湖一日游怎么安排？',
        includes: ['断桥', '苏堤'],
        excludes: ['接入后台智能体后']
      },
      '路线安排：从断桥出发，沿白堤到苏堤。'
    );
    const failing = evaluateGoldenAnswer(
      {
        name: 'west lake',
        message: '西湖一日游怎么安排？',
        includes: ['断桥', '苏堤'],
        excludes: ['接入后台智能体后']
      },
      '路线安排：从断桥出发，接入后台智能体后再回答。'
    );

    expect(passing).toEqual({
      passed: true,
      missingIncludes: [],
      presentExcludes: []
    });
    expect(failing).toEqual({
      passed: false,
      missingIncludes: ['苏堤'],
      presentExcludes: ['接入后台智能体后']
    });
  });

  it('runs a golden case set and reports failed cases', async () => {
    const summary = await runGoldenEvaluation(
      [
        {
          name: 'passing case',
          message: '西湖一日游怎么安排？',
          includes: ['断桥'],
          excludes: ['接入后台智能体后']
        },
        {
          name: 'failing case',
          message: '故宫一日游怎么安排？',
          includes: ['午门'],
          excludes: ['接入后台智能体后']
        }
      ],
      async (message) =>
        message.includes('西湖') ? '路线安排：断桥出发。' : '接入后台智能体后再回答。'
    );

    expect(summary.total).toBe(2);
    expect(summary.passed).toBe(1);
    expect(summary.failed).toHaveLength(1);
    expect(summary.failed[0]).toMatchObject({
      name: 'failing case',
      missingIncludes: ['午门'],
      presentExcludes: ['接入后台智能体后']
    });
  });
});
