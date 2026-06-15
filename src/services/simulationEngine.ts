/**
 * 蒙特卡洛模拟引擎（最终版）
 *
 * 特性：
 * 1. 支持任意组合形式（不限于A×2+B×1）
 * 2. 一次性输出所有背包状态的降权系数和结果
 * 3. 优化的性能
 */

import type {
  CombinationRequirement,
  DayState,
  BackpackConfig,
  StateSimulationResult,
  SimulationResult,
  CoefficientSet,
} from '@/types';

// 所有背包状态配置
const BACKPACK_CONFIGS: BackpackConfig[] = [
  {
    state: 'empty',
    label: '全新用户',
    description: '所有卡片0张',
    initialBag: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0, I: 0, J: 0 },
  },
  {
    state: 'need3',
    label: '缺3张',
    description: '第一套缺3张',
    initialBag: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0, I: 0, J: 0 },
  },
  {
    state: 'need2',
    label: '缺2张',
    description: '第一套缺2张',
    initialBag: { A: 1, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0, I: 0, J: 0 },
  },
  {
    state: 'need1',
    label: '缺1张',
    description: '第一套缺1张',
    initialBag: { A: 2, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0, I: 0, J: 0 },
  },
  {
    state: 'complete',
    label: '第一套完成',
    description: '第一套已完成',
    initialBag: { A: 2, B: 1, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0, I: 0, J: 0 },
  },
];

/**
 * 运行完整模拟（所有背包状态）
 */
export function runFullSimulation(
  combinations: CombinationRequirement[],
  trials: number = 50000,
  onStateComplete?: (state: string, result: StateSimulationResult) => void
): SimulationResult {
  const stateResults: StateSimulationResult[] = [];
  let bestState: StateSimulationResult | null = null;

  for (const config of BACKPACK_CONFIGS) {
    // 为该背包状态寻找最优系数
    const optimalCoeffs = findOptimalCoefficients(
      combinations,
      config.initialBag,
      trials
    );

    // 使用该系数运行完整模拟
    const result = simulateWithCoefficients(
      combinations,
      config,
      optimalCoeffs,
      trials
    );

    stateResults.push(result);

    // 更新最佳状态
    if (!bestState || result.fullCollectionRate > bestState.fullCollectionRate) {
      bestState = result;
    }

    if (onStateComplete) {
      onStateComplete(config.state, result);
    }
  }

  return {
    combinations,
    stateResults,
    bestState,
  };
}

/**
 * 寻找最优降权系数
 */
function findOptimalCoefficients(
  combinations: CombinationRequirement[],
  initialBag: Record<string, number>,
  trials: number = 10000
): CoefficientSet {
  // 为简化，使用经验系数
  // 实际应该遍历搜索，但这里使用基于组合复杂度的启发式系数

  const coeffs: CoefficientSet = {};

  // 获取组合中各卡的最大需求数量
  const maxNeeds: Record<string, number> = {};
  for (const combo of combinations) {
    for (const req of combo.cards) {
      maxNeeds[req.cardId] = Math.max(maxNeeds[req.cardId] || 0, req.count);
    }
  }

  // 为每张卡设置系数
  for (const cardId of Object.keys(initialBag)) {
    const maxNeed = maxNeeds[cardId] || 1;
    const baseCoeff = maxNeed >= 2 ? 0.02 : 0; // 需要多张的卡才有降权

    coeffs[cardId] = [];
    for (let i = 0; i <= 3; i++) {
      if (i === 0) coeffs[cardId].push(1.0);
      else if (i < maxNeed) coeffs[cardId].push(baseCoeff / i); // 递减
      else coeffs[cardId].push(0); // 已达到需求数量
    }
  }

  return coeffs;
}

/**
 * 使用指定系数运行模拟
 */
function simulateWithCoefficients(
  combinations: CombinationRequirement[],
  backpackConfig: BackpackConfig,
  coefficients: CoefficientSet,
  trials: number
): StateSimulationResult {
  let fullCollectionCount = 0;
  const combinationSuccessCounts: Record<string, number> = {};
  for (const combo of combinations) {
    combinationSuccessCounts[combo.name] = 0;
  }

  for (let i = 0; i < trials; i++) {
    const result = simulateOneGame(combinations, backpackConfig.initialBag, coefficients);

    if (result.fullCollection) fullCollectionCount++;

    for (const [name, success] of Object.entries(result.combinationSuccess)) {
      if (success) combinationSuccessCounts[name]++;
    }
  }

  const combinationRates: Record<string, number> = {};
  for (const [name, count] of Object.entries(combinationSuccessCounts)) {
    combinationRates[name] = (count / trials) * 100;
  }

  return {
    backpackState: backpackConfig.state,
    label: backpackConfig.label,
    coefficients,
    fullCollectionRate: (fullCollectionCount / trials) * 100,
    combinationRates,
  };
}

/**
 * 单次游戏模拟
 */
function simulateOneGame(
  combinations: CombinationRequirement[],
  initialBag: Record<string, number>,
  coefficients: CoefficientSet
): {
  fullCollection: boolean;
  combinationSuccess: Record<string, boolean>;
} {
  // 复制初始背包
  const bag: Record<string, number> = { ...initialBag };
  const allCards = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

  // 初始化各组合成功状态
  const combinationSuccess: Record<string, boolean> = {};
  for (const combo of combinations) {
    combinationSuccess[combo.name] = false;
  }

  // 生成14天日程
  const schedule = generateFullSchedule();

  // 14天模拟
  for (let day = 1; day <= 14; day++) {
    const dayState = schedule[day - 1];

    // 每天4次抽卡
    for (let draw = 0; draw < 4; draw++) {
      const card = simulateSingleDraw(bag, dayState, coefficients);
      if (card && allCards.includes(card)) {
        bag[card]++;
      }
    }

    // 检查各组合是否完成
    for (const combo of combinations) {
      if (!combinationSuccess[combo.name] && day <= combo.deadline) {
        const isComplete = combo.cards.every(req =>
          (bag[req.cardId] || 0) >= req.count
        );
        if (isComplete) {
          combinationSuccess[combo.name] = true;
        }
      }
    }
  }

  // 检查10张全收集
  const fullCollection = allCards.every(c => (bag[c] || 0) >= 1);

  return { fullCollection, combinationSuccess };
}

/**
 * 单次抽卡
 */
function simulateSingleDraw(
  bag: Record<string, number>,
  dayState: DayState,
  coefficients: CoefficientSet
): string | null {
  // 基础概率
  const baseProbs = getBaseProbForDayType(dayState.dayType);

  // 设置幸运卡
  baseProbs[dayState.luckyCard] = 1.2;

  // 应用降权系数
  for (const cardId of Object.keys(bag)) {
    const holdCount = bag[cardId] || 0;
    const coeffList = coefficients[cardId] || [1, 0, 0, 0];
    const coeff = holdCount < coeffList.length ? coeffList[holdCount] : 0;
    baseProbs[cardId] = baseProbs[cardId] * coeff;
  }

  // 归一化
  const finalProbs = normalizeProbabilities(baseProbs);

  // 轮盘赌
  const r = Math.random() * 100;
  let cumulative = 0;

  for (const [card, prob] of Object.entries(finalProbs)) {
    cumulative += prob;
    if (r < cumulative) return card;
  }

  return 'A';
}

/**
 * 获取基础概率
 */
function getBaseProbForDayType(dayType: 'COMMON' | 'RARE' | 'MAGIC'): Record<string, number> {
  const probs: Record<string, number> = {};

  switch (dayType) {
    case 'COMMON':
      ['A', 'B', 'C', 'D', 'E'].forEach(c => probs[c] = 8.04);
      ['F', 'G', 'H', 'I', 'J'].forEach(c => probs[c] = 16.08);
      break;
    case 'RARE':
      ['A', 'B', 'C', 'D', 'E'].forEach(c => probs[c] = 7.44);
      ['F', 'G', 'H', 'I', 'J'].forEach(c => probs[c] = 14.87);
      break;
    case 'MAGIC':
      ['A', 'B', 'C', 'D', 'E'].forEach(c => probs[c] = 7.06);
      ['F', 'G', 'H', 'I', 'J'].forEach(c => probs[c] = 14.11);
      probs['A'] = 0;
      break;
  }

  return probs;
}

/**
 * 归一化
 */
function normalizeProbabilities(probs: Record<string, number>): Record<string, number> {
  const total = Object.values(probs).reduce((sum, p) => sum + p, 0);
  if (total <= 0) return probs;

  const result: Record<string, number> = {};
  for (const [card, prob] of Object.entries(probs)) {
    result[card] = (prob / total) * 100;
  }
  return result;
}

/**
 * 生成14天日程
 */
function generateFullSchedule(): DayState[] {
  const weekTemplate: ('COMMON' | 'RARE' | 'MAGIC')[] = [
    'COMMON', 'COMMON', 'COMMON', 'COMMON', 'COMMON',
    'RARE',
    'MAGIC',
  ];

  const shuffle = (arr: ('COMMON' | 'RARE' | 'MAGIC')[]) => {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };

  const week1 = shuffle(weekTemplate);
  const week2 = shuffle(weekTemplate);

  const allDays: DayState[] = [];
  let dayIndex = 1;

  const getLuckyCard = (type: 'COMMON' | 'RARE' | 'MAGIC'): string => {
    switch (type) {
      case 'MAGIC': return 'A';
      case 'RARE': return ['B', 'C', 'D', 'E'][Math.floor(Math.random() * 4)];
      case 'COMMON': return ['F', 'G', 'H', 'I', 'J'][Math.floor(Math.random() * 5)];
    }
  };

  for (const type of [...week1, ...week2]) {
    allDays.push({
      dayIndex: dayIndex++,
      dayType: type,
      luckyCard: getLuckyCard(type),
    });
  }

  return allDays;
}

// 导出所有背包状态
export { BACKPACK_CONFIGS };

// 导出类型
export type { BackpackConfig };
