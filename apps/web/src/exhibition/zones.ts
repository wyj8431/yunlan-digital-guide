export type HallZoneId = 'entrance' | 'history' | 'architecture' | 'heritage' | 'future';

export type HallZone = {
  id: HallZoneId;
  title: string;
  subtitle: string;
  color: string;
  position: [number, number, number];
};

export const HALL_ZONES: HallZone[] = [
  { id: 'entrance', title: '数字入口大厅', subtitle: 'DIGITAL ATRIUM', color: '#d9b76d', position: [0, 0, 11.2] },
  { id: 'history', title: '乌镇历史文化馆', subtitle: 'HISTORY ARCHIVE', color: '#b8d6c6', position: [-11.25, 0, -17.6] },
  { id: 'architecture', title: '江南建筑数字馆', subtitle: 'JIANGNAN ARCHITECTURE', color: '#d7c29b', position: [-3.75, 0, -17.6] },
  { id: 'heritage', title: '非遗文化体验馆', subtitle: 'INTANGIBLE HERITAGE', color: '#d58b72', position: [3.75, 0, -17.6] },
  { id: 'future', title: '元宇宙乌镇未来馆', subtitle: 'FUTURE WUZHEN', color: '#b9a6e8', position: [11.25, 0, -17.6] }
];
