import type { GuideChatResponse, ScenicAreaSummary } from '../types/guide';

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as unknown;

  if (!response.ok) {
    const message =
      typeof body === 'object' &&
      body !== null &&
      'message' in body &&
      typeof body.message === 'string'
        ? body.message
        : '请求失败';
    throw new Error(message);
  }

  return body as T;
}

export async function fetchScenicArea(): Promise<ScenicAreaSummary> {
  const response = await fetch('/api/scenic-area');
  return readJson<ScenicAreaSummary>(response);
}

export async function askGuide(message: string): Promise<GuideChatResponse> {
  const response = await fetch('/api/guide/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  });

  return readJson<GuideChatResponse>(response);
}
