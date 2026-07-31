// 嘴型参数控制区把表单值转换为状态仓库需要的数值配置。
import type { ChangeEvent } from 'react';
import { useLipSyncLabStore } from '../store/useLipSyncLabStore';
import type { MouthSignalConfig, RenderQualityTier } from '../types';

type SliderConfig = {
  key: keyof MouthSignalConfig;
  label: string;
  min: number;
  max: number;
  step: number;
  suffix: string;
};

const SLIDERS: SliderConfig[] = [
  { key: 'sensitivity', label: '灵敏度', min: 0.1, max: 5, step: 0.1, suffix: 'x' },
  { key: 'threshold', label: '噪声阈值', min: 0, max: 1, step: 0.01, suffix: '' },
  { key: 'maxOpen', label: '最大开口', min: 0, max: 1, step: 0.01, suffix: '' },
  { key: 'attackMs', label: '张口速度', min: 0, max: 1000, step: 10, suffix: 'ms' },
  { key: 'releaseMs', label: '闭口速度', min: 0, max: 1000, step: 10, suffix: 'ms' }
];

const QUALITY_TIERS: Array<{ tier: RenderQualityTier; label: string }> = [
  { tier: 'low', label: '低' },
  { tier: 'medium', label: '中' },
  { tier: 'high', label: '高' }
];

export function LipSyncControls() {
  const config = useLipSyncLabStore((state) => state.config);
  const qualityTier = useLipSyncLabStore((state) => state.qualityTier);
  const automaticQuality = useLipSyncLabStore((state) => state.automaticQuality);
  const updateConfig = useLipSyncLabStore((state) => state.updateConfig);
  const setQualityTier = useLipSyncLabStore((state) => state.setQualityTier);
  const setAutomaticQuality = useLipSyncLabStore((state) => state.setAutomaticQuality);

  const onSliderChange =
    (key: keyof MouthSignalConfig) => (event: ChangeEvent<HTMLInputElement>) => {
      updateConfig({ [key]: Number(event.currentTarget.value) });
    };

  return (
    <section className="lip-sync-panel lip-sync-controls" aria-label="口型参数">
      {SLIDERS.map((slider) => (
        <label key={slider.key} className="lip-sync-slider">
          <span>{slider.label}</span>
          <input
            aria-label={slider.label}
            type="range"
            min={slider.min}
            max={slider.max}
            step={slider.step}
            value={config[slider.key]}
            onChange={onSliderChange(slider.key)}
          />
          <strong>
            {config[slider.key]}
            {slider.suffix}
          </strong>
        </label>
      ))}

      <fieldset className="lip-sync-quality">
        <legend>渲染质量</legend>
        <div className="lip-sync-segmented">
          {QUALITY_TIERS.map((item) => (
            <button
              key={item.tier}
              type="button"
              aria-pressed={qualityTier === item.tier}
              onClick={() => setQualityTier(item.tier)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="lip-sync-checkbox">
        <input
          type="checkbox"
          checked={automaticQuality}
          onChange={(event) => setAutomaticQuality(event.currentTarget.checked)}
        />
        <span>自动质量调节</span>
      </label>
    </section>
  );
}
