import {
  ArrowLeft,
  AudioLines,
  Bot,
  ExternalLink,
  Gauge,
  Map,
  Volume2,
  VolumeX,
  X
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AssetProgress } from '../exhibition/assets/ExhibitionAssetLoader';
import { createExhibitionAudio, type ExhibitionAudio } from '../exhibition/audio/ExhibitionAudio';
import { ExhibitionRenderer } from '../exhibition/ExhibitionRenderer';
import type { QualityLevel } from '../exhibition/quality/qualityProfile';
import { WestLakeScene } from '../exhibition/westLakeScene';

type ExhibitionPageProps = { onReturnHome: () => void };
type SceneMode = 'hall' | 'lake';
type PageState = 'loading' | 'hall' | 'detail-open' | 'transitioning' | 'lake' | 'render-error';
type TransitionPhase = 'fade-out' | 'switch' | 'fade-in';
type ActiveRenderer = ExhibitionRenderer | WestLakeScene;

type TransitionState = {
  from: SceneMode;
  target: SceneMode;
  phase: TransitionPhase;
};

const EMPTY_PROGRESS: AssetProgress = {
  loadedBytes: 0,
  totalBytes: null,
  completed: 0,
  total: 1
};

const EXHIBITS: Record<string, { title: string; description: string; sandTable?: boolean }> = {
  'west-lake-map': {
    title: '西湖数字沙盘',
    description: '以三维场景呈现湖岸、苏堤和雷峰塔的空间关系。',
    sandTable: true
  },
  'silk-and-tea': {
    title: '丝茶文化',
    description: '杭州丝绸与西湖龙井共同记录了江南生活的手艺与滋味。'
  },
  'silk-garment': {
    title: '杭罗丝绸服饰',
    description: '轻薄的杭罗织物体现了江南织造的细密工艺与含蓄审美。'
  },
  'west-lake-bicycle': {
    title: '西湖绿道自行车',
    description: '绿色出行连接湖滨、北山街与杨公堤，适合慢速游览。'
  },
  'green-mobility-car': {
    title: '绿色接驳车',
    description: '景区接驳系统将公交、步行和骑行节点连成低碳游线。'
  }
};

const QUALITY_LABELS: Record<QualityLevel, string> = {
  high: '高',
  medium: '中',
  low: '低'
};

function nextQuality(quality: QualityLevel): QualityLevel {
  if (quality === 'high') return 'medium';
  if (quality === 'medium') return 'low';
  return 'high';
}

function progressPercent(progress: AssetProgress): number {
  if (progress.totalBytes && progress.totalBytes > 0) {
    return Math.round((progress.loadedBytes / progress.totalBytes) * 100);
  }
  return Math.round((progress.completed / Math.max(progress.total, 1)) * 100);
}

export function ExhibitionPage({ onReturnHome }: ExhibitionPageProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<ActiveRenderer | null>(null);
  const audioRuntimeRef = useRef<ExhibitionAudio | null>(null);
  const transitionRef = useRef<TransitionState | null>(null);
  const transitionTimerRef = useRef<number | null>(null);
  const transitionProgressTimerRef = useRef<number | null>(null);
  const [scene, setScene] = useState<SceneMode>('hall');
  const [pageState, setPageState] = useState<PageState>('loading');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [progress, setProgress] = useState<AssetProgress>(EMPTY_PROGRESS);
  const [quality, setQuality] = useState<QualityLevel>('high');
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [muted, setMuted] = useState(false);
  const [transition, setTransition] = useState<TransitionState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const qualityRef = useRef<QualityLevel>('high');
  const qualityOverrideRef = useRef<QualityLevel | null>(null);
  const mutedRef = useRef(false);
  const audioUnlockedRef = useRef(false);
  const focusedExhibitRef = useRef<string | null>(null);
  const selected = selectedId ? EXHIBITS[selectedId] : undefined;

  const clearTransitionTimer = useCallback(() => {
    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
    if (transitionProgressTimerRef.current !== null) {
      window.clearInterval(transitionProgressTimerRef.current);
      transitionProgressTimerRef.current = null;
    }
  }, []);

  const transitionDuration = useCallback(() => {
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return reduced ? 100 : 550;
  }, []);

  const animateTransitionProgress = useCallback((from: number, to: number, duration: number) => {
    if (transitionProgressTimerRef.current !== null) {
      window.clearInterval(transitionProgressTimerRef.current);
    }
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.setTransitionProgress(from);
    if (duration <= 100) {
      renderer.setTransitionProgress(to);
      transitionProgressTimerRef.current = null;
      return;
    }
    const startedAt = performance.now();
    transitionProgressTimerRef.current = window.setInterval(() => {
      const amount = Math.min((performance.now() - startedAt) / duration, 1);
      renderer.setTransitionProgress(from + (to - from) * amount);
      if (amount >= 1 && transitionProgressTimerRef.current !== null) {
        window.clearInterval(transitionProgressTimerRef.current);
        transitionProgressTimerRef.current = null;
      }
    }, 16);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    setSceneReady(false);
    setProgress(EMPTY_PROGRESS);
    const handleReady = () => {
      setSceneReady(true);
      const pending = transitionRef.current;
      if (pending?.target === scene) {
        const duration = transitionDuration();
        clearTransitionTimer();
        animateTransitionProgress(1, 0, duration);
        const fadingIn = { ...pending, phase: 'fade-in' as const };
        transitionRef.current = fadingIn;
        setTransition(fadingIn);
        setPageState('transitioning');
        transitionTimerRef.current = window.setTimeout(() => {
          rendererRef.current?.setTransitionProgress(0);
          clearTransitionTimer();
          transitionRef.current = null;
          setTransition(null);
          setPageState(scene);
          rendererRef.current?.setInteractionEnabled(true);
        }, duration);
        return;
      }
      setPageState(scene);
    };
    const handleFatalError = () => {
      const pending = transitionRef.current;
      if (pending?.target === scene) {
        clearTransitionTimer();
        transitionRef.current = null;
        setTransition(null);
        setNotice(scene === 'lake' ? '西湖场景加载失败，已返回展馆' : '展馆加载失败，已返回西湖');
        setScene(pending.from);
        setPageState(pending.from);
        return;
      }
      setNotice('3D 场景暂时无法加载，请检查浏览器图形加速设置。');
      setPageState('render-error');
    };
    const callbacks = {
      host,
      onProgress: setProgress,
      onReady: handleReady,
      onQualityChange: (nextQuality: QualityLevel) => {
        qualityRef.current = nextQuality;
        setQuality(nextQuality);
      },
      onRecoverableFailure: (assetId: string) =>
        setNotice(`部分展馆资源加载失败，已使用简化内容（${assetId}）。`),
      onFatalError: handleFatalError
    };

    try {
      const audio = audioRuntimeRef.current ?? createExhibitionAudio();
      audioRuntimeRef.current = audio;
      const renderer =
        scene === 'hall'
          ? new ExhibitionRenderer({ ...callbacks, audio, onExhibitSelect: setSelectedId })
          : new WestLakeScene({ ...callbacks, audio });
      rendererRef.current = renderer;
      renderer.setMuted(mutedRef.current);
      if (qualityOverrideRef.current) renderer.setQuality(qualityOverrideRef.current);
      if (audioUnlockedRef.current) void renderer.unlockAudio();
      return () => {
        if (rendererRef.current === renderer) rendererRef.current = null;
        renderer.dispose();
      };
    } catch {
      handleFatalError();
      return undefined;
    }
  }, [animateTransitionProgress, clearTransitionTimer, scene, transitionDuration]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!(renderer instanceof ExhibitionRenderer) || scene !== 'hall') return;
    renderer.setInteractionEnabled(pageState === 'hall');
    if (focusedExhibitRef.current !== selectedId) {
      renderer.setFocus(selectedId);
      if (focusedExhibitRef.current && !selectedId) renderer.stopNarration();
      focusedExhibitRef.current = selectedId;
    }
  }, [pageState, scene, selectedId]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && pageState === 'detail-open') {
        setSelectedId(null);
        setPageState('hall');
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [pageState]);

  useEffect(
    () => () => {
      clearTransitionTimer();
      audioRuntimeRef.current?.dispose();
      audioRuntimeRef.current = null;
    },
    [clearTransitionTimer]
  );

  useEffect(() => {
    if (selectedId && scene === 'hall' && pageState !== 'transitioning') {
      setPageState('detail-open');
    }
  }, [pageState, scene, selectedId]);

  function beginTransition(target: SceneMode) {
    if (transitionRef.current || target === scene) return;
    const pending: TransitionState = { from: scene, target, phase: 'fade-out' };
    transitionRef.current = pending;
    setTransition(pending);
    setPageState('transitioning');
    setSelectedId(null);
    setNotice(null);
    rendererRef.current?.setInteractionEnabled(false);
    const duration = transitionDuration();
    clearTransitionTimer();
    animateTransitionProgress(0, 1, duration);
    transitionTimerRef.current = window.setTimeout(() => {
      rendererRef.current?.setTransitionProgress(1);
      clearTransitionTimer();
      const switching = { ...pending, phase: 'switch' as const };
      transitionRef.current = switching;
      setTransition(switching);
      setSceneReady(false);
      setScene(target);
    }, duration);
  }

  async function enableAudio() {
    try {
      await rendererRef.current?.unlockAudio();
      audioUnlockedRef.current = true;
      mutedRef.current = false;
      setAudioUnlocked(true);
      setMuted(false);
    } catch {
      setNotice('浏览器未能开启环境声音。');
    }
  }

  function toggleMuted() {
    const nextMuted = !muted;
    mutedRef.current = nextMuted;
    setMuted(nextMuted);
    rendererRef.current?.setMuted(nextMuted);
  }

  function changeQuality() {
    const next = nextQuality(quality);
    qualityRef.current = next;
    qualityOverrideRef.current = next;
    setQuality(next);
    rendererRef.current?.setQuality(next);
  }

  function closeDetail() {
    setSelectedId(null);
    setPageState('hall');
  }

  const percent = progressPercent(progress);
  const transitioning = pageState === 'transitioning';

  return (
    <main className="exhibition-page" data-page-state={pageState}>
      <div
        ref={hostRef}
        className="exhibition-canvas-host"
        aria-label={scene === 'hall' ? '西湖室内 3D 展馆' : '西湖 3D 实景'}
        data-exhibition-ready={sceneReady ? 'true' : 'false'}
      />

      {pageState === 'loading' && (
        <section className="exhibition-loading" aria-live="polite">
          <span>正在布展</span>
          <progress
            aria-label="展馆资源加载进度"
            aria-valuenow={percent}
            max={100}
            value={percent}
          />
          <strong>{percent}%</strong>
        </section>
      )}

      {notice && (
        <p className="exhibition-notice" role="alert">
          {notice}
        </p>
      )}

      {transition && (
        <div
          className="exhibition-transition"
          data-testid="scene-transition"
          data-phase={transition.phase}
          aria-label={transition.target === 'lake' ? '正在进入西湖' : '正在返回展馆'}
          role="status"
        />
      )}

      <header className="exhibition-topbar">
        <button type="button" onClick={onReturnHome} aria-label="返回首页" title="返回首页">
          <ArrowLeft aria-hidden="true" />
        </button>
        <div className="exhibition-heading">
          <span>{scene === 'hall' ? '西湖文旅数字展馆' : '西湖数字实景'}</span>
          <h1>{scene === 'hall' ? '3D 展馆' : '湖山全景'}</h1>
        </div>
        <button
          className="exhibition-service"
          type="button"
          onClick={onReturnHome}
          aria-label="数字人客服"
          title="数字人客服"
        >
          <Bot aria-hidden="true" />
          <span>数字人客服</span>
        </button>
      </header>

      <nav className="exhibition-toolbar" aria-label="展馆控制">
        <button
          type="button"
          onClick={audioUnlocked ? toggleMuted : enableAudio}
          aria-label={audioUnlocked ? (muted ? '恢复环境声音' : '静音环境声音') : '开启环境声音'}
          title={audioUnlocked ? (muted ? '恢复环境声音' : '静音环境声音') : '开启环境声音'}
          disabled={pageState === 'render-error'}
        >
          {muted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
        </button>
        <button
          type="button"
          onClick={changeQuality}
          aria-label={`画质：${QUALITY_LABELS[quality]}`}
          title={`画质：${QUALITY_LABELS[quality]}`}
          disabled={pageState === 'render-error'}
        >
          <Gauge aria-hidden="true" />
          <span>{QUALITY_LABELS[quality]}</span>
        </button>
      </nav>

      {scene === 'lake' && pageState !== 'render-error' && (
        <button
          className="exhibition-return-hall"
          type="button"
          onClick={() => beginTransition('hall')}
          disabled={transitioning}
          aria-label="返回展馆"
          title="返回展馆"
        >
          <ArrowLeft aria-hidden="true" />
          <span>返回展馆</span>
        </button>
      )}

      {selected && pageState === 'detail-open' && (
        <aside className="exhibit-dialog" role="dialog" aria-labelledby="exhibit-dialog-title">
          <button
            className="exhibit-dialog-close"
            type="button"
            aria-label="关闭展品介绍"
            title="关闭展品介绍"
            onClick={closeDetail}
          >
            <X aria-hidden="true" />
          </button>
          <span>展品导览</span>
          <h2 id="exhibit-dialog-title">{selected.title}</h2>
          <p>{selected.description}</p>
          <div className="exhibit-dialog-actions">
            <button
              type="button"
              onClick={() => {
                const renderer = rendererRef.current;
                if (selectedId && renderer instanceof ExhibitionRenderer) {
                  renderer.playNarration(selectedId);
                }
              }}
              aria-label="播放语音讲解"
              title="播放语音讲解"
            >
              <AudioLines aria-hidden="true" />
              <span>语音讲解</span>
            </button>
            {selected.sandTable && (
              <button
                type="button"
                onClick={() => beginTransition('lake')}
                disabled={transitioning}
              >
                <Map aria-hidden="true" />
                进入西湖沙盘
              </button>
            )}
            <a href="/videos">
              视频中心
              <ExternalLink aria-hidden="true" />
            </a>
          </div>
        </aside>
      )}
    </main>
  );
}
