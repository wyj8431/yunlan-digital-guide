export type QualityLevel = 'high' | 'medium' | 'low';

export type QualityProfile = {
  pixelRatio: number;
  shadowMapSize: 2048 | 1024 | 512;
  postScale: 1 | 0.75 | 0.5;
  ssao: boolean;
  ssr: boolean;
  bloom: boolean;
  depthOfField: boolean;
  godRays: boolean;
  volumetricFog: boolean;
  cascadedShadows: boolean;
  areaLightCount: number;
  vegetationDensity: number;
};

export const QUALITY_PROFILES: Record<QualityLevel, QualityProfile> = {
  high: {
    pixelRatio: 2,
    shadowMapSize: 2048,
    postScale: 1,
    // Fixed high quality favors a bright, sharp display over cinematic effects.
    ssao: false,
    ssr: false,
    bloom: false,
    depthOfField: false,
    godRays: false,
    volumetricFog: false,
    cascadedShadows: false,
    areaLightCount: 8,
    vegetationDensity: 1
  },
  medium: {
    pixelRatio: 1.5,
    shadowMapSize: 1024,
    postScale: 0.75,
    ssao: true,
    ssr: false,
    bloom: true,
    depthOfField: true,
    godRays: false,
    volumetricFog: true,
    cascadedShadows: false,
    areaLightCount: 4,
    vegetationDensity: 0.7
  },
  low: {
    pixelRatio: 1.25,
    shadowMapSize: 512,
    postScale: 0.5,
    ssao: false,
    ssr: false,
    bloom: true,
    depthOfField: false,
    godRays: false,
    volumetricFog: false,
    cascadedShadows: false,
    areaLightCount: 2,
    vegetationDensity: 0.45
  }
};

export function nextLowerQuality(level: QualityLevel): QualityLevel {
  if (level === 'high') return 'medium';
  if (level === 'medium') return 'low';
  return 'low';
}

export class QualityDowngradeController {
  private slowWindows = 0;
  private lastDowngradeAt = Number.NEGATIVE_INFINITY;

  constructor(
    private level: QualityLevel,
    private readonly targetFps: number,
    private readonly cooldownMs: number,
    private readonly warmupMs = 5_000,
    private readonly startedAt = 0
  ) {}

  sample(fps: number, nowMs: number): QualityLevel {
    if (nowMs - this.startedAt < this.warmupMs || nowMs - this.lastDowngradeAt < this.cooldownMs) {
      return this.level;
    }
    this.slowWindows = fps < this.targetFps ? this.slowWindows + 1 : 0;
    if (this.slowWindows >= 3) {
      const next = nextLowerQuality(this.level);
      if (next !== this.level) {
        this.level = next;
        this.lastDowngradeAt = nowMs;
      }
      this.slowWindows = 0;
    }
    return this.level;
  }

  getLevel(): QualityLevel {
    return this.level;
  }
}
