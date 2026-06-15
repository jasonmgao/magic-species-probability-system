/**
 * 蒙特卡洛模拟引擎（自由组合版）
 *
 * 特性：
 * 1. 组合完全自由，每张卡数量任意配置
 * 2. 自动计算降权系数，控制中奖率≈4%
 */

import type {
  Combination,
  CardSetup,
  CoefficientSet,
  BackpackState,
  SingleStateResult,
  FullSimulationResult,
} from '@/types';

const ALL_CARDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

// 背包状态配置
export const BACKPACK_STATES: BackpackState[] = [
  {
    state: 'empty',
    label: '全新用户',
    description: '所有卡片0张',
    initialBag: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0, I: 0, J: 0 },
  },
  {
    state: 'need3',
    label: '缺3张（第一套）',
    description: '第一套组合卡各1张',
    initialBag: { A: 1, B: 1, C: 1, D: 0, E: 0, F: 0, G: 0, H: 0, I: 0, J: 0 },
  },
  {
    state: 'need2',
    label: '缺2张（第一套）',
    description: '第一套部分完成',
    initialBag: { A: 2, B: 1, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0, I: 0, J: 0 },
  },
  {
    state: 'need1',
    label: '缺1张（第一套）',
    description: '第一套即将完成',
    initialBag: { A: 2, B: 2, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0, I: 0, J: 0 },
  },
  {
    state: 'complete',
    label: '第一套完成',
    description: '第一套已完成，开始第二套',
    initialBag: { A: 2, B: 2, C: 2, D: 0, E: 0, F: 0, G: 0, H: 0, I: 0, J: 0 },
  },
];

/**
 * 运行完整模拟（所有背包状态）
 */
export function runFullSimulation(
  setup: CardSetup,
  targetRate: number = 4.0,
  trials: number = 10000
): FullSimulationResult {
  const results: SingleStateResult[] = [];

  for (const backpack of BACKPACK_STATES) {
    // 寻找最优降权系数
    const coefficients = findOptimalCoefficients(setup, backpack, targetRate, trials);

    // 运行模拟
    const result = simulateState(setup, backpack, coefficients, trials);
    results.push(result);
  }

  // 找到全收集率最高的状态
  const bestState = results.reduce((best, current) =>
    current.fullCollectionRate > best.fullCollectionRate ? current : best,
    results[0]
  );

  return { stateResults: results, bestState };
}

/**
 * 寻找最优降权系数（使中奖率≈4%）
 */
function findOptimalCoefficients(
  setup: CardSetup,
  backpack: BackpackState,
  targetRate: number,
  trials: number
): CoefficientSet {
  // 获取所有组合中使用的卡片及其最大需求数量
  const cardMaxNeeds: Record<string, number> = {};
  for (const combo of setup.combinations) {
    for (const req of combo.requirements) {
      cardMaxNeeds[req.cardId] = Math.max(
        cardMaxNeeds[req.cardId] || 0,
        req.count
      );
    }
  }

  // 初始化系数
  const baseCoeffs: CoefficientSet = {};
  for (const card of ALL_CARDS) {
    const maxNeed = cardMaxNeeds[card] || 1;
    baseCoeffs[card] = [];
    for (let i = 0; i <= maxNeed; i++) {
      if (i === 0) baseCoeffs[card].push(1.0);
      else if (i < maxNeed) baseCoeffs[card].push(0.02);
      else baseCoeffs[card].push(0);
    }
  }

  // 只优化有需求的卡片
  const comboCards = Object.keys(cardMaxNeeds);
  if (comboCards.length === 0) return baseCoeffs;

  let bestError = Infinity;
  let bestCoeffs = JSON.parse(JSON.stringify(baseCoeffs));

  // 简单网格搜索：主要调整各卡的第1张之后的系数
  // 为简化，使用统一的系数调整策略
  for (let factor = 0.001; factor <= 0.1; factor += 0.002) {
    const testCoeffs: CoefficientSet = JSON.parse(JSON.stringify(baseCoeffs));

    // 调整组合卡的系数
    for (const card of comboCards) {
      const maxNeed = cardMaxNeeds[card];
      for (let i = 1; i < maxNeed; i++) {
        // 渐进降权：第1张后系数为factor，第2张后系数为factor/2，依此类推
        testCoeffs[card][i] = factor / i;
      }
      testCoeffs[card][maxNeed] = 0; // 达到需求数量后不再掉落
    }

    // 快速测试
    const result = simulateState(setup, backpack, testCoeffs, 2000);

    // 计算误差
    let totalError = 0;
    for (const combo of setup.combinations) {
      const rate = result.combinationRates[combo.name] || 0;
      totalError += Math.abs(rate - targetRate);
    }

    if (totalError < bestError) {
      bestError = totalError;
      bestCoeffs = testCoeffs;
    }
  }

  return bestCoeffs;
}

/**
 * 对单个背包状态运行模拟
 */
function simulateState(
  setup: CardSetup,
  backpack: BackpackState,
  coefficients: CoefficientSet,
  trials: number
): SingleStateResult {
  let fullCollectionCount = 0;
  const comboSuccessCounts: Record<string, number> = {};
  for (const combo of setup.combinations) {
    comboSuccessCounts[combo.name] = 0;
  }

  for (let i = 0; i < trials; i++) {
    const result = simulateOneRound(setup, backpack.initialBag, coefficients);
    if (result.fullCollection) fullCollectionCount++;
    for (const [name, success] of Object.entries(result.comboSuccess)) {
      if (success) comboSuccessCounts[name]++;
    }
  }

  const combinationRates: Record<string, number> = {};
  for (const combo of setup.combinations) {
    combinationRates[combo.name] = (comboSuccessCounts[combo.name] / trials) * 100;
  }

  return {
    state: backpack.state,
    label: backpack.label,
    description: backpack.description,
    coefficients,
    fullCollectionRate: (fullCollectionCount / trials) * 100,
    combinationRates,
  };
}

/**
 * 单次游戏模拟
 */
function simulateOneRound(
  setup: CardSetup,
  initialBag: Record<string, number>,
  coefficients: CoefficientSet
): { fullCollection: boolean; comboSuccess: Record<string, boolean> } {
  const bag: Record<string, number> = { ...initialBag };
  const comboSuccess: Record<string, boolean> = {};
  for (const combo of setup.combinations) {
    comboSuccess[combo.name] = false;
  }

  // 生成14天日程
  const schedule = generateSchedule();

  for (let day = 1; day <= 14; day++) {
    const dayInfo = schedule[day - 1];

    // 每天4次抽卡
    for (let draw = 0; draw < 4; draw++) {
      const card = drawCard(bag, dayInfo, coefficients);
      if (card) bag[card]++;
    }

    // 检查组合完成情况
    for (const combo of setup.combinations) {
      if (!comboSuccess[combo.name] && day <= combo.deadline) {
        const isComplete = combo.requirements.every(req =>
          (bag[req.cardId] || 0) >= req.count
        );
        if (isComplete) comboSuccess[combo.name] = true;
      }
    }
  }

  const fullCollection = ALL_CARDS.every(c => (bag[c] || 0) >= 1);
  return { fullCollection, comboSuccess };
}

/**
 * 抽卡
 */
function drawCard(
  bag: Record<string, number>,
  dayInfo: { dayType: string; luckyCard: string },
  coefficients: CoefficientSet
): string | null {
  // 基础概率
  const probs = getBaseProbs(dayInfo.dayType);

  // 设置幸运卡
  probs[dayInfo.luckyCard] = 1.2;

  // 应用降权系数
  for (const card of ALL_CARDS) {
    const count = bag[card] || 0;
    const coeffList = coefficients[card] || [1, 0];
    const coeff = count < coeffList.length ? coeffList[count] : 0;
    probs[card] *= coeff;
  }

  // 归一化
  const total = Object.values(probs).reduce((a, b) => a + b, 0);
  if (total <= 0) return 'A';

  for (const card of ALL_CARDS) {
    probs[card] = (probs[card] / total) * 100;
  }

  // 轮盘赌
  const r = Math.random() * 100;
  let sum = 0;
  for (const [card, prob] of Object.entries(probs)) {
    sum += prob;
    if (r < sum) return card;
  }
  return 'A';
}

/**
 * 获取基础概率
 */
function getBaseProbs(dayType: string): Record<string, number> {
  const p: Record<string, number> = {};

  switch (dayType) {
    case 'COMMON':
      p['A'] = 2.30;
      ['B', 'C', 'D', 'E'].forEach(c => p[c] = 8.04);
      ['F', 'G', 'H', 'I', 'J'].forEach(c => p[c] = 16.08);
      break;
    case 'RARE':
      p['A'] = 2.12;
      ['B', 'C', 'D', 'E'].forEach(c => p[c] = 7.44);
      ['F', 'G', 'H', 'I', 'J'].forEach(c => p[c] = 14.87);
      break;
    case 'MAGIC':
      p['A'] = 0;
      ['B', 'C', 'D', 'E'].forEach(c => p[c] = 7.06);
      ['F', 'G', 'H', 'I', 'J'].forEach(c => p[c] = 14.11);
      break;
  }

  return p;
}

/**
 * 生成14天日程
 */
function generateSchedule(): Array<{ dayType: string; luckyCard: string }> {
  const template = ['COMMON', 'COMMON', 'COMMON', 'COMMON', 'COMMON', 'RARE', 'MAGIC'];

  const shuffle = (arr: string[]) => {
    const r = [...arr];
    for (let i = r.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [r[i], r[j]] = [r[j], r[i]];
    }
    return r;
  };

  const w1 = shuffle(template);
  const w2 = shuffle(template);

  const days: Array<{ dayType: string; luckyCard: string }> = [];

  const getLucky = (t: string): string => {
    switch (t) {
      case 'MAGIC': return 'A';
      case 'RARE': return ['B', 'C', 'D', 'E'][Math.floor(Math.random() * 4)];
      case 'COMMON': return ['F', 'G', 'H', 'I', 'J'][Math.floor(Math.random() * 5)];
    }
    return 'A';
  };

  for (const t of [...w1, ...w2]) {
    days.push({ dayType: t, luckyCard: getLucky(t) });
  }

  return days;
}
