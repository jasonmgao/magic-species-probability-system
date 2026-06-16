/**
 * 🎯 降权系数求解器（V6.1 - 分层跨周降权修复版）
 *
 * V6.1 关键修复：
 * 1. 系数按卡存储：每张卡有自己的系数数组（基于该卡在该周的需求）
 * 2. 跨周降权时，也按该卡的需求结构应用（而不是用另一周的总系数）
 * 3. 超额副本索引：按该卡实际超额数取对应系数
 *
 * 例子 AAAB / CCF：
 * - Week1: A 需求3 → coeffs[A] = [1.0, c_a2, c_a3]; B 需求1 → coeffs[B] = [1.0]
 * - Week2: C 需求2 → coeffs[C] = [1.0, c_c2]; F 需求1 → coeffs[F] = [1.0]
 *
 * 第一周抽卡时：
 * - C 是跨周卡，C 在 week2 的需求是 2，所以 check 背包里的 C 数量
 * - 超额数 = max(0, min(have-1, 2-1))
 * - 如果超额数=1，用 coeffs[C][1] = c_c2
 * - 如果超额数=2（不可能，因为 week2 只需要 2 张 C，最大超额是 1），但依然用 c_c2
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

/** 统计周需求：卡名 → 需求数量 */
function countCardNeeds(cards: string[]): Map<string, number> {
  const needs = new Map<string, number>();
  for (const card of cards) {
    needs.set(card, (needs.get(card) || 0) + 1);
  }
  return needs;
}

/** V6.1: 计算指定超额深度的系数索引
 * 需求3张(AAB/AAA)：超额槽位=2（第2张索引1，第3张索引2）
 * 需求2张(AA/CC)：超额槽位=1（第2张索引1）
 * 需求1张(AB)：超额槽位=0（无降权）
 */
function getMaxExcessSlots(combo: WeeklyCombo, card: string): number {
  const needs = countCardNeeds(combo.cards);
  const need = needs.get(card) || 0;
  return Math.max(0, need - 1); // 超过第1张的数量
}

/** V6.1: 计算某卡的实际超额副本数（基于持有和该卡的需求）
 * - 需求3，持有2：超额1（第2张副本）
 * - 需求3，持有3：超额2（第2、3张副本）
 * - 需求3，持有5：超额2（第2、3张副本，第4+张不管）
 */
function getExcessCount(combo: WeeklyCombo, backpack: Record<string, number>, card: string): number {
  const need = countCardNeeds(combo.cards).get(card) || 0;
  if (need <= 1) return 0; // 需求只有1张，永不超额
  const have = backpack[card] || 0;
  const theoreticalExcess = Math.max(0, have - 1); // 超过第1张的数量
  return Math.min(theoreticalExcess, need - 1); // 不超过该卡的总超额槽位
}

/** V6.1: 获取该卡在该 excessLevel 的系数
 * V6.1简化：所有超额副本使用同一个系数（但保持数组结构用于未来扩展）
 *
 * @param coeffs 该卡的系数数组 [1.0, c_excess1, c_excess2, ...]
 * @param excessCount 实际超额数（0=无超额=不降权）
 */
function getExcessCoeff(coeffs: CardCoefficients, excessCount: number): number {
  if (excessCount <= 0) return 1.0;
  // 超额1用索引1，超额2用索引1（当前简化），未来可扩展为索引2
  return coeffs[1] ?? 1.0;
}

/** V6.1: 创建每卡系数映射
 * 返回 Record<卡名, 系数数组>
 * 简化版：每张卡要么有系数数组（该卡有超额槽位），要么只有[1.0]
 * 实际非1.0的系数存于索引1（所有超额副本共享，网格搜索求解）
 */
function createCardCoefficients(combo: WeeklyCombo, baseCoeff: number): Record<string, CardCoefficients> {
  const result: Record<string, CardCoefficients> = {};
  const needs = countCardNeeds(combo.cards);

  for (const [card, need] of needs.entries()) {
    const excessSlots = Math.max(0, need - 1);
    const coeffs: CardCoefficients = [1.0]; // 第1张总是1.0
    if (excessSlots > 0) {
      // 为简化，所有超额槽位共享同一个系数
      coeffs.push(baseCoeff);
    }
    result[card] = coeffs;
  }

  // 未在 combo 中的卡，默认 [1.0]
  for (const card of ALL_CARDS) {
    if (!result[card]) {
      result[card] = [1.0];
    }
  }

  return result;
}

/** V6.1: 创建完整系数配置（两周，每卡独立） */
function createFullCardCoefficients(
  setup: CardSetup,
  week1Coeff: number,
  week2Coeff: number,
): {
  week1: Record<string, CardCoefficients>;
  week2: Record<string, CardCoefficients>;
} {
  return {
    week1: createCardCoefficients(setup.week1, week1Coeff),
    week2: createCardCoefficients(setup.week2, week2Coeff),
  };
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
 * 🔑 V6.1 抽卡核心逻辑（分层跨周降权）
 *
 * 关键修复：
 * - 每张卡有自己的系数数组，基于该卡在该周的需求
 * - 当前周和跨周分别检查持有数，但都用该卡对应的系数数组
 * - 超额数索引到对应的系数
 *
 * 例子 AAAB / CCF：
 * - A 在 week1（当前周）：week1Coeffs[A] = [1.0, 0.05, 0.05]，超额2时使用索引1=0.05
 * - C 在 week1（跨周）：week2Coeffs[C] = [1.0, 0.08]，超额1时使用索引1=0.08
 * - C 在 week2（当前周）：week2Coeffs[C] = [1.0, 0.08]，超额1时使用索引1=0.08
 * - A 在 week2（跨周）：week1Coeffs[A] = [1.0, 0.05, 0.05]，超额1或2时使用索引1=0.05
 */
function drawOneCard(
  backpack: Record<string, number>,
  setup: CardSetup,
  coefficients: {
    week1: Record<string, CardCoefficients>;
    week2: Record<string, CardCoefficients>;
  },
  day: number,
  dayType: 'common' | 'rare' | 'magic',
  luckyCard: string | null
): string {
  const isWeek1 = day <= 7;
  const currentCombo = isWeek1 ? setup.week1 : setup.week2;
  const crossCombo = isWeek1 ? setup.week2 : setup.week1;
  const currentCoeffs = isWeek1 ? coefficients.week1 : coefficients.week2;
  const crossCoeffs = isWeek1 ? coefficients.week2 : coefficients.week1;

  // 基础概率
  const rawProbs: Record<string, number> = {};
  for (const card of ALL_CARDS) {
    rawProbs[card] = getBaseProb(card);
  }

  // V6.1 加权概率计算（关键修复）
  const weightedProbs: Record<string, number> = {};
  for (const card of ALL_CARDS) {
    const isInCurrentWeek = currentCombo.cards.includes(card);
    const isInCrossWeek = crossCombo.cards.includes(card);

    let coeff = 1.0;

    if (isInCurrentWeek) {
      // 当前周：用当前周的该卡系数，基于当前周的该卡需求计算超额
      const excessCount = getExcessCount(currentCombo, backpack, card);
      coeff = getExcessCoeff(currentCoeffs[card], excessCount);
    } else if (isInCrossWeek) {
      // 🎯 关键修复：跨周也是用该卡在【跨周combo】中的系数
      // 基于【跨周combo】的需求结构计算超额数
      const excessCount = getExcessCount(crossCombo, backpack, card);
      coeff = getExcessCoeff(crossCoeffs[card], excessCount);
    }
    // 不在任何 combo 的卡 coeff=1.0

    weightedProbs[card] = rawProbs[card] * coeff;
  }

  // V6.1：幸运卡也受降权影响
  if (luckyCard) {
    const luckyInCurrent = currentCombo.cards.includes(luckyCard);
    const luckyInCross = crossCombo.cards.includes(luckyCard);

    let luckyCoeff = 1.0;
    if (luckyInCurrent) {
      const excessCount = getExcessCount(currentCombo, backpack, luckyCard);
      luckyCoeff = getExcessCoeff(currentCoeffs[luckyCard], excessCount);
    } else if (luckyInCross) {
      const excessCount = getExcessCount(crossCombo, backpack, luckyCard);
      luckyCoeff = getExcessCoeff(crossCoeffs[luckyCard], excessCount);
    }

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
 * 模拟单个周的完成率
 */
async function simulateWeek(
  setup: CardSetup,
  week: 'week1' | 'week2',
  weekCoeffPerCard: Record<string, CardCoefficients>,  // V6.1 每卡系数
  trials: number,
  fixedWeek1Coeffs?: Record<string, CardCoefficients>,
): Promise<{ rate: number }> {
  const isWeek1 = week === 'week1';
  const weekCombo = isWeek1 ? setup.week1 : setup.week2;
  const deadline = weekCombo.deadline;

  const w1Coeffs = isWeek1 ? weekCoeffPerCard : (fixedWeek1Coeffs || {});
  const w2Coeffs = !isWeek1 ? weekCoeffPerCard : {};

  // 合并系数（确保所有卡都有系数数组）
  const fullCoeffs = { week1: {}, week2: {} } as {
    week1: Record<string, CardCoefficients>;
    week2: Record<string, CardCoefficients>;
  };

  for (const card of ALL_CARDS) {
    fullCoeffs.week1[card] = w1Coeffs[card] || [1.0];
    fullCoeffs.week2[card] = w2Coeffs[card] || [1.0];
  }

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
  w1CoeffPerCard: Record<string, CardCoefficients>,
  w2CoeffPerCard: Record<string, CardCoefficients>,
  trials: number
): Promise<{ week1Rate: number; week2Rate: number; fullCollectionRate: number }> {
  let w1 = 0, w2 = 0, fc = 0;
  const allCards = new Set([...setup.week1.cards, ...setup.week2.cards]);

  const fullCoeffs = { week1: w1CoeffPerCard, week2: w2CoeffPerCard };
  const dailyDraws = setup.dailyDraws || 4;

  const chunkSize = 500;
  const chunks = Math.ceil(trials / chunkSize);

  for (let chunk = 0; chunk < chunks; chunk++) {
    const currentChunkSize = chunk === chunks - 1 ? (trials % chunkSize || chunkSize) : chunkSize;

    for (let t = 0; t < currentChunkSize; t++) {
      // Week 1 (7 days)
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

      // Full 2 weeks (14 days)
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
  coefficients: {
    week1: Record<string, CardCoefficients>;  // V6.1 每卡系数
    week2: Record<string, CardCoefficients>;
  };
  week1Rate: number;
  week2Rate: number;
  fullCollectionRate: number;
  converged: boolean;
  iterations: number;
  finalError: number;
}

/**
 * V6.1 主求解器：网格搜索，使用每卡系数结构
 */
export async function solveCoefficientsAsync(
  setup: CardSetup,
  _targetRate: number = 4.0,
  onProgress?: (progress: SolverProgress) => void
): Promise<SolverResult> {
  // 占位系数（用于结构初始化）
  const w2Placeholders = createCardCoefficients(setup.week2, 0.5);

  // ===== 粗网格搜索第一周系数 =====
  const coarseGrid = [0.02, 0.05, 0.08, 0.1, 0.15, 0.2, 0.3, 0.5, 0.7, 1.0];
  let w1BestCoeff = 0.1;
  let w1BestRate = 0;
  let w1BestError = 100;

  for (let i = 0; i < coarseGrid.length; i++) {
    const coeff = coarseGrid[i];
    const testW1Coeffs = createCardCoefficients(setup.week1, coeff);
    const res = await simulateBothWeeks(setup, testW1Coeffs, w2Placeholders, 2000);

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

  // ===== 细网格搜索第一周系数 =====
  const w1Low = Math.max(0.01, w1BestCoeff - 0.03);
  const w1High = Math.min(1.0, w1BestCoeff + 0.03);
  const w1FineSteps = 12;

  for (let i = 0; i <= w1FineSteps; i++) {
    const coeff = w1Low + (w1High - w1Low) * i / w1FineSteps;
    const testW1Coeffs = createCardCoefficients(setup.week1, coeff);
    const res = await simulateBothWeeks(setup, testW1Coeffs, w2Placeholders, 3000);

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

  // ===== 粗网格搜索第二周系数 =====
  const w1FinalCoeffs = createCardCoefficients(setup.week1, w1BestCoeff);
  let w2BestCoeff = 0.1;
  let w2BestRate = 0;
  let w2BestError = 100;

  for (let i = 0; i < coarseGrid.length; i++) {
    const coeff = coarseGrid[i];
    const testW2Coeffs = createCardCoefficients(setup.week2, coeff);
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

  // ===== 细网格搜索第二周系数 =====
  const w2Low = Math.max(0.01, w2BestCoeff - 0.03);
  const w2High = Math.min(1.0, w2BestCoeff + 0.03);
  const w2FineSteps = 12;

  for (let i = 0; i <= w2FineSteps; i++) {
    const coeff = w2Low + (w2High - w2Low) * i / w2FineSteps;
    const testW2Coeffs = createCardCoefficients(setup.week2, coeff);
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

  // ===== 最终验证 =====
  const finalW1Coeffs = createCardCoefficients(setup.week1, w1BestCoeff);
  const finalW2Coeffs = createCardCoefficients(setup.week2, w2BestCoeff);
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
 * 生成系数报告（兼容旧 UI）
 */
export function generateCoefficientReport(
  solverResult: SolverResult,
  _setup: CardSetup
): CoefficientResult {
  // V6.1 直接返回每卡系数（已经是对格式）
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
