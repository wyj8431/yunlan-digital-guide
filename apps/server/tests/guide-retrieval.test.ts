import { describe, expect, it } from 'vitest';
import { loadScenicData } from '../src/modules/scenic/scenic-data';
import {
  formatGuideKnowledgeContext,
  retrieveGuideKnowledge
} from '../src/modules/guide/guide-retrieval';

describe('guide retrieval', () => {
  it('returns no knowledge for generic image-analysis wording without a destination clue', () => {
    const results = retrieveGuideKnowledge(
      '帮我分析图片中的内容，并推荐对应的景点',
      loadScenicData()
    );

    expect(results).toEqual([]);
  });

  it('retrieves destination guide data by aliases', () => {
    const results = retrieveGuideKnowledge('上海迪士尼亲子游怎么玩？', loadScenicData());

    expect(results[0]).toMatchObject({
      source: 'destination-knowledge',
      title: '上海迪士尼度假区'
    });
    expect(results[0].content).toContain('飞跃地平线');
    expect(results[0].content).toContain('票务和开放时间核验');
  });

  it('retrieves local scenic data from the built-in Wuzhen dataset', () => {
    const results = retrieveGuideKnowledge('乌镇木心美术馆适合安排多久？', loadScenicData());

    expect(results[0]).toMatchObject({
      source: 'local-scenic',
      title: '木心美术馆'
    });
    expect(results[0].content).toContain('60 分钟');
  });

  it('formats retrieved documents as grounded prompt context', () => {
    const results = retrieveGuideKnowledge('九寨沟两日游怎么安排？', loadScenicData(), 1);
    const context = formatGuideKnowledgeContext(results);

    expect(context).toContain('检索到的景区知识库上下文');
    expect(context).toContain('九寨沟');
    expect(context).toContain('日则沟');
    expect(context).toContain('官方');
  });

  it('retrieves concrete Shanxi recommendations for a province question', () => {
    const results = retrieveGuideKnowledge('推荐一下山西有什么好玩的景区', loadScenicData());

    expect(results[0]).toMatchObject({
      title: '山西旅游推荐',
      source: 'destination-knowledge'
    });
    expect(results[0].content).toContain('平遥古城');
    expect(results[0].content).toContain('云冈石窟');
    expect(results[0].content).toContain('五台山');
    expect(results[0].content).toContain('晋祠');
    expect(results[0].content).toContain('壶口瀑布');
    expect(results[0].content).toContain('悬空寺');
    expect(results).toHaveLength(1);
  });

  it('retrieves an attraction and its province overview together', () => {
    const results = retrieveGuideKnowledge('察尔汗盐湖适合什么时候去？', loadScenicData());

    expect(results[0]).toMatchObject({
      title: '察尔汗盐湖（青海·海西）',
      source: 'destination-knowledge'
    });
    expect(results.map((item) => item.title)).toContain('青海旅游推荐');
  });
});
