import {
  ArrowLeft,
  ArrowRight,
  AudioLines,
  Bot,
  CloudRain,
  CloudSun,
  Compass,
  ExternalLink,
  Expand,
  Gamepad2,
  HelpCircle,
  Info,
  MapPinned,
  Move,
  Navigation,
  Pause,
  Play,
  Map,
  RotateCcw,
  Route,
  Sparkles,
  UtensilsCrossed,
  Volume2,
  VolumeX,
  X
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from 'react';
import type { AssetProgress } from '../exhibition/assets/ExhibitionAssetLoader';
import { createExhibitionAudio, type ExhibitionAudio } from '../exhibition/audio/ExhibitionAudio';
import {
  ExhibitionRenderer,
  type ExhibitionModelInteraction
} from '../exhibition/ExhibitionRenderer';
import type { QualityLevel } from '../exhibition/quality/qualityProfile';
import {
  SCENIC_MAP_STOPS,
  VISITOR_HOURS,
  VISITOR_INFO_NOTE,
  VISITOR_ROUTES,
  VISITOR_SERVICES,
  type ExhibitionWeatherMode,
  type VisitorPanelTab
} from '../exhibition/visitorGuide';
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
  'entrance-wupeng-boat': {
    title: '入口乌篷船模型',
    description: '从船身、码头到水面尺度，认识乌镇最具代表性的水上交通。'
  },
  'wuzhen-boat': {
    title: '乌镇水巷乌篷船',
    description: '乌篷船连接河道与街巷，也把乌镇的日常生活带到水面上。'
  },
  'waterway-night-boat': {
    title: '水乡夜游船',
    description: '灯影与船行共同构成西栅夜游的节奏，展示水乡从白天进入夜晚的变化。'
  },
  'dongzha-weaving-rack': {
    title: '东栅织造架',
    description: '从经纬交错的织造架，观察江南手工艺如何融入水乡生活。'
  },
  'waterway-loom': {
    title: '水巷织机模型',
    description: '织机记录传统工艺的工作节奏，也呈现水乡家庭作坊的生活场景。'
  },
  'culture-weaving-rack': {
    title: '非遗织造展架',
    description: '在经线与纬线之间，理解乌镇手艺如何被保存、传承并继续使用。'
  },
  'dongzha-tea-house': {
    title: '东栅临水茶席',
    description: '临水茶席把待客、休息和街巷生活放在同一个日常场景里。'
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
  'entrance-lanterns': {
    title: '入口水巷灯笼',
    description: '灯笼沿着入口水路布置，提示游客从白天的水乡生活进入展厅旅程。'
  },
  'wuzhen-artifact-pedestal': {
    title: '乌镇水乡器物展台',
    description: '展台上的日用器物，记录水乡居民与河道、街巷共同形成的生活方式。'
  },
  'xizha-venue-pavilion': {
    title: '西栅场馆模型',
    description: '场馆模型把戏台、展馆与夜游动线放在同一处，方便观察空间关系。'
  },
  'waterway-craft-stall': {
    title: '水巷手作摊位',
    description: '手作摊位展示茶礼、织物和日常小物如何从水乡技艺进入游客生活。'
  },
  'culture-ink-pedestal': {
    title: '非遗墨彩堂展台',
    description: '蓝印花布与木心美学在展台汇合，呈现乌镇文化记忆的不同层次。'
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

const MOBILE_ZONE_LABELS: Record<(typeof SHOWROOM_ZONES)[number]['id'], string> = {
  entrance: '入口',
  wuzhen: '全景',
  global: '东栅',
  interactive: '夜游',
  supporting: '餐饮',
  culture: '文化'
};

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

const WEATHER_LABELS: Record<ExhibitionWeatherMode, string> = {
  sunny: '晴天',
  night: '夜游',
  rain: '雨景'
};

const EXPLORATION_STOPS = [
  {
    exhibitId: 'west-lake-map',
    zoneId: 'entrance',
    title: '水乡路线数字沙盘',
    clue: '从河道与桥梁之间，找出乌镇的游览动线。'
  },
  {
    exhibitId: 'silk-and-tea',
    zoneId: 'global',
    title: '茶礼与水乡生活',
    clue: '留意一盏茶如何连接待客方式与日常节奏。'
  },
  {
    exhibitId: 'west-lake-bicycle',
    zoneId: 'global',
    title: '水乡慢游自行车',
    clue: '看看慢游交通怎样适应临水街巷的尺度。'
  },
  {
    exhibitId: 'entrance-wupeng-boat',
    zoneId: 'entrance',
    title: '入口乌篷船模型',
    clue: '观察船身与码头的尺度，理解乌镇水路如何进入日常生活。'
  },
  {
    exhibitId: 'waterway-loom',
    zoneId: 'supporting',
    title: '水巷织机模型',
    clue: '找出经线与纬线交错的位置，感受传统织造的工作节奏。'
  },
  {
    exhibitId: 'entrance-lanterns',
    zoneId: 'entrance',
    title: '入口水巷灯笼',
    clue: '从灯笼的排列方向，寻找入口水路通向展厅深处的线索。'
  }
] as const;

const EXHIBITION_QUIZ = {
  question: '乌镇空间中最先串联游览路线的要素是什么？',
  choices: [
    { id: 'waterways', label: '水系' },
    { id: 'highways', label: '高速路' },
    { id: 'mountains', label: '山脉' }
  ],
  correctId: 'waterways'
} as const;

const MODEL_INTERACTION_PROFILES: Record<string, { animationLabel: string; hint: string }> = {
  'silk-and-tea': {
    animationLabel: '茶席动态展示',
    hint: '观察茶席以细微起伏呈现水乡待客的从容节奏。'
  },
  'silk-garment': {
    animationLabel: '丝绸展示',
    hint: '观察织物模型的轻微律动，感受江南纺织的轻盈质感。'
  },
  'west-lake-bicycle': {
    animationLabel: '慢游演示',
    hint: '自行车会沿展台做短距离往复，模拟水乡巷道中的慢游。'
  },
  'green-mobility-car': {
    animationLabel: '接驳演示',
    hint: '接驳车会以短距离往复展示景区低碳出行的节奏。'
  },
  'entrance-wupeng-boat': {
    animationLabel: '水路演示',
    hint: '乌篷船会轻微前后摆动，展示水乡船只穿行河道时的节奏。'
  },
  'wuzhen-boat': {
    animationLabel: '河道演示',
    hint: '观察乌篷船模型的摆动，理解河道、码头与街巷之间的连接。'
  },
  'waterway-night-boat': {
    animationLabel: '夜航演示',
    hint: '夜游船会沿展台轻轻往复，模拟从餐饮街区驶向西栅的夜航。'
  },
  'dongzha-weaving-rack': {
    animationLabel: '织造演示',
    hint: '织造架会做细微律动，突出经纬交错的手工节奏。'
  },
  'waterway-loom': {
    animationLabel: '织机演示',
    hint: '观察织机模型的轻微起伏，感受传统织造从经线到纬线的过程。'
  },
  'culture-weaving-rack': {
    animationLabel: '非遗织造',
    hint: '非遗织架会缓慢律动，展示手艺在日常生活中的延续。'
  },
  'entrance-hologram': {
    animationLabel: '全景演示',
    hint: '入口全息屏会轻微呼吸律动，串联展厅各个区域的游览线索。'
  },
  'dongzha-tea-house': {
    animationLabel: '茶席演示',
    hint: '东栅茶席会以轻微起伏呈现临水待客的日常节奏。'
  },
  'xizha-night-tour-panel': {
    animationLabel: '夜游演示',
    hint: '夜游展板会缓慢律动，突出灯影、水巷与场馆共同形成的夜间体验。'
  },
  'entrance-lanterns': {
    animationLabel: '灯影演示',
    hint: '灯笼会做轻微律动，模拟水面反光和夜色中的行进节奏。'
  },
  'wuzhen-artifact-pedestal': {
    animationLabel: '器物演示',
    hint: '器物展台会缓慢起伏，引导观察日用器物的轮廓与细节。'
  },
  'xizha-venue-pavilion': {
    animationLabel: '场馆演示',
    hint: '场馆模型会轻微律动，帮助理解夜游路线中的空间节点。'
  },
  'waterway-craft-stall': {
    animationLabel: '手作演示',
    hint: '手作摊位会以细微律动展示水乡手艺从制作到售卖的生活场景。'
  },
  'culture-ink-pedestal': {
    animationLabel: '非遗演示',
    hint: '非遗展台会缓慢律动，突出蓝印花布与木心美学的工艺细节。'
  }
};

const MODEL_INTERACTION_IDS = Object.keys(MODEL_INTERACTION_PROFILES);

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
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [muted, setMuted] = useState(false);
  const [transition, setTransition] = useState<TransitionState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [activeZoneId, setActiveZoneId] = useState('entrance');
  const [zoneNavOpen, setZoneNavOpen] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [visitorPanelOpen, setVisitorPanelOpen] = useState(false);
  const [visitorPanelTab, setVisitorPanelTab] = useState<VisitorPanelTab>('map');
  const [weatherMenuOpen, setWeatherMenuOpen] = useState(false);
  const [weather, setWeather] = useState<ExhibitionWeatherMode>('sunny');
  const [freeRoam, setFreeRoam] = useState(true);
  const [mobileMove, setMobileMove] = useState({ x: 0, y: 0 });
  const [selectedMapStopId, setSelectedMapStopId] = useState(SCENIC_MAP_STOPS[0].id);
  const [interactionOpen, setInteractionOpen] = useState(false);
  const [discoveredExhibitIds, setDiscoveredExhibitIds] = useState<string[]>([]);
  const [quizAnswer, setQuizAnswer] = useState<string | null>(null);
  const [activeModelInteraction, setActiveModelInteraction] =
    useState<ExhibitionModelInteraction | null>(null);
  const [modelRotation, setModelRotation] = useState(0);
  const [modelTourActive, setModelTourActive] = useState(false);
  const [rendererRetryKey, setRendererRetryKey] = useState(0);
  // Keep the visitor-facing exhibition at native high quality.
  // This prevents the renderer's background performance sampler from reducing post-process scale.
  const qualityOverrideRef = useRef<QualityLevel>('high');
  const weatherRef = useRef<ExhibitionWeatherMode>('sunny');
  const freeRoamRef = useRef(true);
  const mobileMoveRef = useRef({ x: 0, y: 0 });
  const mobileMoveFrameRef = useRef<number | null>(null);
  const mobileFrameTimestampRef = useRef<number | null>(null);
  const mobileLookRef = useRef<{ x: number; y: number } | null>(null);
  const modelTourTimerRef = useRef<number | null>(null);
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
  const discoveryCount = EXPLORATION_STOPS.filter((stop) =>
    discoveredExhibitIds.includes(stop.exhibitId)
  ).length;
  const quizComplete = quizAnswer === EXHIBITION_QUIZ.correctId;
  const selectedModelProfile = selectedId ? MODEL_INTERACTION_PROFILES[selectedId] : undefined;

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

  const driveMobileMovement = useCallback((timestamp: number) => {
    const previousTimestamp = mobileFrameTimestampRef.current;
    const deltaSeconds = previousTimestamp
      ? Math.min(Math.max((timestamp - previousTimestamp) / 1000, 0.008), 0.08)
      : 0.016;
    mobileFrameTimestampRef.current = timestamp;
    const input = mobileMoveRef.current;
    if (Math.hypot(input.x, input.y) > 0.01 && freeRoamRef.current) {
      rendererRef.current?.moveByInput(input.x, -input.y, deltaSeconds);
      mobileMoveFrameRef.current = window.requestAnimationFrame(driveMobileMovement);
    } else {
      mobileMoveFrameRef.current = null;
      mobileFrameTimestampRef.current = null;
    }
  }, []);

  const startMobileMovement = useCallback(() => {
    if (mobileMoveFrameRef.current === null) {
      mobileFrameTimestampRef.current = null;
      mobileMoveFrameRef.current = window.requestAnimationFrame(driveMobileMovement);
    }
  }, [driveMobileMovement]);

  const stopMobileMovement = useCallback(() => {
    mobileMoveRef.current = { x: 0, y: 0 };
    setMobileMove({ x: 0, y: 0 });
    if (mobileMoveFrameRef.current !== null) {
      window.cancelAnimationFrame(mobileMoveFrameRef.current);
      mobileMoveFrameRef.current = null;
    }
    mobileFrameTimestampRef.current = null;
  }, []);

  const updateMobileMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!freeRoamRef.current) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      const radius = Math.max(bounds.width, bounds.height) * 0.36;
      const dx = event.clientX - (bounds.left + bounds.width / 2);
      const dy = event.clientY - (bounds.top + bounds.height / 2);
      const length = Math.hypot(dx, dy);
      const scale = length > radius ? radius / length : 1;
      const next = { x: (dx * scale) / radius, y: (dy * scale) / radius };
      mobileMoveRef.current = next;
      setMobileMove(next);
      startMobileMovement();
    },
    [startMobileMovement]
  );

  const handleMobileMoveStart = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!freeRoamRef.current) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      updateMobileMove(event);
    },
    [updateMobileMove]
  );

  const handleMobileLookStart = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!freeRoamRef.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    mobileLookRef.current = { x: event.clientX, y: event.clientY };
    void rendererRef.current?.unlockAudio();
  }, []);

  const handleMobileLookMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const last = mobileLookRef.current;
    if (!last || !freeRoamRef.current) return;
    rendererRef.current?.rotateByInput(event.clientX - last.x, event.clientY - last.y);
    mobileLookRef.current = { x: event.clientX, y: event.clientY };
  }, []);

  const handleMobilePointerEnd = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      stopMobileMovement();
      mobileLookRef.current = null;
    },
    [stopMobileMovement]
  );

  useEffect(
    () => () => {
      if (mobileMoveFrameRef.current !== null) {
        window.cancelAnimationFrame(mobileMoveFrameRef.current);
      }
    },
    []
  );

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
      // Every optional exhibit asset has an authored fallback. Keep those recovery details out of
      // the visitor-facing canvas so a transient model request never interrupts the tour.
      onRecoverableFailure: () => undefined,
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
      renderer.setFreeRoam(freeRoamRef.current);
      renderer.setWeather(weatherRef.current);
      renderer.setQuality(qualityOverrideRef.current);
      if (audioUnlockedRef.current) void renderer.unlockAudio();
      return () => {
        if (rendererRef.current === renderer) rendererRef.current = null;
        renderer.dispose();
      };
    } catch {
      handleFatalError();
      return undefined;
    }
  }, [
    animateTransitionProgress,
    clearTransitionTimer,
    rendererRetryKey,
    scene,
    transitionDuration
  ]);

  const navigateModel = useCallback(
    (offset: number) => {
      if (!selectedId) return;
      const currentIndex = MODEL_INTERACTION_IDS.indexOf(selectedId);
      if (currentIndex < 0) return;

      const nextIndex =
        (currentIndex + offset + MODEL_INTERACTION_IDS.length) % MODEL_INTERACTION_IDS.length;
      const nextId = MODEL_INTERACTION_IDS[nextIndex];
      const renderer = rendererRef.current;
      if (renderer instanceof ExhibitionRenderer) {
        renderer.stopModelInteraction();
        renderer.goToExhibit(nextId);
      }
      setActiveModelInteraction(null);
      setModelRotation(0);
      setSelectedId(nextId);
      setPageState('detail-open');
    },
    [selectedId]
  );

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!(renderer instanceof ExhibitionRenderer) || scene !== 'hall') return;
    renderer.setInteractionEnabled(pageState === 'hall');
    if (focusedExhibitRef.current !== selectedId) {
      renderer.setFocus(selectedId);
      renderer.stopModelInteraction();
      setActiveModelInteraction(null);
      setModelRotation(0);
      if (focusedExhibitRef.current && !selectedId) renderer.stopNarration();
      focusedExhibitRef.current = selectedId;
    }
  }, [pageState, scene, selectedId]);

  useEffect(() => {
    if (!modelTourActive || !selectedModelProfile || pageState !== 'detail-open') {
      return;
    }

    modelTourTimerRef.current = window.setInterval(() => {
      navigateModel(1);
    }, 5_000);

    return () => {
      if (modelTourTimerRef.current !== null) {
        window.clearInterval(modelTourTimerRef.current);
        modelTourTimerRef.current = null;
      }
    };
  }, [modelTourActive, navigateModel, pageState, selectedModelProfile, selectedId]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      if (helpOpen) {
        setHelpOpen(false);
      } else if (interactionOpen) {
        setInteractionOpen(false);
      } else if (visitorPanelOpen) {
        setVisitorPanelOpen(false);
      } else if (weatherMenuOpen) {
        setWeatherMenuOpen(false);
      } else if (pageState === 'detail-open') {
        closeDetail();
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [closeDetail, helpOpen, interactionOpen, pageState, visitorPanelOpen, weatherMenuOpen]);

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

  useEffect(() => {
    if (!selectedId || !EXPLORATION_STOPS.some((stop) => stop.exhibitId === selectedId)) {
      return;
    }

    setDiscoveredExhibitIds((current) =>
      current.includes(selectedId) ? current : [...current, selectedId]
    );
  }, [selectedId]);

  function beginTransition(target: SceneMode) {
    if (transitionRef.current || target === scene) return;
    const pending: TransitionState = { from: scene, target, phase: 'fade-out' };
    transitionRef.current = pending;
    setTransition(pending);
    setPageState('transitioning');
    setSelectedId(null);
    setVisitorPanelOpen(false);
    setHelpOpen(false);
    setInteractionOpen(false);
    setWeatherMenuOpen(false);
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

  function toggleFreeRoam() {
    const next = !freeRoam;
    freeRoamRef.current = next;
    setFreeRoam(next);
    rendererRef.current?.setFreeRoam(next);
    if (!next) stopMobileMovement();
  }

  function changeWeather(next: ExhibitionWeatherMode) {
    weatherRef.current = next;
    setWeather(next);
    setWeatherMenuOpen(false);
    rendererRef.current?.setWeather(next);
  }

  function openVisitorPanel(tab: VisitorPanelTab = 'map') {
    setVisitorPanelTab(tab);
    setVisitorPanelOpen(true);
    setHelpOpen(false);
    setWeatherMenuOpen(false);
    setSelectedId(null);
    setPageState('hall');
  }

  function openInteractionPanel() {
    setInteractionOpen(true);
    setHelpOpen(false);
    setVisitorPanelOpen(false);
    setWeatherMenuOpen(false);
    setSelectedId(null);
    setPageState('hall');
  }

  function closeVisitorPanel() {
    setVisitorPanelOpen(false);
  }

  function closeDetail() {
    const renderer = rendererRef.current;
    if (renderer instanceof ExhibitionRenderer) {
      renderer.stopModelInteraction();
    }
    setActiveModelInteraction(null);
    setSelectedId(null);
    setModelTourActive(false);
    setPageState('hall');
  }

  function startModelInteraction(mode: ExhibitionModelInteraction) {
    const renderer = rendererRef.current;
    if (!selectedId || !(renderer instanceof ExhibitionRenderer)) {
      return;
    }

    renderer.goToExhibit(selectedId);
    if (renderer.startModelInteraction(selectedId, mode)) {
      setActiveModelInteraction(mode);
    }
  }

  function resetModelInteraction() {
    const renderer = rendererRef.current;
    if (renderer instanceof ExhibitionRenderer) {
      if (selectedId) {
        renderer.resetModel(selectedId);
      } else {
        renderer.stopModelInteraction();
      }
    }
    setActiveModelInteraction(null);
    setModelRotation(0);
  }

  function rotateSelectedModel(degrees: number) {
    const renderer = rendererRef.current;
    if (!selectedId || !(renderer instanceof ExhibitionRenderer)) return;
    if (renderer.rotateModel(selectedId, degrees)) {
      setModelRotation(degrees);
      setActiveModelInteraction(null);
    }
  }

  function retryRenderer() {
    rendererRef.current?.dispose();
    rendererRef.current = null;
    setNotice(null);
    setSceneReady(false);
    setPageState('loading');
    setRendererRetryKey((key) => key + 1);
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

  function discoverExhibit(exhibitId: string, zoneId: string) {
    const renderer = rendererRef.current;
    if (renderer instanceof ExhibitionRenderer) {
      if (!renderer.goToExhibit(exhibitId)) {
        goToZone(zoneId);
      }
    }
    setInteractionOpen(false);
    setSelectedId(exhibitId);
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
    <main
      className="exhibition-page"
      data-page-state={pageState}
      data-detail-open={pageState === 'detail-open' ? 'true' : 'false'}
      data-visitor-panel-open={visitorPanelOpen ? 'true' : 'false'}
    >
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

      {pageState === 'render-error' && (
        <section className="exhibition-render-error" role="region" aria-label="展馆加载失败">
          <span>3D 场景暂时无法加载</span>
          <p>可以重新初始化展馆；如果问题持续，请开启浏览器硬件加速。</p>
          <button type="button" onClick={retryRenderer}>
            <RotateCcw aria-hidden="true" />
            重新加载展馆
          </button>
        </section>
      )}

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
          className="exhibition-weather-trigger"
          onClick={() => setWeatherMenuOpen((open) => !open)}
          aria-label={`场景氛围：${WEATHER_LABELS[weather]}`}
          title={`场景氛围：${WEATHER_LABELS[weather]}`}
          aria-expanded={weatherMenuOpen}
        >
          {weather === 'rain' ? <CloudRain aria-hidden="true" /> : <CloudSun aria-hidden="true" />}
        </button>
      </nav>

      {weatherMenuOpen && (
        <div className="exhibition-weather-menu" role="group" aria-label="场景氛围选择">
          <span>场景氛围</span>
          {(Object.keys(WEATHER_LABELS) as ExhibitionWeatherMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              data-active={weather === mode ? 'true' : 'false'}
              aria-pressed={weather === mode}
              onClick={() => changeWeather(mode)}
            >
              {mode === 'rain' ? <CloudRain aria-hidden="true" /> : <CloudSun aria-hidden="true" />}
              {WEATHER_LABELS[mode]}
            </button>
          ))}
          <small>这是展厅氛围演示，实况天气请以景区当天信息为准。</small>
        </div>
      )}

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
                aria-label={zone.name}
                title={zone.name}
              >
                <span className="exhibition-zone-nav-label">{zone.name}</span>
                <span className="exhibition-zone-nav-mobile-label">
                  {MOBILE_ZONE_LABELS[zone.id]}
                </span>
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
        <button
          type="button"
          onClick={() => openVisitorPanel('map')}
          aria-label="打开景区地图和服务"
          title="景区地图和服务"
          aria-pressed={visitorPanelOpen}
        >
          <MapPinned aria-hidden="true" />
        </button>
        {scene === 'hall' && (
          <button
            type="button"
            onClick={openInteractionPanel}
            aria-label="打开展厅探索互动"
            title="展厅探索互动"
            aria-pressed={interactionOpen}
            disabled={!sceneReady || transitioning}
          >
            <Gamepad2 aria-hidden="true" />
            {discoveryCount > 0 ? (
              <small aria-label={`已发现 ${discoveryCount} 件互动展品`}>{discoveryCount}</small>
            ) : null}
          </button>
        )}
        <button
          type="button"
          onClick={() => setHelpOpen((open) => !open)}
          aria-label="打开操作引导"
          title="操作引导"
          aria-pressed={helpOpen}
        >
          <HelpCircle aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={toggleFreeRoam}
          aria-label={freeRoam ? '关闭自由漫游' : '开启自由漫游'}
          title={freeRoam ? '自由漫游：已开启' : '自由漫游：已关闭'}
          aria-pressed={freeRoam}
        >
          <Compass aria-hidden="true" />
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

      {helpOpen && (
        <aside className="exhibition-control-guide" role="dialog" aria-label="操作引导">
          <div className="exhibition-panel-heading">
            <div>
              <span>VISITOR GUIDE</span>
              <h2>怎么逛</h2>
            </div>
            <button
              type="button"
              onClick={() => setHelpOpen(false)}
              aria-label="关闭操作引导"
              title="关闭操作引导"
            >
              <X aria-hidden="true" />
            </button>
          </div>
          <div className="exhibition-control-guide-grid">
            <div>
              <Gamepad2 aria-hidden="true" />
              <strong>桌面端</strong>
              <p>开启自由漫游后，用 W A S D 或方向键移动，按住鼠标拖动转向，点击展品查看详情。</p>
            </div>
            <div>
              <Move aria-hidden="true" />
              <strong>手机端</strong>
              <p>左侧虚拟摇杆移动，右侧滑动区域转向。地图、路线和服务信息可随时打开。</p>
            </div>
          </div>
          <p className="exhibition-control-guide-note">
            当前自由漫游：{freeRoam ? '已开启' : '已关闭'}
          </p>
        </aside>
      )}

      {interactionOpen && (
        <aside className="exhibition-interaction-drawer" role="dialog" aria-label="展厅探索互动">
          <div className="exhibition-panel-heading">
            <div>
              <span>DISCOVERY MODE</span>
              <h2>展厅探索</h2>
            </div>
            <button
              type="button"
              onClick={() => setInteractionOpen(false)}
              aria-label="关闭展厅探索互动"
              title="关闭展厅探索互动"
            >
              <X aria-hidden="true" />
            </button>
          </div>
          <div className="exhibition-interaction-body">
            <section className="exhibition-discovery-progress" aria-label="互动展品发现进度">
              <div>
                <span>发现进度</span>
                <strong>
                  {discoveryCount} / {EXPLORATION_STOPS.length}
                </strong>
              </div>
              <div
                className="exhibition-discovery-meter"
                role="progressbar"
                aria-label="互动展品发现进度"
                aria-valuemin={0}
                aria-valuemax={EXPLORATION_STOPS.length}
                aria-valuenow={discoveryCount}
              >
                <span style={{ width: `${(discoveryCount / EXPLORATION_STOPS.length) * 100}%` }} />
              </div>
              {discoveryCount === EXPLORATION_STOPS.length ? (
                <p role="status">已完成本轮探索，继续自由漫游还能发现更多细节。</p>
              ) : null}
            </section>

            <section className="exhibition-discovery-list" aria-label="互动展品清单">
              {EXPLORATION_STOPS.map((stop, index) => {
                const discovered = discoveredExhibitIds.includes(stop.exhibitId);
                return (
                  <article key={stop.exhibitId} data-discovered={discovered ? 'true' : 'false'}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <div>
                      <strong>{stop.title}</strong>
                      <p>{stop.clue}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => discoverExhibit(stop.exhibitId, stop.zoneId)}
                      aria-label={`${discovered ? '再次查看' : '前往发现'} ${stop.title}`}
                    >
                      {discovered ? '查看' : '前往'}
                    </button>
                  </article>
                );
              })}
            </section>

            <section className="exhibition-quiz" aria-labelledby="exhibition-quiz-title">
              <span>馆内问答</span>
              <h3 id="exhibition-quiz-title">{EXHIBITION_QUIZ.question}</h3>
              <div role="radiogroup" aria-label="乌镇空间问答">
                {EXHIBITION_QUIZ.choices.map((choice) => (
                  <button
                    key={choice.id}
                    type="button"
                    role="radio"
                    aria-checked={quizAnswer === choice.id}
                    data-correct={
                      quizAnswer ? String(choice.id === EXHIBITION_QUIZ.correctId) : undefined
                    }
                    onClick={() => setQuizAnswer(choice.id)}
                  >
                    {choice.label}
                  </button>
                ))}
              </div>
              {quizAnswer ? (
                <p role="status">
                  {quizComplete
                    ? '回答正确，水系是乌镇空间组织的起点。'
                    : '再观察一下入口沙盘和河道关系。'}
                </p>
              ) : null}
            </section>

            <button
              type="button"
              className="exhibition-interaction-reset"
              onClick={() => {
                setDiscoveredExhibitIds([]);
                setQuizAnswer(null);
              }}
            >
              重置本轮探索
            </button>
          </div>
        </aside>
      )}

      {visitorPanelOpen && (
        <aside className="exhibition-visitor-drawer" role="dialog" aria-label="景区地图与游客服务">
          <div className="exhibition-panel-heading">
            <div>
              <span>WUZHEN VISITOR INFO</span>
              <h2>景区地图与服务</h2>
            </div>
            <button
              type="button"
              onClick={closeVisitorPanel}
              aria-label="关闭景区信息"
              title="关闭景区信息"
            >
              <X aria-hidden="true" />
            </button>
          </div>
          <div className="exhibition-visitor-tabs" role="tablist" aria-label="景区信息分类">
            {(
              [
                ['map', '地图'],
                ['routes', '路线'],
                ['services', '时间与服务']
              ] as const
            ).map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={visitorPanelTab === tab}
                data-active={visitorPanelTab === tab ? 'true' : 'false'}
                onClick={() => setVisitorPanelTab(tab)}
              >
                {tab === 'map' ? (
                  <MapPinned aria-hidden="true" />
                ) : tab === 'routes' ? (
                  <Route aria-hidden="true" />
                ) : (
                  <Info aria-hidden="true" />
                )}
                {label}
              </button>
            ))}
          </div>

          {visitorPanelTab === 'map' && (
            <div className="exhibition-visitor-map-panel">
              <div
                className="exhibition-scenic-map"
                role="img"
                aria-label="乌镇水乡航拍导览图，标注东栅、西栅和主要游客点位"
              >
                <img src="/images/wuzhen-real/aerial-2023.jpg" alt="乌镇水乡航拍景观" />
                <div className="exhibition-scenic-map-overlay" aria-hidden="true" />
                {SCENIC_MAP_STOPS.map((stop) => (
                  <button
                    key={stop.id}
                    type="button"
                    className="exhibition-map-stop"
                    data-active={selectedMapStopId === stop.id ? 'true' : 'false'}
                    style={{ left: `${stop.x}%`, top: `${stop.y}%` }}
                    onClick={() => setSelectedMapStopId(stop.id)}
                    aria-label={stop.name}
                  >
                    <MapPinned aria-hidden="true" />
                    <span>{stop.name}</span>
                  </button>
                ))}
              </div>
              <p className="exhibition-map-caption">
                实景航拍总览 · 点位为游客导览定位，现场路线以景区指引为准
              </p>
              {(() => {
                const stop =
                  SCENIC_MAP_STOPS.find((candidate) => candidate.id === selectedMapStopId) ??
                  SCENIC_MAP_STOPS[0];
                return (
                  <div className="exhibition-map-stop-detail">
                    <strong>{stop.name}</strong>
                    <span>{stop.detail}</span>
                    <button
                      type="button"
                      onClick={() => {
                        goToZone(stop.zoneId);
                        closeVisitorPanel();
                      }}
                    >
                      <Navigation aria-hidden="true" />在 3D 展厅定位
                    </button>
                  </div>
                );
              })()}
            </div>
          )}

          {visitorPanelTab === 'routes' && (
            <div className="exhibition-route-list">
              {VISITOR_ROUTES.map((route) => (
                <article key={route.id} className="exhibition-route-item">
                  <div className="exhibition-route-item-heading">
                    <Route aria-hidden="true" />
                    <div>
                      <h3>{route.name}</h3>
                      <span>
                        {route.duration} · 建议 {route.bestTime}
                      </span>
                    </div>
                  </div>
                  <p>{route.description}</p>
                  <small>{route.stops.join(' / ')}</small>
                  <button
                    type="button"
                    onClick={() => {
                      goToZone(route.zoneId);
                      closeVisitorPanel();
                    }}
                  >
                    <Navigation aria-hidden="true" />
                    在展厅查看这段路线
                  </button>
                </article>
              ))}
            </div>
          )}

          {visitorPanelTab === 'services' && (
            <div className="exhibition-service-info">
              <section>
                <div className="exhibition-section-label">
                  <Info aria-hidden="true" /> 常规开放参考
                </div>
                {VISITOR_HOURS.map((item) => (
                  <div className="exhibition-hour-row" key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </section>
              <section>
                <div className="exhibition-section-label">
                  <UtensilsCrossed aria-hidden="true" /> 餐饮与游客服务
                </div>
                <div className="exhibition-service-list">
                  {VISITOR_SERVICES.map((service) => (
                    <article key={service.label}>
                      {service.icon === 'food' ? (
                        <UtensilsCrossed aria-hidden="true" />
                      ) : service.icon === 'info' ? (
                        <Info aria-hidden="true" />
                      ) : (
                        <Navigation aria-hidden="true" />
                      )}
                      <div>
                        <strong>{service.label}</strong>
                        <span>{service.detail}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
              <p className="exhibition-info-note">{VISITOR_INFO_NOTE}</p>
            </div>
          )}
        </aside>
      )}

      {sceneReady && pageState !== 'render-error' && (
        <section className="exhibition-mobile-controls" aria-label="手机端虚拟控制">
          <div
            className="exhibition-mobile-joystick"
            role="group"
            aria-label={freeRoam ? '左侧虚拟摇杆，控制移动' : '请先开启自由漫游'}
            aria-disabled={!freeRoam}
            onPointerDown={handleMobileMoveStart}
            onPointerMove={updateMobileMove}
            onPointerUp={handleMobilePointerEnd}
            onPointerCancel={handleMobilePointerEnd}
          >
            <span className="exhibition-mobile-joystick-crosshair" aria-hidden="true" />
            <span
              className="exhibition-mobile-joystick-thumb"
              aria-hidden="true"
              style={{ transform: `translate(${mobileMove.x * 22}px, ${mobileMove.y * 22}px)` }}
            />
          </div>
          <div
            className="exhibition-mobile-lookpad"
            role="group"
            aria-label={freeRoam ? '右侧滑动区域，控制转向' : '请先开启自由漫游'}
            aria-disabled={!freeRoam}
            onPointerDown={handleMobileLookStart}
            onPointerMove={handleMobileLookMove}
            onPointerUp={handleMobilePointerEnd}
            onPointerCancel={handleMobilePointerEnd}
          >
            <Move aria-hidden="true" />
            <span>滑动转向</span>
          </div>
        </section>
      )}

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
          {selectedModelProfile ? (
            <section
              className="exhibit-dialog-model-controls"
              aria-label={`${selected.title} 模型互动`}
            >
              <span>模型互动</span>
              <p>{selectedModelProfile.hint}</p>
              <div className="exhibit-dialog-model-nav" aria-label="互动模型切换">
                <button type="button" onClick={() => navigateModel(-1)} aria-label="上一个互动模型">
                  <ArrowLeft aria-hidden="true" />
                </button>
                <span>
                  {MODEL_INTERACTION_IDS.indexOf(selectedId ?? '') + 1} /{' '}
                  {MODEL_INTERACTION_IDS.length}
                </span>
                <button type="button" onClick={() => navigateModel(1)} aria-label="下一个互动模型">
                  <ArrowRight aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setModelTourActive((active) => !active)}
                  aria-label={modelTourActive ? '暂停模型巡览' : '开始模型巡览'}
                  aria-pressed={modelTourActive}
                  title={modelTourActive ? '暂停模型巡览' : '开始模型巡览'}
                >
                  {modelTourActive ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
                </button>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => startModelInteraction('orbit')}
                  aria-pressed={activeModelInteraction === 'orbit'}
                >
                  <RotateCcw aria-hidden="true" />
                  模型环视
                </button>
                <button
                  type="button"
                  onClick={() => startModelInteraction('animate')}
                  aria-pressed={activeModelInteraction === 'animate'}
                >
                  <Gamepad2 aria-hidden="true" />
                  {selectedModelProfile.animationLabel}
                </button>
                <button
                  type="button"
                  onClick={() => startModelInteraction('showcase')}
                  aria-pressed={activeModelInteraction === 'showcase'}
                >
                  <Sparkles aria-hidden="true" />
                  细节聚焦
                </button>
                {activeModelInteraction ? (
                  <button type="button" onClick={resetModelInteraction} aria-label="复位模型">
                    <RotateCcw aria-hidden="true" />
                    复位
                  </button>
                ) : null}
              </div>
              <label className="exhibit-dialog-model-angle">
                <span>模型角度</span>
                <output>{modelRotation}°</output>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="15"
                  value={modelRotation}
                  aria-label="模型角度"
                  onChange={(event) => rotateSelectedModel(Number(event.target.value))}
                />
              </label>
            </section>
          ) : null}
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
