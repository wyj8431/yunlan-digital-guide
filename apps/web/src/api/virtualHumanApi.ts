import type { VirtualHumanConfig } from '../types/virtualHuman';

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as unknown;

  if (!response.ok) {
    const message =
      typeof body === 'object' &&
      body !== null &&
      'message' in body &&
      typeof body.message === 'string'
        ? body.message
        : '虚拟人配置加载失败';
    throw new Error(message);
  }

  return body as T;
}

export async function fetchVirtualHumanConfig(): Promise<VirtualHumanConfig> {
  const response = await fetch('/api/virtual-human/config');
  return readJson<VirtualHumanConfig>(response);
}
