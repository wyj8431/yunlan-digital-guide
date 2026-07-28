import { describe, expect, it } from 'vitest';
import {
  findDestinationGuidePlan,
  findDestinationName
} from '../src/modules/guide/guide-knowledge';

describe('guide knowledge', () => {
  it('resolves destination aliases to canonical guide plans', () => {
    const plan = findDestinationGuidePlan('明天去西湖一日游怎么玩？');

    expect(plan?.destination).toBe('杭州西湖');
    expect(plan?.sections.join('\n')).toContain('断桥');
    expect(plan?.sections.join('\n')).toContain('苏堤');
  });

  it('prefers the longest destination match before aliases', () => {
    const plan = findDestinationGuidePlan('巴黎埃菲尔铁塔一日游路线怎么安排？');

    expect(plan?.destination).toBe('埃菲尔铁塔');
    expect(plan?.sections.join('\n')).toContain('特罗卡德罗');
  });

  it.each([
    ['张家界三日游路线怎么安排？', '张家界', '天门山'],
    ['九寨沟两日游交通住宿怎么安排？', '九寨沟', '沟口'],
    ['北京长城一日游怎么玩？', '长城', '八达岭'],
    ['上海迪士尼亲子游怎么玩？', '上海迪士尼度假区', '飞跃地平线'],
    ['北京环球影城一日游路线怎么安排？', '北京环球影城', '哈利波特'],
    ['巴黎卢浮宫半日游怎么安排？', '卢浮宫', '玻璃金字塔']
  ])('returns detailed guide plan for %s', (message, destination, expectedSpot) => {
    const plan = findDestinationGuidePlan(message);
    const answer = plan?.sections.join('\n') ?? '';

    expect(plan?.destination).toBe(destination);
    expect(answer).toContain(expectedSpot);
    expect(answer).toContain('路线安排');
    expect(answer).toContain('交通方式');
    expect(answer).toContain('住宿建议');
    expect(answer).toContain('注意事项');
    expect(answer).toContain('官方');
  });

  it('extracts known destination names even when no detailed plan exists yet', () => {
    expect(findDestinationName('首尔三日游路线怎么安排？')).toBe('首尔');
    expect(findDestinationGuidePlan('首尔三日游路线怎么安排？')).toBeNull();
  });
});
