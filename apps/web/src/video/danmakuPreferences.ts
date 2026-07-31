export type DanmakuPreferences = {
  speed: number;
  fontSize: number;
  opacity: number;
  density: number;
};

export const DANMAKU_PREFERENCES_KEY = 'yunlan-video-danmaku-preferences-v2';

export const defaultDanmakuPreferences: DanmakuPreferences = {
  speed: 1,
  fontSize: 18,
  opacity: 0.9,
  density: 6
};

function isPreference(value: unknown): value is DanmakuPreferences {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.speed === 'number' &&
    candidate.speed >= 0.5 &&
    candidate.speed <= 2 &&
    typeof candidate.fontSize === 'number' &&
    candidate.fontSize >= 14 &&
    candidate.fontSize <= 28 &&
    typeof candidate.opacity === 'number' &&
    candidate.opacity >= 0.3 &&
    candidate.opacity <= 1 &&
    Number.isInteger(candidate.density) &&
    (candidate.density as number) >= 1 &&
    (candidate.density as number) <= 6
  );
}

export function loadDanmakuPreferences(): DanmakuPreferences {
  try {
    const stored = window.localStorage.getItem(DANMAKU_PREFERENCES_KEY);
    const parsed: unknown = stored ? JSON.parse(stored) : null;
    return isPreference(parsed) ? parsed : defaultDanmakuPreferences;
  } catch {
    return defaultDanmakuPreferences;
  }
}

export function saveDanmakuPreferences(preferences: DanmakuPreferences): void {
  try {
    window.localStorage.setItem(DANMAKU_PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // Preference persistence is optional in privacy-restricted browser modes.
  }
}
