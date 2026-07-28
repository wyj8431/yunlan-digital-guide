export type ProvinceTourismHighlight = {
  name: string;
  city: string;
  categories: string[];
  recommendation: string;
};

export type ProvinceTourismRecord = {
  province: string;
  aliases: string[];
  summary: string;
  highlights: ProvinceTourismHighlight[];
  routes: string[];
  transport: string;
  stay: string;
  season: string;
  tips: string;
};

export type ProvinceTourismSeed = {
  province: string;
  aliases: string[];
  theme: string;
  highlights: Array<[name: string, city: string, categories: string]>;
  routes: [string, string, ...string[]];
  transport?: string;
  stay?: string;
  season?: string;
  tips?: string;
};

export function createProvinceTourismRecord(seed: ProvinceTourismSeed): ProvinceTourismRecord {
  return {
    province: seed.province,
    aliases: seed.aliases,
    summary: `${seed.province}适合围绕${seed.theme}安排跨城市旅行，既可串联代表景点，也可按自然、人文或亲子主题深度游览。`,
    highlights: seed.highlights.map(([name, city, categories]) => ({
      name,
      city,
      categories: categories.split('、'),
      recommendation: `${name}是${city}具有代表性的${categories}目的地，适合按兴趣加入${seed.province}行程。`
    })),
    routes: seed.routes,
    transport:
      seed.transport ??
      `${seed.province}省内跨城优先组合高铁、城际铁路和正规旅游专线，山区或郊野景点要预留公路换乘时间。`,
    stay:
      seed.stay ??
      `首次到访建议选择省会或核心旅游城市分段住宿，再以一日游方式覆盖周边景点，减少重复往返。`,
    season:
      seed.season ?? `春秋通常更适合城市与户外行程，夏冬出发前应关注当地天气、道路和景区开放情况。`,
    tips:
      seed.tips ??
      `热门景点尽量提前预约；门票、开放时间、交通班次和临时管控以各景区官方当天公告为准。`
  };
}
