/**
 * 蒙特卡洛模拟引擎（修正版）
 *
 * 核心逻辑：
 * 1. 自由选择A/B/C/D四张卡及其稀有度
 * 2. 根据背包状态计算降权系数，确保中奖率≈4%
 * 3. 只输出一个指标：14天10张全收集率（要最大化）
 */

import type { Rarity, DayState } from '@/types';

/** 卡组配置 */
export interface CardSetup {
  A: { id: string; rarity: Rarity };
  B: { id: string; rarity: Rarity };
  C: { id: string; rarity: Rarity };
  D: { id: string; rarity: Rarity };
}

/** 模拟结果 */
export interface SimulationResult {
  // 目标指标：14天10张全收集率
  fullCollectionRate: number;

  // 验证指标（应该都≈4%）
  week1SetRate: number;  // 第一套中奖率
  week2SetRate: number;  // 第二套中奖率

  // 使用的降权系数
  coeffA: number;  // A卡第2张的系数
  coeffC: number;  // C卡第2张的系数
}

/** 背包状态 */
export type BackpackState = 'empty' | 'need3' | 'need2' | 'need1' | 'complete';

/**
 * 根据背包状态计算降权系数
 * 目标：确保中奖率≈4%
 */
export function calculateCoefficients(
  setup: CardSetup,
  backpackState: BackpackState,
  trials: number = 50000
): { coeffA: number; coeffC: number } {
  // 针对不同背包状态的经验系数
  const stateCoeffs: Record<BackpackState, { baseA: number; baseC: number }> = {
    empty: { baseA: 0.02, baseC: 0.008 },      // 全新用户
    need3: { baseA: 0.025, baseC: 0.01 },      // 缺3张
    need2: { baseA: 0.035, baseC: 0.015 },     // 缺2张
    need1: { baseA: 0.05, baseC: 0.025 },      // 缺1张
    complete: { baseA: 0, baseC: 0 },          // 已完成
  };

  const { baseA, baseC } = stateCoeffs[backpackState];

  // 根据卡片稀有度微调
  // 如果A是神奇卡，需要提高系数；如果是普通卡，降低系数
  const rarityMultiplier: Record<Rarity, number> = {
    MAGIC: 1.5,
    RARE: 1.0,
    COMMON: 0.8,
  };

  return {
    coeffA: baseA * rarityMultiplier[setup.A.rarity],
    coeffC: baseC * rarityMultiplier[setup.C.rarity],
  };
}

/**
 * 运行蒙特卡洛模拟
 */
export function runMonteCarloSimulation(
  setup: CardSetup,
  coeffA: number,
  coeffC: number,
  trials: number = 100000
): SimulationResult {
  let fullCollectionCount = 0;
  let week1SetCount = 0;
  let week2SetCount = 0;

  for (let i = 0; i < trials; i++) {
    const result = simulateOneGame(setup, coeffA, coeffC);

    if (result.fullCollection) fullCollectionCount++;
    if (result.week1SetComplete) week1SetCount++;
    if (result.week2SetComplete) week2SetCount++;
  }

  return {
    fullCollectionRate: (fullCollectionCount / trials) * 100,
    week1SetRate: (week1SetCount / trials) * 100,
    week2SetRate: (week2SetCount / trials) * 100,
    coeffA,
    coeffC,
  };
}

/**
 * 单次完整游戏模拟
 */
function simulateOneGame(
  setup: CardSetup,
  coeffA: number,
  coeffC: number
): {
  fullCollection: boolean;
  week1SetComplete: boolean;
  week2SetComplete: boolean;
} {
  // 背包：10张卡的持有数量
  const bag: Record<string, number> = {};
  const allCards = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  for (const c of allCards) bag[c] = 0;

  // 生成14天日程
  const schedule = generateFullSchedule();

  let week1SetComplete = false;
  let week2SetComplete = false;

  // 14天模拟
  for (let day = 1; day <= 14; day++) {
    const dayState = schedule[day - 1];

    // 每天4次抽卡
    for (let draw = 0; draw < 4; draw++) {
      const card = simulateSingleDraw(bag, setup, dayState, coeffA, coeffC);
      if (card && allCards.includes(card)) {
        bag[card]++;
      }
    }

    // 第7天检查第一套
    if (day === 7) {
      if (bag[setup.A.id] >= 2 && bag[setup.B.id] >= 1) {
        week1SetComplete = true;
      }
    }

    // 第14天检查第二套
    if (day === 14) {
      if (bag[setup.C.id] >= 2 && bag[setup.D.id] >= 1) {
        week2SetComplete = true;
      }
    }
  }

  // 检查10张全收集
  const fullCollection = allCards.every(c => bag[c] >= 1);

  return { fullCollection, week1SetComplete, week2SetComplete };
}

/**
 * 单次抽卡模拟
 */
function simulateSingleDraw(
  bag: Record<string, number>,
  setup: CardSetup,
  dayState: DayState,
  coeffA: number,
  coeffC: number
): string | null {
  // 基础概率（根据日期类型）
  const baseProbs = getBaseProbForDayType(dayState.dayType);

  // 设置幸运卡概率1.2%
  baseProbs[dayState.luckyCard] = 1.2;

  // 应用降权
  // A卡
  const aCount = bag[setup.A.id] || 0;
  if (aCount === 1) baseProbs[setup.A.id] *= coeffA;
  else if (aCount >= 2) baseProbs[setup.A.id] = 0;

  // B卡（只需要1张）
  if (bag[setup.B.id] >= 1) baseProbs[setup.B.id] = 0;

  // C卡
  const cCount = bag[setup.C.id] || 0;
  if (cCount === 1) baseProbs[setup.C.id] *= coeffC;
  else if (cCount >= 2) baseProbs[setup.C.id] = 0;

  // D卡（只需要1张）
  if (bag[setup.D.id] >= 1) baseProbs[setup.D.id] = 0;

  // 填充卡E-J每张只掉1次
  for (const c of ['E', 'F', 'G', 'H', 'I', 'J']) {
    if (bag[c] >= 1) baseProbs[c] = 0;
  }

  // 归一化
  const finalProbs = normalizeProbabilities(baseProbs);

  // 轮盘赌选择
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
function getBaseProbForDayType(dayType: DayState['dayType']): Record<string, number> {
  const probs: Record<string, number> = {};

  switch (dayType) {
    case 'COMMON':
      // 普通日：普通卡16.08%，稀有卡8.04%，神奇卡2.30%
      ['A', 'B', 'C', 'D', 'E'].forEach(c => probs[c] = 8.04);  // 稀有卡
      ['F', 'G', 'H', 'I', 'J'].forEach(c => probs[c] = 16.08); // 普通卡
      break;
    case 'RARE':
      // 稀有日：普通卡14.87%，稀有卡7.44%，神奇卡2.12%
      ['A', 'B', 'C', 'D', 'E'].forEach(c => probs[c] = 7.44);
      ['F', 'G', 'H', 'I', 'J'].forEach(c => probs[c] = 14.87);
      break;
    case 'MAGIC':
      // 神奇日：普通卡14.11%，稀有卡7.06%，神奇卡0%
      ['A', 'B', 'C', 'D', 'E'].forEach(c => probs[c] = 7.06);
      ['F', 'G', 'H', 'I', 'J'].forEach(c => probs[c] = 14.11);
      probs['A'] = 0; // 神奇卡A作为幸运卡单独处理
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
 * 生成14天日程（5普通日+1稀有日+1神奇日，每周打乱）
 */
function generateFullSchedule(): DayState[] {
  const weekTemplate: DayState['dayType'][] = [
    'COMMON', 'COMMON', 'COMMON', 'COMMON', 'COMMON',
    'RARE',
    'MAGIC',
  ];

  // 打乱一周
  const shuffle = (arr: any[]) => {
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

  const getLuckyCard = (type: DayState['dayType']): string => {
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

/**
 * 分块运行模拟（避免阻塞UI）
 */
export async function runSimulationInChunks(
  setup: CardSetup,
  coeffA: number,
  coeffC: number,
  trials: number = 100000,
  onProgress?: (progress: number) => void
): Promise<SimulationResult> {
  const chunkSize = 1000;
  let fullCollectionCount = 0;
  let week1SetCount = 0;
  let week2SetCount = 0;

  for (let i = 0; i < trials; i += chunkSize) {
    const currentChunkSize = Math.min(chunkSize, trials - i);

    for (let j = 0; j < currentChunkSize; j++) {
      const result = simulateOneGame(setup, coeffA, coeffC);
      if (result.fullCollection) fullCollectionCount++;
      if (result.week1SetComplete) week1SetCount++;
      if (result.week2SetComplete) week2SetCount++;
    }

    if (onProgress) {
      onProgress((i + currentChunkSize) / trials);
    }

    // 让出控制权
    if (i + chunkSize < trials) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  return {
    fullCollectionRate: (fullCollectionCount / trials) * 100,
    week1SetRate: (week1SetCount / trials) * 100,
    week2SetRate: (week2SetCount / trials) * 100,
    coeffA,
    coeffC,
  };
}

/**
 * 寻找最优降权系数（使中奖率≈4%）
 */
export function findOptimalCoefficients(
  setup: CardSetup,
  targetRate: number = 4.0,
  trials: number = 20000
): { coeffA: number; coeffC: number } {
  let bestA = 0.02;
  let bestC = 0.008;
  let minError = Infinity;

  // 网格搜索
  for (let a = 0.005; a <= 0.1; a += 0.005) {
    for (let c = 0.002; c <= 0.05; c += 0.002) {
      const result = runMonteCarloSimulation(setup, a, c, trials);

      // 计算与目标4%的误差
      const error = Math.abs(result.week1SetRate - targetRate) +
                    Math.abs(result.week2SetRate - targetRate);

      if (error < minError) {
        minError = error;
        bestA = a;
        bestC = c;
      }
    }
  }

  return { coeffA: bestA, coeffC: bestC };
}

/**
 * 运行所有组合的模拟
 */
export function runAllCombinationsSimulation(
  trials: number = 20000,
  onProgress?: (progress: number) => void
): Array<{
  setup: CardSetup;
  result: SimulationResult;
}> {
  const cards = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  const rarities: Rarity[] = ['MAGIC', 'RARE', 'COMMON'];

  const results: Array<{ setup: CardSetup; result: SimulationResult }> = [];
  let count = 0;
  const total = 81 * 100; // 简化为抽样

  // 随机抽样100种配置
  for (let i = 0; i < 100; i++) {
    const setup: CardSetup = {
      A: { id: cards[Math.floor(Math.random() * 10)], rarity: rarities[Math.floor(Math.random() * 3)] },
      B: { id: cards[Math.floor(Math.random() * 10)], rarity: rarities[Math.floor(Math.random() * 3)] },
      C: { id: cards[Math.floor(Math.random() * 10)], rarity: rarities[Math.floor(Math.random() * 3)] },
      D: { id: cards[Math.floor(Math.random() * 10)], rarity: rarities[Math.floor(Math.random() * 3)] },
    };

    // 确保A/B/C/D不同
    if (new Set([setup.A.id, setup.B.id, setup.C.id, setup.D.id]).size !== 4) continue;

    const { coeffA, coeffC } = findOptimalCoefficients(setup, 4.0, trials);
    const result = runMonteCarloSimulation(setup, coeffA, coeffC, trials);

    results.push({ setup, result });
    count++;

    if (onProgress) {
      onProgress(count / 100);
    }
  }

  // 按全收集率排序
  results.sort((a, b) => b.result.fullCollectionRate - a.result.fullCollectionRate);

  return results;
}
