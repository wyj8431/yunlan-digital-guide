import type { MouthSignalConfig } from '../types';

// Work order: 3D digital-human lip sync and audio synchronization.

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function calculateRms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  const sum = samples.reduce((total, sample) => total + sample * sample, 0);
  return Math.sqrt(sum / samples.length);
}

export function nextMouthSignal(
  current: number,
  rms: number,
  deltaMs: number,
  config: MouthSignalConfig
): number {
  const aboveNoise = Math.max(0, rms - config.threshold);
  const target = clamp(aboveNoise * config.sensitivity, 0, config.maxOpen);
  const duration = target > current ? config.attackMs : config.releaseMs;
  const alpha = duration <= 0 ? 1 : 1 - Math.exp(-Math.max(deltaMs, 0) / duration);
  const next = current + (target - current) * alpha;
  return target === 0 && next < 0.001 ? 0 : next;
}
