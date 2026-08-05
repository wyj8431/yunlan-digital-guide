import { useEffect, useMemo, useRef } from 'react';
import type { PointerEvent } from 'react';
import { ArrowLeft, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import * as THREE from 'three';

type ScenicHotspot = {
  label: string;
  detail: string;
};

export type ScenicPanorama = {
  id: string;
  name: string;
  englishName: string;
  zone: string;
  intro: string;
  story: string;
  duration: string;
  image: string;
  startYaw: number;
  hotspots: ScenicHotspot[];
};

const REAL_SCENE_IMAGES = {
  street: '/images/wuzhen-water-town-bg.jpg',
  aerial: '/images/wuzhen-aerial-panorama.jpg'
} as const;

const PANORAMA_IMAGE = REAL_SCENE_IMAGES.street;

const SCENIC_PANORAMAS: ScenicPanorama[] = [
  {
    id: 'west-gate',
    name: '西栅老街',
    englishName: 'XIZHA OLD STREET',
    zone: '西栅景区',
    intro: '沿着水巷慢慢展开的乌镇夜游入口，白墙黛瓦与河灯构成最经典的江南视线。',
    story: '从临水街巷出发，先看桥、再看船，最后把时间留给屋檐下的灯影。',
    duration: '建议停留 90 分钟',
    image: PANORAMA_IMAGE,
    startYaw: 0.2,
    hotspots: [
      { label: '临水街巷', detail: '沿河店铺和石板路保持着水乡生活的尺度，适合从傍晚开始慢行。' },
      { label: '古桥视线', detail: '站在桥顶可以同时看到河道、摇橹船和连续的屋檐线，是西栅最完整的取景方向。' },
      { label: '夜游灯影', detail: '入夜后河面反光会把街巷拉长，建议把拍摄设备调低曝光，保留灯笼层次。' }
    ]
  },
  {
    id: 'east-gate',
    name: '东栅景区',
    englishName: 'DONGZHA OLD TOWN',
    zone: '东栅景区',
    intro: '更接近日常生活的水乡街区，染坊、作坊和老宅共同组成一条可阅读的生活长卷。',
    story: '东栅的看点不只在建筑，也在门前晾晒、临河作业和街坊往来的细节。',
    duration: '建议停留 2 小时',
    image: PANORAMA_IMAGE,
    startYaw: -0.7,
    hotspots: [
      { label: '木构老宅', detail: '沿街住宅的进深和天井体现了江南宅院对采光、通风与亲水生活的安排。' },
      { label: '手工作坊', detail: '蓝印花布、酿造和竹木工艺让东栅保留了更鲜明的传统生产记忆。' },
      { label: '河埠生活', detail: '河埠头既是上下船的位置，也是居民清洗、搬运和交流的日常节点。' }
    ]
  },
  {
    id: 'mu-xin',
    name: '木心美术馆',
    englishName: 'MU XIN ART MUSEUM',
    zone: '乌镇西栅',
    intro: '一座面向水面的现代美术馆，以克制的几何体量收纳木心的文学、绘画与时间感。',
    story: '看展时不妨把速度放慢，建筑的留白与窗外水面一样，都是展览的一部分。',
    duration: '建议停留 60 分钟',
    image: PANORAMA_IMAGE,
    startYaw: 1.15,
    hotspots: [
      { label: '水院倒影', detail: '建筑与水面之间保持了安静距离，晴天和阴天会呈现两种完全不同的边界感。' },
      { label: '展厅序列', detail: '展厅之间的转折适合按照时间线慢慢阅读，不必一次看完所有内容。' },
      { label: '临窗阅读', detail: '临水窗口把古镇环境引入室内，适合在看展后停留片刻，整理自己的观展感受。' }
    ]
  },
  {
    id: 'grand-theater',
    name: '乌镇大剧院',
    englishName: 'WUZHEN GRAND THEATER',
    zone: '乌镇西栅',
    intro: '水乡环境中的当代剧场地标，适合在白天看建筑，在夜晚看灯光和人流。',
    story: '它把乌镇从古镇游览延伸到当代演出，建筑外部的开合关系也像一幕未落的舞台。',
    duration: '建议停留 45 分钟',
    image: PANORAMA_IMAGE,
    startYaw: 2.2,
    hotspots: [
      { label: '剧场前场', detail: '开阔前场是观演前后的集合空间，适合从正面观察建筑的整体轮廓。' },
      { label: '水岸立面', detail: '临水一侧的层叠线条会随着视角变化，黄昏时最容易看出它与古镇屋面的呼应。' },
      { label: '夜间入口', detail: '演出日建议提前到达，入口灯光亮起后，剧院会成为水岸上很清晰的方向标。' }
    ]
  },
  {
    id: 'water-market',
    name: '水上集市',
    englishName: 'WATER MARKET',
    zone: '西栅水巷',
    intro: '船只、摊位和临水廊棚交汇的生活型节点，最能感受到乌镇仍在使用的水上节奏。',
    story: '集市不是被观看的布景，而是水乡交易和邻里交往持续发生的地方。',
    duration: '建议停留 40 分钟',
    image: PANORAMA_IMAGE,
    startYaw: -2.05,
    hotspots: [
      { label: '船市码头', detail: '码头连接水路与街路，早晨更容易看到装卸、采购和短途摆渡的真实场景。' },
      { label: '临河摊棚', detail: '摊棚顺着河岸展开，视线会在货物、招牌和水面之间不断切换。' },
      { label: '水巷转角', detail: '从集市转入水巷后人流会变慢，适合顺着河道继续前往染坊与桥梁节点。' }
    ]
  },
  {
    id: 'bailian-tower',
    name: '白莲塔',
    englishName: 'BAILIAN PAGODA',
    zone: '西栅景区',
    intro: '临水而立的垂直地标，是观察乌镇河网、屋顶和远处船线的最佳参照。',
    story: '在平缓的水乡天际线上，塔把视线向上提起，也把不同方向的水路重新串联。',
    duration: '建议停留 30 分钟',
    image: PANORAMA_IMAGE,
    startYaw: 2.8,
    hotspots: [
      { label: '塔影入河', detail: '晴朗天气下塔影会落入河面，适合用桥面或船头作为前景。' },
      { label: '远眺水网', detail: '从开阔位置观察，能够更直观地理解乌镇桥、河、街共同构成的空间结构。' }
    ]
  },
  {
    id: 'hongyuantai-dyehouse',
    name: '宏源泰染坊',
    englishName: 'HONGYUANTAI DYEHOUSE',
    zone: '西栅景区',
    intro: '蓝印花布从木架间垂落，染坊把传统工艺变成一处可以从颜色和气味进入的现场。',
    story: '布匹需要水、阳光和时间，染坊的空间也因此始终和河道保持着密切联系。',
    duration: '建议停留 35 分钟',
    image: PANORAMA_IMAGE,
    startYaw: -1.4,
    hotspots: [
      { label: '晒布长廊', detail: '不同深浅的蓝色在风里展开，是染坊最具辨识度的视觉层次。' },
      { label: '工艺展台', detail: '可以按刻板、刮浆、染色和晾晒的顺序理解蓝印花布的制作过程。' }
    ]
  },
  {
    id: 'qiaoli-bridge',
    name: '桥里桥',
    englishName: 'QIAOLI BRIDGE',
    zone: '西栅景区',
    intro: '两座桥连续跨过水巷，桥洞、石阶和临水街屋在这里形成一条连续的江南视线。',
    story: '桥里桥适合观察乌镇桥梁的尺度，慢慢走过桥面，水路和街路会在脚下交替。',
    duration: '建议停留 25 分钟',
    image: PANORAMA_IMAGE,
    startYaw: 0.9,
    hotspots: [
      { label: '桥洞水面', detail: '低机位可以把桥洞、船线和倒影压缩在同一条视线上。' },
      { label: '石阶埠头', detail: '石阶连接街面与河道，是乌镇临水生活最直接的空间切口。' }
    ]
  },
  {
    id: 'fengyuan-bridge',
    name: '逢源双桥',
    englishName: 'FENGYUAN BRIDGES',
    zone: '西栅景区',
    intro: '两座石拱桥在水巷转折处相遇，桥面高差和河道弯曲共同构成标志性空间。',
    story: '从桥上看水面开阔，从岸边看桥身交叠，两个方向都能读到乌镇的水路结构。',
    duration: '建议停留 25 分钟',
    image: PANORAMA_IMAGE,
    startYaw: -2.7,
    hotspots: [
      { label: '双桥交汇', detail: '站在岸边可以看到两座桥的错落关系，适合等待船只经过制造尺度感。' },
      { label: '河道转弯', detail: '河道弯曲让屋檐线自然消失又出现，适合拍摄有层次的水乡远景。' }
    ]
  },
  {
    id: 'old-stage',
    name: '古戏台',
    englishName: 'OLD STAGE',
    zone: '西栅景区',
    intro: '临河古戏台保留木构台口与檐下灯影，是夜游路线中很有停留感的一处节点。',
    story: '戏台面对水路，观众可以来自街巷也可以来自船上，舞台因此天然拥有开放的边界。',
    duration: '建议停留 30 分钟',
    image: PANORAMA_IMAGE,
    startYaw: 1.7,
    hotspots: [
      { label: '台口木构', detail: '观察台口、檐角和柱网的比例，可以看出传统戏台对观看方向的组织。' },
      { label: '檐下灯影', detail: '夜间灯光落在木构表面，建议从河对岸观看整体轮廓。' }
    ]
  },
  {
    id: 'tongji-bridge',
    name: '通济桥',
    englishName: 'TONGJI BRIDGE',
    zone: '西栅景区',
    intro: '青石拱桥跨过主河道，桥下水面为船只留出缓慢通过的开阔尺度。',
    story: '通济桥是水路与步行路的交叉点，桥面和桥下分别提供两种乌镇观看方式。',
    duration: '建议停留 20 分钟',
    image: PANORAMA_IMAGE,
    startYaw: -0.1,
    hotspots: [
      { label: '桥面远景', detail: '从桥面看沿河屋顶和远处水巷，适合捕捉乌镇连续的天际线。' },
      { label: '桥下船线', detail: '桥下视角更接近水面，雨天石阶和青石会呈现明显的反光层次。' }
    ]
  },
  {
    id: 'mao-dun-house',
    name: '茅盾故居',
    englishName: 'MAO DUN HOUSE',
    zone: '东栅景区',
    intro: '老式书房、木床和书柜保留着作家故居的安静尺度，适合以生活细节理解东栅。',
    story: '这里的价值在于日常物件仍然保持原有秩序，建筑和文字记忆从小尺度同时展开。',
    duration: '建议停留 40 分钟',
    image: PANORAMA_IMAGE,
    startYaw: 2.5,
    hotspots: [
      { label: '书房空间', detail: '书桌、书柜和窗户共同形成了适合阅读与写作的安静纵深。' },
      { label: '故居庭院', detail: '庭院把室内生活和东栅街巷连接起来，适合留意门槛、天井与光线的关系。' }
    ]
  },
  {
    id: 'lizhi-academy',
    name: '立志书院',
    englishName: 'LIZHI ACADEMY',
    zone: '东栅景区',
    intro: '沿河设置的书院保留院落、门厅与巷道的紧凑尺度，是理解乌镇教育传统的入口。',
    story: '书院让水乡的商业生活之外多了一层人文脉络，院落的安静也来自对街巷节奏的过滤。',
    duration: '建议停留 35 分钟',
    image: PANORAMA_IMAGE,
    startYaw: -1.9,
    hotspots: [
      { label: '书院院落', detail: '院落的围合关系让室外光线更柔和，适合观察门厅和巷道的转折。' },
      { label: '临河门厅', detail: '门厅把水面引入视线，体现了东栅建筑对河道方向的持续回应。' }
    ]
  },
  {
    id: 'jiangnan-bed-hall',
    name: '江南百床馆',
    englishName: 'JIANGNAN BED MUSEUM',
    zone: '东栅景区',
    intro: '明清雕花古床集中陈列，木雕、榫卯和民俗信息让家具成为一部立体的生活史。',
    story: '一张床不仅是睡眠家具，也记录了家庭结构、工艺审美和江南居住空间的尺度。',
    duration: '建议停留 45 分钟',
    image: PANORAMA_IMAGE,
    startYaw: 0.55,
    hotspots: [
      { label: '雕花古床', detail: '观察床围、柱脚和雕花层次，可以看到不同年代的审美与工艺变化。' },
      { label: '展厅动线', detail: '沿展厅顺序观看，先理解床的结构，再关注装饰和家庭使用场景。' }
    ]
  }
];

const panoramaById = new Map(SCENIC_PANORAMAS.map((panorama) => [panorama.id, panorama]));
const PANORAMA_ALIASES: Record<string, string> = {
  'xizha-street': 'west-gate',
  'dongzha-old-town': 'east-gate',
  'muhsin-art-museum': 'mu-xin',
  'muxin-art-museum': 'mu-xin',
  'wuzhen-grand-theater': 'grand-theater'
};

type ScenicMedia = {
  sourceUrl: string;
  fallbackImage: string;
  tileToken?: string;
  kind: 'panorama' | 'photo';
};

const GOOGLE_PANO_TILE_TOKENS = {
  eastGate:
    'AFP8RcNCB8VPtSHRxiWWpAv7b6Mj7toGKjN-RmQpBhi7bhlbKkbRRy1VaKU1zxRfvNSeviP_p00aSsSqWRFAMYZ4_DRvgy9S6SOpliXLZRMGFsVzSXwLRrmtb2IWSVw6CTcvk7k9mCtj',
  waterMarket:
    'AFP8RcPbRG-zwVCAkdDJbWvKqMVnGwgPwNxmgJoos68dZ9yVc-EU28ivhLWscEyCw8THyoM6WnWH5t1AdCPiOj7fsemEBFcflmQMvvlQH7wFDLuEV_R-WgJACnLPf-Iz9A4Mu7Wx3L5b',
  dyehouse:
    'AFP8RcPW-ySssC4IVHX1zZ_4ncJ_-02qCKzocSVUt3CNgE4i247-sf7CprWXFqz6aIjz_8uI6upx2Ke7J_TSsJ44crjFzWiidYd0Q-EYL1Tk1rDeBE3ijCuVzQNJrlMB0Jqf9GD5BaW8',
  qiaoli:
    'AFP8RcMUULv6kOEX5l_k5lME7o63sG1jJb3klfBcI8qiU-52GETSIYrEma0Ni62r1IKeu7dHF2W6_H89J4jFQyooN8ve8Os9IovG8_5gIMcMMYLO37D4lEq4u2JotnQO2Z-SMsxfvrVUIA',
  tongji:
    'AFP8RcOZYp37hjT5dRWRFTOZQJn-Ziz4KMzzPj0No03_qeCGE7Ult7Fr_wsYSoCAD0tgUY1R4_NYYF_D8mSRd3AcCFEPz3qjgzqkDGtDff7aM8cz8x8t9n4IPeyAn-FK7fgh9oSFpdsUwA',
  maoDun:
    'AFP8RcNgrRIfJloU4ZjKcqPLbwZ7i4t7yhIVf6_Z5N8lDXacH0Kx7-LbfUGTBW2F14U7yFFJBKRLvgF8XyvDOeCbcQFZSHAH898fXVj4w1q_ucmpJ5CA367WjodrpG5HZ8H1b-SG4Kimgw',
  lizhi:
    'AFP8RcO1M4rSKY2Rn4tPSiEivPvCp8x0of_mycfiHHhJ4HM7fAjaB8F6aSarky52AxVM448dCN2F3MtOGXZPEln2oDpqxpXI7UKia_y4WMwi5Grf8hA1qsjJGdITyhYb6WBxTOwddZAalg',
  bedHall:
    'AFP8RcOymUUEJMO-_zl1F1Rxp-RGtCtFHnHMxU2psGjmEw6O3m0iZt9QMX-d_xxM4KZvzAA36XZftdboQJWc35DK8uUL65J7IyT8eLBZsYKj6gbRCi0K4Ifvbyr_wEYO2KO09Nh7y7yU'
} as const;

const googlePanoPreview = (token: string, x = 0, y = 0) =>
  x === 0 && y === 0
    ? `https://lh3.googleusercontent.com/gpms-cs-s/${token}=w1400-h900-k-no-pi0-ya0-ro0-fo100`
    : `https://lh3.googleusercontent.com/gpms-cs-s/${token}=x${x}-y${y}-z3`;

const SCENIC_MEDIA_BY_ID: Record<string, ScenicMedia> = {
  'west-gate': {
    sourceUrl: 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=30.747939,120.489457&heading=0&pitch=0&fov=90',
    fallbackImage: REAL_SCENE_IMAGES.street,
    kind: 'photo'
  },
  'east-gate': {
    sourceUrl: 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=30.740495,120.496551&heading=0&pitch=0&fov=90',
    fallbackImage: googlePanoPreview(GOOGLE_PANO_TILE_TOKENS.eastGate),
    tileToken: GOOGLE_PANO_TILE_TOKENS.eastGate,
    kind: 'panorama'
  },
  'mu-xin': {
    sourceUrl: 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=30.750254,120.487742&heading=0&pitch=0&fov=90',
    fallbackImage:
      'https://lh3.googleusercontent.com/gps-cs-s/AHRPTWmR19qz97rAFGPnvxMTZEN2jb7VelcxsTBnUR-84z9dfvqij6EBhQgUIPRqTFFpQ16GxARaVbGyJHng1zbWa4l23rnDS18fBm6crwrJKHv8w1BRUYxxoMYDxkIDn9VtmGYGYmj-=w408-h306-k-no',
    kind: 'photo'
  },
  'grand-theater': {
    sourceUrl: 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=30.74801,120.491854&heading=0&pitch=0&fov=90',
    fallbackImage: googlePanoPreview(GOOGLE_PANO_TILE_TOKENS.dyehouse, 3, 1),
    kind: 'photo'
  },
  'water-market': {
    sourceUrl: 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=30.750584,120.484081&heading=0&pitch=0&fov=90',
    fallbackImage:
      'https://lh3.googleusercontent.com/gps-cs-s/AHRPTWlX6MM5142yC3rS6xCTXdPtmaG483wqetikPx_TdbYnAi4qHnQrYRE_NubtO9r5sgnypABoAr7w_85mDBIDaAve53ttTa3JlsTqq4SW-gsCyW7_7_LkDdNoRFraOM48cicEvbQO3g=w408-h306-k-no',
    tileToken: GOOGLE_PANO_TILE_TOKENS.waterMarket,
    kind: 'panorama'
  },
  'bailian-tower': {
    sourceUrl: 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=30.736598,120.491093&heading=0&pitch=0&fov=90',
    fallbackImage:
      'https://lh3.googleusercontent.com/gps-cs-s/AHRPTWm-i2Owb9llnJDE4ANwRUgi_jeMdOUlT8ZFiJmjsns7bY5pPbdJRupbuYoipFGeX-RJzz3q2tc9SHK9iStLciA0YYBpBI9pXJ9TIID-xwfuUB9EDsyYG_9ci-2D0hYaXI6ZibBmIsXZ0PP2=w408-h544-k-no',
    kind: 'photo'
  },
  'hongyuantai-dyehouse': {
    sourceUrl: 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=30.740264,120.497389&heading=0&pitch=0&fov=90',
    fallbackImage:
      'https://lh3.googleusercontent.com/gps-cs-s/AHRPTWmG5Zl3IMsO5XyvE2WZRH9fN7_-RoTYLsY8wCp1fUTPENuamqu0RgQpzEdNHNEAFpwHhOsw-oiF-aB10DAO_KPFFzoXFQJDFWkWEpSWpngjVJBJJExzAyGwRpf23P7DHC3Uo6JR=w408-h306-k-no',
    tileToken: GOOGLE_PANO_TILE_TOKENS.dyehouse,
    kind: 'panorama'
  },
  'qiaoli-bridge': {
    sourceUrl: 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=30.742694,120.48796&heading=0&pitch=0&fov=90',
    fallbackImage: googlePanoPreview(GOOGLE_PANO_TILE_TOKENS.qiaoli),
    kind: 'photo'
  },
  'fengyuan-bridge': {
    sourceUrl: 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=30.73932,120.49958&heading=0&pitch=0&fov=90',
    fallbackImage:
      'https://lh3.googleusercontent.com/gps-cs-s/AHRPTWnma5QEBNVGF8wf3D5JbnrBB_CZZhFm3KVOxqaxdF4_3bge_xbtxwIVy00k8nstR3GDs7_rqk12Z2oQatU2A4MERUpSgQEw2yKwLjC1W9uXEAK-8Op1Yqq1tOLQcGkAUZhl15RbjQ=w408-h306-k-no',
    kind: 'photo'
  },
  'old-stage': {
    sourceUrl: 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=30.7409165,120.491204&heading=0&pitch=0&fov=90',
    fallbackImage: googlePanoPreview(GOOGLE_PANO_TILE_TOKENS.maoDun, 1, 1),
    kind: 'photo'
  },
  'tongji-bridge': {
    sourceUrl: 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=30.753479,120.47431&heading=0&pitch=0&fov=90',
    fallbackImage: googlePanoPreview(GOOGLE_PANO_TILE_TOKENS.tongji),
    tileToken: GOOGLE_PANO_TILE_TOKENS.tongji,
    kind: 'panorama'
  },
  'mao-dun-house': {
    sourceUrl: 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=30.739646,120.4895265&heading=0&pitch=0&fov=90',
    fallbackImage: googlePanoPreview(GOOGLE_PANO_TILE_TOKENS.maoDun),
    kind: 'photo'
  },
  'lizhi-academy': {
    sourceUrl: 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=30.741407,120.49437&heading=0&pitch=0&fov=90',
    fallbackImage:
      'https://lh3.googleusercontent.com/gps-cs-s/AHRPTWnpjSNEeMAAZQoJ5gRJnaleo5a5TbdjU-ffJifO0KbUNNnX6EY25_a0Krvhb6D9vSR7nMHtuEPgsPpv3Tfe_VLYQUDl9RKT37ZKaqluilkX1_MdorKfCb69T4b1gg9ovjkLuTJunw=w408-h272-k-no',
    tileToken: GOOGLE_PANO_TILE_TOKENS.lizhi,
    kind: 'panorama'
  },
  'jiangnan-bed-hall': {
    sourceUrl: 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=30.739786,120.498703&heading=0&pitch=0&fov=90',
    fallbackImage:
      'https://lh3.googleusercontent.com/gps-cs-s/AHRPTWmNN6CQUQfQhS78UPQFIr-duzza8DL3K3FwAyx8YMskDc2HYxFY93cvVzCZAHE8lw-H2o2qYUVsgrUyq54U-FCbytmXdS0Oz1wklBVkFVZMVC5aThuq03V0D1d94xhP68ejGdyW=w408-h272-k-no',
    tileToken: GOOGLE_PANO_TILE_TOKENS.bedHall,
    kind: 'panorama'
  }
};

const SCENE_IMAGE_BY_ID = Object.fromEntries(
  Object.entries(SCENIC_MEDIA_BY_ID).map(([id, media]) => [id, media.fallbackImage])
) as Record<string, string>;
const GOOGLE_PANO_MAX_TILE_COLUMNS = 8;
const GOOGLE_PANO_MAX_TILE_ROWS = 4;
const GOOGLE_PANO_TILE_SIZE = 512;

function loadGooglePanoTexture(tileToken: string): Promise<THREE.CanvasTexture> {
  const loader = new THREE.ImageLoader();
  loader.setCrossOrigin('anonymous');
  const tiles = Array.from({ length: GOOGLE_PANO_MAX_TILE_COLUMNS * GOOGLE_PANO_MAX_TILE_ROWS }, (_, index) => {
    const x = index % GOOGLE_PANO_MAX_TILE_COLUMNS;
    const y = Math.floor(index / GOOGLE_PANO_MAX_TILE_COLUMNS);
    const url = `https://lh3.googleusercontent.com/gpms-cs-s/${tileToken}=x${x}-y${y}-z3`;

    return new Promise<{ x: number; y: number; image: HTMLImageElement } | null>((resolve) => {
      loader.load(
        url,
        (image) => {
          resolve({ x, y, image });
        },
        undefined,
        () => resolve(null)
      );
    });
  });

  return Promise.all(tiles).then((loadedTiles) => {
    const validTiles = loadedTiles.filter(
      (tile): tile is { x: number; y: number; image: HTMLImageElement } => tile !== null
    );
    if (validTiles.length === 0) {
      throw new Error('Unable to load any panorama tiles');
    }

    const columns = Math.max(...validTiles.map((tile) => tile.x)) + 1;
    const rows = Math.max(...validTiles.map((tile) => tile.y)) + 1;
    const atlas = document.createElement('canvas');
    atlas.width = columns * GOOGLE_PANO_TILE_SIZE;
    atlas.height = rows * GOOGLE_PANO_TILE_SIZE;
    const context = atlas.getContext('2d');
    if (!context) {
      throw new Error('Unable to create the panorama atlas canvas');
    }
    validTiles.forEach(({ x, y, image }) => {
      context.drawImage(image, x * GOOGLE_PANO_TILE_SIZE, y * GOOGLE_PANO_TILE_SIZE);
    });

    const texture = new THREE.CanvasTexture(atlas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  });
}

function fallbackPanorama(spotId: string): ScenicPanorama {
  const readableName = spotId
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  return {
    id: spotId,
    name: readableName || '乌镇景点',
    englishName: 'WUZHEN SCENIC SPOT',
    zone: '乌镇景区',
    intro: '这是一个可以从水路、街巷和建筑细节进入的乌镇景点。',
    story: '拖动画面环顾四周，选择热点即可查看当前景点的数字导游讲解。',
    duration: '建议停留 30 分钟',
    image: PANORAMA_IMAGE,
    startYaw: 0,
    hotspots: [
      { label: '水乡街巷', detail: '沿着河岸观察屋檐、桥梁和街面之间的关系，可以更快熟悉周边环境。' },
      { label: '建筑细节', detail: '留意门窗、石阶和临水平台，它们共同组成了乌镇日常生活的尺度。' }
    ]
  };
}

type ScenicVRPageProps = {
  spotId: string;
  onBack: () => void;
  onOpenScenic: (spotId: string) => void;
};

export function ScenicVRPage({ spotId, onBack }: ScenicVRPageProps) {
  const stageRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const viewRef = useRef({ yaw: 0, pitch: 0, fov: 70 });
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const panorama = useMemo(
    () => panoramaById.get(PANORAMA_ALIASES[spotId] ?? spotId) ?? fallbackPanorama(spotId),
    [spotId]
  );
  const media = SCENIC_MEDIA_BY_ID[panorama.id] ?? SCENIC_MEDIA_BY_ID['west-gate'];

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) {
      return undefined;
    }
    if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) {
      return undefined;
    }
    if (!media.tileToken) {
      return undefined;
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch {
      return undefined;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(viewRef.current.fov, 1, 0.1, 120);
    cameraRef.current = camera;
    viewRef.current = { yaw: panorama.startYaw, pitch: 0, fov: 70 };

    const geometry = new THREE.SphereGeometry(50, 96, 64);
    let texture: THREE.CanvasTexture | undefined;
    let disposed = false;
    const material = new THREE.MeshBasicMaterial({
      color: 0x24443b,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0
    });
    scene.add(new THREE.Mesh(geometry, material));

    void loadGooglePanoTexture(media.tileToken)
      .then((nextTexture) => {
        if (disposed) {
          nextTexture.dispose();
          return;
        }
        texture = nextTexture;
        material.map = nextTexture;
        material.opacity = 1;
        material.needsUpdate = true;
      })
      .catch(() => undefined);

    const resize = () => {
      const width = Math.max(1, stage.clientWidth);
      const height = Math.max(1, stage.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(stage);
    let animationFrame = 0;
    const renderFrame = () => {
      const view = viewRef.current;
      camera.rotation.order = 'YXZ';
      camera.rotation.set(view.pitch, view.yaw, 0);
      camera.fov = view.fov;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(renderFrame);
    };
    renderFrame();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      texture?.dispose();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      cameraRef.current = null;
    };
  }, [media, panorama]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      viewRef.current.fov = Math.min(92, Math.max(42, viewRef.current.fov + (event.deltaY > 0 ? 4 : -4)));
    };
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, []);

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    viewRef.current.yaw += (event.clientX - drag.x) * 0.004;
    viewRef.current.pitch = Math.max(-1.15, Math.min(1.15, viewRef.current.pitch + (event.clientY - drag.y) * 0.003));
    drag.x = event.clientX;
    drag.y = event.clientY;
  };

  const handlePointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const resetView = () => {
    viewRef.current = { yaw: panorama.startYaw, pitch: 0, fov: 70 };
  };

  const changeFov = (delta: number) => {
    viewRef.current.fov = Math.min(92, Math.max(42, viewRef.current.fov + delta));
  };

  return (
    <main
      ref={stageRef}
      className="scenic-vr-page scenic-vr-page--clean"
      style={{
        backgroundImage: `url(${SCENE_IMAGE_BY_ID[panorama.id] ?? panorama.image})`
      }}
    >
      <nav className="scenic-vr-clean-toolbar" aria-label="VR 全景控制">
        <button type="button" className="scenic-vr-icon-button" onClick={onBack} aria-label="返回景点列表" title="返回景点列表">
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        {media.kind === 'panorama' && (
          <div className="scenic-vr-view-controls" aria-label="视角控制">
            <button type="button" className="scenic-vr-icon-button" onClick={() => changeFov(4)} aria-label="放大视野" title="放大视野">
              <ZoomIn size={18} aria-hidden="true" />
            </button>
            <button type="button" className="scenic-vr-icon-button" onClick={resetView} aria-label="重置视角" title="重置视角">
              <RotateCcw size={18} aria-hidden="true" />
            </button>
            <button type="button" className="scenic-vr-icon-button" onClick={() => changeFov(-4)} aria-label="缩小视野" title="缩小视野">
              <ZoomOut size={18} aria-hidden="true" />
            </button>
          </div>
        )}
      </nav>
      <div className="scenic-vr-mode-badge" aria-label={media.kind === 'panorama' ? '360 度 VR 实景全景' : '真实照片'}>
        <span className="scenic-vr-mode-dot" aria-hidden="true" />
        {media.kind === 'panorama' ? '360° VR 实景' : '真实实景照片'}
      </div>
      {false && (<iframe
        className="scenic-vr-embed"
        title={`${panorama.name} 360 度实景全景`}
        src="about:blank"
        allow="fullscreen; xr-spatial-tracking; gyroscope; accelerometer"
        allowFullScreen
      />)}
      <canvas
        ref={canvasRef}
        className="scenic-vr-canvas scenic-vr-canvas--immersive"
        aria-label={`${panorama.name} 360 度 VR 全景场景`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
      <div className="scenic-vr-clean-brand">
        <strong>乌镇全景</strong>
        <small>WUZHEN / REAL SCENE</small>
        <a
          href={media.sourceUrl}
          target="_blank"
          rel="noreferrer"
        >
          Google Maps 实景来源
        </a>
        <small className="scenic-vr-clean-status">
          {media.kind === 'panorama' ? 'MATCHED 360 SCENE' : 'REAL PHOTO / NO MATCHED 360'}
        </small>
      </div>
      <section className="scenic-vr-clean-copy" aria-labelledby="scenic-vr-title">
        <p>{panorama.zone}</p>
        <h1 id="scenic-vr-title">{panorama.name}</h1>
        <span>{panorama.englishName}</span>
        <div className="scenic-vr-clean-divider" />
        <p>{panorama.intro}</p>
      </section>
    </main>
  );
}
