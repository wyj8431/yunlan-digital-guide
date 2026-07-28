import { describe, expect, it } from 'vitest';
import { createXfyunSignedUrl } from '../src/modules/voice/xfyun-auth';

describe('xfyun auth', () => {
  it('creates a deterministic signed websocket url', () => {
    const signedUrl = createXfyunSignedUrl({
      url: 'wss://iat-api.xfyun.cn/v2/iat',
      apiKey: 'test-key',
      apiSecret: 'test-secret',
      date: 'Thu, 23 Jul 2026 12:00:00 GMT'
    });
    const parsed = new URL(signedUrl);
    const authorization = Buffer.from(
      decodeURIComponent(parsed.searchParams.get('authorization') ?? ''),
      'base64'
    ).toString('utf8');

    expect(parsed.pathname).toBe('/v2/iat');
    expect(parsed.searchParams.get('date')).toBe('Thu, 23 Jul 2026 12:00:00 GMT');
    expect(parsed.searchParams.get('host')).toBe('iat-api.xfyun.cn');
    expect(authorization).toContain('api_key="test-key"');
    expect(authorization).toContain('algorithm="hmac-sha256"');
    expect(authorization).toContain('headers="host date request-line"');
  });
});
