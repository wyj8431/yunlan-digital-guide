// 导游黄金用例及规则评分器，用于发现回答质量回归。
export type GuideGoldenCase = {
  name: string;
  message: string;
  includes: string[];
  excludes?: string[];
};

export type GuideGoldenEvaluation = {
  passed: boolean;
  missingIncludes: string[];
  presentExcludes: string[];
};

export type GuideGoldenEvaluationFailure = GuideGoldenEvaluation & {
  name: string;
  message: string;
};

export type GuideGoldenEvaluationSummary = {
  total: number;
  passed: number;
  failed: GuideGoldenEvaluationFailure[];
};

export function evaluateGoldenAnswer(
  goldenCase: GuideGoldenCase,
  answer: string
): GuideGoldenEvaluation {
  const missingIncludes = goldenCase.includes.filter((expected) => !answer.includes(expected));
  const presentExcludes = (goldenCase.excludes ?? []).filter((forbidden) =>
    answer.includes(forbidden)
  );

  return {
    passed: missingIncludes.length === 0 && presentExcludes.length === 0,
    missingIncludes,
    presentExcludes
  };
}

export async function runGoldenEvaluation(
  goldenCases: GuideGoldenCase[],
  answerForMessage: (message: string) => Promise<string>
): Promise<GuideGoldenEvaluationSummary> {
  const failed: GuideGoldenEvaluationFailure[] = [];

  for (const goldenCase of goldenCases) {
    const answer = await answerForMessage(goldenCase.message);
    const evaluation = evaluateGoldenAnswer(goldenCase, answer);

    if (!evaluation.passed) {
      failed.push({
        name: goldenCase.name,
        message: goldenCase.message,
        ...evaluation
      });
    }
  }

  return {
    total: goldenCases.length,
    passed: goldenCases.length - failed.length,
    failed
  };
}

export const offlineDetailedGoldenCases: GuideGoldenCase[] = [
  {
    name: 'generic global destination',
    message: '黄山一日游怎么安排？交通住宿注意事项都说一下',
    includes: ['路线安排', '交通方式', '住宿建议', '注意事项', '官方'],
    excludes: ['接入后台智能体后']
  },
  {
    name: 'international scenic destination',
    message: '富士山一日游怎么安排？交通住宿注意事项都说一下',
    includes: ['富士山', '路线安排', '交通方式'],
    excludes: ['这个目的地建议']
  },
  {
    name: 'specific Huangshan plan',
    message: '黄山一日游怎么安排？交通住宿注意事项都说一下',
    includes: ['云谷索道', '汤口', '换乘中心', '山顶酒店', '官方']
  },
  {
    name: 'specific Mount Fuji plan',
    message: '富士山一日游怎么安排？交通住宿注意事项都说一下',
    includes: ['河口湖', '五合目', '高速巴士', '温泉酒店', '官方']
  },
  {
    name: 'Eiffel Tower landmark plan',
    message: '巴黎埃菲尔铁塔一日游怎么安排？交通住宿注意事项都说一下',
    includes: [
      '埃菲尔铁塔',
      '特罗卡德罗',
      '战神广场',
      '塞纳河',
      '地铁',
      '第七区',
      '路线安排',
      '交通方式',
      '住宿建议',
      '官方'
    ],
    excludes: ['巴黎建议按一日游节奏规划']
  },
  {
    name: 'West Lake plan with city name',
    message: '杭州西湖一日游怎么安排？交通住宿注意事项都说一下',
    includes: ['断桥', '苏堤', '雷峰塔', '地铁', '湖滨', '官方']
  },
  {
    name: 'Forbidden City plan with city name',
    message: '北京故宫一日游怎么安排？交通住宿注意事项都说一下',
    includes: ['午门', '神武门', '中轴线', '地铁', '王府井', '官方']
  },
  {
    name: 'West Lake short name',
    message: '西湖一日游怎么安排？交通住宿注意事项都说一下',
    includes: ['断桥', '苏堤', '湖滨']
  },
  {
    name: 'Forbidden City short name',
    message: '故宫一日游怎么安排？交通住宿注意事项都说一下',
    includes: ['午门', '神武门', '王府井']
  },
  {
    name: 'Zhangjiajie detailed plan',
    message: '张家界三日游路线怎么安排？交通住宿注意事项都说一下',
    includes: ['天门山', '武陵源', '百龙天梯', '张家界西站', '住宿建议', '官方']
  },
  {
    name: 'Jiuzhaigou detailed plan',
    message: '九寨沟两日游交通住宿怎么安排？注意事项也说一下',
    includes: ['沟口', '日则沟', '树正沟', '观光车', '住宿建议', '官方']
  },
  {
    name: 'Great Wall detailed plan',
    message: '北京长城一日游怎么玩？交通住宿注意事项都说一下',
    includes: ['八达岭', '慕田峪', '北京市区', '住宿建议', '官方']
  },
  {
    name: 'Shanghai Disney family plan',
    message: '上海迪士尼亲子游怎么玩？交通住宿注意事项都说一下',
    includes: ['飞跃地平线', '11 号线', '玩具总动员酒店', '烟花', '官方']
  },
  {
    name: 'Universal Beijing detailed plan',
    message: '北京环球影城一日游路线怎么安排？交通住宿注意事项都说一下',
    includes: ['哈利波特', '侏罗纪', '环球度假区站', '优速通', '官方']
  },
  {
    name: 'Louvre half day plan',
    message: '巴黎卢浮宫半日游怎么安排？交通住宿注意事项都说一下',
    includes: ['玻璃金字塔', '蒙娜丽莎', '地铁', '住宿建议', '官方']
  }
];
