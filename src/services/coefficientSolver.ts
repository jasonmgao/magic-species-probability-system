/**
 * 🎯 降权系数求解器（V6.3 - 多系数差异化版本）
 *
 * V6.3 核心改版：
 * 1. 每张卡有自己的独立系数（不再是全系统一）
 * 2. 超额槽位越少的卡，系数应该越低（更严格）
 * 3. 多维度网格搜索优化
 *
 * 关键洞察：
 * - 超额槽位 = 1 的卡（如 HHF 的 H）：只有 1 次降权机会，必须极严（0.005~0.02）
 * - 超额槽位 = 2 的卡（如 AAA 的 A）：有 2 次降权机会，可以稍宽（0.02~0.05）
 * - 超额槽位多 = 更难完成 = 需要系数帮助更多 = 系数可以高一些
 */

import type { CardSetup, WeeklyCombo, CoefficientResult, CardCoefficients, SolverProgress } from '@/types';

export const ALL_CARDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

const BASE_PROBS: Record<string, number> = {
  A: 2, B: 7, C: 7, D: 7, E: 7,
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

/** 计算某卡在某 combo 中的最大超额槽位数 */
function getMaxExcessSlots(combo: WeeklyCombo, card: string): number {
  const need = countCardNeeds(combo.cards).get(card) || 0;
  return Math.max(0, need - 1);
}

/** 计算某卡在某 combo 中的实际超额副本数 */
function getExcessCount(combo: WeeklyCombo, backpack: Record<string, number>, card: string): number {
  const need = countCardNeeds(combo.cards).get(card) || 0;
  if (need <= 1) return 0;
  const have = backpack[card] || 0;
  return Math.min(Math.max(0, have - 1), need - 1);
}

/** 获取某卡的全局最大超额槽位数（取两周最大值） */
function getGlobalMaxExcessSlots(setup: CardSetup, card: string): number {
  return Math.max(
    getMaxExcessSlots(setup.week1, card),
    getMaxExcessSlots(setup.week2, card)
  );
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
 * 🔑 V6.3 抽卡核心逻辑（多系数差异化）
 *
 * 变化：coefficients 是 Record<卡名, CardCoefficients>
 * 每张卡有自己的系数，根据该卡的全局超额槽位决定其严格程度
 */
function drawOneCard(
  backpack: Record<string, number>,
  setup: CardSetup,
  coefficients: Record<string, CardCoefficients>,
  day: number,
  dayType: 'common' | 'rare' | 'magic',
  luckyCard: string | null
): string {
  const isWeek1 = day <= 7;
  const currentCombo = isWeek1 ? setup.week1 : setup.week2;
  const crossCombo = isWeek1 ? setup.week2 : setup.week1;

  const weightedProbs: Record<string, number> = {};
  for (const card of ALL_CARDS) {
    const coeffArray = coefficients[card] || [1.0];
    const currentExcess = currentCombo.cards.includes(card)
      ? getExcessCount(currentCombo, backpack, card)
      : 0;
    const crossExcess = crossCombo.cards.includes(card)
      ? getExcessCount(crossCombo, backpack, card)
      : 0;

    // V6.3：多卡多系数，但逻辑不变 - 有超额就降权
    const hasExcess = currentExcess > 0 || crossExcess > 0;
    const coeff = hasExcess ? (coeffArray[1] ?? 1.0) : 1.0;

    weightedProbs[card] = getBaseProb(card) * coeff;
  }

  // 幸运卡处理
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

  let r = Math.random() * 100;
  for (const card of ALL_CARDS) {
    r -= normalized[card];
    if (r <= 0) return card;
  }
  return 'A';
}

/**
 * 模拟两周完整游戏（多系数版）
 */
async function simulateBothWeeks(
  setup: CardSetup,
  coefficients: Record<string, CardCoefficients>,
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

/**
 * 统计所有需要降权的卡及其超额槽位
 */
function getCardsNeedingCoeff(setup: CardSetup): Array<{ card: string; maxExcess: number }> {
  const result: Array<{ card: string; maxExcess: number }> = [];
  const seen = new Set<string>();

  for (const card of ALL_CARDS) {
    const maxExcess = getGlobalMaxExcessSlots(setup, card);
    if (maxExcess > 0 && !seen.has(card)) {
      seen.add(card);
      result.push({ card, maxExcess });
    }
  }

  return result.sort((a, b) => a.maxExcess - b.maxExcess); // 按超额槽位从小到大排序
}

export interface SolverResult {
  coefficients: Record<string, CardCoefficients>;
  week1Rate: number;
  week2Rate: number;
  fullCollectionRate: number;
  converged: boolean;
  iterations: number;
  finalError: number;
}

/**
 * 🔍 V6.3 多系数分层搜索
 *
 * 策略：
 * 1. 识别系统中所有需要系数的卡
 * 2. 按超额槽位数分层（槽位少的更严格）
 * 3. 使用罚分机制，槽位少的卡系数上限更低
 *
 * 简化版：两层系数
 * - 层1（超额槽位=1）：极严格，范围 0.001 ~ 0.02
 * - 层2（超额槽位≥2）：较宽松，范围 0.01 ~ 0.3
 */
export async function solveCoefficientsAsync(
  setup: CardSetup,
  _targetRate: number = 4.0,
  onProgress?: (progress: SolverProgress) => void
): Promise<SolverResult> {
  const cardsNeedingCoeff = getCardsNeedingCoeff(setup);

  // 分离两层
  const tier1Cards = cardsNeedingCoeff.filter(c => c.maxExcess === 1).map(c => c.card);
  const tier2Cards = cardsNeedingCoeff.filter(c => c.maxExcess >= 2).map(c => c.card);

  // 两层分别搜索的范围
  const tier1Range = [0.001, 0.002, 0.005, 0.008, 0.01, 0.015, 0.02, 0.03, 0.05];
  const tier2Range = [0.01, 0.02, 0.03, 0.05, 0.08, 0.1, 0.15, 0.2, 0.3, 0.5];

  let bestCoeff1 = 0.005;
  let bestCoeff2 = 0.05;
  let bestW1Rate = 0;
  let bestW2Rate = 0;
  let bestTotalError = 1000;
  let iterCount = 0;
  const totalIters = tier1Range.length * tier2Range.length;

  // 网格搜索两层系数组合
  for (const c1 of tier1Range) {
    for (const c2 of tier2Range) {
      // 构建系数表
      const testCoeffs: Record<string, CardCoefficients> = {};
      for (const card of ALL_CARDS) {
        const maxExcess = getGlobalMaxExcessSlots(setup, card);
        if (maxExcess === 1) {
          testCoeffs[card] = [1.0, c1];
        } else if (maxExcess >= 2) {
          testCoeffs[card] = [1.0, c2];
        } else {
          testCoeffs[card] = [1.0];
        }
      }

      const res = await simulateBothWeeks(setup, testCoeffs, 1500);
      const error = Math.abs(res.week1Rate - 4) + Math.abs(res.week2Rate - 4);

      if (error < bestTotalError) {
        bestTotalError = error;
        bestCoeff1 = c1;
        bestCoeff2 = c2;
        bestW1Rate = res.week1Rate;
        bestW2Rate = res.week2Rate;
      }

      iterCount++;
      if (onProgress && iterCount % 5 === 0) {
        onProgress({
          iteration: iterCount / totalIters * 2, // 前2/3是粗网格
          totalIterations: 3,
          week1Rate: bestW1Rate,
          week2Rate: bestW2Rate,
          error: bestTotalError,
          isConverged: false,
        });
      }
    }
  }

  // 细网格优化（在最佳点附近）
  const fine1Steps = 10;
  const fine2Steps = 10;
  const fine1Low = Math.max(0.0005, bestCoeff1 * 0.5);
  const fine1High = Math.min(0.1, bestCoeff1 * 2);
  const fine2Low = Math.max(0.005, bestCoeff2 * 0.5);
  const fine2High = Math.min(0.8, bestCoeff2 * 2);

  for (let i = 0; i <= fine1Steps; i++) {
    for (let j = 0; j <= fine2Steps; j++) {
      const c1 = fine1Low + (fine1High - fine1Low) * i / fine1Steps;
      const c2 = fine2Low + (fine2High - fine2Low) * j / fine2Steps;

      const testCoeffs: Record<string, CardCoefficients> = {};
      for (const card of ALL_CARDS) {
        const maxExcess = getGlobalMaxExcessSlots(setup, card);
        if (maxExcess === 1) {
          testCoeffs[card] = [1.0, c1];
        } else if (maxExcess >= 2) {
          testCoeffs[card] = [1.0, c2];
        } else {
          testCoeffs[card] = [1.0];
        }
      }

      const res = await simulateBothWeeks(setup, testCoeffs, 2500);
      const error = Math.abs(res.week1Rate - 4) + Math.abs(res.week2Rate - 4);

      if (error < bestTotalError) {
        bestTotalError = error;
        bestCoeff1 = c1;
        bestCoeff2 = c2;
        bestW1Rate = res.week1Rate;
        bestW2Rate = res.week2Rate;
      }
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

  // 最终验证
  const finalCoeffs: Record<string, CardCoefficients> = {};
  for (const card of ALL_CARDS) {
    const maxExcess = getGlobalMaxExcessSlots(setup, card);
    if (maxExcess === 1) {
      finalCoeffs[card] = [1.0, bestCoeff1];
    } else if (maxExcess >= 2) {
      finalCoeffs[card] = [1.0, bestCoeff2];
    } else {
      finalCoeffs[card] = [1.0];
    }
  }

  const final = await simulateBothWeeks(setup, finalCoeffs, 12000);

  return {
    coefficients: finalCoeffs,
    week1Rate: final.week1Rate,
    week2Rate: final.week2Rate,
    fullCollectionRate: final.fullCollectionRate,
    converged: bestTotalError < 1.0,
    iterations: iterCount + (fine1Steps + 1) * (fine2Steps + 1) + 1,
    finalError: Math.abs(final.week1Rate - 4) + Math.abs(final.week2Rate - 4),
  };
}

/**
 * 生成系数报告（UI 兼容格式）
 */
export function generateCoefficientReport(
  solverResult: SolverResult,
  setup: CardSetup
): CoefficientResult {
  const w1Needs = countCardNeeds(setup.week1.cards);
  const w2Needs = countCardNeeds(setup.week2.cards);

  const week1Coeffs: Record<string, CardCoefficients> = {};
  const week2Coeffs: Record<string, CardCoefficients> = {};

  for (const card of ALL_CARDS) {
    const globalCoeff = solverResult.coefficients[card];
    const w1Need = w1Needs.get(card) || 0;
    const w2Need = w2Needs.get(card) || 0;

    if (w1Need > 1) {
      const arr: CardCoefficients = [1.0];
      for (let i = 1; i < w1Need; i++) {
        arr.push(globalCoeff[1] ?? 1.0);
      }
      week1Coeffs[card] = arr;
    } else {
      week1Coeffs[card] = [1.0];
    }

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
