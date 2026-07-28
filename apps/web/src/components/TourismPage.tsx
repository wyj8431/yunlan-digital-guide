import { useState, type CSSProperties } from 'react';
import {
  ArrowLeft,
  AudioLines,
  BedDouble,
  BookOpen,
  BusFront,
  Camera,
  Check,
  CircleAlert,
  Clock3,
  Compass,
  Footprints,
  Headphones,
  MapPinned,
  Mic2,
  MoonStar,
  Navigation,
  Route,
  Sailboat,
  ShieldCheck,
  Sparkles,
  SunMedium,
  Ticket,
  UsersRound,
  Waves
} from 'lucide-react';
import type { TourismView } from '../routing/appRoute';
import type { RouteCard, ScenicAreaSummary } from '../types/guide';
import type { VoiceGuideState } from '../voice/useVoiceGuideSession';
import { TourismNav } from './TourismNav';

type PageView = Exclude<TourismView, 'explore' | 'history'>;
type MapLayer = 'walk' | 'boat' | 'night';

type TourismPageProps = {
  view: PageView;
  scenicArea: ScenicAreaSummary;
  routeCards: RouteCard[];
  latestAnswer: string;
  voice: Pick<VoiceGuideState, 'status' | 'transcript' | 'error'>;
  onNavigate: (view: TourismView) => void;
  onAsk: (question: string) => void | Promise<void>;
  onToggleVoice: () => void;
};

const PAGE_META: Record<PageView, { title: string; summary: string }> = {
  home: {
    title: '今日乌镇',
    summary: '先看懂今天适合怎样游，再决定从哪一段水路出发。'
  },
  guide: {
    title: '对话导览',
    summary: '路线、交通、住宿、避坑和文化故事，都可以交给数字导游继续追问。'
  },
  narration: {
    title: '水乡讲解',
    summary: '让一段景区资料变成有章节、有节奏、可以被数字人讲述的现场故事。'
  },
  map: {
    title: '活体运河地图',
    summary: '景点沿水脉展开，切换步行、摇橹船和夜游视角，理解它们之间的关系。'
  },
  itinerary: {
    title: '流动行程',
    summary: '把景点、时间和行动建议放进同一条旅行时间带，照着走也不会慌。'
  },
  voice: {
    title: '水纹声场',
    summary: '直接说出目的地和需求，在这里确认识别状态，再由数字人接着回答。'
  },
  profile: {
    title: '旅行档案',
    summary: '把本次路线、服务和出发前必须核验的信息，收进一张数字旅行护照。'
  }
};

const GUIDE_PROMPTS = [
  {
    label: '一天路线怎么排？',
    detail: '景点顺序、游玩时长与节奏',
    question: '第一次去乌镇，帮我安排一天路线，包含景点顺序、交通、住宿和注意事项。',
    icon: Route
  },
  {
    label: '怎么到达最省心？',
    detail: '高铁、自驾与景区接驳',
    question: '从杭州怎么去乌镇最省心？请比较高铁、自驾和景区接驳。',
    icon: BusFront
  },
  {
    label: '住东栅还是西栅？',
    detail: '夜游体验与第二天动线',
    question: '住东栅还是西栅更方便？请比较住宿体验和交通。',
    icon: BedDouble
  },
  {
    label: '老人孩子怎么游？',
    detail: '少走路、休息点与安全提醒',
    question: '带老人和孩子游乌镇要注意什么？请给一条轻松路线。',
    icon: UsersRound
  },
  {
    label: '哪里最适合拍照？',
    detail: '清晨、蓝调与夜景机位',
    question: '乌镇哪里适合拍清晨和夜景？请按时间推荐拍照点。',
    icon: Camera
  },
  {
    label: '乌镇为什么值得看？',
    detail: '水乡文化、生活方式与必看景点',
    question: '介绍乌镇的水乡文化和必看景点，并说明每个景点的看点。',
    icon: BookOpen
  }
] as const;

const STORY_CHAPTERS = [
  { title: '水路形成', text: '桥、河、街共同塑造了乌镇的行走方式。' },
  { title: '商贸生活', text: '临水店铺、染坊与码头保存着江南日常的尺度。' },
  { title: '当代夜游', text: '灯光落在河面以后，古镇进入另一套缓慢节奏。' }
] as const;

const MAP_LAYERS: Record<
  MapLayer,
  { label: string; description: string; icon: typeof Footprints }
> = {
  walk: {
    label: '步行图层',
    description: '沿桥、巷和文化场馆串联，适合第一次完整认识乌镇。',
    icon: Footprints
  },
  boat: {
    label: '摇橹船图层',
    description: '优先连接码头与临水景点，减少折返，从水面观看古镇。',
    icon: Sailboat
  },
  night: {
    label: '夜游图层',
    description: '聚焦亮灯后的西栅、桥面和河岸，适合傍晚到夜间慢游。',
    icon: MoonStar
  }
};

const PHASES = ['晨', '昼', '暮', '夜'] as const;

const VOICE_STATUS: Record<VoiceGuideState['status'], { title: string; detail: string }> = {
  idle: { title: '声场已就绪', detail: '点击中心按钮后开始说话。' },
  connecting: { title: '正在连接语音服务', detail: '请保持页面开启。' },
  listening: { title: '正在聆听', detail: '说完后稍等片刻，系统会自动识别。' },
  recognizing: { title: '正在识别', detail: '正在把你的声音转换为文字。' },
  thinking: { title: '数字导游正在思考', detail: '正在组织景区路线和旅行建议。' },
  speaking: { title: '数字导游正在回答', detail: '文字、语音和口型将继续在探索页呈现。' },
  error: { title: '语音没有连接成功', detail: '检查麦克风权限后可以重新尝试。' }
};

function SectionHeading({ view }: { view: PageView }) {
  const meta = PAGE_META[view];

  return (
    <div className="tourism-page-heading">
      <span className="tourism-page-index">WUZHEN / {view.toUpperCase()}</span>
      <h1 id="tourism-page-title">{meta.title}</h1>
      <p>{meta.summary}</p>
    </div>
  );
}

export function TourismPage({
  view,
  scenicArea,
  routeCards,
  latestAnswer,
  voice,
  onNavigate,
  onAsk,
  onToggleVoice
}: TourismPageProps) {
  const [mapLayer, setMapLayer] = useState<MapLayer>('walk');
  const visibleRouteCards =
    routeCards.length > 0
      ? routeCards
      : scenicArea.routes.map((route) => ({
          type: 'route-step' as const,
          title: route.name,
          duration: route.duration,
          description: route.description
        }));

  const askThenExplore = (question: string) => {
    void onAsk(question);
    onNavigate('explore');
  };

  const narration = latestAnswer || scenicArea.scenicArea.description;
  const voiceStatus = VOICE_STATUS[voice.status];

  return (
    <main
      className={`tourism-page tourism-page--${view}`}
      data-tourism-page={view}
      data-design-thesis="living-wuzhen-travel-os"
    >
      <div className="tourism-ambient" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <header className="tourism-page-header">
        <button type="button" className="tourism-page-back" onClick={() => onNavigate('explore')}>
          <ArrowLeft size={19} aria-hidden="true" />
          <span>返回探索</span>
        </button>
        <div className="tourism-page-brand">
          <strong>智慧文旅 · 全息导游</strong>
          <small>Living Wuzhen Travel OS</small>
        </div>
      </header>

      <section className="tourism-page-content" aria-labelledby="tourism-page-title">
        <SectionHeading view={view} />

        {view === 'home' ? (
          <section className="tourism-home-observatory" aria-label="今日旅行观景台">
            <div className="tourism-home-sun" aria-hidden="true">
              <SunMedium size={34} />
            </div>
            <div className="tourism-home-intro">
              <span>{scenicArea.scenicArea.location || '浙江 · 嘉兴 · 桐乡'}</span>
              <h2>今天，从水上醒来</h2>
              <p>{scenicArea.scenicArea.description}</p>
              <div className="tourism-home-facts">
                <span>
                  <Clock3 size={18} aria-hidden="true" />
                  {scenicArea.scenicArea.openingHours}
                </span>
                <span>
                  <Ticket size={18} aria-hidden="true" />
                  {scenicArea.scenicArea.ticketInfo}
                </span>
              </div>
            </div>
            <div className="tourism-departure-modes">
              <button type="button" onClick={() => onNavigate('itinerary')}>
                <Clock3 size={21} aria-hidden="true" />
                <span>
                  <strong>半日漫游</strong>
                  <small>第一次来，先抓住水乡核心</small>
                </span>
              </button>
              <button
                type="button"
                onClick={() => askThenExplore('请规划一条乌镇西栅傍晚到夜间的游玩路线。')}
              >
                <MoonStar size={21} aria-hidden="true" />
                <span>
                  <strong>夜游西栅</strong>
                  <small>从蓝调时刻走到灯火亮起</small>
                </span>
              </button>
              <button
                type="button"
                onClick={() => askThenExplore('请规划一条适合亲子家庭的乌镇轻松路线。')}
              >
                <UsersRound size={21} aria-hidden="true" />
                <span>
                  <strong>亲子慢行</strong>
                  <small>少折返，保留休息和体验时间</small>
                </span>
              </button>
            </div>
            <p className="tourism-official-note">
              <ShieldCheck size={18} aria-hidden="true" />
              出发前请核验官方票务与当日开放信息
            </p>
          </section>
        ) : null}

        {view === 'guide' ? (
          <section className="tourism-guide-constellation" aria-label="旅行问题星群">
            <div className="tourism-guide-core">
              <span className="tourism-guide-orbit" aria-hidden="true" />
              <Sparkles size={30} aria-hidden="true" />
              <strong>全球景区都可以问</strong>
              <p>告诉我目的地、同行人、时间和预算，我会优先给出路线、交通、住宿与注意事项。</p>
            </div>
            <div className="tourism-guide-prompts">
              {GUIDE_PROMPTS.map(({ label, detail, question, icon: Icon }, index) => (
                <button
                  key={question}
                  type="button"
                  style={{ '--prompt-index': index } as CSSProperties}
                  onClick={() => askThenExplore(question)}
                >
                  <Icon size={20} aria-hidden="true" />
                  <span>
                    <strong>{label}</strong>
                    <small>{detail}</small>
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {view === 'narration' ? (
          <section className="tourism-story-stage" aria-label="水乡故事舞台">
            <div className="tourism-story-copy">
              <span className="tourism-story-status">
                <AudioLines size={18} aria-hidden="true" />
                当前讲解稿
              </span>
              <blockquote>{narration}</blockquote>
              <button
                type="button"
                onClick={() =>
                  askThenExplore('请以数字导游口吻讲解乌镇的水乡历史、商贸生活和夜游看点。')
                }
              >
                <Headphones size={19} aria-hidden="true" />
                开始数字人讲解
              </button>
            </div>
            <div className="tourism-story-wave" aria-hidden="true">
              {Array.from({ length: 28 }, (_, index) => (
                <span
                  key={index}
                  style={
                    {
                      '--wave-index': index,
                      '--wave-height': `${8 + (index % 7) * 4}px`
                    } as CSSProperties
                  }
                />
              ))}
            </div>
            <ol className="tourism-story-chapters">
              {STORY_CHAPTERS.map((chapter, index) => (
                <li key={chapter.title}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <strong>{chapter.title}</strong>
                    <p>{chapter.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {view === 'map' ? (
          <section className="tourism-map-experience" aria-label="景点地图">
            <div className="tourism-map-toolbar" role="group" aria-label="地图图层">
              {(Object.entries(MAP_LAYERS) as Array<[MapLayer, (typeof MAP_LAYERS)[MapLayer]]>).map(
                ([key, layer]) => {
                  const Icon = layer.icon;
                  return (
                    <button
                      key={key}
                      type="button"
                      className={mapLayer === key ? 'is-active' : ''}
                      aria-pressed={mapLayer === key}
                      aria-label={layer.label}
                      onClick={() => setMapLayer(key)}
                    >
                      <Icon size={18} aria-hidden="true" />
                      <span>{layer.label.replace('图层', '')}</span>
                    </button>
                  );
                }
              )}
            </div>
            <div className="tourism-canal-map" data-map-layer={mapLayer}>
              <div className="tourism-canal-flow" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              {scenicArea.spots.slice(0, 8).map((spot, index) => (
                <button
                  key={spot.id}
                  type="button"
                  className="tourism-map-node"
                  style={{ '--spot-index': index } as CSSProperties}
                  onClick={() => askThenExplore(`介绍一下${spot.name}，并推荐附近游玩路线。`)}
                >
                  <span className="tourism-map-marker">
                    <MapPinned size={18} aria-hidden="true" />
                  </span>
                  <span>
                    <strong>{spot.name}</strong>
                    <small>{spot.summary}</small>
                  </span>
                </button>
              ))}
            </div>
            <div className="tourism-map-layer-copy">
              <Compass size={22} aria-hidden="true" />
              <p>{MAP_LAYERS[mapLayer].description}</p>
            </div>
          </section>
        ) : null}

        {view === 'itinerary' ? (
          <section className="tourism-itinerary-layout" aria-label="智慧行程时间带">
            <aside className="tourism-itinerary-summary">
              <Route size={28} aria-hidden="true" />
              <span>ROUTE READY</span>
              <strong>{visibleRouteCards.length} 个路线方案</strong>
              <p>先选符合体力和停留时间的路线，再向数字导游补充交通、住宿和同行人需求。</p>
              <button type="button" onClick={() => onNavigate('guide')}>
                让 AI 重新规划
                <Navigation size={18} aria-hidden="true" />
              </button>
            </aside>
            <div className="tourism-itinerary-stream">
              {visibleRouteCards.slice(0, 6).map((route, index) => (
                <article key={`${route.title}-${index}`}>
                  <div className="tourism-itinerary-time">
                    <span>{PHASES[index % PHASES.length]}</span>
                    <small>{route.duration}</small>
                  </div>
                  <div className="tourism-itinerary-stop">
                    <span className="tourism-itinerary-dot" aria-hidden="true" />
                    <h2>{route.title}</h2>
                    <p>{route.description}</p>
                    <small>到达前确认开放时间，并为排队和步行预留缓冲。</small>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {view === 'voice' ? (
          <section className="tourism-voice-field" aria-label="实时语音交互">
            <div className={`tourism-voice-ripples is-${voice.status}`} aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div className="tourism-voice-core">
              <span className="tourism-voice-state">{voiceStatus.title}</span>
              <button
                type="button"
                className="tourism-voice-trigger"
                aria-label={
                  voice.status === 'listening' || voice.status === 'recognizing'
                    ? '停止语音提问'
                    : '开始语音提问'
                }
                onClick={onToggleVoice}
              >
                <Mic2 size={34} aria-hidden="true" />
              </button>
              <p>{voice.error || voice.transcript || voiceStatus.detail}</p>
            </div>
            <div className="tourism-voice-examples">
              <strong>你可以这样问</strong>
              <span>“这座建筑是什么？”</span>
              <span>“帮我规划两小时路线。”</span>
              <span>“附近有什么适合带孩子玩的？”</span>
            </div>
          </section>
        ) : null}

        {view === 'profile' ? (
          <section className="tourism-passport" aria-label="本次旅行档案">
            <div className="tourism-passport-cover">
              <span>WUZHEN JOURNEY</span>
              <Waves size={42} aria-hidden="true" />
              <h2>本次乌镇旅程</h2>
              <p>未登录状态下保存的是本次浏览会话中的路线和景区服务，不会伪造历史足迹。</p>
              <div className="tourism-passport-stamp">
                <strong>{scenicArea.spots.length}</strong>
                <span>可探索景点</span>
              </div>
            </div>
            <div className="tourism-passport-pages">
              <section>
                <h3>出发准备</h3>
                <ul>
                  <li>
                    <Check size={17} aria-hidden="true" />
                    选择符合停留时间的路线
                  </li>
                  <li>
                    <Check size={17} aria-hidden="true" />
                    确认到达交通和返程时间
                  </li>
                  <li>
                    <Check size={17} aria-hidden="true" />
                    雨天准备防滑鞋和轻便雨具
                  </li>
                </ul>
              </section>
              <section>
                <h3>景区服务</h3>
                <div className="tourism-passport-services">
                  {scenicArea.services.slice(0, 6).map((service) => (
                    <article key={service.id}>
                      <span>{service.type}</span>
                      <strong>{service.name}</strong>
                      <p>{service.description}</p>
                    </article>
                  ))}
                </div>
              </section>
              <section className="tourism-passport-warning">
                <CircleAlert size={20} aria-hidden="true" />
                <div>
                  <h3>官方信息核验</h3>
                  <p>票价、开放时间、预约规则和交通班次可能变化，请以景区官方当天公告为准。</p>
                </div>
              </section>
            </div>
          </section>
        ) : null}
      </section>

      <TourismNav activeView={view} onNavigate={onNavigate} />
    </main>
  );
}
