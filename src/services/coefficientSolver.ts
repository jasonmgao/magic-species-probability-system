/**
 * 🎯 降权系数求解器（数学优化版）
 * 使用数学公式反推初始系数，避免猜测
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
 * 🔢 数学反推：根据目标中奖率计算合适的初始系数
 *
 * 原理：
 * - n 张卡组，需要在 d 天内集齐
 * - 每天 4 抽，共 4d 抽
 * - 目标完成率 p = 4%
 *
 * 对于卡组中的一张卡，需要 k 张：
 * - 第 1 张：正常概率
 * - 第 2 张到第 k 张：需要降权
 *
 * 使用泊松近似 + 经验公式
 */
function calculateInitialCoefficient(
  cardId: string,
  needCount: number,
  totalSlots: number,
  deadline: number,
  targetRate: number
): number {
  const baseProb = getBaseProb(cardId) / 100;  // 转成小数
  const totalDraws = deadline * 4;  // 总抽数

  // 如果不降权，这张卡的期望收集张数
  const expectedWithoutCoeff = totalDraws * baseProb;

  // 需要降权的次数 = needCount - 1（第 1 张正常抽）
  const weightedDraws = needCount - 1;

  if (weightedDraws <= 0) return 1.0;  // 只需要 1 张，不需要降权

  // 关键：如果完成率是 4%，意味着 96% 的情况下会失败
  // 失败的主要原因是没有在限定时间内集齐所有卡
  //
  // 对于稀有物品收集问题，可以用对数近似：
  // ln(成功率) ≈ Σ ln(1 - exp(-λ_i))
  //
  // 简化的启发式公式：
  // coeff ≈ (targetRate / 100) ^ (1 / weightedDraws) / (expectedWithoutCoeff / weightedDraws)
  //
  // 更实用的：根据实际观察的经验值
  // 4% = 1/25，意味着平均需要 25 次尝试才能成功 1 次

  // 对于 CCC（3张C，14天）：
  // - C 基础概率 7% = 0.07
  // - 56 抽期望 3.92 张
  // - 需要 3 张
  // - 约等于 2.5 个降权周期
  //
  // 观察：当初始系数 0.005 时，第二周 30%
  // 观察：当初始系数 0.00001 时，第二周 0.7%
  // 观察：当系数 0.0005 时，第二周 0.8%
  //
  // 说明：0.0005 ~ 0.005 之间有个"甜蜜点"
  // 0.8% → 30% 是 37.5 倍增长，系数增长 10 倍
  // 系数和需求关系近似：coeff ∝ rate^(1/2.5) （非线性）
  //
  // 插值：0.0005 * (4/0.8)^(1/2.5) ≈ 0.0005 * 5^0.4 ≈ 0.0005 * 1.9 ≈ 0.00095
  // 考虑安全余量，取 0.0012

  // 更系统的方法：
  // 计算"标准化难度因子"
  // 卡组总抽数需求 = totalSlots（例如 CCC+DE = 5 张）
  // 可用抽数 = 4 * deadline
  //
  // 对于 CCC（3张），14天，56抽，基础掉落期望 3.92
  // 目标：4% 完成率意味着总共约 1/25 的机会成功
  //
  // 经验公式（基于之前的测试结果拟合）：
  // coeff = 0.0015 * (4 / deadline) * sqrt(totalSlots / 5)
  //
  // 对于 CCC+DE（14天，5张）：
  // coeff = 0.0015 * (4/14) * sqrt(5/5) = 0.0015 * 0.286 * 1 = 0.00043
  //
  // 但对于多需求卡（3张C），需要更严格
  // 乘以 (needCount - 1) 的衰减：
  const baseCoeff = 0.002;
  const deadlineFactor = Math.sqrt(7 / deadline);  // 7天为基准
  const slotFactor = Math.pow(totalSlots / 3, 0.5);  // 3张为基准
  const needFactor = 1 / Math.pow(needCount, 0.8);  // 需要张数越多越严格

  let coeff = baseCoeff * deadlineFactor * slotFactor * needFactor;

  // 约束在合理范围
  return Math.max(0.00005, Math.min(0.1, coeff));
}

/**
 * 使用经验值初始化 - 根据deadline直接设置
 * 基于实际测试数据调整
 */
function initializeCoefficients(
  needs: Map<string, number>,
  deadline: number,
  _targetRate: number
): Record<string, CardCoefficients> {
  const result: Record<string, CardCoefficients> = {};

  for (const [cardId, needCount] of needs.entries()) {
    const coeffs: CardCoefficients = [1.0];

    // 根据天数和卡的稀有度设置经验值
    // 7天窗口： coeff[1] ≈ 0.01
    // 14天窗口：coeff[1] ≈ 0.0006 (根据0.0005→0.8%, 希望到4%稍微提高)
    const isRare = ['B', 'C', 'D', 'E'].includes(cardId);
    const isMagic = cardId === 'A';

    let baseCoeff: number;
    if (deadline <= 7) {
      // 第一周：7天窗口，相对宽松
      baseCoeff = isMagic ? 0.008 : (isRare ? 0.012 : 0.015);
    } else {
      // 第二周：14天窗口，必须很严格
      // 数据：0.0005→0.8%, 0.00065→0.7%  目标4%，尝试0.00075
      baseCoeff = isMagic ? 0.0005 : (isRare ? 0.00075 : 0.001);
    }

    // 需要多张的卡，后续系数递减
    for (let i = 1; i < needCount; i++) {
      const decay = Math.pow(0.4, i - 1);
      coeffs.push(Math.max(0.00001, baseCoeff * decay));
    }

    result[cardId] = coeffs;
  }
  return result;
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
        const coeffIndex = holdCount;
        if (coeffIndex >= cardCoeffs.length) {
          weightedProbs[card] = 0;
        } else {
          weightedProbs[card] = rawProbs[card] * cardCoeffs[coeffIndex];
        }
      }
    }
  }

  // 归一化
  const total = Object.values(weightedProbs).reduce((a, b) => a + b, 0);
  if (total <= 0) return 'A';

  const normalizedProbs: Record<string, number> = {};
  for (const card of ALL_CARDS) {
    normalizedProbs[card] = (weightedProbs[card] / total) * 100;
  }

  const r = Math.random() * 100;
  let sum = 0;
  for (const card of ALL_CARDS) {
    sum += normalizedProbs[card];
    if (r < sum) return card;
  }
  return 'A';
}

async function monteCarloSimulateAsync(
  setup: CardSetup,
  coefficients: { week1: Record<string, CardCoefficients>; week2: Record<string, CardCoefficients> },
  totalTrials: number,
  batchSize: number = 500,
  onBatch?: (completed: number, total: number, interimResult: { week1Rate: number; week2Rate: number }) => void
): Promise<{ week1Rate: number; week2Rate: number; fullCollectionRate: number }> {
  let week1Success = 0;
  let week2Success = 0;
  let fullCollection = 0;
  const allComboCards = new Set([...setup.week1.cards, ...setup.week2.cards]);

  const runBatch = (startIdx: number, count: number) => {
    for (let t = startIdx; t < startIdx + count && t < totalTrials; t++) {
      // Week 1
      const bagWeek1: Record<string, number> = {};
      const schedule1 = generateSchedule().slice(0, 7);
      const week1LuckySet = new Set<string>();

      for (let day = 1; day <= 7; day++) {
        const dayType = schedule1[day - 1];
        const luckyCard = getLuckyCard(dayType, allComboCards, week1LuckySet);
        for (let draw = 0; draw < 4; draw++) {
          const card = drawOneCard(bagWeek1, setup, coefficients, day, dayType, luckyCard);
          bagWeek1[card] = (bagWeek1[card] || 0) + 1;
        }
      }
      if (checkComboComplete(setup.week1, bagWeek1)) week1Success++;

      // Week 2 (14 days)
      const bagFull: Record<string, number> = {};
      const scheduleFull = generateSchedule();
      const w1Lucky = new Set<string>();
      const w2Lucky = new Set<string>();

      for (let day = 1; day <= 14; day++) {
        const dayType = scheduleFull[day - 1];
        const weekLuckySet = day <= 7 ? w1Lucky : w2Lucky;
        const luckyCard = getLuckyCard(dayType, allComboCards, weekLuckySet);
        for (let draw = 0; draw < 4; draw++) {
          const card = drawOneCard(bagFull, setup, coefficients, day, dayType, luckyCard);
          bagFull[card] = (bagFull[card] || 0) + 1;
        }
      }
      if (checkComboComplete(setup.week2, bagFull)) week2Success++;
      if (checkFullCollection(bagFull)) fullCollection++;
    }
  };

  for (let i = 0; i < totalTrials; i += batchSize) {
    const currentBatch = Math.min(batchSize, totalTrials - i);
    runBatch(i, currentBatch);

    if (onBatch && i % (batchSize * 4) === 0) {
      const completed = i + currentBatch;
      onBatch(completed, totalTrials, {
        week1Rate: (week1Success / completed) * 100,
        week2Rate: (week2Success / completed) * 100,
      });
      await new Promise(r => setTimeout(r, 0));
    }
  }

  return {
    week1Rate: (week1Success / totalTrials) * 100,
    week2Rate: (week2Success / totalTrials) * 100,
    fullCollectionRate: (fullCollection / totalTrials) * 100,
  };
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

export async function solveCoefficientsAsync(
  setup: CardSetup,
  targetRate: number = 4.0,
  onProgress?: (progress: SolverProgress) => void
): Promise<SolverResult> {
  const week1Needs = countCardNeeds(setup.week1.cards);
  const week2Needs = countCardNeeds(setup.week2.cards);
  const week1Slots = setup.week1.cards.length;
  const week2Slots = setup.week2.cards.length;
  const week1Deadline = setup.week1.deadline;
  const week2Deadline = setup.week2.deadline;

  // 使用经验值初始化
  let week1Coeffs = initializeCoefficients(week1Needs, week1Deadline, targetRate);
  let week2Coeffs = initializeCoefficients(week2Needs, week2Deadline, targetRate);

  const maxIterations = 60;
  const tolerance = 0.3;
  let learningRate = 0.8;
  let bestError = Infinity;
  let bestCoeffs = {
    week1: JSON.parse(JSON.stringify(week1Coeffs)) as Record<string, CardCoefficients>,
    week2: JSON.parse(JSON.stringify(week2Coeffs)) as Record<string, CardCoefficients>,
  };
  let bestRates = { week1: 0, week2: 0, fullCollection: 0 };

  for (let iter = 0; iter < maxIterations; iter++) {
    const result = await monteCarloSimulateAsync(
      setup,
      { week1: week1Coeffs, week2: week2Coeffs },
      12000,
      400,
      (completed, total, interim) => {
        if (onProgress && iter === 0) {
          onProgress({
            iteration: 1,
            totalIterations: maxIterations,
            week1Rate: interim.week1Rate,
            week2Rate: interim.week2Rate,
            error: Math.abs(interim.week1Rate - 4) + Math.abs(interim.week2Rate - 4),
            isConverged: false,
          });
        }
      }
    );

    const error1 = result.week1Rate - targetRate;
    const error2 = result.week2Rate - targetRate;
    const totalError = Math.abs(error1) + Math.abs(error2);

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

    // 极端调整：如果某个组合中奖率过高（>15%），直接把所有系数除以20
    if (error2 > 15) {
      for (const [, coeffs] of Object.entries(week2Coeffs)) {
        for (let i = 1; i < coeffs.length; i++) {
          coeffs[i] = Math.max(0.000001, coeffs[i] * 0.05);
        }
      }
    }
    if (error1 > 15) {
      for (const [, coeffs] of Object.entries(week1Coeffs)) {
        for (let i = 1; i < coeffs.length; i++) {
          coeffs[i] = Math.max(0.000001, coeffs[i] * 0.05);
        }
      }
    }

    const adjustCoefficients = (coeffs: CardCoefficients, error: number) => {
      for (let i = 1; i < coeffs.length; i++) {
        if (error > 0) {
          const ratio = error / targetRate;
          const factor = Math.pow(0.1, ratio * learningRate);
          coeffs[i] *= factor;
        } else {
          const ratio = Math.abs(error) / targetRate;
          const factor = Math.pow(1.2, ratio * learningRate);
          coeffs[i] *= factor;
        }
        coeffs[i] = Math.max(0.000001, Math.min(0.5, coeffs[i]));
      }
      for (let i = 1; i < coeffs.length; i++) {
        coeffs[i] = Math.min(coeffs[i], coeffs[i - 1] * 0.95);
      }
    };

    for (const [, coeffs] of Object.entries(week1Coeffs)) {
      adjustCoefficients(coeffs, error1);
    }
    for (const [, coeffs] of Object.entries(week2Coeffs)) {
      adjustCoefficients(coeffs, error2);
    }

    if (iter > 2 && totalError > bestError * 1.1) {
      learningRate *= 0.9;
    } else if (iter > 2 && totalError < bestError * 0.95) {
      learningRate = Math.min(0.8, learningRate * 1.05);
    }

    await new Promise(r => setTimeout(r, 0));
  }

  return {
    coefficients: bestCoeffs,
    week1Rate: bestRates.week1,
    week2Rate: bestRates.week2,
    fullCollectionRate: bestRates.fullCollection,
    converged: bestError < tolerance * 3,
    iterations: maxIterations,
    finalError: bestError,
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
