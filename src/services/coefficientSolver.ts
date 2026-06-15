/**
 * 🎯 降权系数求解器（反向求解版）
 * 输入：两周卡组配置（卡牌数量 2-5，可重复）
 * 输出：按持有数量分层的降权系数，使两周中奖率均≈4%
 *
 * 核心规则：
 * - n 张卡组 → n-1 个待求系数（第1张固定=1.0）
 * - 持有≥n+1 张时，概率=0
 * - 跨周控制：第一周不降权第二周的卡，反之亦然
 */

import type { CardSetup, WeeklyCombo, CoefficientResult, CardCoefficients, SolverProgress } from '@/types';

// 10 张卡定义
export const ALL_CARDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

// 基础概率配置（百分比形式，便于计算）
const BASE_PROBS: Record<string, number> = {
  A: 2,                          // 神奇卡：2%
  B: 7, C: 7, D: 7, E: 7,        // 稀有卡：7%
  F: 14, G: 14, H: 14, I: 14, J: 14,  // 普通卡：14%
};

// 幸运卡固定概率
const LUCKY_FIXED_PROB = 1.2;  // 1.2%

/**
 * 获取卡片类型
 */
export function getCardType(card: string): 'common' | 'rare' | 'magic' {
  if (card === 'A') return 'magic';
  if (['B', 'C', 'D', 'E'].includes(card)) return 'rare';
  return 'common';
}

/**
 * 获取基础概率（百分比）
 */
export function getBaseProb(card: string): number {
  return BASE_PROBS[card] ?? 14;
}

/**
 * 统计卡组中每张卡的需求量
 * 返回：Map<cardId, 需求量>
 */
function countCardNeeds(cards: string[]): Map<string, number> {
  const needs = new Map<string, number>();
  for (const card of cards) {
    needs.set(card, (needs.get(card) || 0) + 1);
  }
  return needs;
}

/**
 * 初始化降权系数
 * - 第 1 张固定 = 1.0（索引 0）
 * - 第 2 张到第 n 张（索引 1 到 n-1）= 初始猜测值
 *
 * 重要：系数数量 = 卡组卡槽总数（2-5），不是单张卡的需求量
 * 例如卡组 ["A","A","B"]（3个卡槽），每张卡都有 [1.0, x, y]（3个系数）
 *
 * @param needs 卡牌需求量 Map
 * @param totalSlots 卡组总卡槽数（2-5）
 * @param isWeek2 是否是第二周（第二周通常系数更小）
 */
function initializeCoefficients(
  needs: Map<string, number>,
  totalSlots: number,
  isWeek2: boolean
): Record<string, CardCoefficients> {
  const result: Record<string, CardCoefficients> = {};

  // 系数数量 = 卡槽总数（2-5）
  // 例如 3 张卡组 → 系数 [1.0, x, y]（索引 0, 1, 2 对应持有 1, 2, 3 张）
  const coeffCount = totalSlots;

  for (const [cardId] of needs.entries()) {
    const coeffs: CardCoefficients = [1.0];  // 持有 1 张固定=1.0（不降权）

    // 初始猜测值（第二周通常系数更小，因为窗口更长）
    const initialGuess = isWeek2 ? 0.05 : 0.15;

    // 生成剩余系数（索引 1 到 coeffCount-1）
    for (let i = 1; i < coeffCount; i++) {
      // 指数衰减：越往后系数越小
      const decay = Math.pow(0.4, i - 1);
      // 确保递减
      const prevVal = coeffs[i - 1];
      const newVal = Math.min(initialGuess * decay, prevVal * 0.8);
      coeffs.push(Math.max(0.001, newVal));
    }

    result[cardId] = coeffs;
  }

  return result;
}

/**
 * 生成随机日程（两周）
 * 每周：5 普通日 + 1 稀有日 + 1 神奇日
 */
function generateSchedule(): Array<'common' | 'rare' | 'magic'> {
  const week = ['common', 'common', 'common', 'common', 'common', 'rare', 'magic'] as Array<'common' | 'rare' | 'magic'>;

  // 每周独立洗牌
  const shuffle = (arr: Array<'common' | 'rare' | 'magic'>) => {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };

  const week1 = shuffle(week);
  const week2 = shuffle(week);
  return [...week1, ...week2];
}

/**
 * 根据日类型获取候选幸运卡
 */
function getLuckyCardCandidates(
  dayType: 'common' | 'rare' | 'magic',
  comboCards: Set<string>
): string[] {
  if (dayType === 'magic') return ['A'];

  if (dayType === 'rare') {
    const rareCards = ['B', 'C', 'D', 'E'];
    // 优先选卡组内的卡
    const inCombo = rareCards.filter(c => comboCards.has(c));
    return inCombo.length > 0 ? inCombo : rareCards;
  }

  // common day
  const commonCards = ['F', 'G', 'H', 'I', 'J'];
  const inCombo = commonCards.filter(c => comboCards.has(c));
  return inCombo.length > 0 ? inCombo : commonCards;
}

/**
 * 单次抽卡（应用降权系数 + 幸运日逻辑）
 *
 * @param backpack 当前背包状态
 * @param setup 卡组配置
 * @param coefficients 两周的降权系数
 * @param day 当前天数（1-14）
 * @param dayType 日类型
 * @param weekHasLucky 本周是否已有幸运日
 */
function drawOneCard(
  backpack: Record<string, number>,
  setup: CardSetup,
  coefficients: { week1: Record<string, CardCoefficients>; week2: Record<string, CardCoefficients> },
  day: number,
  dayType: 'common' | 'rare' | 'magic',
  weekHasLucky: Record<string, boolean>
): { card: string; luckyCard: string | null } {
  // 1. 确定当前周次及对应的卡组
  const isWeek1 = day <= 7;
  const currentCombo = isWeek1 ? setup.week1 : setup.week2;
  const currentCoeffs = isWeek1 ? coefficients.week1 : coefficients.week2;
  const allComboCards = new Set([...setup.week1.cards, ...setup.week2.cards]);

  // 2. 确定幸运卡
  let luckyCard: string | null = null;
  const typeKey = `${dayType}_lucky`;

  if (!weekHasLucky[typeKey]) {
    const candidates = getLuckyCardCandidates(dayType, allComboCards);
    if (candidates.length > 0) {
      luckyCard = candidates[Math.floor(Math.random() * candidates.length)];
      weekHasLucky[typeKey] = true;
    }
  }

  // 3. 计算基础概率（考虑幸运卡）
  const rawProbs: Record<string, number> = {};
  const otherCards = ALL_CARDS.filter(c => c !== luckyCard);
  const otherTotal = otherCards.reduce((sum, c) => sum + getBaseProb(c), 0);

  for (const card of ALL_CARDS) {
    const baseProb = getBaseProb(card);

    if (luckyCard === card) {
      rawProbs[card] = LUCKY_FIXED_PROB;
    } else if (luckyCard !== null) {
      // 非幸运卡的概率被压缩
      rawProbs[card] = (baseProb / otherTotal) * (100 - LUCKY_FIXED_PROB);
    } else {
      rawProbs[card] = baseProb;
    }
  }

  // 4. 应用降权系数（仅对当前周的卡组）
  const weightedProbs: Record<string, number> = {};

  for (const card of ALL_CARDS) {
    const holdCount = backpack[card] || 0;

    // 检查该卡是否在当前周的卡组中
    const isInCurrentWeek = currentCombo.cards.includes(card);

    if (!isInCurrentWeek) {
      // 不在当前周卡组的卡：正常概率（不降权）
      weightedProbs[card] = rawProbs[card];
    } else {
      // 在当前周卡组中：应用降权系数
      const cardCoeffs = currentCoeffs[card];

      if (!cardCoeffs) {
        // 异常情况，保持原概率
        weightedProbs[card] = rawProbs[card];
      } else {
        // 持有 0 张：不降权（系数 1.0）
        if (holdCount === 0) {
          weightedProbs[card] = rawProbs[card];
        } else {
          // 查表：索引 = 持有数量 - 1
          const coeffIndex = holdCount - 1;

          if (coeffIndex >= cardCoeffs.length) {
            // 持有数量超过需求，概率=0
            weightedProbs[card] = 0;
          } else {
            // 应用系数
            weightedProbs[card] = rawProbs[card] * cardCoeffs[coeffIndex];
          }
        }
      }
    }
  }

  // 5. 归一化 + 轮盘赌
  const total = Object.values(weightedProbs).reduce((a, b) => a + b, 0);
  if (total <= 0) {
    // 异常情况，返回第一张卡
    return { card: 'A', luckyCard };
  }

  const r = Math.random() * total;
  let sum = 0;

  for (const [card, prob] of Object.entries(weightedProbs)) {
    sum += prob;
    if (r < sum) {
      return { card, luckyCard };
    }
  }

  return { card: 'A', luckyCard };
}

/**
 * 检查某周组合是否完成
 */
function checkComboComplete(combo: WeeklyCombo, backpack: Record<string, number>): boolean {
  const needs = countCardNeeds(combo.cards);
  for (const [card, need] of needs.entries()) {
    if ((backpack[card] || 0) < need) return false;
  }
  return true;
}

/**
 * 检查是否全收集（10 张卡各至少 1 张）
 */
function checkFullCollection(backpack: Record<string, number>): boolean {
  return ALL_CARDS.every(card => (backpack[card] || 0) >= 1);
}

/**
 * 蒙特卡洛模拟
 *
 * @returns 各周中奖率和全收集率
 */
function monteCarloSimulate(
  setup: CardSetup,
  coefficients: { week1: Record<string, CardCoefficients>; week2: Record<string, CardCoefficients> },
  trials: number = 50000
): { week1Rate: number; week2Rate: number; fullCollectionRate: number } {
  let week1Success = 0;
  let week2Success = 0;
  let fullCollection = 0;

  for (let t = 0; t < trials; t++) {
    const backpack: Record<string, number> = {};

    // 模拟 14 天
    const schedule = generateSchedule();
    const week1HasLucky: Record<string, boolean> = {};
    const week2HasLucky: Record<string, boolean> = {};

    for (let day = 1; day <= 14; day++) {
      const dayType = schedule[day - 1];
      const weekHasLucky = day <= 7 ? week1HasLucky : week2HasLucky;

      // 每天 4 次抽卡
      for (let draw = 0; draw < 4; draw++) {
        const { card } = drawOneCard(backpack, setup, coefficients, day, dayType, weekHasLucky);
        backpack[card] = (backpack[card] || 0) + 1;
      }
    }

    // 检查第一周是否完成（7 天内）
    // 注意：这里需要模拟 7 天的情况，但我们只做了 14 天模拟
    // 所以需要单独判断第 7 天时的状态
    // 简化处理：假设每周独立，用回溯法更精确
  }

  // 为了精确计算，我们需要分别模拟第一周和第二周的中奖率
  // 这里的简化：分别模拟两种场景
  return monteCarloSimulateDetailed(setup, coefficients, trials);
}

/**
 * 详细的蒙特卡洛模拟（精确计算每一周的完成率）
 */
function monteCarloSimulateDetailed(
  setup: CardSetup,
  coefficients: { week1: Record<string, CardCoefficients>; week2: Record<string, CardCoefficients> },
  trials: number
): { week1Rate: number; week2Rate: number; fullCollectionRate: number } {
  let week1Success = 0;
  let week2Success = 0;
  let fullCollection = 0;

  // 分别模拟两次：一次只看第一周，一次看两周
  for (let t = 0; t < trials; t++) {
    // === 模拟第一周（只跑 7 天）===
    const backpackWeek1: Record<string, number> = {};
    const schedule1 = generateSchedule().slice(0, 7);
    const week1HasLucky: Record<string, boolean> = {};

    for (let day = 1; day <= 7; day++) {
      const dayType = schedule1[day - 1];
      for (let draw = 0; draw < 4; draw++) {
        const { card } = drawOneCard(backpackWeek1, setup, coefficients, day, dayType, week1HasLucky);
        backpackWeek1[card] = (backpackWeek1[card] || 0) + 1;
      }
    }

    if (checkComboComplete(setup.week1, backpackWeek1)) {
      week1Success++;
    }

    // === 模拟完整两周 ===
    const backpackFull: Record<string, number> = {};
    const scheduleFull = generateSchedule();
    const week1Lucky: Record<string, boolean> = {};
    const week2Lucky: Record<string, boolean> = {};

    for (let day = 1; day <= 14; day++) {
      const dayType = scheduleFull[day - 1];
      const weekHasLucky = day <= 7 ? week1Lucky : week2Lucky;
      for (let draw = 0; draw < 4; draw++) {
        const { card } = drawOneCard(backpackFull, setup, coefficients, day, dayType, weekHasLucky);
        backpackFull[card] = (backpackFull[card] || 0) + 1;
      }
    }

    if (checkComboComplete(setup.week2, backpackFull)) {
      week2Success++;
    }

    if (checkFullCollection(backpackFull)) {
      fullCollection++;
    }
  }

  return {
    week1Rate: (week1Success / trials) * 100,
    week2Rate: (week2Success / trials) * 100,
    fullCollectionRate: (fullCollection / trials) * 100,
  };
}

/**
 * 求解器结果
 */
export interface SolverResult {
  coefficients: { week1: Record<string, CardCoefficients>; week2: Record<string, CardCoefficients> };
  week1Rate: number;
  week2Rate: number;
  fullCollectionRate: number;
  converged: boolean;
  iterations: number;
  finalError: number;
}

/**
 * 反向求解降权系数（梯度下降）
 *
 * 目标：通过调整降权系数，使两周中奖率均接近 targetRate
 *
 * @param setup 两周卡组配置
 * @param targetRate 目标中奖率（默认 4%）
 * @param tolerance 容差（默认 0.1%）
 * @param maxIterations 最大迭代次数（默认 50）
 * @param trialsPerIteration 每迭代模拟次数（默认 30000）
 * @param onProgress 进度回调
 */
export function solveCoefficients(
  setup: CardSetup,
  targetRate: number = 4.0,
  tolerance: number = 0.1,
  maxIterations: number = 50,
  trialsPerIteration: number = 30000,
  onProgress?: (progress: SolverProgress) => void
): SolverResult {
  // 1. 统计两周的卡牌需求和卡槽数
  const week1Needs = countCardNeeds(setup.week1.cards);
  const week2Needs = countCardNeeds(setup.week2.cards);
  const week1Slots = setup.week1.cards.length;  // 第一周卡槽数（2-5）
  const week2Slots = setup.week2.cards.length;  // 第二周卡槽数（2-5）

  // 2. 初始化降权系数（按卡槽总数）
  let week1Coeffs = initializeCoefficients(week1Needs, week1Slots, false);
  let week2Coeffs = initializeCoefficients(week2Needs, week2Slots, true);

  // 3. 梯度下降迭代
  let learningRate = 0.2;
  let bestError = Infinity;
  let bestCoeffs = {
    week1: JSON.parse(JSON.stringify(week1Coeffs)) as Record<string, CardCoefficients>,
    week2: JSON.parse(JSON.stringify(week2Coeffs)) as Record<string, CardCoefficients>,
  };
  let bestRates = { week1: 0, week2: 0, fullCollection: 0 };

  for (let iter = 0; iter < maxIterations; iter++) {
    // 运行蒙特卡洛模拟
    const result = monteCarloSimulateDetailed(
      setup,
      { week1: week1Coeffs, week2: week2Coeffs },
      trialsPerIteration
    );

    // 计算误差
    const error1 = result.week1Rate - targetRate;
    const error2 = result.week2Rate - targetRate;
    const totalError = Math.abs(error1) + Math.abs(error2);

    // 记录最佳结果
    if (totalError < bestError) {
      bestError = totalError;
      bestCoeffs = {
        week1: JSON.parse(JSON.stringify(week1Coeffs)),
        week2: JSON.parse(JSON.stringify(week2Coeffs)),
      };
      bestRates = {
        week1: result.week1Rate,
        week2: result.week2Rate,
        fullCollection: result.fullCollectionRate,
      };
    }

    // 进度回调
    if (onProgress) {
      onProgress({
        iteration: iter + 1,
        totalIterations: maxIterations,
        week1Rate: result.week1Rate,
        week2Rate: result.week2Rate,
        error: totalError,
        isConverged: totalError < tolerance * 2,
      });
    }

    // 检查是否收敛
    if (Math.abs(error1) < tolerance && Math.abs(error2) < tolerance) {
      return {
        coefficients: { week1: week1Coeffs, week2: week2Coeffs },
        week1Rate: result.week1Rate,
        week2Rate: result.week2Rate,
        fullCollectionRate: result.fullCollectionRate,
        converged: true,
        iterations: iter + 1,
        finalError: totalError,
      };
    }

    // 梯度下降更新系数
    // error > 0: 中奖率过高，需要降低系数（更严格）
    // error < 0: 中奖率过低，需要提高系数（更宽松）

    // 更新第一周系数
    for (const [cardId, coeffs] of Object.entries(week1Coeffs)) {
      for (let i = 1; i < coeffs.length; i++) {  // 跳过索引 0（固定=1.0）
        // 误差方向决定调整方向
        const adjustment = -learningRate * error1 * 0.01;
        coeffs[i] += adjustment;
        // 约束到合理范围
        coeffs[i] = Math.max(0.001, Math.min(0.5, coeffs[i]));
      }
      // 确保系数单调递减
      for (let i = 1; i < coeffs.length; i++) {
        coeffs[i] = Math.min(coeffs[i], coeffs[i - 1] * 0.9);
      }
    }

    // 更新第二周系数
    for (const [cardId, coeffs] of Object.entries(week2Coeffs)) {
      for (let i = 1; i < coeffs.length; i++) {
        const adjustment = -learningRate * error2 * 0.01;
        coeffs[i] += adjustment;
        coeffs[i] = Math.max(0.001, Math.min(0.5, coeffs[i]));
      }
      // 确保系数单调递减
      for (let i = 1; i < coeffs.length; i++) {
        coeffs[i] = Math.min(coeffs[i], coeffs[i - 1] * 0.9);
      }
    }

    // 自适应学习率
    if (iter > 5 && totalError > bestError * 1.2) {
      // 误差增大，减小学习率
      learningRate *= 0.8;
    } else if (iter > 5 && totalError < bestError * 0.9) {
      // 误差减小，增大学习率
      learningRate = Math.min(0.5, learningRate * 1.05);
    }
  }

  // 返回最佳结果（即使未收敛）
  return {
    coefficients: bestCoeffs,
    week1Rate: bestRates.week1,
    week2Rate: bestRates.week2,
    fullCollectionRate: bestRates.fullCollection,
    converged: bestError < tolerance * 4,
    iterations: maxIterations,
    finalError: bestError,
  };
}

/**
 * 生成系数报告（用于 UI 展示）
 */
export function generateCoefficientReport(solverResult: SolverResult): CoefficientResult {
  return {
    week1: solverResult.coefficients.week1,
    week2: solverResult.coefficients.week2,
    actualRates: {
      week1: solverResult.week1Rate,
      week2: solverResult.week2Rate,
    },
    fullCollectionRate: solverResult.fullCollectionRate,
    converged: solverResult.converged,
    iterations: solverResult.iterations,
    finalError: solverResult.finalError,
  };
}

/**
 * 快速求解（较少迭代，用于预览）
 */
export function solveCoefficientsQuick(
  setup: CardSetup,
  targetRate: number = 4.0,
  onProgress?: (progress: SolverProgress) => void
): SolverResult {
  return solveCoefficients(setup, targetRate, 0.2, 20, 15000, onProgress);
}
