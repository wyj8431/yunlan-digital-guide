import {
  ArrowLeft,
  ArrowRight,
  AudioLines,
  Bot,
  ExternalLink,
  Expand,
  Gauge,
  Map,
  RotateCcw,
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

type ExhibitionPageProps = { onReturnHome: () => void; onOpenGuide?: () => void };
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
    title: '乌镇路线数字沙盘',
    description: '以三维场景呈现乌镇水巷、石桥和东栅西栅之间的游览关系。',
    sandTable: true
  },
  'silk-and-tea': {
    title: '乌镇茶礼与水乡生活',
    description: '从一盏茶看乌镇水乡的待客方式、日常节奏与江南手艺。'
  },
  'silk-garment': {
    title: '水乡丝绸服饰',
    description: '轻薄织物与克制纹样记录了乌镇水乡延续至今的生活审美。'
  },
  'west-lake-bicycle': {
    title: '乌镇水乡慢游自行车',
    description: '沿着水巷、桥埠和临水街巷慢速游览，感受乌镇的生活尺度。'
  },
  'green-mobility-car': {
    title: '乌镇景区接驳车',
    description: '接驳系统把入口、东栅、西栅和重点场馆连成便于换乘的游线。'
  },
  'entrance-hologram': {
    title: '乌镇入口全息大屏',
    description: '从乌镇水乡全景、东栅生活到西栅夜游，入口屏把整座展厅的游览路径串联起来。'
  },
  'wuzhen-streets': {
    title: '乌镇街巷复刻空间',
    description: '沿着水巷、石桥和临水民居，了解乌镇街巷与水路共同形成的生活尺度。'
  },
  'xizha-night-tour-panel': {
    title: '西栅夜游与场馆',
    description: '夜色中的水巷、摇橹船、戏台与文化场馆共同构成西栅的夜游体验。'
  },
  'culture-folk': {
    title: '木心与水乡非遗',
    description: '木心美术馆、蓝印花布、杭扇、定胜糕和水乡婚俗在这里并置呈现。'
  }
};

const SHOWROOM_ZONES = [
  { id: 'entrance', name: '乌镇入口前厅' },
  { id: 'wuzhen', name: '乌镇全景总览' },
  { id: 'global', name: '东栅生活街区' },
  { id: 'interactive', name: '西栅夜游与场馆' },
  { id: 'supporting', name: '水巷餐饮与文创' },
  { id: 'culture', name: '木心与非遗文化' }
] as const;

const ZONE_GUIDES: Record<
  string,
  { eyebrow: string; title: string; description: string; cue: string; duration: string }
> = {
  entrance: {
    eyebrow: '序章 · 入口前厅',
    title: '先看水路，再看街巷',
    description: '从乌篷船、临水民居和码头开始，建立乌镇的第一印象。',
    cue: '留意船、桥与房屋的尺度关系',
    duration: '建议停留 2 分钟'
  },
  wuzhen: {
    eyebrow: '第一站 · 全景总览',
    title: '一座被河网塑造的城镇',
    description: '把河道、桥梁、街屋与日常动线放在同一张空间地图里。',
    cue: '先看航拍，再找影像里的水巷转角',
    duration: '建议停留 3 分钟'
  },
  global: {
    eyebrow: '第二站 · 东栅生活',
    title: '前店后宅，生活就在街边',
    description: '东栅的魅力来自作坊、茶席、染织与临河店屋共同组成的日常。',
    cue: '观察蓝印花布与街屋的开窗方式',
    duration: '建议停留 4 分钟'
  },
  interactive: {
    eyebrow: '第三站 · 西栅夜游',
    title: '让灯影带你进入夜乌镇',
    description: '夜色、桥巷、演艺场馆和临水建筑共同构成西栅的夜游节奏。',
    cue: '从夜景影像移步到场馆模型',
    duration: '建议停留 4 分钟'
  },
  supporting: {
    eyebrow: '第四站 · 水巷文创',
    title: '把水乡带回日常',
    description: '文创、手作、店屋和夜航一起，呈现水巷从白天到夜晚的生活场景。',
    cue: '先看货架，再看织造与手作细节',
    duration: '建议停留 3 分钟'
  },
  culture: {
    eyebrow: '终章 · 木心与非遗',
    title: '在手艺与文字之间收束旅程',
    description: '蓝印花布、木心美学与河埠空间在这里汇合，留下乌镇的文化记忆。',
    cue: '从大幅影像走向织造展架与河埠',
    duration: '建议停留 4 分钟'
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

export function ExhibitionPage({ onReturnHome, onOpenGuide }: ExhibitionPageProps) {
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
  const [activeZoneId, setActiveZoneId] = useState('entrance');
  const [zoneNavOpen, setZoneNavOpen] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const qualityRef = useRef<QualityLevel>('high');
  const qualityOverrideRef = useRef<QualityLevel | null>(null);
  const mutedRef = useRef(false);
  const audioUnlockedRef = useRef(false);
  const focusedExhibitRef = useRef<string | null>(null);
  const activeZoneGuide = ZONE_GUIDES[activeZoneId] ?? ZONE_GUIDES.entrance;
  const activeZoneIndex = Math.max(
    SHOWROOM_ZONES.findIndex((zone) => zone.id === activeZoneId),
    0
  );
  const selected = selectedId
    ? (EXHIBITS[selectedId] ?? {
        title: activeZoneGuide.title,
        description: `${activeZoneGuide.description} ${activeZoneGuide.cue}。`
      })
    : undefined;

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
        setNotice(
          scene === 'lake' ? '乌镇实景加载失败，已返回展馆' : '展馆加载失败，已返回乌镇实景'
        );
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
      onZoneChange: setActiveZoneId,
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

  useEffect(() => {
    const syncFullscreenState = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', syncFullscreenState);
    return () => document.removeEventListener('fullscreenchange', syncFullscreenState);
  }, []);

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

  function goToZone(zoneId: string) {
    const renderer = rendererRef.current;
    if (!(renderer instanceof ExhibitionRenderer) || scene !== 'hall') return;
    setSelectedId(null);
    setPageState('hall');
    setActiveZoneId(zoneId);
    renderer.goToZone(zoneId);
  }

  function resetView() {
    const renderer = rendererRef.current;
    if (!(renderer instanceof ExhibitionRenderer) || scene !== 'hall') return;
    renderer.goToZone(activeZoneId);
  }

  function goToNextZone() {
    const nextZone = SHOWROOM_ZONES[(activeZoneIndex + 1) % SHOWROOM_ZONES.length];
    goToZone(nextZone.id);
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      const page = hostRef.current?.closest('.exhibition-page');
      if (page?.requestFullscreen) await page.requestFullscreen();
    } catch {
      setNotice('当前浏览器不支持全屏显示');
    }
  }

  const percent = progressPercent(progress);
  const transitioning = pageState === 'transitioning';

  return (
    <main className="exhibition-page" data-page-state={pageState}>
      <div
        ref={hostRef}
        className="exhibition-canvas-host"
        aria-label={scene === 'hall' ? '乌镇室内 3D 展馆' : '乌镇 3D 实景'}
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
          aria-label={transition.target === 'lake' ? '正在进入乌镇实景' : '正在返回展馆'}
          role="status"
        />
      )}

      <header className="exhibition-topbar">
        <button type="button" onClick={onReturnHome} aria-label="返回首页" title="返回首页">
          <ArrowLeft aria-hidden="true" />
        </button>
        <div className="exhibition-heading">
          <span>{scene === 'hall' ? '乌镇文旅数字展馆' : '乌镇数字实景'}</span>
          <h1>{scene === 'hall' ? '3D 展馆' : '水乡全景'}</h1>
        </div>
        <button
          className="exhibition-service"
          type="button"
          onClick={onOpenGuide ?? onReturnHome}
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

      {scene === 'hall' && pageState !== 'render-error' && zoneNavOpen && (
        <nav className="exhibition-zone-nav" aria-label="展厅分区导航">
          <span>展厅分区</span>
          <div>
            {SHOWROOM_ZONES.map((zone) => (
              <button
                key={zone.id}
                type="button"
                data-active={activeZoneId === zone.id ? 'true' : 'false'}
                onClick={() => goToZone(zone.id)}
                disabled={transitioning || pageState === 'loading'}
              >
                {zone.name}
              </button>
            ))}
          </div>
        </nav>
      )}

      {scene === 'hall' && sceneReady && pageState === 'hall' && (
        <aside className="exhibition-zone-guide" aria-live="polite">
          <div className="exhibition-zone-guide-topline">
            <span>{activeZoneGuide.eyebrow}</span>
            <strong>
              {String(activeZoneIndex + 1).padStart(2, '0')} /{' '}
              {String(SHOWROOM_ZONES.length).padStart(2, '0')}
            </strong>
          </div>
          <h2>{activeZoneGuide.title}</h2>
          <p>{activeZoneGuide.description}</p>
          <div className="exhibition-zone-guide-cue">
            <span>观展线索</span>
            <strong>{activeZoneGuide.cue}</strong>
          </div>
          <div className="exhibition-zone-guide-footer">
            <span>{activeZoneGuide.duration}</span>
            <button type="button" onClick={goToNextZone} disabled={transitioning}>
              下一展厅
              <ArrowRight aria-hidden="true" />
            </button>
          </div>
        </aside>
      )}

      <nav className="exhibition-action-dock" aria-label="展厅快捷操作">
        <button
          type="button"
          onClick={onOpenGuide ?? onReturnHome}
          aria-label="打开数字人客服"
          title="打开数字人客服"
        >
          <Bot aria-hidden="true" />
        </button>
        {scene === 'hall' && (
          <button
            type="button"
            onClick={() => setZoneNavOpen((open) => !open)}
            aria-label={zoneNavOpen ? '隐藏展厅分区' : '显示展厅分区'}
            title={zoneNavOpen ? '隐藏展厅分区' : '显示展厅分区'}
            aria-pressed={zoneNavOpen}
          >
            <Map aria-hidden="true" />
          </button>
        )}
        {scene === 'hall' && (
          <button
            type="button"
            onClick={resetView}
            aria-label="复位当前视角"
            title="复位当前视角"
            disabled={!sceneReady || transitioning}
          >
            <RotateCcw aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          onClick={() => void toggleFullscreen()}
          aria-label={isFullscreen ? '退出全屏' : '进入全屏'}
          title={isFullscreen ? '退出全屏' : '进入全屏'}
        >
          <Expand aria-hidden="true" />
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
                进入乌镇沙盘
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
