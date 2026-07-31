import { describe, expect, it, vi } from 'vitest';
import { getScenicAreaSummary } from '../src/modules/scenic/scenic-data';
import { ScenicLiveService } from '../src/modules/scenic/scenic-live.service';

function response(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload
  } as Response;
}

describe('ScenicLiveService', () => {
  it('merges official JSON fields and exposes source freshness', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      response({
        openingHours: '今日 08:00-22:00',
        ticketInfo: '成人票 120 元，官方预约中',
        notices: ['夜游入口从西栅游客中心进入'],
        sourceName: '乌镇景区官方公告',
        sourceUrl: 'https://official.example/wuzhen/notice',
        updatedAt: '2026-07-31T08:00:00+08:00'
      })
    );
    const service = new ScenicLiveService({
      feedUrl: 'https://official.example/wuzhen/live.json',
      fetchImpl,
      fallback: getScenicAreaSummary,
      now: () => new Date('2026-07-31T09:00:00+08:00')
    });

    const summary = await service.getSummary();

    expect(summary.scenicArea.openingHours).toBe('今日 08:00-22:00');
    expect(summary.scenicArea.ticketInfo).toBe('成人票 120 元，官方预约中');
    expect(summary.officialInfo).toEqual({
      status: 'live',
      sourceName: '乌镇景区官方公告',
      sourceUrl: 'https://official.example/wuzhen/notice',
      updatedAt: '2026-07-31T08:00:00+08:00',
      checkedAt: '2026-07-31T01:00:00.000Z',
      notices: ['夜游入口从西栅游客中心进入']
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('reuses a fresh live snapshot within the TTL', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({ ticketInfo: '实时票价' }));
    const service = new ScenicLiveService({
      feedUrl: 'https://official.example/wuzhen/live.json',
      fetchImpl,
      fallback: getScenicAreaSummary,
      now: () => new Date('2026-07-31T09:00:00+08:00'),
      ttlMs: 300_000
    });

    await service.getSummary();
    await service.getSummary();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('normalizes the official Wuzhen ticket API response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      response({
        data: {
          records: [
            {
              name: '乌镇',
              price: 110,
              openTime: '东栅 07:00-18:00<br/>西栅 09:00-22:00',
              orderNotice: '<p>当天开放时间以景区公告为准</p>'
            }
          ]
        }
      })
    );
    const service = new ScenicLiveService({
      feedUrl: 'https://wzapi.ewuzhen.com/front/api/product/park/list',
      fetchImpl,
      fallback: getScenicAreaSummary
    });

    const summary = await service.getSummary();

    expect(summary.scenicArea.openingHours).toBe('东栅 07:00-18:00 西栅 09:00-22:00');
    expect(summary.scenicArea.ticketInfo).toContain('乌镇 110 元');
    expect(summary.officialInfo?.notices).toEqual(['当天开放时间以景区公告为准']);
  });

  it('returns the last live value as stale when refresh fails', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(response({ notices: ['临时管控：南栅入口限流'] }))
      .mockRejectedValueOnce(new Error('official feed unavailable'));
    let currentTime = new Date('2026-07-31T09:00:00+08:00');
    const service = new ScenicLiveService({
      feedUrl: 'https://official.example/wuzhen/live.json',
      fetchImpl,
      fallback: getScenicAreaSummary,
      now: () => currentTime,
      ttlMs: 300_000
    });

    const first = await service.getSummary();
    currentTime = new Date('2026-07-31T10:00:00+08:00');
    const second = await service.getSummary();

    expect(first.officialInfo?.status).toBe('live');
    expect(second.officialInfo).toMatchObject({
      status: 'stale',
      notices: ['临时管控：南栅入口限流'],
      sourceUrl: 'https://official.example/wuzhen/live.json'
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('marks the response unconfigured without an official feed URL', async () => {
    const fetchImpl = vi.fn();
    const service = new ScenicLiveService({
      feedUrl: '',
      fetchImpl,
      fallback: getScenicAreaSummary
    });

    const summary = await service.getSummary();

    expect(summary.officialInfo).toMatchObject({ status: 'unconfigured', notices: [] });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
