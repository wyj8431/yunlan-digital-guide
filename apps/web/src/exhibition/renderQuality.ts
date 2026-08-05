export type RenderDeviceProfile = {
  devicePixelRatio: number;
  viewportWidth: number;
  hardwareConcurrency?: number;
};

export const MIN_RENDER_DPR = 1;
export const SLOW_FRAME_MS = 26;
export const FAST_FRAME_MS = 17;

export function getInitialRenderDprCap({ devicePixelRatio, viewportWidth, hardwareConcurrency }: RenderDeviceProfile): number {
  const normalizedDpr = Number.isFinite(devicePixelRatio) ? Math.max(MIN_RENDER_DPR, devicePixelRatio) : MIN_RENDER_DPR;
  const constrainedDevice = viewportWidth <= 720 || (hardwareConcurrency !== undefined && hardwareConcurrency <= 4);
  return Math.min(normalizedDpr, constrainedDevice ? 1.25 : 1.5);
}

export function getNextRenderDpr(currentDpr: number, averageFrameMs: number, maxDpr: number): number {
  if (averageFrameMs >= SLOW_FRAME_MS) return Math.max(MIN_RENDER_DPR, Number((currentDpr - 0.15).toFixed(2)));
  if (averageFrameMs <= FAST_FRAME_MS) return Math.min(maxDpr, Number((currentDpr + 0.1).toFixed(2)));
  return currentDpr;
}
