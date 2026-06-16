/**
 * 🎯 降权系数求解器（V6.2 - 统一全局系数 + 跨周同压）
 *
 * V6.2 关键改版：
 * 1. 每张卡只有一个全局系数（不再分 week1/week2）
 * 2. 无论当周还是跨周，同一卡的超额副本受同一系数压制
 * 3. 极大增强跨周压制力，解决"第一周不压第二周卡"的问题
 *
 * 结构变化：
 * - V6.1: coeffs[week][card] = [1.0, c_w]
 * - V6.2: coeffs[card] = [1.0, c_global]
 *
 * 效果：
 * - AAB/CCC：A 的系数 0.05，C 的系数 0.06
 * - 第一周抽 A：excess>0 → 系数 0.05
 * - 第一周抽 C（跨周）：excess>0 → 系数 0.06（严格压制！）
 * - 第二周抽 C：excess>0 → 系数 0.06（同样压制）
 */

import type { CardSetup, WeeklyCombo, CoefficientResult, CardCoefficients, SolverProgress } from '@/types';

export const ALL_CARDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

const BASE_PROBS: Record<string, number> = {
  A: 2,
  B: 7, C: 7, D: 7, E: 7,
  F: 14, G: 14, H: 14, I: 14, J: 14,
};

const LUCKY_FIXED_PROB = 1.2;

export function getCardType(card: string): 'common' | 'rare' | 'magic' {
  if (card === 'A') return 'magic';
  if (['B', 'C', 'D', 'E'].includes(card)) return 'rare';
  return 'common';
}

export function getBaseProb(card: string): number {
  return BASE_PROBS[card] ?? 14;
}

/** 统计 combo 需求：卡名 → 需求数量 */
function countCardNeeds(cards: string[]): Map<string, number> {
  const needs = new Map<string, number>();
  for (const card of cards) {
    needs.set(card, (needs.get(card) || 0) + 1);
  }
  return needs;
}

/** V6.2: 计算某卡在某 combo 中的超额副本数
 * 例如 combo 是 CCF，卡是 C，背包有 3 张 C：
 * - CCF 需求 C×2，超额槽位 = 1（第 2 张 C）
 * - 背包 3 张 C，理论超额 = 3-1 = 2
 * - 实际超额 = min(2, 1) = 1
 */
function getExcessCount(combo: WeeklyCombo, backpack: Record<string, number>, card: string): number {
  const need = countCardNeeds(combo.cards).get(card) || 0;
  if (need <= 1) return 0;
  const have = backpack[card] || 0;
  const theoreticalExcess = Math.max(0, have - 1);
  return Math.min(theoreticalExcess, need - 1);
}

/** V6.2: 创建全局系数（每卡一个系数）
 * 返回 Record<卡名, [1.0, coeff]>
 * 只有 combo 中出现的卡才有非 1.0 的系数
 */
function createGlobalCoefficients(
  setup: CardSetup,
  baseCoeffMap: Record<string, number>
): Record<string, CardCoefficients> {
  const w1Needs = countCardNeeds(setup.week1.cards);
  const w2Needs = countCardNeeds(setup.week2.cards);

  const result: Record<string, CardCoefficients> = {};

  for (const card of ALL_CARDS) {
    const w1Need = w1Needs.get(card) || 0;
    const w2Need = w2Needs.get(card) || 0;
    const maxNeed = Math.max(w1Need, w2Need);

    if (maxNeed > 1) {
      // 该卡至少在一周有超额槽位，需要系数
      const coeff = baseCoeffMap[card] ?? 0.1;
      result[card] = [1.0, coeff];
    } else {
      // 该卡没有超额槽位（最多需求 1 张），无需降权
      result[card] = [1.0];
    }
  }

  return result;
}

/** 简化版：所有 combo 卡用同一系数创建 */
function createSimpleCoefficients(
  setup: CardSetup,
  coeffValue: number
): Record<string, CardCoefficients> {
  const baseMap: Record<string, number> = {};
  const allComboCards = new Set([...setup.week1.cards, ...setup.week2.cards]);
  for (const card of allComboCards) {
    baseMap[card] = coeffValue;
  }
  return createGlobalCoefficients(setup, baseMap);
}

/** 检查 combo 是否完成 */
function checkComboComplete(combo: WeeklyCombo, backpack: Record<string, number>): boolean {
  const needs = countCardNeeds(combo.cards);
  for (const [card, need] of needs.entries()) {
    if ((backpack[card] || 0) < need) return false;
  }
  return true;
}

/** 检查全收集 */
function checkFullCollection(backpack: Record<string, number>): boolean {
  return ALL_CARDS.every(card => (backpack[card] || 0) >= 1);
}

/** 生成每日类型表（两周） */
function generateSchedule(): Array<'common' | 'rare' | 'magic'> {
  const week = ['common', 'common', 'common', 'common', 'common', 'rare', 'magic'] as Array<'common' | 'rare' | 'magic'>;
  const shuffle = (arr: Array<'common' | 'rare' | 'magic'>) => {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };
  return [...shuffle(week), ...shuffle(week)];
}

/** 获取幸运卡 */
function getLuckyCard(
  dayType: 'common' | 'rare' | 'magic',
  comboCards: Set<string>,
  weekHasLucky: Set<string>
): string | null {
  const typeKey = `${dayType}_lucky`;
  if (weekHasLucky.has(typeKey)) return null;

  let candidates: string[] = [];
  if (dayType === 'magic') {
    candidates = ['A'];
  } else if (dayType === 'rare') {
    const rareCards = ['B', 'C', 'D', 'E'];
    candidates = rareCards.filter(c => comboCards.has(c));
    if (candidates.length === 0) candidates = rareCards;
  } else {
    const commonCards = ['F', 'G', 'H', 'I', 'J'];
    candidates = commonCards.filter(c => comboCards.has(c));
    if (candidates.length === 0) candidates = commonCards;
  }

  if (candidates.length === 0) return null;
  weekHasLucky.add(typeKey);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/**
 * 🔑 V6.2 抽卡核心逻辑（全局统一系数 + 跨周同压）
 *
 * 关键变化：
 * - coefficients 现在是 Record<卡名, CardCoefficients>（不再有 week1/week2 分层）
 * - 对任意卡，计算其在当前周的 excess 和跨周的 excess
 * - 只要任一 excess > 0，就应用该卡的全局系数
 *
 * 压制逻辑：
 * - 如果卡在当前周有超额：应用系数（降低本周继续出该卡的概率）
 * - 如果卡在跨周有超额：同样应用系数（降低屯跨周卡的概率）
 * - 结果是：同一卡无论在哪一周被抽到，只要有超额就压制
 */
function drawOneCard(
  backpack: Record<string, number>,
  setup: CardSetup,
  coefficients: Record<string, CardCoefficients>,  // V6.2 全局系数
  day: number,
  dayType: 'common' | 'rare' | 'magic',
  luckyCard: string | null
): string {
  const isWeek1 = day <= 7;
  const currentCombo = isWeek1 ? setup.week1 : setup.week2;
  const crossCombo = isWeek1 ? setup.week2 : setup.week1;

  // 计算各卡系数
  const weightedProbs: Record<string, number> = {};
  for (const card of ALL_CARDS) {
    const coeffArray = coefficients[card] || [1.0];

    // 计算该卡在当前周和跨周的超额数
    const currentExcess = currentCombo.cards.includes(card)
      ? getExcessCount(currentCombo, backpack, card)
      : 0;
    const crossExcess = crossCombo.cards.includes(card)
      ? getExcessCount(crossCombo, backpack, card)
      : 0;

    // V6.2：只要任一 excess > 0 就应用降权（跨周同压！）
    const hasExcess = currentExcess > 0 || crossExcess > 0;
    const coeff = hasExcess ? (coeffArray[1] ?? 1.0) : 1.0;

    weightedProbs[card] = getBaseProb(card) * coeff;
  }

  // 幸运卡处理（同样受全局系数影响）
  if (luckyCard) {
    const luckyCurrentExcess = currentCombo.cards.includes(luckyCard)
      ? getExcessCount(currentCombo, backpack, luckyCard)
      : 0;
    const luckyCrossExcess = crossCombo.cards.includes(luckyCard)
      ? getExcessCount(crossCombo, backpack, luckyCard)
      : 0;

    const luckyHasExcess = luckyCurrentExcess > 0 || luckyCrossExcess > 0;
    const luckyCoeffArray = coefficients[luckyCard] || [1.0];
    const luckyCoeff = luckyHasExcess ? (luckyCoeffArray[1] ?? 1.0) : 1.0;

    // 幸运卡概率重分配
    const luckyBonus = LUCKY_FIXED_PROB;
    const currentTotal = Object.values(weightedProbs).reduce((a, b) => a + b, 0);

    if (currentTotal > 0) {
      const deductionRatio = luckyBonus / currentTotal;
      for (const card of ALL_CARDS) {
        if (card === luckyCard) {
          weightedProbs[card] = weightedProbs[card] * luckyCoeff + luckyBonus;
        } else {
          weightedProbs[card] *= (1 - deductionRatio);
        }
      }
    } else {
      weightedProbs[luckyCard] = luckyBonus;
    }
  }

  // 归一化
  const total = Object.values(weightedProbs).reduce((a, b) => a + b, 0);
  if (total <= 0) return 'A';

  const normalized: Record<string, number> = {};
  for (const card of ALL_CARDS) {
    normalized[card] = (weightedProbs[card] / total) * 100;
  }

  // 轮盘赌
  let r = Math.random() * 100;
  for (const card of ALL_CARDS) {
    r -= normalized[card];
    if (r <= 0) return card;
  }
  return 'A';
}

/**
 * 模拟单周完成率
 */
async function simulateWeek(
  setup: CardSetup,
  week: 'week1' | 'week2',
  coefficients: Record<string, CardCoefficients>,  // V6.2 全局系数
  trials: number,
): Promise<{ rate: number }> {
  const weekCombo = week === 'week1' ? setup.week1 : setup.week2;
  const deadline = weekCombo.deadline;

  let completed = 0;
  const allCards = new Set([...setup.week1.cards, ...setup.week2.cards]);
  const dailyDraws = setup.dailyDraws || 4;

  const chunkSize = 500;
  const chunks = Math.ceil(trials / chunkSize);

  for (let chunk = 0; chunk < chunks; chunk++) {
    const currentChunkSize = chunk === chunks - 1 ? (trials % chunkSize || chunkSize) : chunkSize;

    for (let t = 0; t < currentChunkSize; t++) {
      const bag: Record<string, number> = {};
      const sched = generateSchedule().slice(0, deadline);
      const luckySet = new Set<string>();

      for (let d = 1; d <= deadline; d++) {
        const dt = sched[d - 1];
        const lc = getLuckyCard(dt, allCards, luckySet);
        for (let i = 0; i < dailyDraws; i++) {
          const c = drawOneCard(bag, setup, coefficients, d, dt, lc);
          bag[c] = (bag[c] || 0) + 1;
        }
      }

      if (checkComboComplete(weekCombo, bag)) completed++;
    }

    if (chunk < chunks - 1) {
      await new Promise(r => setTimeout(r, 0));
    }
  }

  return { rate: (completed / trials) * 100 };
}

/**
 * 模拟两周完整游戏
 */
async function simulateBothWeeks(
  setup: CardSetup,
  coefficients: Record<string, CardCoefficients>,  // V6.2 全局系数
  trials: number
): Promise<{ week1Rate: number; week2Rate: number; fullCollectionRate: number }> {
  let w1 = 0, w2 = 0, fc = 0;
  const allCards = new Set([...setup.week1.cards, ...setup.week2.cards]);
  const dailyDraws = setup.dailyDraws || 4;

  const chunkSize = 500;
  const chunks = Math.ceil(trials / chunkSize);

  for (let chunk = 0; chunk < chunks; chunk++) {
    const currentChunkSize = chunk === chunks - 1 ? (trials % chunkSize || chunkSize) : chunkSize;

    for (let t = 0; t < currentChunkSize; t++) {
      // Week 1
      const bag1: Record<string, number> = {};
      const sched1 = generateSchedule().slice(0, 7);
      const lucky1 = new Set<string>();
      for (let d = 1; d <= 7; d++) {
        const dt = sched1[d - 1];
        const lc = getLuckyCard(dt, allCards, lucky1);
        for (let i = 0; i < dailyDraws; i++) {
          const c = drawOneCard(bag1, setup, coefficients, d, dt, lc);
          bag1[c] = (bag1[c] || 0) + 1;
        }
      }
      if (checkComboComplete(setup.week1, bag1)) w1++;

      // Full 2 weeks
      const bag2: Record<string, number> = {};
      const sched2 = generateSchedule();
      const lucky2a = new Set<string>(), lucky2b = new Set<string>();
      for (let d = 1; d <= 14; d++) {
        const dt = sched2[d - 1];
        const lc = getLuckyCard(dt, allCards, d <= 7 ? lucky2a : lucky2b);
        for (let i = 0; i < dailyDraws; i++) {
          const c = drawOneCard(bag2, setup, coefficients, d, dt, lc);
          bag2[c] = (bag2[c] || 0) + 1;
        }
      }
      if (checkComboComplete(setup.week2, bag2)) w2++;
      if (checkFullCollection(bag2)) fc++;
    }

    if (chunk < chunks - 1) {
      await new Promise(r => setTimeout(r, 0));
    }
  }

  return {
    week1Rate: (w1 / trials) * 100,
    week2Rate: (w2 / trials) * 100,
    fullCollectionRate: (fc / trials) * 100,
  };
}

export interface SolverResult {
  coefficients: Record<string, CardCoefficients>;  // V6.2 全局系数
  week1Rate: number;
  week2Rate: number;
  fullCollectionRate: number;
  converged: boolean;
  iterations: number;
  finalError: number;
}

/**
 * V6.2 主求解器：迭代优化，同时考虑两周约束
 *
 * 策略：联合搜索 - 同时调整两组系数，最小化总误差
 * 因为 V6.2 系数是全局的，w1 和 w2 会影响彼此，必须联合优化
 */
export async function solveCoefficientsAsync(
  setup: CardSetup,
  _targetRate: number = 4.0,
  onProgress?: (progress: SolverProgress) => void
): Promise<SolverResult> {
  // 确定需要系数的卡（在至少一周有超额槽位的卡）
  const w1Needs = countCardNeeds(setup.week1.cards);
  const w2Needs = countCardNeeds(setup.week2.cards);
  const cardsNeedingCoeff = new Set<string>();
  for (const card of ALL_CARDS) {
    if ((w1Needs.get(card) || 0) > 1 || (w2Needs.get(card) || 0) > 1) {
      cardsNeedingCoeff.add(card);
    }
  }

  // V6.2 简化：所有需要系数的卡使用同一值
  // 这样可以大幅减少搜索空间（1维搜索 vs n维搜索）
  // 如果需要差异化，可以后续扩展为每卡独立搜索

  // ===== 粗网格搜索全局系数 =====
  // 范围：0.01 ~ 0.5（更严格的范围，因为统一系数压制力更强）
  const coarseGrid = [0.005, 0.01, 0.02, 0.03, 0.05, 0.07, 0.1, 0.15, 0.2, 0.3, 0.5];
  let bestCoeff = 0.05;
  let bestW1Rate = 0;
  let bestW2Rate = 0;
  let bestTotalError = 1000;

  for (let i = 0; i < coarseGrid.length; i++) {
    const coeff = coarseGrid[i];
    const testCoeffs = createSimpleCoefficients(setup, coeff);
    const res = await simulateBothWeeks(setup, testCoeffs, 2000);

    // 总误差：与 4%/4% 的偏差之和
    const error = Math.abs(res.week1Rate - 4) + Math.abs(res.week2Rate - 4);

    if (error < bestTotalError) {
      bestTotalError = error;
      bestCoeff = coeff;
      bestW1Rate = res.week1Rate;
      bestW2Rate = res.week2Rate;
    }

    if (onProgress) {
      onProgress({
        iteration: 1 + i / coarseGrid.length,
        totalIterations: 3,
        week1Rate: res.week1Rate,
        week2Rate: res.week2Rate,
        error: error,
        isConverged: false,
      });
    }
  }

  // ===== 细网格搜索 =====
  const fineLow = Math.max(0.001, bestCoeff * 0.5);
  const fineHigh = Math.min(0.8, bestCoeff * 2);
  const fineSteps = 24;

  for (let i = 0; i <= fineSteps; i++) {
    const coeff = fineLow + (fineHigh - fineLow) * i / fineSteps;
    const testCoeffs = createSimpleCoefficients(setup, coeff);
    const res = await simulateBothWeeks(setup, testCoeffs, 3000);

    const error = Math.abs(res.week1Rate - 4) + Math.abs(res.week2Rate - 4);

    if (error < bestTotalError) {
      bestTotalError = error;
      bestCoeff = coeff;
      bestW1Rate = res.week1Rate;
      bestW2Rate = res.week2Rate;
    }

    if (onProgress) {
      onProgress({
        iteration: 2 + i / fineSteps,
        totalIterations: 3,
        week1Rate: res.week1Rate,
        week2Rate: res.week2Rate,
        error: error,
        isConverged: false,
      });
    }
  }

  if (onProgress) {
    onProgress({
      iteration: 3,
      totalIterations: 3,
      week1Rate: bestW1Rate,
      week2Rate: bestW2Rate,
      error: bestTotalError,
      isConverged: false,
    });
  }

  // ===== 最终验证 =====
  const finalCoeffs = createSimpleCoefficients(setup, bestCoeff);
  const final = await simulateBothWeeks(setup, finalCoeffs, 12000);

  return {
    coefficients: finalCoeffs,
    week1Rate: final.week1Rate,
    week2Rate: final.week2Rate,
    fullCollectionRate: final.fullCollectionRate,
    converged: bestTotalError < 1.0,
    iterations: 36, // 11 + 25
    finalError: Math.abs(final.week1Rate - 4) + Math.abs(final.week2Rate - 4),
  };
}

/**
 * 生成系数报告（兼容 UI，统一到 week1/week2 格式）
 */
export function generateCoefficientReport(
  solverResult: SolverResult,
  setup: CardSetup
): CoefficientResult {
  const w1Needs = countCardNeeds(setup.week1.cards);
  const w2Needs = countCardNeeds(setup.week2.cards);

  // 转换到旧格式（UI 兼容）
  const week1Coeffs: Record<string, CardCoefficients> = {};
  const week2Coeffs: Record<string, CardCoefficients> = {};

  for (const card of ALL_CARDS) {
    const globalCoeff = solverResult.coefficients[card];

    // Week1 格式：该卡需求决定系数数组长度
    const w1Need = w1Needs.get(card) || 0;
    if (w1Need > 1) {
      const arr: CardCoefficients = [1.0];
      for (let i = 1; i < w1Need; i++) {
        arr.push(globalCoeff[1] ?? 1.0);
      }
      week1Coeffs[card] = arr;
    } else {
      week1Coeffs[card] = [1.0];
    }

    // Week2 同理
    const w2Need = w2Needs.get(card) || 0;
    if (w2Need > 1) {
      const arr: CardCoefficients = [1.0];
      for (let i = 1; i < w2Need; i++) {
        arr.push(globalCoeff[1] ?? 1.0);
      }
      week2Coeffs[card] = arr;
    } else {
      week2Coeffs[card] = [1.0];
    }
  }

  return {
    week1: week1Coeffs,
    week2: week2Coeffs,
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
