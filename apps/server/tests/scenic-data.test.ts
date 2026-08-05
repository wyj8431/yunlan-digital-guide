import { describe, expect, it } from 'vitest';
import { getScenicAreaSummary, loadScenicData } from '../src/modules/scenic/scenic-data';

describe('scenic data', () => {
  it('loads real Wuzhen scenic data with required content counts', () => {
    const data = loadScenicData();

    expect(data.scenicArea.name).toBe('乌镇景区');
    expect(data.scenicArea.sourceUrl).toContain('ewuzhen.com');
    expect(data.spots).toHaveLength(5);
    expect(data.routes).toHaveLength(3);
    expect(data.services).toHaveLength(5);
    expect(data.faqs.length).toBeGreaterThanOrEqual(4);
  });

  it('returns a public summary without long story fields', () => {
    const summary = getScenicAreaSummary();

    expect(summary.scenicArea.id).toBe('wuzhen-scenic-area');
    expect(summary.spots[0]).toEqual({
      id: 'xizha-street',
      name: '西栅老街',
      summary: '西栅是乌镇夜游和水乡慢行的核心区域，白墙黛瓦、河道石桥和灯影水巷集中。'
    });
    expect('story' in summary.spots[0]).toBe(false);
  });

  it('includes the self-introduction quick question without the regional recommendation', () => {
    const summary = getScenicAreaSummary();

    expect(summary.quickQuestions).toContain('先介绍一下你自己');
    expect(summary.quickQuestions).not.toContain('推荐几个国内热门地区的景区和路线');
  });
});
