export type VisitorPanelTab = 'map' | 'routes' | 'services';
export type ExhibitionWeatherMode = 'sunny' | 'night' | 'rain';

export type ScenicMapStop = {
  id: string;
  name: string;
  category: 'entrance' | 'culture' | 'service' | 'food' | 'night';
  x: number;
  y: number;
  zoneId: string;
  detail: string;
};

export type VisitorRoute = {
  id: string;
  name: string;
  duration: string;
  bestTime: string;
  description: string;
  stops: string[];
  zoneId: string;
};

export const SCENIC_MAP_STOPS: ScenicMapStop[] = [
  {
    id: 'xizha-service',
    name: '西栅游客服务中心',
    category: 'service',
    x: 24,
    y: 70,
    zoneId: 'entrance',
    detail: '购票、咨询、导览和行李服务的主要入口。'
  },
  {
    id: 'dongzha-entrance',
    name: '东栅景区入口',
    category: 'entrance',
    x: 76,
    y: 30,
    zoneId: 'global',
    detail: '适合从传统街巷、民居和手工作坊开始游览。'
  },
  {
    id: 'muxin-museum',
    name: '木心美术馆',
    category: 'culture',
    x: 60,
    y: 58,
    zoneId: 'culture',
    detail: '西栅水岸的文化地标，开放安排以馆方公告为准。'
  },
  {
    id: 'blue-print-dyehouse',
    name: '宏源泰染坊',
    category: 'culture',
    x: 42,
    y: 37,
    zoneId: 'global',
    detail: '可观察蓝印花布的制作流程和晾晒场景。'
  },
  {
    id: 'night-river',
    name: '西栅夜游水巷',
    category: 'night',
    x: 50,
    y: 82,
    zoneId: 'interactive',
    detail: '夜间灯影、桥巷和临水建筑集中出现的游览段。'
  },
  {
    id: 'water-market',
    name: '水市口餐饮街',
    category: 'food',
    x: 68,
    y: 78,
    zoneId: 'supporting',
    detail: '可优先寻找面食、地方菜、茶饮和休息座位。'
  }
];

export const VISITOR_ROUTES: VisitorRoute[] = [
  {
    id: 'classic-xizha',
    name: '西栅经典水巷线',
    duration: '约 2.5 小时',
    bestTime: '09:00 - 16:30',
    description: '从游客中心进入，沿水巷、桥梁和文化场馆串联主要景观。',
    stops: ['西栅游客服务中心', '宏源泰染坊', '木心美术馆', '水市口餐饮街'],
    zoneId: 'wuzhen'
  },
  {
    id: 'xizha-night',
    name: '西栅夜游摄影线',
    duration: '约 3 小时',
    bestTime: '16:30 - 21:30',
    description: '先看日落和临水建筑，再把时间留给灯影、桥巷与夜间演艺。',
    stops: ['西栅游客服务中心', '西栅夜游水巷', '水市口餐饮街'],
    zoneId: 'interactive'
  },
  {
    id: 'dongzha-culture',
    name: '东栅人文半日线',
    duration: '约 2.5 小时',
    bestTime: '07:00 - 15:30',
    description: '以传统民居、作坊和生活街巷为主，适合早到慢慢看。',
    stops: ['东栅景区入口', '蓝印花布作坊', '传统水巷街屋'],
    zoneId: 'global'
  }
];

export const VISITOR_HOURS = [
  { label: '西栅景区', value: '常规参考 09:00 - 22:00' },
  { label: '东栅景区', value: '常规参考 07:00 - 17:30' },
  { label: '木心美术馆', value: '常规参考 10:00 - 17:00，周一闭馆' },
  { label: '夜游安排', value: '灯光、演艺和游船以当日公告为准' }
];

export const VISITOR_SERVICES = [
  {
    label: '游客中心与票务',
    detail: '咨询、检票、导览、失物招领和行李服务优先在游客中心确认。',
    icon: 'info'
  },
  {
    label: '餐饮与地方小吃',
    detail: '可留意水市口、临水街区和茶馆；红烧羊肉、白水鱼、姑嫂饼、定胜糕是常见地方风味。',
    icon: 'food'
  },
  {
    label: '卫生间与休息',
    detail: '沿主游线和游客服务点寻找卫生间、座椅及饮水补给，老人和儿童建议预留休息时间。',
    icon: 'rest'
  },
  {
    label: '医疗与应急',
    detail: '突发不适先联系现场工作人员；夜游、雨天和临水区域请按现场安全提示通行。',
    icon: 'medical'
  }
];

export const VISITOR_INFO_NOTE =
  '开放时间、票价、游船和演艺安排会随季节及现场客流调整，请以乌镇旅游官网和景区当天公告为准。';
