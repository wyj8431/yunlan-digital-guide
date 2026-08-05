import type { ExhibitionCatalog, ExhibitionItem } from '../types/exhibition';

export class ExhibitionApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(`${message}（HTTP ${status}）`);
    this.name = 'ExhibitionApiError';
  }
}

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const message =
      typeof body === 'object' &&
      body !== null &&
      'message' in body &&
      typeof body.message === 'string'
        ? body.message
        : '展厅内容请求失败';
    throw new ExhibitionApiError(message, response.status);
  }
  return body as T;
}

export async function fetchExhibitionCatalog(): Promise<ExhibitionCatalog> {
  return readJson<ExhibitionCatalog>(await fetch('/api/exhibition'));
}

export async function fetchExhibitionItem(itemId: string): Promise<{ item: ExhibitionItem }> {
  return readJson<{ item: ExhibitionItem }>(
    await fetch(`/api/exhibition/items/${encodeURIComponent(itemId)}`)
  );
}
