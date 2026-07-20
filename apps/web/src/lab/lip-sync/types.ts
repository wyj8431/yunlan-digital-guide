export type MouthSignalConfig = {
  threshold: number;
  sensitivity: number;
  maxOpen: number;
  attackMs: number;
  releaseMs: number;
};

export const DEFAULT_MOUTH_SIGNAL_CONFIG: MouthSignalConfig = {
  threshold: 0.08,
  sensitivity: 2,
  maxOpen: 0.86,
  attackMs: 70,
  releaseMs: 140
};
