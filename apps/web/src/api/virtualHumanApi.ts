import type { VirtualHumanConfig } from '../types/virtualHuman';

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as unknown;

  if (!response.ok) {
    throw new Error('虚拟人配置加载失败');
  }

  return body as T;
}

export async function fetchVirtualHumanConfig(): Promise<VirtualHumanConfig> {
  const response = await fetch('/api/virtual-human/config');
  return readJson<VirtualHumanConfig>(response);
}
