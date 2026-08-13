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

  // 之前加载失败的 script 无法再次触发 load/error：移除后重新创建，避免重试时 Promise 永久挂起
  existing?.remove();

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.async = true;
    script.src = coreUrl;
    script.dataset.live2dCore = coreUrl;
    const cleanup = () => {
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
    };
    const onLoad = () => {
      script.dataset.loaded = 'true';
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('Live2D Cubism Core could not be loaded.'));
    };
    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });
    document.head.appendChild(script);
  });
}

export function Live2DStage({ speaking, onStatusChange }: Live2DStageProps) {
  // WO-5/WO-6: drive the Live2D mouth parameter while speech is active.
  const hostRef = useRef<HTMLDivElement | null>(null);
  const modelRef = useRef<import('pixi-live2d-display').Live2DModel | null>(null);
  const mouthAnimationRef = useRef<number | null>(null);
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

        // 异步加载期间组件可能已卸载：及时销毁刚创建的实例，避免 canvas 泄漏
        if (disposed) {
          app.destroy(true, { children: true, texture: true, baseTexture: true });
          return;
        }

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
        modelRef.current = model;
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
      modelRef.current = null;
      if (mouthAnimationRef.current !== null) {
        window.cancelAnimationFrame(mouthAnimationRef.current);
      }
      model?.destroy({ children: true, texture: true, baseTexture: true });
      app?.destroy(true, { children: true, texture: true, baseTexture: true });
    };
  }, [onStatusChange]);

  useEffect(() => {
    const model = modelRef.current;
    const coreModel = model?.internalModel?.coreModel as
      | {
          setParameterValueById?: (parameterId: string, value: number, weight?: number) => void;
        }
      | undefined;
    const setMouth = coreModel?.setParameterValueById;
    if (status !== 'ready' || !setMouth) {
      return;
    }

    let closed = false;
    const animate = (timestamp: number) => {
      const open = speaking ? 0.28 + (Math.sin(timestamp / 95) + 1) * 0.26 : 0;
      setMouth.call(coreModel, 'ParamMouthOpenY', open, 1);
      if (!closed) mouthAnimationRef.current = window.requestAnimationFrame(animate);
    };
    mouthAnimationRef.current = window.requestAnimationFrame(animate);

    return () => {
      closed = true;
      if (mouthAnimationRef.current !== null) {
        window.cancelAnimationFrame(mouthAnimationRef.current);
        mouthAnimationRef.current = null;
      }
      setMouth.call(coreModel, 'ParamMouthOpenY', 0, 1);
    };
  }, [speaking, status]);

  return (
    <div
      ref={hostRef}
      className="live2d-host"
      aria-label={status === 'ready' ? 'Live2D 数字人' : 'Live2D 数字人加载中'}
    />
  );
}
