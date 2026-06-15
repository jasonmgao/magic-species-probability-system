/**
 * 蒙特卡洛模拟引擎
 *
 * 正确逻辑：
 * 1. 集齐率 = 14天内10张卡每张都≥1张的概率（全收集）
 * 2. 中奖率：
 *    - 第一套中奖率 = 7天内获得 A×2 + B×1 的概率（目标控制在4%以内）
 *    - 第二套中奖率 = 14天内获得 C×2 + D×1 的概率（目标控制在4%以内）
 */

import type {
  SimulationParams,
  DayState,
  CardRarityConfig,
} from '@/types';
import {
  DEFAULT_SIMULATION_PARAMS,
  DEFAULT_BASE_PROB_TABLE,
  LUCKY_CARD_PROB,
} from '@/constants';
import {
  generateFullSchedule,
} from '@/utils';

/**
 * 14天完整模拟结果
 */
export interface SimulationResult {
  // 集齐率：10张卡每张都≥1张的概率
  fullCollectionRate: number;

  // 第一套中奖率：7天内获得 A×2 + B×1 的概率（目标控制在4%以内）
  week1SetRate: number;

  // 第二套中奖率：14天内获得 C×2 + D×1 的概率（目标控制在4%以内）
  week2SetRate: number;

  // 平均获得的不同卡片数
  avgUniqueCards: number;
}

/**
 * 卡组配置
 */
export interface CardSetup {
  // 4张组合卡及其稀有度
  A: CardRarityConfig;
  B: CardRarityConfig;
  C: CardRarityConfig;
  D: CardRarityConfig;
}

/**
 * 降权系数配置
 */
interface CoefficientConfig {
  A: number;  // 第一套第2张的系数（默认0.02）
  C: number;  // 第二套第2张的系数（默认0.008）
}

/**
 * 运行蒙特卡洛模拟
 *
 * @param setup 卡组配置（4张卡的稀有度）
 * @param coeff 降权系数配置
 * @param trials 模拟次数
 */
export function runMonteCarloSimulation(
  setup: CardSetup,
  coeff: CoefficientConfig = { A: 0.02, C: 0.008 },
  trials: number = 100000
): SimulationResult {
  let fullCollectionCount = 0;
  let week1SetCount = 0;
  let week2SetCount = 0;
  let totalUniqueCards = 0;

  for (let i = 0; i < trials; i++) {
    const result = simulateOneGame(setup, coeff);

    if (result.fullCollection) fullCollectionCount++;
    if (result.week1SetComplete) week1SetCount++;
    if (result.week2SetComplete) week2SetCount++;
    totalUniqueCards += result.uniqueCardCount;
  }

  return {
    fullCollectionRate: (fullCollectionCount / trials) * 100,
    week1SetRate: (week1SetCount / trials) * 100,
    week2SetRate: (week2SetCount / trials) * 100,
    avgUniqueCards: totalUniqueCards / trials,
  };
}

/**
 * 单次完整游戏模拟（14天）
 */
function simulateOneGame(
  setup: CardSetup,
  coeff: CoefficientConfig
): {
  fullCollection: boolean;
  week1SetComplete: boolean;
  week2SetComplete: boolean;
  uniqueCardCount: number;
} {
  // 背包：记录每张卡的持有数量
  const bag: Record<string, number> = {};
  const cards = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  for (const c of cards) bag[c] = 0;

  // 生成14天日程
  const schedule = generateFullSchedule();

  let week1SetComplete = false;
  let week2SetComplete = false;

  // 14天模拟
  for (let day = 1; day <= 14; day++) {
    const dayState = schedule[day - 1];

    // 每天4次抽卡
    for (let draw = 0; draw < 4; draw++) {
      const card = simulateSingleDraw(bag, setup, dayState, coeff);
      if (card && cards.includes(card)) {
        bag[card]++;
      }
    }

    // 第7天结束检查第一套（AaB）
    if (day === 7) {
      if (bag['A'] >= 2 && bag['B'] >= 1) {
        week1SetComplete = true;
      }
    }

    // 第14天结束检查第二套（CcD）
    if (day === 14) {
      if (bag['C'] >= 2 && bag['D'] >= 1) {
        week2SetComplete = true;
      }
    }
  }

  // 检查是否集齐全部10张卡（每张至少1张）
  const fullCollection = cards.every(c => bag[c] >= 1);

  // 计算获得的不同卡片数量
  const uniqueCardCount = cards.filter(c => bag[c] >= 1).length;

  return {
    fullCollection,
    week1SetComplete,
    week2SetComplete,
    uniqueCardCount,
  };
}

/**
 * 模拟单次抽卡
 */
function simulateSingleDraw(
  bag: Record<string, number>,
  setup: CardSetup,
  dayState: DayState,
  coeff: CoefficientConfig
): string | null {
  // 获取基础概率
  const baseProbs = getBaseProbForDayType(dayState.dayType, setup);

  // Step 1: 设置幸运卡概率为1.2%
  baseProbs[dayState.luckyCard] = LUCKY_CARD_PROB;

  // Step 2: 应用降权系数（只对A/B/C/D）
  const A_count = bag['A'];
  const B_count = bag['B'];
  const C_count = bag['C'];
  const D_count = bag['D'];

  // A卡降权
  if (A_count === 1) baseProbs['A'] *= coeff.A;
  else if (A_count >= 2) baseProbs['A'] = 0;

  // B卡降权（B只需要1张，所以只要有1张就降权到0或极低）
  if (B_count >= 1) baseProbs['B'] = 0; // B只需要1张，有了就不再掉落

  // C卡降权
  if (C_count === 1) baseProbs['C'] *= coeff.C;
  else if (C_count >= 2) baseProbs['C'] = 0;

  // D卡降权（D只需要1张）
  if (D_count >= 1) baseProbs['D'] = 0; // D只需要1张，有了就不再掉落

  // Step 3: 归一化
  const finalProbs = normalizeProbabilitiesAfterAdjustment(baseProbs);

  // Step 4: 轮盘赌选择
  const cards = Object.keys(finalProbs);
  const thresholds: number[] = [];
  let cumulative = 0;

  for (const card of cards) {
    cumulative += finalProbs[card];
    thresholds.push(cumulative);
  }

  const r = Math.random();
  for (let i = 0; i < cards.length; i++) {
    if (r < thresholds[i]) {
      return cards[i];
    }
  }

  return cards[cards.length - 1] || null;
}

/**
 * 获取基础概率（根据日期类型）
 *
 * 根据文档中的基础概率表
 */
function getBaseProbForDayType(
  dayType: DayState['dayType'],
  setup: CardSetup
): Record<string, number> {
  // 根据稀有度获取基础概率
  const getRarityProb = (rarity: string, isLucky: boolean) => {
    if (isLucky) return LUCKY_CARD_PROB;

    switch (dayType) {
      case 'COMMON':
        return rarity === 'COMMON' ? 16.08 : rarity === 'RARE' ? 8.04 : 2.30;
      case 'RARE':
        return rarity === 'COMMON' ? 14.87 : rarity === 'RARE' ? 7.44 : 2.12;
      case 'MAGIC':
        return rarity === 'COMMON' ? 14.11 : rarity === 'RARE' ? 7.06 : 0;
    }
  };

  return {
    A: getRarityProb(setup.A.rarity, false),
    B: getRarityProb(setup.B.rarity, false),
    C: getRarityProb(setup.C.rarity, false),
    D: getRarityProb(setup.D.rarity, false),
    E: getRarityProb('RARE', false),
    F: getRarityProb('COMMON', false),
    G: getRarityProb('COMMON', false),
    H: getRarityProb('COMMON', false),
    I: getRarityProb('COMMON', false),
    J: getRarityProb('COMMON', false),
  };
}

/**
 * 归一化处理（使概率总和为100%）
 */
function normalizeProbabilitiesAfterAdjustment(
  probs: Record<string, number>
): Record<string, number> {
  const total = Object.values(probs).reduce((sum, p) => sum + p, 0);

  if (total <= 0) {
    // 如果总和为0，平均分配（不应该发生）
    const cards = Object.keys(probs);
    const avg = 100 / cards.length;
    const result: Record<string, number> = {};
    for (const c of cards) result[c] = avg;
    return result;
  }

  const result: Record<string, number> = {};
  for (const [card, prob] of Object.entries(probs)) {
    result[card] = (prob / total) * 100;
  }

  return result;
}

/**
 * 生成所有可能的组合（考虑4张卡的稀有度）
 *
 * A/B/C/D 每张卡都可以是 神奇/稀有/普通
 * 共 3^4 = 81 种组合
 */
export function* generateAllCardSetups(): Generator<{
  setup: CardSetup;
  label: string;
}> {
  const rarities: ('MAGIC' | 'RARE' | 'COMMON')[] = ['MAGIC', 'RARE', 'COMMON'];

  for (const rA of rarities) {
    for (const rB of rarities) {
      for (const rC of rarities) {
        for (const rD of rarities) {
          const setup: CardSetup = {
            A: { id: 'A', rarity: rA },
            B: { id: 'B', rarity: rB },
            C: { id: 'C', rarity: rC },
            D: { id: 'D', rarity: rD },
          };

          const label = `A${rA[0]}-B${rB[0]}-C${rC[0]}-D${rD[0]}`;
          yield { setup, label };
        }
      }
    }
  }
}

/**
 * 运行所有组合的模拟，并返回统计结果
 */
export function runAllCombinationsSimulation(
  coeff: CoefficientConfig = { A: 0.02, C: 0.008 },
  trials: number = 50000,
  onProgress?: (progress: number) => void
): {
  results: Array<{ setup: CardSetup; label: string; result: SimulationResult }>;
  bestForFullCollection: { setup: CardSetup; label: string; rate: number } | null;
  bestForWeek1: { setup: CardSetup; label: string; rate: number } | null;
  bestForWeek2: { setup: CardSetup; label: string; rate: number } | null;
  avgFullCollectionRate: number;
  avgWeek1Rate: number;
  avgWeek2Rate: number;
} {
  const results: Array<{ setup: CardSetup; label: string; result: SimulationResult }> = [];

  const generator = generateAllCardSetups();
  let count = 0;
  const total = 81; // 3^4

  for (const { setup, label } of generator) {
    const result = runMonteCarloSimulation(setup, coeff, trials);
    results.push({ setup, label, result });

    count++;
    if (onProgress) {
      onProgress(count / total);
    }
  }

  // 计算最佳配置
  const bestForFullCollection = results.reduce((best, curr) =>
    !best || curr.result.fullCollectionRate > best.rate
      ? { setup: curr.setup, label: curr.label, rate: curr.result.fullCollectionRate }
      : best,
    null as { setup: CardSetup; label: string; rate: number } | null
  );

  const bestForWeek1 = results.reduce((best, curr) =>
    !best || curr.result.week1SetRate > best.rate
      ? { setup: curr.setup, label: curr.label, rate: curr.result.week1SetRate }
      : best,
    null as { setup: CardSetup; label: string; rate: number } | null
  );

  const bestForWeek2 = results.reduce((best, curr) =>
    !best || curr.result.week2SetRate > best.rate
      ? { setup: curr.setup, label: curr.label, rate: curr.result.week2SetRate }
      : best,
    null as { setup: CardSetup; label: string; rate: number } | null
  );

  // 计算平均值
  const avgFullCollectionRate = results.reduce((sum, r) => sum + r.result.fullCollectionRate, 0) / results.length;
  const avgWeek1Rate = results.reduce((sum, r) => sum + r.result.week1SetRate, 0) / results.length;
  const avgWeek2Rate = results.reduce((sum, r) => sum + r.result.week2SetRate, 0) / results.length;

  return {
    results,
    bestForFullCollection,
    bestForWeek1,
    bestForWeek2,
    avgFullCollectionRate,
    avgWeek1Rate,
    avgWeek2Rate,
  };
}

/**
 * 分块运行模拟（避免阻塞UI）
 */
export async function runSimulationInChunks(
  setup: CardSetup,
  coeff: CoefficientConfig,
  trials: number = 100000,
  onProgress?: (progress: number) => void
): Promise<SimulationResult> {
  const chunkSize = 1000;

  let fullCollectionCount = 0;
  let week1SetCount = 0;
  let week2SetCount = 0;
  let totalUniqueCards = 0;

  for (let i = 0; i < trials; i += chunkSize) {
    const currentChunkSize = Math.min(chunkSize, trials - i);

    for (let j = 0; j < currentChunkSize; j++) {
      const result = simulateOneGame(setup, coeff);

      if (result.fullCollection) fullCollectionCount++;
      if (result.week1SetComplete) week1SetCount++;
      if (result.week2SetComplete) week2SetCount++;
      totalUniqueCards += result.uniqueCardCount;
    }

    if (onProgress) {
      onProgress((i + currentChunkSize) / trials);
    }

    // 让出控制权给事件循环
    if (i + chunkSize < trials) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  return {
    fullCollectionRate: (fullCollectionCount / trials) * 100,
    week1SetRate: (week1SetCount / trials) * 100,
    week2SetRate: (week2SetCount / trials) * 100,
    avgUniqueCards: totalUniqueCards / trials,
  };
}
