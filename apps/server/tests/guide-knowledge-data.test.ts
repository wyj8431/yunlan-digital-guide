import { describe, expect, it } from 'vitest';
import {
  destinationGuidePlanRecords,
  destinationPlanAliases,
  travelDestinationKeywords
} from '../src/modules/guide/guide-knowledge-data';

describe('guide knowledge data', () => {
  it('keeps destination data in a dedicated data source', () => {
    expect(travelDestinationKeywords).toContain('张家界');
    expect(travelDestinationKeywords).toContain('上海迪士尼度假区');
    expect(destinationPlanAliases).toMatchObject({
      西湖: '杭州西湖',
      迪士尼: '上海迪士尼度假区',
      环球影城: '北京环球影城'
    });
    expect(destinationGuidePlanRecords.some((record) => record.destination === '九寨沟')).toBe(
      true
    );
  });

  it('requires every destination plan to cover the detailed travel sections', () => {
    for (const record of destinationGuidePlanRecords) {
      const answer = record.sections.join('\n');

      expect(record.sections).toHaveLength(5);
      expect(answer).toContain('路线安排');
      expect(answer).toContain('交通方式');
      expect(answer).toContain('住宿建议');
      expect(answer).toContain('注意事项');
      expect(answer).toContain('票务和开放时间核验');
    }
  });
});
