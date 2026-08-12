export type Live2DConfig = {
  modelUrl: string;
  coreUrl: string;
};

function getHttpsUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed).protocol === 'https:' ? trimmed : null;
  } catch {
    return null;
  }
}

export function resolveLive2DConfig(env: Record<string, string | undefined>): Live2DConfig | null {
  const modelUrl = getHttpsUrl(env.VITE_LIVE2D_MODEL_URL);
  const coreUrl = getHttpsUrl(env.VITE_LIVE2D_CORE_URL);

  return modelUrl && coreUrl ? { modelUrl, coreUrl } : null;
}

export const live2DConfig = resolveLive2DConfig(import.meta.env);
