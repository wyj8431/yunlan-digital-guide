import { useEffect, useRef, useState } from 'react';
import { live2DConfig } from '../lib/live2dConfig';

type Live2DStageProps = {
  speaking: boolean;
  onStatusChange?: (status: 'loading' | 'ready' | 'error') => void;
};

declare global {
  interface Window {
    PIXI?: typeof import('pixi.js');
  }
}

function loadCubismCore(coreUrl: string): Promise<void> {
  const existing = document.querySelector<HTMLScriptElement>(
    `script[data-live2d-core="${coreUrl}"]`
  );

  if (existing?.dataset.loaded === 'true') {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const script = existing ?? document.createElement('script');
    script.async = true;
    script.src = coreUrl;
    script.dataset.live2dCore = coreUrl;
    script.addEventListener(
      'load',
      () => {
        script.dataset.loaded = 'true';
        resolve();
      },
      { once: true }
    );
    script.addEventListener(
      'error',
      () => reject(new Error('Live2D Cubism Core could not be loaded.')),
      {
        once: true
      }
    );

    if (!existing) {
      document.head.appendChild(script);
    }
  });
}

export function Live2DStage({ speaking, onStatusChange }: Live2DStageProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    const host = hostRef.current;

    if (!host || !live2DConfig) {
      return;
    }

    let disposed = false;
    let app: import('pixi.js').Application | null = null;
    let model: import('pixi-live2d-display').Live2DModel | null = null;

    void (async () => {
      try {
        await loadCubismCore(live2DConfig.coreUrl);
        const PIXI = await import('pixi.js');
        window.PIXI = PIXI;
        const { Live2DModel } = await import('pixi-live2d-display');

        if (disposed) {
          return;
        }

        app = new PIXI.Application({
          resizeTo: host,
          transparent: true,
          antialias: true,
          autoDensity: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2)
        });
        host.appendChild(app.view as HTMLCanvasElement);
        model = await Live2DModel.from(live2DConfig.modelUrl);

        if (disposed || !app) {
          model.destroy();
          return;
        }

        model.anchor.set(0.5, 1);
        model.x = app.renderer.width / 2;
        model.y = app.renderer.height;
        model.scale.set(
          Math.min(
            app.renderer.width / Math.max(model.width, 1),
            app.renderer.height / Math.max(model.height, 1)
          ) * 0.92
        );
        app.stage.addChild(model);
        setStatus('ready');
        onStatusChange?.('ready');
      } catch {
        if (!disposed) {
          setStatus('error');
          onStatusChange?.('error');
        }
      }
    })();

    return () => {
      disposed = true;
      model?.destroy({ children: true, texture: true, baseTexture: true });
      app?.destroy(true, { children: true, texture: true, baseTexture: true });
    };
  }, [onStatusChange]);

  useEffect(() => {
    if (status !== 'ready' || !speaking) {
      return;
    }
  }, [speaking, status]);

  return (
    <div
      ref={hostRef}
      className="live2d-host"
      aria-label={status === 'ready' ? 'Live2D 数字人' : 'Live2D 数字人加载中'}
    />
  );
}
