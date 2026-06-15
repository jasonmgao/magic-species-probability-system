/**
 * 蒙特卡洛模拟引擎（正确版）
 *
 * 核心逻辑：
 * 1. 两套组合，每套3张卡（其中1张需要2张）
 * 2. 交叉控制：第一周控制第二周卡的掉率，反之亦然
 * 3. 自动搜索降权系数，使中奖率≈4%
 */

import type {
  CardSetup,
  Combination,
  DayState,
  Coefficients,
  BackpackConfig,
  StateResult,
  SimulationResult,
} from '@/types';

// 背包状态配置
export const BACKPACK_CONFIGS: BackpackConfig[] = [
  {
    state: 'empty',
    label: '全新用户',
    description: '所有卡片0张',
    initialBag: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0, I: 0, J: 0 },
  },
  {
    state: 'need3',
    label: '缺3张（第一套）',
    description: '第一套组合缺3张',
    initialBag: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0, I: 0, J: 0 },
  },
  {
    state: 'need2',
    label: '缺2张（第一套）',
    description: '第一套双卡有1张，缺单卡',
    initialBag: { A: 1, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0, I: 0, J: 0 },
  },
  {
    state: 'need1',
    label: '缺1张（第一套）',
    description: '第一套双卡有2张，缺单卡',
    initialBag: { A: 2, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0, I: 0, J: 0 },
  },
  {
    state: 'complete',
    label: '第一套完成',
    description: '第一套已完成，从零开始第二套',
    initialBag: { A: 2, B: 1, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0, I: 0, J: 0 },
  },
];

// 所有10张卡
const ALL_CARDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

/**
 * 运行完整模拟
 */
export function runFullSimulation(
  setup: CardSetup,
  targetRate: number = 4.0,
  trials: number = 20000
): SimulationResult {
  const stateResults: StateResult[] = [];

  for (const config of BACKPACK_CONFIGS) {
    // 为该背包状态寻找最优系数
    const coefficients = findOptimalCoefficients(setup, config, targetRate, trials);

    // 使用最优系数运行完整模拟
    const result = runSimulationForState(setup, config, coefficients, trials);

    stateResults.push(result);
  }

  // 找到全收集率最高的状态
  const bestState = stateResults.reduce((best, current) =>
    current.fullCollectionRate > best.fullCollectionRate ? current : best,
    stateResults[0]
  );

  return { setup, stateResults, bestState };
}

/**
 * 寻找最优降权系数
 * 目标：使两套中奖率都≈targetRate（默认4%）
 */
function findOptimalCoefficients(
  setup: CardSetup,
  backpackConfig: BackpackConfig,
  targetRate: number,
  trials: number
): Coefficients {
  // 初始化系数
  const coeffs: Coefficients = {};
  for (const card of ALL_CARDS) {
    coeffs[card] = { count0: 1.0, count1: 0.02, count2: 0 };
  }

  // 获取4张组合卡
  const comboCards = new Set([
    setup.week1.doubleCard,
    ...setup.week1.singleCards,
    setup.week2.doubleCard,
    ...setup.week2.singleCards,
  ]);

  // 只优化4张组合卡的系数
  const w1Cards = [setup.week1.doubleCard, ...setup.week1.singleCards];
  const w2Cards = [setup.week2.doubleCard, ...setup.week2.singleCards];

  let bestError = Infinity;
  let bestCoeffs = JSON.parse(JSON.stringify(coeffs));

  // 网格搜索：双卡第2张的系数
  for (let c1_2nd = 0.001; c1_2nd <= 0.1; c1_2nd += 0.005) {
    for (let c2_2nd = 0.001; c2_2nd <= 0.05; c2_2nd += 0.002) {
      // 设置系数
      const testCoeffs: Coefficients = JSON.parse(JSON.stringify(coeffs));

      // 第一套双卡第2张
      testCoeffs[setup.week1.doubleCard].count1 = c1_2nd;
      testCoeffs[setup.week1.doubleCard].count2 = 0;

      // 第二套双卡第2张
      testCoeffs[setup.week2.doubleCard].count1 = c2_2nd;
      testCoeffs[setup.week2.doubleCard].count2 = 0;

      // 单卡只需要1张，有了就降为0
      for (const card of setup.week1.singleCards) {
        testCoeffs[card].count1 = 0;
        testCoeffs[card].count2 = 0;
      }
      for (const card of setup.week2.singleCards) {
        testCoeffs[card].count1 = 0;
        testCoeffs[card].count2 = 0;
      }

      // 填充卡每张只出1次
      for (const card of ALL_CARDS) {
        if (!comboCards.has(card)) {
          testCoeffs[card].count1 = 0;
          testCoeffs[card].count2 = 0;
        }
      }

      // 快速测试
      const result = runSimulationForState(setup, backpackConfig, testCoeffs, 5000);

      // 计算误差（与4%的偏差）
      const error =
        Math.abs(result.week1Rate - targetRate) +
        Math.abs(result.week2Rate - targetRate);

      if (error < bestError) {
        bestError = error;
        bestCoeffs = testCoeffs;
      }
    }
  }

  return bestCoeffs;
}

/**
 * 对单个背包状态运行模拟
 */
function runSimulationForState(
  setup: CardSetup,
  backpackConfig: BackpackConfig,
  coefficients: Coefficients,
  trials: number
): StateResult {
  let fullCollectionCount = 0;
  let week1SuccessCount = 0;
  let week2SuccessCount = 0;

  for (let i = 0; i < trials; i++) {
    const result = simulateOneGame(setup, backpackConfig.initialBag, coefficients);

    if (result.fullCollection) fullCollectionCount++;
    if (result.week1Success) week1SuccessCount++;
    if (result.week2Success) week2SuccessCount++;
  }

  return {
    backpackState: backpackConfig.state,
    label: backpackConfig.label,
    description: backpackConfig.description,
    coefficients,
    fullCollectionRate: (fullCollectionCount / trials) * 100,
    week1Rate: (week1SuccessCount / trials) * 100,
    week2Rate: (week2SuccessCount / trials) * 100,
  };
}

/**
 * 单次游戏模拟
 */
function simulateOneGame(
  setup: CardSetup,
  initialBag: Record<string, number>,
  coefficients: Coefficients
): { fullCollection: boolean; week1Success: boolean; week2Success: boolean } {
  // 复制背包
  const bag: Record<string, number> = { ...initialBag };

  // 生成14天日程
  const schedule = generateFullSchedule();

  let week1Success = false;
  let week2Success = false;

  // 模拟14天
  for (let day = 1; day <= 14; day++) {
    const dayState = schedule[day - 1];

    // 生成当日概率（带交叉控制）
    const probs = generateDailyProbabilities(
      day,
      setup,
      bag,
      coefficients,
      dayState
    );

    // 每天4次抽卡
    for (let draw = 0; draw < 4; draw++) {
      const card = drawCard(probs);
      if (card) bag[card] = (bag[card] || 0) + 1;
    }

    // 检查组合完成情况
    if (day === 7 && !week1Success) {
      week1Success = checkCombinationComplete(bag, setup.week1);
    }
    if (day === 14 && !week2Success) {
      week2Success = checkCombinationComplete(bag, setup.week2);
    }
  }

  // 检查全收集
  const fullCollection = ALL_CARDS.every(c => (bag[c] || 0) >= 1);

  return { fullCollection, week1Success, week2Success };
}

/**
 * 生成当日概率（带交叉控制）
 *
 * 关键逻辑：
 * - 第1周：压低week2卡的掉率
 * - 第2周：适当提高week1卡的掉率（补偿）
 */
function generateDailyProbabilities(
  day: number,
  setup: CardSetup,
  bag: Record<string, number>,
  coefficients: Coefficients,
  dayState: DayState
): Record<string, number> {
  // 基础概率
  const probs = getBaseProbForDayType(dayState.dayType);

  // 设置幸运卡
  probs[dayState.luckyCard] = 1.2;

  const w1Cards = [setup.week1.doubleCard, ...setup.week1.singleCards];
  const w2Cards = [setup.week2.doubleCard, ...setup.week2.singleCards];

  // 交叉控制
  if (day <= 7) {
    // 第1周：压低week2卡的掉率（特别是非组合卡）
    for (const card of w2Cards) {
      if (!w1Cards.includes(card)) {
        // week2独有的卡，第一周大幅降权
        probs[card] *= 0.3;
      }
    }
  } else {
    // 第2周：适当提高week1卡的掉率（帮助未完成第一套的用户）
    for (const card of w1Cards) {
      probs[card] *= 1.2;
    }
  }

  // 应用降权系数
  for (const card of ALL_CARDS) {
    const count = bag[card] || 0;
    const coeff = coefficients[card];
    let multiplier = 1.0;

    if (count === 0) multiplier = coeff.count0;
    else if (count === 1) multiplier = coeff.count1;
    else multiplier = coeff.count2;

    probs[card] *= multiplier;
  }

  // 归一化
  return normalizeProbabilities(probs);
}

/**
 * 检查组合是否完成
 */
function checkCombinationComplete(
  bag: Record<string, number>,
  combo: Combination
): boolean {
  const doubleCount = bag[combo.doubleCard] || 0;
  const single1Count = bag[combo.singleCards[0]] || 0;
  const single2Count = bag[combo.singleCards[1]] || 0;

  return doubleCount >= 2 && single1Count >= 1 && single2Count >= 1;
}

/**
 * 抽卡
 */
function drawCard(probs: Record<string, number>): string | null {
  const r = Math.random() * 100;
  let cumulative = 0;

  for (const [card, prob] of Object.entries(probs)) {
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
      ['A'].forEach(c => probs[c] = 2.30);  // 神奇
      ['B', 'C', 'D', 'E'].forEach(c => probs[c] = 8.04);  // 稀有
      ['F', 'G', 'H', 'I', 'J'].forEach(c => probs[c] = 16.08);  // 普通
      break;
    case 'RARE':
      ['A'].forEach(c => probs[c] = 2.12);
      ['B', 'C', 'D', 'E'].forEach(c => probs[c] = 7.44);
      ['F', 'G', 'H', 'I', 'J'].forEach(c => probs[c] = 14.87);
      break;
    case 'MAGIC':
      ['A'].forEach(c => probs[c] = 0);
      ['B', 'C', 'D', 'E'].forEach(c => probs[c] = 7.06);
      ['F', 'G', 'H', 'I', 'J'].forEach(c => probs[c] = 14.11);
      break;
  }

  return probs;
}

/**
 * 归一化概率
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

  // 打乱
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
