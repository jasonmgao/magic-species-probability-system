/**
 * 🎯 降权系数求解器（经验公式 V3）
 *
 * 基于测试数据直接计算系数
 * - 7天3张稀有卡：coeff ≈ 0.008 → 4%
 * - 14天3张稀有卡：coeff ≈ 0.00003 → 4%
 *
 * 避免二分搜索的巨量计算，直接用经验公式
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

function countCardNeeds(cards: string[]): Map<string, number> {
  const needs = new Map<string, number>();
  for (const card of cards) {
    needs.set(card, (needs.get(card) || 0) + 1);
  }
  return needs;
}

/**
 * 🔑 核心：生成统一系数的配置
 *
 * 所有涉及当前周的卡，使用同一个 coefficient
 * - 持0张：系数1.0（不降权）
 * - 持1张或以上：使用搜索到的系数
 */
function createUniformCoefficients(
  needs: Map<string, number>,
  coeff: number
): Record<string, CardCoefficients> {
  const result: Record<string, CardCoefficients> = {};

  for (const [cardId, needCount] of needs.entries()) {
    const coeffs: CardCoefficients = [1.0]; // 持0张时系数为1

    // 持1张、2张……都用同一个系数
    for (let holdCount = 1; holdCount < needCount; holdCount++) {
      coeffs.push(coeff);
    }

    result[cardId] = coeffs;
  }

  return result;
}

/**
 * 🔍 二分搜索找正确系数
 *
 * 给定一个周配置，二分搜索合适的统一系数
 * 目标：完成率 ≈ targetRate
 */
async function binarySearchCoeff(
  setup: CardSetup,
  week: 'week1' | 'week2',
  targetRate: number,
  onProgress?: (rate: number, coeff: number) => void,
  fixedWeek1Coeffs?: Record<string, CardCoefficients>, // 搜索week2时传入
): Promise<{ coeff: number; finalRate: number }> {
  // 根据周确定搜索范围
  const isWeek1 = week === 'week1';
  const weekCombo = isWeek1 ? setup.week1 : setup.week2;
  const needs = countCardNeeds(weekCombo.cards);

  // 初始搜索范围（经验值）
  let low = isWeek1 ? 0.001 : 0.0001;   // 下限
  let high = isWeek1 ? 0.1 : 0.01;       // 上限

  // 先验证范围是否包含目标（少量trial快速定位）
  // 测试 low
  let coeffsLow = createUniformCoefficients(needs, low);
  let resLow = await simulateWeek(setup, week, coeffsLow, 2000, fixedWeek1Coeffs);
  await new Promise(r => setTimeout(r, 0));

  // 测试 high
  let coeffsHigh = createUniformCoefficients(needs, high);
  let resHigh = await simulateWeek(setup, week, coeffsHigh, 2000, fixedWeek1Coeffs);
  await new Promise(r => setTimeout(r, 0));

  // 如果范围不对，扩展范围（最多3次）
  let adjustAttempts = 0;
  while (resLow.rate > targetRate && adjustAttempts < 3) {
    low *= 0.5;
    coeffsLow = createUniformCoefficients(needs, low);
    resLow = await simulateWeek(setup, week, coeffsLow, 2000, fixedWeek1Coeffs);
    await new Promise(r => setTimeout(r, 0));
    adjustAttempts++;
  }
  adjustAttempts = 0;
  while (resHigh.rate < targetRate && adjustAttempts < 3) {
    high *= 2;
    coeffsHigh = createUniformCoefficients(needs, high);
    resHigh = await simulateWeek(setup, week, coeffsHigh, 2000, fixedWeek1Coeffs);
    await new Promise(r => setTimeout(r, 0));
    adjustAttempts++;
  }

  // 二分搜索
  let bestCoeff = (low + high) / 2;
  let bestRate = resLow.rate;
  let bestError = Math.abs(bestRate - targetRate);

  for (let iter = 0; iter < 6; iter++) {
    const mid = (low + high) / 2;
    const coeffsMid = createUniformCoefficients(needs, mid);
    const resMid = await simulateWeek(setup, week, coeffsMid, 4000, fixedWeek1Coeffs);

    const error = Math.abs(resMid.rate - targetRate);
    if (error < bestError) {
      bestError = error;
      bestCoeff = mid;
      bestRate = resMid.rate;
    }

    if (onProgress) {
      onProgress(resMid.rate, mid);
    }

    if (resMid.rate > targetRate) {
      // 完成率太高，系数太大，要降低
      high = mid;
    } else {
      // 完成率太低，系数太小，要提高
      low = mid;
    }

    // 让出主线程，避免卡死
    await new Promise(r => setTimeout(r, 0));

    // 如果已经够接近，提前退出
    if (bestError < 0.5) break;
  }

  return { coeff: bestCoeff, finalRate: bestRate };
}

/**
 * 模拟单个周的完成率（分块执行避免阻塞）
 *
 * 注意：搜索week2时需要传入week1Coeffs，否则前7天的降权不生效！
 */
async function simulateWeek(
  setup: CardSetup,
  week: 'week1' | 'week2',
  coefficients: Record<string, CardCoefficients>,
  trials: number,
  fixedWeek1Coeffs?: Record<string, CardCoefficients>, // 搜索week2时传入已固定的week1系数
): Promise<{ rate: number }> {
  const isWeek1 = week === 'week1';
  const weekCombo = isWeek1 ? setup.week1 : setup.week2;
  const deadline = weekCombo.deadline;

  // 构建完整的系数对象
  const fullCoeffs = {
    week1: isWeek1 ? coefficients : (fixedWeek1Coeffs || {}),
    week2: !isWeek1 ? coefficients : {},
  };

  let completed = 0;
  const allCards = new Set([...setup.week1.cards, ...setup.week2.cards]);

  // 分块执行，每500次让出一次主线程
  const chunkSize = 500;
  const chunks = Math.ceil(trials / chunkSize);
  const lastChunkSize = trials % chunkSize || chunkSize;

  for (let chunk = 0; chunk < chunks; chunk++) {
    const currentChunkSize = chunk === chunks - 1 ? lastChunkSize : chunkSize;

    for (let t = 0; t < currentChunkSize; t++) {
      const bag: Record<string, number> = {};
      const sched = generateSchedule().slice(0, deadline);
      const luckySet = new Set<string>();

      for (let d = 1; d <= deadline; d++) {
        const dt = sched[d - 1];
        const lc = getLuckyCard(dt, allCards, luckySet);
        for (let i = 0; i < 4; i++) {
          const c = drawOneCard(bag, setup, fullCoeffs, d, dt, lc);
          bag[c] = (bag[c] || 0) + 1;
        }
      }

      if (checkComboComplete(weekCombo, bag)) completed++;
    }

    // 让出主线程，允许UI更新
    if (chunk < chunks - 1) {
      await new Promise(r => setTimeout(r, 0));
    }
  }

  return { rate: (completed / trials) * 100 };
}

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

function checkComboComplete(combo: WeeklyCombo, backpack: Record<string, number>): boolean {
  const needs = countCardNeeds(combo.cards);
  for (const [card, need] of needs.entries()) {
    if ((backpack[card] || 0) < need) return false;
  }
  return true;
}

function checkFullCollection(backpack: Record<string, number>): boolean {
  return ALL_CARDS.every(card => (backpack[card] || 0) >= 1);
}

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

function drawOneCard(
  backpack: Record<string, number>,
  setup: CardSetup,
  coefficients: { week1: Record<string, CardCoefficients>; week2: Record<string, CardCoefficients> },
  day: number,
  dayType: 'common' | 'rare' | 'magic',
  luckyCard: string | null
): string {
  const isWeek1 = day <= 7;
  const currentCombo = isWeek1 ? setup.week1 : setup.week2;
  const currentCoeffs = isWeek1 ? coefficients.week1 : coefficients.week2;

  // 基础概率
  const rawProbs: Record<string, number> = {};
  const otherCards = ALL_CARDS.filter(c => c !== luckyCard);
  const otherTotal = otherCards.reduce((sum, c) => sum + getBaseProb(c), 0);

  for (const card of ALL_CARDS) {
    const baseProb = getBaseProb(card);
    if (luckyCard === card) {
      rawProbs[card] = LUCKY_FIXED_PROB;
    } else if (luckyCard !== null) {
      rawProbs[card] = (baseProb / otherTotal) * (100 - LUCKY_FIXED_PROB);
    } else {
      rawProbs[card] = baseProb;
    }
  }

  // 应用降权
  const weightedProbs: Record<string, number> = {};
  for (const card of ALL_CARDS) {
    const holdCount = backpack[card] || 0;
    const isInCurrentWeek = currentCombo.cards.includes(card);

    if (!isInCurrentWeek) {
      weightedProbs[card] = rawProbs[card];
    } else {
      const cardCoeffs = currentCoeffs[card];
      if (!cardCoeffs || holdCount === 0) {
        weightedProbs[card] = rawProbs[card];
      } else {
        // holdCount张后需要第holdCount+1张，用coeff[holdCount]
        const coeffIndex = Math.min(holdCount, cardCoeffs.length - 1);
        const coeff = cardCoeffs[coeffIndex];
        weightedProbs[card] = rawProbs[card] * coeff;
      }
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
 * 主入口：二分搜索找正确系数
 *
 * 策略：
 * 1. 对第一周二分搜索合适的统一系数
 * 2. 对第二周二分搜索合适的统一系数
 * 3. 两轮搜索独立进行，但模拟时要考虑完整的两周交互
 */
export async function solveCoefficientsAsync(
  setup: CardSetup,
  _targetRate: number = 4.0,
  onProgress?: (progress: SolverProgress) => void
): Promise<SolverResult> {
  // ========== 搜索第一周系数 ==========
  let w1BestCoeff = 0.01;
  let w1BestRate = 0;

  await binarySearchCoeff(
    setup,
    'week1',
    4.0,
    (rate, coeff) => {
      w1BestCoeff = coeff;
      w1BestRate = rate;
      if (onProgress) {
        onProgress({
          iteration: 1,
          totalIterations: 3,
          week1Rate: rate,
          week2Rate: 0,
          error: Math.abs(rate - 4),
          isConverged: false,
        });
      }
    }
  );

  // 用找到的第一周系数，搜索第二周
  const w1Needs = countCardNeeds(setup.week1.cards);
  const w1Coeffs = createUniformCoefficients(w1Needs, w1BestCoeff);

  // ========== 搜索第二周系数 ==========
  let w2BestCoeff = 0.001;
  let w2BestRate = 0;

  // 自定义第二周搜索（需要固定第一周系数）
  const w2Needs = countCardNeeds(setup.week2.cards);
  // 大幅向下调整初始范围 - 14天3张C无降权期望~3.9张，完成率极高
  // 要让完成率=4%，系数可能需要极低（1e-5或更低）
  let low = 1e-6;  // 1e-6 = 0.000001
  let high = 0.001; // 从0.001开始往下找

  // 立即回调显示开始第二周搜索
  if (onProgress) {
    onProgress({
      iteration: 2,
      totalIterations: 10,
      week1Rate: w1BestRate,
      week2Rate: 0,
      error: 100,
      isConverged: false,
    });
  }

  // 初步范围测试（更少的trial快速定位）
  let testLow = await simulateBothWeeks(setup, w1Coeffs, createUniformCoefficients(w2Needs, low), 1500);
  await new Promise(r => setTimeout(r, 0));
  let testHigh = await simulateBothWeeks(setup, w1Coeffs, createUniformCoefficients(w2Needs, high), 1500);
  await new Promise(r => setTimeout(r, 0));

  // 大幅扩展范围直到覆盖目标（最多5次）
  let w2AdjustAttempts = 0;
  while (testLow.week2Rate > 4.5 && low > 1e-8 && w2AdjustAttempts < 5) {
    low *= 0.1;  // 大幅降低
    testLow = await simulateBothWeeks(setup, w1Coeffs, createUniformCoefficients(w2Needs, low), 1500);
    await new Promise(r => setTimeout(r, 0));
    w2AdjustAttempts++;
  }
  w2AdjustAttempts = 0;
  while (testHigh.week2Rate < 3.5 && high < 0.1 && w2AdjustAttempts < 5) {
    high *= 2;
    testHigh = await simulateBothWeeks(setup, w1Coeffs, createUniformCoefficients(w2Needs, high), 1500);
    await new Promise(r => setTimeout(r, 0));
    w2AdjustAttempts++;
  }

  // 二分搜索第二周系数（更多迭代+实时更新进度）
  let bestW2Coeff = low;
  let bestW2Error = 100;

  for (let iter = 0; iter < 10; iter++) {  // 增加到10轮
    const mid = (low + high) / 2;
    const w2Coeffs = createUniformCoefficients(w2Needs, mid);
    const res = await simulateBothWeeks(setup, w1Coeffs, w2Coeffs, 3000);

    const error = Math.abs(res.week2Rate - 4);
    if (error < bestW2Error) {
      bestW2Error = error;
      bestW2Coeff = mid;
      w2BestRate = res.week2Rate;
    }

    // 每轮都更新进度条
    if (onProgress) {
      onProgress({
        iteration: 2 + iter,
        totalIterations: 12,
        week1Rate: w1BestRate,
        week2Rate: res.week2Rate,
        error: (Math.abs(w1BestRate - 4) + error),
        isConverged: false,
      });
    }

    if (res.week2Rate > 4.5) {
      high = mid;  // 太高，系数要降
    } else if (res.week2Rate < 3.5) {
      low = mid;   // 太低，系数要升
    } else {
      // 已经在3.5%-4.5%之间，很接近了
      bestW2Error = error;
      bestW2Coeff = mid;
      w2BestRate = res.week2Rate;
      break;
    }

    // 让出主线程
    await new Promise(r => setTimeout(r, 0));

    // 精度够就提前退出
    if (bestW2Error < 0.3) break;
  }

  w2BestCoeff = bestW2Coeff;

  if (onProgress) {
    onProgress({
      iteration: 3,
      totalIterations: 3,
      week1Rate: w1BestRate,
      week2Rate: w2BestRate,
      error: bestW2Error,
      isConverged: false,
    });
  }

  // ========== 最终结果 ==========
  const finalW2Coeffs = createUniformCoefficients(w2Needs, w2BestCoeff);
  const final = await simulateBothWeeks(setup, w1Coeffs, finalW2Coeffs, 12000);

  return {
    coefficients: { week1: w1Coeffs, week2: finalW2Coeffs },
    week1Rate: final.week1Rate,
    week2Rate: final.week2Rate,
    fullCollectionRate: final.fullCollectionRate,
    converged: bestW2Error < 0.5,
    iterations: 10,
    finalError: Math.abs(final.week1Rate - 4) + Math.abs(final.week2Rate - 4),
  };
}

/**
 * 模拟两周的完整游戏（用于最终验证，分块执行）
 */
async function simulateBothWeeks(
  setup: CardSetup,
  w1Coeffs: Record<string, CardCoefficients>,
  w2Coeffs: Record<string, CardCoefficients>,
  trials: number
): Promise<{ week1Rate: number; week2Rate: number; fullCollectionRate: number }> {
  let w1 = 0, w2 = 0, fc = 0;
  const allCards = new Set([...setup.week1.cards, ...setup.week2.cards]);

  // 分块执行，每500次让出一次主线程
  const chunkSize = 500;
  const chunks = Math.ceil(trials / chunkSize);
  const lastChunkSize = trials % chunkSize || chunkSize;

  for (let chunk = 0; chunk < chunks; chunk++) {
    const currentChunkSize = chunk === chunks - 1 ? lastChunkSize : chunkSize;

    for (let t = 0; t < currentChunkSize; t++) {
      // Week 1 simulation (7 days)
      const bag1: Record<string, number> = {};
      const sched1 = generateSchedule().slice(0, 7);
      const lucky1 = new Set<string>();
      for (let d = 1; d <= 7; d++) {
        const dt = sched1[d - 1];
        const lc = getLuckyCard(dt, allCards, lucky1);
        for (let i = 0; i < 4; i++) {
          const c = drawOneCard(bag1, setup, { week1: w1Coeffs, week2: w2Coeffs }, d, dt, lc);
          bag1[c] = (bag1[c] || 0) + 1;
        }
      }
      if (checkComboComplete(setup.week1, bag1)) w1++;

      // Full 2 weeks simulation (14 days)
      const bag2: Record<string, number> = {};
      const sched2 = generateSchedule();
      const lucky2a = new Set<string>(), lucky2b = new Set<string>();
      for (let d = 1; d <= 14; d++) {
        const dt = sched2[d - 1];
        const lc = getLuckyCard(dt, allCards, d <= 7 ? lucky2a : lucky2b);
        for (let i = 0; i < 4; i++) {
          const c = drawOneCard(bag2, setup, { week1: w1Coeffs, week2: w2Coeffs }, d, dt, lc);
          bag2[c] = (bag2[c] || 0) + 1;
        }
      }
      if (checkComboComplete(setup.week2, bag2)) w2++;
      if (checkFullCollection(bag2)) fc++;
    }

    // 让出主线程
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
