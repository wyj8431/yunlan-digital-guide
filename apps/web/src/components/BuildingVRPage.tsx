import { useEffect, useState } from 'react';
import { ArrowLeft, Expand, Eye, PauseCircle, Sparkles, Volume2 } from 'lucide-react';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';
import panoramas from '../config/panoramas.json';
import { PanoramaViewer } from './PanoramaViewer';

type BuildingHotspot = {
  label: string;
  detail: string;
  panoramaId: keyof typeof panoramas;
  x: number;
  y: number;
};
type BuildingView = { name: string; englishName: string; zone: string; intro: string; story: string; duration: string; tone: string; hotspots: BuildingHotspot[] };

const BUILDINGS: Record<string, BuildingView> = {
  'xizha-street': { name: '西栅老街', englishName: 'XIZHA OLD STREET', zone: '西栅景区', intro: '沿着水巷展开的乌镇街景，白墙黛瓦和临河灯影构成最经典的江南视线。', story: '从临水街巷出发，先看桥，再看船，把脚步留给屋檐下的光影。', duration: '建议停留 90 分钟', tone: 'xizha', hotspots: [
    { label: '临水街巷', detail: '沿河店铺与石板路保留着水乡生活的尺度。', panoramaId: 'wuzhen-xishan-scenic-35-2013', x: 24, y: 44 },
    { label: '古桥视线', detail: '站在桥边能同时看到河道、摇橹船与连续屋檐。', panoramaId: 'wuzhen-scenic-2-2013', x: 66, y: 29 },
    { label: '街巷转角', detail: '从水巷转角看建筑层层展开，是西栅的代表性视角。', panoramaId: 'wuzhen-xishan-scenic-41-2013', x: 76, y: 70 }
  ] },
  'dongzha-old-town': { name: '东栅古镇', englishName: 'DONGZHA OLD TOWN', zone: '东栅景区', intro: '更接近日常生活的水乡街区，作坊、老宅与河埠共同组成可阅读的生活长卷。', story: '东栅的看点不只在建筑，也在临河作业和街巷往来的细节。', duration: '建议停留 2 小时', tone: 'dongzha', hotspots: [
    { label: '西栅街景', detail: '临水街面延续着乌镇传统建筑的亲水尺度。', panoramaId: 'jiaxing-wuzhen-xishan-street-zhejiang-province-zhejiang', x: 26, y: 35 },
    { label: '夜游水巷', detail: '入夜后河面反光把街巷拉长，形成安静的夜游视线。', panoramaId: 'wuzhen-scenic-night-6-2013', x: 64, y: 50 },
    { label: '河岸屋檐', detail: '河岸屋檐与石板路共同勾勒出连续的江南街巷。', panoramaId: 'wuzhen-xishan-scenic-45-2013', x: 76, y: 73 }
  ] },
  'muhsin-art-museum': { name: '木心美术馆', englishName: 'MU XIN ART MUSEUM', zone: '乌镇西栅', intro: '面向水面的现代美术馆，以克制的几何体量收纳文学、绘画与时间感。', story: '建筑的留白与窗外水面一样，都是观展体验的一部分。', duration: '建议停留 60 分钟', tone: 'museum', hotspots: [
    { label: '水院倒影', detail: '水面与建筑之间保持安静距离，天气变化会带来不同边界感。', panoramaId: 'wuzhen-scenic-night-7-2013', x: 25, y: 35 },
    { label: '临水院落', detail: '从院落观看河道，能体会乌镇传统空间与现代场馆的对话。', panoramaId: 'wuzhen-xishan-scenic-12-2013', x: 63, y: 48 },
    { label: '远眺河埠', detail: '河埠与屋檐把观展后的步行路线自然延伸到水边。', panoramaId: 'wuzhen-xishan-scenic-18-2013', x: 75, y: 73 }
  ] },
  'wuzhen-grand-theater': { name: '乌镇大剧院', englishName: 'WUZHEN GRAND THEATER', zone: '乌镇西栅', intro: '水乡环境中的当代剧场地标，适合在白天看建筑，在夜晚看灯光与人流。', story: '它把古镇游览延伸到当代演出，外部开合关系像一幕未落的舞台。', duration: '建议停留 45 分钟', tone: 'theater', hotspots: [
    { label: '剧院前场', detail: '开阔前场适合观察建筑整体轮廓和到场动线。', panoramaId: 'wuzhen-xishan-scenic-21-2013', x: 24, y: 38 },
    { label: '剧院入口', detail: '入口的开敞空间在演出前后成为水岸的方向标。', panoramaId: 'jiaxing-wzdy-damen', x: 65, y: 47 },
    { label: '水岸立面', detail: '沿水一侧的层叠线条会随着观看角度变化。', panoramaId: 'wuzhen-xishan-scenic-22-2013', x: 76, y: 73 }
  ] },
  'water-market': { name: '水上市集', englishName: 'WATER MARKET', zone: '西栅水巷', intro: '船只、摊位和临水廊檐交汇的生活型节点，最能感受乌镇仍在使用的水上节奏。', story: '集市不是布景，而是水乡交易和邻里交往持续发生的地方。', duration: '建议停留 40 分钟', tone: 'market', hotspots: [
    { label: '市集河埠', detail: '河埠连接水路与街路，早晨能看到真实的装卸与采购场景。', panoramaId: 'wuzhen-xishan-scenic-24-2013', x: 25, y: 47 },
    { label: '临河摊位', detail: '摊位顺着河岸展开，视线在货物、招牌与水面之间切换。', panoramaId: 'wuzhen-scenic-6-2013', x: 64, y: 32 },
    { label: '码头转角', detail: '从市集转入水巷后人流变慢，适合继续前往桥梁节点。', panoramaId: 'wuzhen-xishan-scenic-31-2013', x: 77, y: 72 }
  ] }
};

const SPOT_ALIASES: Record<string, keyof typeof BUILDINGS> = {
  'west-gate': 'xizha-street', 'east-gate': 'dongzha-old-town', 'mu-xin': 'muhsin-art-museum', 'muxin-art-museum': 'muhsin-art-museum', 'grand-theater': 'wuzhen-grand-theater', 'bailian-tower': 'water-market', 'hongyuantai-dyehouse': 'water-market', 'qiaoli-bridge': 'xizha-street', 'fengyuan-bridge': 'xizha-street', 'old-stage': 'dongzha-old-town', 'tongji-bridge': 'xizha-street', 'mao-dun-house': 'dongzha-old-town', 'lizhi-academy': 'dongzha-old-town', 'jiangnan-bed-hall': 'dongzha-old-town'
};

export const BUILDING_VR_DATA = BUILDINGS;

export function BuildingVRPage({ spotId, onReturnMap }: { spotId: string; onReturnMap: () => void }) {
  const building = BUILDINGS[SPOT_ALIASES[spotId] ?? spotId] ?? BUILDINGS['xizha-street'];
  const [activeHotspot, setActiveHotspot] = useState(0);
  const { supported: speechSupported, speaking, speak, stop } = useSpeechSynthesis();
  const activeDetail = building.hotspots[activeHotspot] ?? building.hotspots[0];
  const panorama = panoramas[activeDetail.panoramaId];
  const narration = `${building.name}。${building.intro}${activeDetail.label}，${activeDetail.detail}${building.story}`;

  useEffect(() => { stop(); setActiveHotspot(0); }, [spotId, stop]);
  const selectHotspot = (index: number) => { stop(); setActiveHotspot(index); };
  const toggleFullscreen = () => document.fullscreenElement ? void document.exitFullscreen() : void document.documentElement.requestFullscreen?.();

  return <main className={`building-vr-page building-vr-page--${building.tone}`}>
    <header className="building-vr-header">
      <button type="button" className="building-vr-back" onClick={onReturnMap}><ArrowLeft size={18} aria-hidden="true" /><span>返回景点地图</span></button>
      <div className="building-vr-brand"><span>WUZHEN / REAL PANORAMA</span><strong>乌镇 360 实景全景</strong></div>
      <button type="button" className="building-vr-icon-button" aria-label="切换全屏" title="切换全屏" onClick={toggleFullscreen}><Expand size={18} aria-hidden="true" /></button>
    </header>
    <section className="building-vr-stage" aria-label={`${building.name} 实景全景`}><div className="building-vr-viewport"><PanoramaViewer key={activeDetail.panoramaId} source={`/api/panoramas/${encodeURIComponent(activeDetail.panoramaId)}/texture?v=${panorama.version}`} cubeSource={`/api/panoramas/${encodeURIComponent(activeDetail.panoramaId)}/cube`} fallbackSource="/images/wuzhen-real/aerial-2023.jpg" alt={`${building.name} - ${activeDetail.label}`} projectLabel={panorama.label} originalUrl={panorama.originalUrl} credit={panorama.credit} navigationTargets={building.hotspots.map((hotspot, index) => ({ ...hotspot, targetIndex: index === activeHotspot ? (index + 1) % building.hotspots.length : index }))} onNavigate={selectHotspot} /></div></section>
    <aside className="building-vr-info-panel">
      <div className="building-vr-kicker">{building.zone}</div><h1>{building.name}</h1><p className="building-vr-english">{building.englishName}</p><p className="building-vr-intro">{building.intro}</p>
      <div className="building-vr-meta"><span><Eye size={15} aria-hidden="true" />实景全景</span><button type="button" className="building-vr-audio-button" aria-label={speaking ? '停止讲解' : '播放讲解'} aria-pressed={speaking} disabled={!speechSupported} onClick={() => speaking ? stop() : void speak(narration)}>{speaking ? <PauseCircle size={15} aria-hidden="true" /> : <Volume2 size={15} aria-hidden="true" />}{speaking ? '停止讲解' : '播放讲解'}</button><span>{building.duration}</span></div>
      <div className="building-vr-hotspot-list" aria-label="全景看点">{building.hotspots.map((hotspot, index) => <button key={hotspot.panoramaId} type="button" className={index === activeHotspot ? 'is-active' : undefined} onClick={() => selectHotspot(index)}>{hotspot.label}</button>)}</div>
      <section className="building-vr-story"><div className="building-vr-story-title"><Sparkles size={17} aria-hidden="true" /><strong>{activeDetail.label}</strong></div><p>{activeDetail.detail}</p><p className="building-vr-story-copy">{building.story}</p></section>
    </aside>
  </main>;
}
