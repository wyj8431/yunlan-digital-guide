# National Province Tourism Knowledge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a structured tourism knowledge base covering all 34 provincial-level regions with 12-20 concrete attractions per region and grounded province-level recommendations.

**Architecture:** Store province tourism facts in four regional data modules and aggregate them through one typed index. Extend the existing retrieval layer with province overview and attraction documents, then expose province catalog APIs and strengthen the guide prompt so province questions produce named places and routes instead of generic templates.

**Tech Stack:** TypeScript, Koa, Vitest, existing guide retrieval and chat service modules.

---

## File Map

- Create `apps/server/src/modules/guide/province-tourism.types.ts`: shared province and attraction types.
- Create `apps/server/src/modules/guide/province-tourism-north-east.ts`: Beijing, Tianjin, Hebei, Shanxi, Inner Mongolia, Liaoning, Jilin, Heilongjiang.
- Create `apps/server/src/modules/guide/province-tourism-east.ts`: Shanghai, Jiangsu, Zhejiang, Anhui, Fujian, Jiangxi, Shandong.
- Create `apps/server/src/modules/guide/province-tourism-central-south.ts`: Henan, Hubei, Hunan, Guangdong, Guangxi, Hainan, Hong Kong, Macau, Taiwan.
- Create `apps/server/src/modules/guide/province-tourism-west.ts`: Chongqing, Sichuan, Guizhou, Yunnan, Tibet, Shaanxi, Gansu, Qinghai, Ningxia, Xinjiang.
- Create `apps/server/src/modules/guide/province-tourism-data.ts`: aggregate and query all province records.
- Create `apps/server/tests/province-tourism-data.test.ts`: completeness and data-quality tests.
- Modify `apps/server/src/modules/guide/guide-retrieval.ts`: index province overviews and attraction documents.
- Modify `apps/server/tests/guide-retrieval.test.ts`: province and attraction retrieval regressions.
- Modify `apps/server/src/modules/guide/guide.routes.ts`: province catalog endpoints.
- Modify `apps/server/tests/api.test.ts`: catalog endpoint coverage.
- Modify `apps/server/src/modules/guide/guide.service.ts`: concrete province recommendation rules.
- Modify `apps/server/tests/guide.service.test.ts`: prompt and grounded-answer context coverage.

### Task 1: Typed Province Dataset

**Files:**

- Create: `apps/server/src/modules/guide/province-tourism.types.ts`
- Create: `apps/server/src/modules/guide/province-tourism-north-east.ts`
- Create: `apps/server/src/modules/guide/province-tourism-east.ts`
- Create: `apps/server/src/modules/guide/province-tourism-central-south.ts`
- Create: `apps/server/src/modules/guide/province-tourism-west.ts`
- Create: `apps/server/src/modules/guide/province-tourism-data.ts`
- Test: `apps/server/tests/province-tourism-data.test.ts`

- [ ] **Step 1: Write the failing completeness test**

```ts
import { describe, expect, it } from 'vitest';
import { provinceTourismRecords } from '../src/modules/guide/province-tourism-data';

const expectedRegions = [
  '北京',
  '天津',
  '河北',
  '山西',
  '内蒙古',
  '辽宁',
  '吉林',
  '黑龙江',
  '上海',
  '江苏',
  '浙江',
  '安徽',
  '福建',
  '江西',
  '山东',
  '河南',
  '湖北',
  '湖南',
  '广东',
  '广西',
  '海南',
  '重庆',
  '四川',
  '贵州',
  '云南',
  '西藏',
  '陕西',
  '甘肃',
  '青海',
  '宁夏',
  '新疆',
  '香港',
  '澳门',
  '台湾'
];

it('covers every provincial-level region with dense attraction data', () => {
  expect(provinceTourismRecords.map((record) => record.province).sort()).toEqual(
    [...expectedRegions].sort()
  );
  for (const record of provinceTourismRecords) {
    expect(record.highlights.length).toBeGreaterThanOrEqual(12);
    expect(record.highlights.length).toBeLessThanOrEqual(20);
    expect(new Set(record.highlights.map((spot) => spot.name)).size).toBe(record.highlights.length);
    expect(record.routes.length).toBeGreaterThanOrEqual(2);
    for (const spot of record.highlights) {
      expect(spot.city.trim()).not.toBe('');
      expect(spot.categories.length).toBeGreaterThan(0);
      expect(spot.recommendation.length).toBeGreaterThanOrEqual(8);
    }
  }
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm --workspace apps/server test -- --run tests/province-tourism-data.test.ts`

Expected: FAIL because `province-tourism-data` does not exist.

- [ ] **Step 3: Define the shared data contract**

```ts
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
```

- [ ] **Step 4: Add all 34 province records**

Create four regional modules. Each region must contain 15 highlights so the completed dataset has 510 places. Every highlight uses a real attraction or destination name, its city/prefecture, 1-3 categories, and a specific recommendation. Each province record also contains at least two named multi-city routes and non-empty transport, stay, season, and tips text.

Use this exact object shape for every record:

```ts
{
  province: '山西',
  aliases: ['山西省', '晋'],
  summary: '山西适合围绕古建、石窟、晋商古城和太行山水安排跨城市旅行。',
  highlights: [
    { name: '平遥古城', city: '晋中', categories: ['古城', '晋商文化'], recommendation: '城墙、票号和传统街巷集中，适合住一晚看早晚古城。' },
    { name: '云冈石窟', city: '大同', categories: ['石窟', '世界遗产'], recommendation: '北魏造像规模宏大，可与大同古城和华严寺组成一日线。' },
    { name: '五台山', city: '忻州', categories: ['名山', '佛教文化'], recommendation: '寺院群密集，适合安排两天并关注山区天气。' }
  ],
  routes: ['晋北 3 日：大同古城—云冈石窟—恒山悬空寺—应县木塔。', '晋中晋南 4 日：太原晋祠—平遥古城—王家大院—壶口瀑布。'],
  transport: '省内跨城优先使用高铁和正规旅游专线，山区景点预留公路换乘时间。',
  stay: '首次到访可按太原、大同、平遥分段住宿，减少往返。',
  season: '春秋适合古建和古城旅行，夏季适合太行山，冬季注意山区道路。',
  tips: '古建和彩塑参观遵守场馆规定，票务、预约和开放区域以官方当天公告为准。'
}
```

The Shanxi module must additionally include 晋祠、壶口瀑布、悬空寺、应县木塔、王家大院、乔家大院、雁门关、皇城相府、太行山大峡谷、芦芽山、洪洞大槐树、绵山. Other provinces follow the same specificity and density.

- [ ] **Step 5: Add the aggregator and lookup helpers**

```ts
export const provinceTourismRecords = [
  ...northEastProvinceTourismRecords,
  ...eastProvinceTourismRecords,
  ...centralSouthProvinceTourismRecords,
  ...westProvinceTourismRecords
];

export function findProvinceTourismRecord(name: string) {
  const normalized = name.trim();
  return (
    provinceTourismRecords.find(
      (record) => record.province === normalized || record.aliases.includes(normalized)
    ) ?? null
  );
}
```

- [ ] **Step 6: Run the completeness test and verify GREEN**

Run: `npm --workspace apps/server test -- --run tests/province-tourism-data.test.ts`

Expected: PASS with 34 regions and 510 highlights.

- [ ] **Step 7: Commit the dataset**

```powershell
git add -- apps/server/src/modules/guide/province-tourism*.ts apps/server/tests/province-tourism-data.test.ts
git commit -m "feat: add national province tourism dataset"
```

### Task 2: Province and Attraction Retrieval

**Files:**

- Modify: `apps/server/src/modules/guide/guide-retrieval.ts`
- Test: `apps/server/tests/guide-retrieval.test.ts`

- [ ] **Step 1: Write failing retrieval tests**

```ts
it('retrieves concrete Shanxi recommendations for a province question', () => {
  const results = retrieveGuideKnowledge('推荐一下山西有什么好玩的景区', loadScenicData());
  expect(results[0]).toMatchObject({ title: '山西旅游推荐', source: 'destination-knowledge' });
  expect(results[0].content).toContain('平遥古城');
  expect(results[0].content).toContain('云冈石窟');
  expect(results[0].content).toContain('五台山');
  expect(results[0].content).toContain('晋祠');
});

it('retrieves an attraction and its province overview together', () => {
  const results = retrieveGuideKnowledge('察尔汗盐湖适合什么时候去？', loadScenicData());
  expect(results[0].title).toContain('察尔汗盐湖');
  expect(results.map((item) => item.title)).toContain('青海旅游推荐');
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `npm --workspace apps/server test -- --run tests/guide-retrieval.test.ts`

Expected: FAIL because province documents are not indexed.

- [ ] **Step 3: Build province overview and attraction documents**

Add `buildProvinceTourismDocuments()` to produce:

```ts
{
  id: `province:${record.province}`,
  title: `${record.province}旅游推荐`,
  source: 'destination-knowledge',
  content: formatProvinceTourismRecord(record),
  keywords: [record.province, ...record.aliases]
}
```

For each highlight, also produce `province-spot:${province}:${name}` with keywords containing the attraction, city, province, and categories. When an exact attraction name appears, add a score bonus and include its province overview in the final limited result set.

- [ ] **Step 4: Add national recommendation diversity**

For messages containing `全国`, `各省`, or `国内推荐`, return representative province overviews across north, east, central-south, and west rather than alphabetical records from one region.

- [ ] **Step 5: Run retrieval and existing guide tests**

Run: `npm --workspace apps/server test -- --run tests/guide-retrieval.test.ts tests/guide-knowledge.test.ts`

Expected: PASS, including existing Wuzhen and international destination retrieval.

- [ ] **Step 6: Commit retrieval support**

```powershell
git add -- apps/server/src/modules/guide/guide-retrieval.ts apps/server/tests/guide-retrieval.test.ts
git commit -m "feat: retrieve province and attraction knowledge"
```

### Task 3: Province Catalog API

**Files:**

- Modify: `apps/server/src/modules/guide/guide.routes.ts`
- Test: `apps/server/tests/api.test.ts`

- [ ] **Step 1: Write failing API tests**

```ts
it('lists all province tourism catalogs and returns province details', async () => {
  const app = createApp();
  const list = await request(app.callback()).get('/api/provinces').expect(200);
  expect(list.body.provinces).toHaveLength(34);
  expect(list.body.provinces.find((item: { name: string }) => item.name === '山西').spotCount).toBe(
    15
  );

  await request(app.callback())
    .get(`/api/provinces/${encodeURIComponent('山西')}`)
    .expect(200)
    .expect(({ body }) => {
      expect(body.highlights).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: '平遥古城' })])
      );
    });
});
```

- [ ] **Step 2: Run the API test and verify RED**

Run: `npm --workspace apps/server test -- --run tests/api.test.ts`

Expected: FAIL with 404 for `/api/provinces`.

- [ ] **Step 3: Add catalog routes**

Add `GET /api/provinces` returning `name`, `summary`, `spotCount`, and the first six highlight names. Add `GET /api/provinces/:province` using `findProvinceTourismRecord`; return `404` with `{ code: 'PROVINCE_NOT_FOUND', message: '没有找到这个省份的旅游资料。' }` when unmatched.

- [ ] **Step 4: Run API tests and verify GREEN**

Run: `npm --workspace apps/server test -- --run tests/api.test.ts`

Expected: PASS for list, detail, and existing API tests.

- [ ] **Step 5: Commit API support**

```powershell
git add -- apps/server/src/modules/guide/guide.routes.ts apps/server/tests/api.test.ts
git commit -m "feat: expose province tourism catalog API"
```

### Task 4: Concrete Province Answer Rules

**Files:**

- Modify: `apps/server/src/modules/guide/guide.service.ts`
- Test: `apps/server/tests/guide.service.test.ts`

- [ ] **Step 1: Write a failing prompt test**

```ts
it('requires concrete named attractions for province recommendation questions', async () => {
  const chat = vi
    .fn()
    .mockResolvedValue('山西可去平遥古城、云冈石窟、五台山、晋祠、壶口瀑布和悬空寺。');
  await createGuideResponse({ message: '推荐一下山西有什么好玩的景区', env: llmEnv, chat });
  const messages = chat.mock.calls[0][0];
  const system = messages.find((message: { role: string }) => message.role === 'system').content;
  expect(system).toContain('至少列出 6 个具体景点');
  expect(system).toContain('平遥古城');
  expect(system).toContain('云冈石窟');
});
```

- [ ] **Step 2: Run the prompt test and verify RED**

Run: `npm --workspace apps/server test -- --run tests/guide.service.test.ts -t "requires concrete named attractions"`

Expected: FAIL because the rule does not exist.

- [ ] **Step 3: Add the province recommendation rule**

Add this system instruction adjacent to the existing regional recommendation rule:

```ts
'用户询问某省份有什么好玩、景区推荐或旅游目的地时，必须优先依据检索上下文，至少列出 6 个具体景点及所在城市，逐项说明推荐理由，并给出一条跨城市路线；禁止只写“上午核心景区、下午拍照、傍晚返程”等无具体地名的通用模板。';
```

- [ ] **Step 4: Run service tests and verify GREEN**

Run: `npm --workspace apps/server test -- --run tests/guide.service.test.ts`

Expected: PASS without changing image-only or document-only response rules.

- [ ] **Step 5: Commit answer quality rules**

```powershell
git add -- apps/server/src/modules/guide/guide.service.ts apps/server/tests/guide.service.test.ts
git commit -m "fix: require concrete province travel recommendations"
```

### Task 5: End-to-End Verification

**Files:**

- Modify only if verification reveals a task-scoped defect.

- [ ] **Step 1: Run all server tests**

Run: `npm --workspace apps/server test`

Expected: all server test files pass.

- [ ] **Step 2: Run the full project test suite and build**

Run: `npm test`

Expected: exit code 0.

Run: `npm run build`

Expected: both server TypeScript build and web Vite build exit with code 0.

- [ ] **Step 3: Verify representative retrieval API calls**

Request `/api/guide/retrieval?query=推荐一下山西有什么好玩的景区` and verify the context includes at least 平遥古城、云冈石窟、五台山、晋祠、壶口瀑布、悬空寺. Repeat with 广东、新疆、西藏、香港、澳门、台湾.

- [ ] **Step 4: Verify real chat behavior in the browser**

Ask `推荐一下山西有什么好玩的景区` from the main chat. Verify the answer names at least six specific places with cities and a route, the source chips include `山西旅游推荐`, the chat remains scrollable, and the answer export menu remains usable.

- [ ] **Step 5: Check formatting and final diff**

Run: `git diff --check`

Expected: no whitespace errors.
