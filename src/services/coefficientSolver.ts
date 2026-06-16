/**
 * 🎯 降权系数求解器（V6 - 按槽位降权版）
 *
 * V6核心改版：
 * 1. 只对卡组中的【超过第1张】的卡生效降权
 * 2. 例如 AAB：第一张A正常，第二张A降权；B只有1张，无降权
 * 3. 例如 AAA：第一张A正常，第二、第三张A都降权
 * 4. 例如 AABB：第二张A和第二张B都降权
 * 5. 幸运卡也受降权影响
 *
 * 跨周关联保留：持有另一周的卡也影响本周概率
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

/**
 * 构建卡组需求映射：卡名 → 需求数量
 */
function countCardNeeds(cards: string[]): Map<string, number> {
  const needs = new Map<string, number>();
  for (const card of cards) {
    needs.set(card, (needs.get(card) || 0) + 1);
  }
  return needs;
}

/**
 * V6核心：计算某卡在卡组中的"超额槽位数"（需要降的位置数）
 * 返回：对于该卡，哪些"超出第1张"的副本需要应用系数
 *
 * 例如 AAA 返回 for card 'A': { totalNeeded: 3, reductionSlots: 2, firstFreeSlot: 1 }
 * 表示：需要3张A，其中2个位置(第2、3张)需要降权，第1个位置(0-indexed)不扮权
 */
function getCardReductionInfo(combo: WeeklyCombo, card: string): {
  totalNeeded: number;
  reductionSlots: number;  // 需要降权的副本数
  firstSlotIsFree: boolean; // 第1张是否不降权
} {
  const needs = countCardNeeds(combo.cards);
  const needed = needs.get(card) || 0;
  return {
    totalNeeded: needed,
    reductionSlots: Math.max(0, needed - 1),  // 超过1张的部分需要降
    firstSlotIsFree: needed > 0, // 只要有需求，第1张就不降
  };
}

/**
 * V6核心：计算玩家背包中某卡的【应该被降权的持有数】
 *
 * 对于卡组 AAA：
 *   - 玩家有0张A：降权数=0
 *   - 玩家有1张A（完成第1张）：降权数=0（第1张总是不降）
 *   - 玩家有2张A（已超第1张, 占用第2张位置）：降权数=1
 *   - 玩家有3张A（已超第1张, 占用第2、3张位置）：降权数=2
 *   - 玩家有4张A（已超需求）：降权数=2（最多降到需求所需）
 *
 * 对于卡组 AAB：
 *   - 玩家有1张A：降权数=0
 *   - 玩家有2张A：降权数=1（第2张A需要降）
 *   - 玩家有3张A（超过所需2张）：降权数=1（最多降到需求-1=1）
 *   - 玩家有1张B：降权数=0（B只有1张需求，无第2张）
 */
function getReductionHoldCount(combo: WeeklyCombo, backpack: Record<string, number>, card: string): number {
  const needs = countCardNeeds(combo.cards);
  const needed = needs.get(card) || 0;
  const have = backpack[card] || 0;

  if (needed <= 1) return 0; // 只需要1张，没有第2张需要降

  // 超过第1张的持有数 = max(0, have - 1)
  // 但不超过所需的超额数 = needed - 1
  const excessHave = Math.max(0, have - 1);
  const maxReduction = needed - 1;
  return Math.min(excessHave, maxReduction);
}

/**
 * V6: 计算某周的总降权槽位需求
 * 用于确定系数数组大小
 */
function getTotalReductionSlots(combo: WeeklyCombo): number {
  const needs = countCardNeeds(combo.cards);
  let total = 0;
  for (const [card, need] of needs.entries()) {
    total += Math.max(0, need - 1); // 每张卡的需求-1（第1张不降）
  }
  return total;
}

/**
 * V6: 按周创建系数数组
 * 长度为：总降权槽位数，例如 AAB → 1个槽位（第2张A），AAA → 2个槽位（第2、3张A）
 *
 * 简化策略：所有超额槽位使用相同系数
 * 如果设计了差异化系数，这里可以扩展
 */
function createProgressCoefficients(combo: WeeklyCombo, coeff: number): CardCoefficients {
  const totalSlots = getTotalReductionSlots(combo);
  const coefficients: CardCoefficients = [1.0]; // 索引0是第1张的系数（总是1.0）

  // 索引1对应第2张开始的超额卡
  if (totalSlots > 0) {
    // 可以使用相同系数，也可以差异化
    // 先用相同系数更简单
    coefficients.push(coeff);
  }

  return coefficients;
}

/**
 * 创建完整系数配置
 */
function createFullCoefficients(
  setup: CardSetup,
  week1Coeff: number,
  week2Coeff: number
): { week1: CardCoefficients; week2: CardCoefficients } {
  return {
    week1: createProgressCoefficients(setup.week1, week1Coeff),
    week2: createProgressCoefficients(setup.week2, week2Coeff),
  };
}

/**
 * 检查组合是否完成
 */
function checkComboComplete(combo: WeeklyCombo, backpack: Record<string, number>): boolean {
  const needs = countCardNeeds(combo.cards);
  for (const [card, need] of needs.entries()) {
    if ((backpack[card] || 0) < need) return false;
  }
  return true;
}

/**
 * 检查全收集（10张各至少1张）
 */
function checkFullCollection(backpack: Record<string, number>): boolean {
  return ALL_CARDS.every(card => (backpack[card] || 0) >= 1);
}

/**
 * 生成每日类型表（两周）
 */
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

/**
 * 获取幸运卡
 */
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
 * 🔑 V6抽卡核心逻辑
 *
 * 变化点：
 * 1. 对于卡组卡，计算"超额持有数"（超过第1张的部分）
 * 2. 只有超额部分应用降权系数
 * 3. 幸运卡也受降权影响（V6新增）
 * 4. 跨周逻辑保持不变
 */
function drawOneCard(
  backpack: Record<string, number>,
  setup: CardSetup,
  coefficients: { week1: CardCoefficients; week2: CardCoefficients },
  day: number,
  dayType: 'common' | 'rare' | 'magic',
  luckyCard: string | null
): string {
  const isWeek1 = day <= 7;
  const currentCombo = isWeek1 ? setup.week1 : setup.week2;
  const crossCombo = isWeek1 ? setup.week2 : setup.week1;
  const weekCoeffs = isWeek1 ? coefficients.week1 : coefficients.week2;
  const crossCoeffs = isWeek1 ? coefficients.week2 : coefficients.week1;

  // V6：计算降权依据（超额持有数，不是总持有数）
  // 对于当前周卡：按超额数应用系数
  // 对于跨周卡：按超额数应用系数（使用跨周系数数组）

  // 基础概率
  const rawProbs: Record<string, number> = {};
  for (const card of ALL_CARDS) {
    rawProbs[card] = getBaseProb(card);
  }

  // V6加权概率计算
  const weightedProbs: Record<string, number> = {};
  for (const card of ALL_CARDS) {
    const isInCurrentWeek = currentCombo.cards.includes(card);
    const isInCrossWeek = crossCombo.cards.includes(card);

    let coeff = 1.0;  // 默认不降权

    if (isInCurrentWeek) {
      // 计算该卡在当前周的超额持有数
      const excessCount = getReductionHoldCount(currentCombo, backpack, card);
      // 取对应系数（索引0是1.0，索引1是降权系数）
      coeff = excessCount > 0 ? weekCoeffs[1] : 1.0;
    } else if (isInCrossWeek) {
      // 计算该卡在跨周的超额持有数
      const excessCount = getReductionHoldCount(crossCombo, backpack, card);
      coeff = excessCount > 0 ? crossCoeffs[1] : 1.0;
    }
    // 不在任何周combo的卡：coeff=1.0

    weightedProbs[card] = rawProbs[card] * coeff;
  }

  // V6：幸运卡也受降权影响！
  if (luckyCard) {
    // 计算幸运卡的超额持有（基于幸运卡本身是否属于某周）
    // 幸运卡如果在当前周/跨周combo中，同样受降权
    const luckyInCurrent = currentCombo.cards.includes(luckyCard);
    const luckyInCross = crossCombo.cards.includes(luckyCard);

    let luckyCoeff = 1.0;
    if (luckyInCurrent) {
      const excessCount = getReductionHoldCount(currentCombo, backpack, luckyCard);
      luckyCoeff = excessCount > 0 ? weekCoeffs[1] : 1.0;
    } else if (luckyInCross) {
      const excessCount = getReductionHoldCount(crossCombo, backpack, luckyCard);
      luckyCoeff = excessCount > 0 ? crossCoeffs[1] : 1.0;
    }

    // 幸运卡重新分配概率（在原本基础上应用系数后，再加LUCKY_FIXED_PROB）
    // 策略：从所有卡均匀扣除一点，补偿给幸运卡
    const luckyBonus = LUCKY_FIXED_PROB; // 1.2%的额外权重

    // 计算当前总和
    const currentTotal = Object.values(weightedProbs).reduce((a, b) => a + b, 0);
    if (currentTotal > 0) {
      const deductionRatio = luckyBonus / currentTotal;
      for (const card of ALL_CARDS) {
        if (card === luckyCard) {
          // 幸运卡获得加成（但先应用降权后的基础值）
          weightedProbs[card] = weightedProbs[card] * luckyCoeff + luckyBonus;
        } else {
          // 其他卡按比例扣除
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
 * 模拟单个周的完成率
 */
async function simulateWeek(
  setup: CardSetup,
  week: 'week1' | 'week2',
  weekCoeff: CardCoefficients,
  trials: number,
  fixedWeek1Coeff?: CardCoefficients,
): Promise<{ rate: number }> {
  const isWeek1 = week === 'week1';
  const weekCombo = isWeek1 ? setup.week1 : setup.week2;
  const deadline = weekCombo.deadline;

  const w1Coeff = isWeek1 ? weekCoeff : (fixedWeek1Coeff || [1.0]);
  const w2Coeff = !isWeek1 ? weekCoeff : [1.0];
  const fullCoeffs = { week1: w1Coeff, week2: w2Coeff };

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
          const c = drawOneCard(bag, setup, fullCoeffs, d, dt, lc);
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
 * 模拟两周的完整游戏
 */
async function simulateBothWeeks(
  setup: CardSetup,
  w1Coeff: CardCoefficients,
  w2Coeff: CardCoefficients,
  trials: number
): Promise<{ week1Rate: number; week2Rate: number; fullCollectionRate: number }> {
  let w1 = 0, w2 = 0, fc = 0;
  const allCards = new Set([...setup.week1.cards, ...setup.week2.cards]);
  const fullCoeffs = { week1: w1Coeff, week2: w2Coeff };
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
          const c = drawOneCard(bag1, setup, fullCoeffs, d, dt, lc);
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
          const c = drawOneCard(bag2, setup, fullCoeffs, d, dt, lc);
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
  coefficients: { week1: CardCoefficients; week2: CardCoefficients };
  week1Rate: number;
  week2Rate: number;
  fullCollectionRate: number;
  converged: boolean;
  iterations: number;
  finalError: number;
}

/**
 * 主入口：V6网格搜索
 */
export async function solveCoefficientsAsync(
  setup: CardSetup,
  _targetRate: number = 4.0,
  onProgress?: (progress: SolverProgress) => void
): Promise<SolverResult> {
  // 占位系数
  const w2CoeffArray = createProgressCoefficients(setup.week2, 0.5);

  // ===== 粗网格搜索第一周 =====
  const coarseGrid = [0.02, 0.05, 0.08, 0.1, 0.15, 0.2, 0.3, 0.5, 0.7, 1.0];
  let w1BestCoeff = 0.1;
  let w1BestRate = 0;
  let w1BestError = 100;

  for (let i = 0; i < coarseGrid.length; i++) {
    const coeff = coarseGrid[i];
    const testW1Coeffs = createProgressCoefficients(setup.week1, coeff);
    const res = await simulateBothWeeks(setup, testW1Coeffs, w2CoeffArray, 2000);

    const error = Math.abs(res.week1Rate - 4);
    if (error < w1BestError) {
      w1BestError = error;
      w1BestCoeff = coeff;
      w1BestRate = res.week1Rate;
    }

    if (onProgress) {
      onProgress({
        iteration: 1 + i / coarseGrid.length,
        totalIterations: 4,
        week1Rate: res.week1Rate,
        week2Rate: 0,
        error: error,
        isConverged: false,
      });
    }
  }

  // ===== 细网格搜索第一周 =====
  const w1Low = Math.max(0.01, w1BestCoeff - 0.03);
  const w1High = Math.min(1.0, w1BestCoeff + 0.03);
  const w1FineSteps = 12;

  for (let i = 0; i <= w1FineSteps; i++) {
    const coeff = w1Low + (w1High - w1Low) * i / w1FineSteps;
    const testW1Coeffs = createProgressCoefficients(setup.week1, coeff);
    const res = await simulateBothWeeks(setup, testW1Coeffs, w2CoeffArray, 3000);

    const error = Math.abs(res.week1Rate - 4);
    if (error < w1BestError) {
      w1BestError = error;
      w1BestCoeff = coeff;
      w1BestRate = res.week1Rate;
    }

    if (onProgress) {
      onProgress({
        iteration: 2 + i / w1FineSteps,
        totalIterations: 4,
        week1Rate: res.week1Rate,
        week2Rate: 0,
        error: error,
        isConverged: false,
      });
    }
  }

  // ===== 粗网格搜索第二周 =====
  const w1FinalCoeffs = createProgressCoefficients(setup.week1, w1BestCoeff);
  let w2BestCoeff = 0.1;
  let w2BestRate = 0;
  let w2BestError = 100;

  for (let i = 0; i < coarseGrid.length; i++) {
    const coeff = coarseGrid[i];
    const testW2Coeffs = createProgressCoefficients(setup.week2, coeff);
    const res = await simulateBothWeeks(setup, w1FinalCoeffs, testW2Coeffs, 2000);

    const error = Math.abs(res.week2Rate - 4);
    if (error < w2BestError) {
      w2BestError = error;
      w2BestCoeff = coeff;
      w2BestRate = res.week2Rate;
    }

    if (onProgress) {
      onProgress({
        iteration: 2.5 + i / coarseGrid.length,
        totalIterations: 4,
        week1Rate: w1BestRate,
        week2Rate: res.week2Rate,
        error: (w1BestError + error),
        isConverged: false,
      });
    }
  }

  // ===== 细网格搜索第二周 =====
  const w2Low = Math.max(0.01, w2BestCoeff - 0.03);
  const w2High = Math.min(1.0, w2BestCoeff + 0.03);
  const w2FineSteps = 12;

  for (let i = 0; i <= w2FineSteps; i++) {
    const coeff = w2Low + (w2High - w2Low) * i / w2FineSteps;
    const testW2Coeffs = createProgressCoefficients(setup.week2, coeff);
    const res = await simulateBothWeeks(setup, w1FinalCoeffs, testW2Coeffs, 3000);

    const error = Math.abs(res.week2Rate - 4);
    if (error < w2BestError) {
      w2BestError = error;
      w2BestCoeff = coeff;
      w2BestRate = res.week2Rate;
    }

    if (onProgress) {
      onProgress({
        iteration: 3 + i / w2FineSteps,
        totalIterations: 4,
        week1Rate: w1BestRate,
        week2Rate: res.week2Rate,
        error: (w1BestError + error),
        isConverged: false,
      });
    }
  }

  if (onProgress) {
    onProgress({
      iteration: 4,
      totalIterations: 4,
      week1Rate: w1BestRate,
      week2Rate: w2BestRate,
      error: w2BestError,
      isConverged: false,
    });
  }

  // 最终验证
  const finalW1Coeffs = createProgressCoefficients(setup.week1, w1BestCoeff);
  const finalW2Coeffs = createProgressCoefficients(setup.week2, w2BestCoeff);
  const final = await simulateBothWeeks(setup, finalW1Coeffs, finalW2Coeffs, 12000);

  return {
    coefficients: { week1: finalW1Coeffs, week2: finalW2Coeffs },
    week1Rate: final.week1Rate,
    week2Rate: final.week2Rate,
    fullCollectionRate: final.fullCollectionRate,
    converged: (w1BestError < 0.5 && w2BestError < 0.5),
    iterations: 48,
    finalError: Math.abs(final.week1Rate - 4) + Math.abs(final.week2Rate - 4),
  };
}

/**
 * 生成系数报告（UI兼容格式）
 */
export function generateCoefficientReport(
  solverResult: SolverResult,
  setup: CardSetup
): CoefficientResult {
  const week1CardCoeffs: Record<string, CardCoefficients> = {};
  const week2CardCoeffs: Record<string, CardCoefficients> = {};

  // 为每张卡生成系数（基于该卡在combo中的需求）
  const w1Needs = countCardNeeds(setup.week1.cards);
  for (const card of ALL_CARDS) {
    const need = w1Needs.get(card) || 0;
    if (need > 0) {
      // V6: 第1张1.0，第2张起使用求解的系数
      const coeffs: CardCoefficients = [1.0];
      for (let i = 1; i < need; i++) {
        coeffs.push(solverResult.coefficients.week1[1] || 1.0);
      }
      week1CardCoeffs[card] = coeffs;
    } else {
      week1CardCoeffs[card] = [1.0];
    }
  }

  const w2Needs = countCardNeeds(setup.week2.cards);
  for (const card of ALL_CARDS) {
    const need = w2Needs.get(card) || 0;
    if (need > 0) {
      const coeffs: CardCoefficients = [1.0];
      for (let i = 1; i < need; i++) {
        coeffs.push(solverResult.coefficients.week2[1] || 1.0);
      }
      week2CardCoeffs[card] = coeffs;
    } else {
      week2CardCoeffs[card] = [1.0];
    }
  }

  return {
    week1: week1CardCoeffs,
    week2: week2CardCoeffs,
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
