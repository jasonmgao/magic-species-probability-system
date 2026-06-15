/**
 * 🎯 降权系数求解器（异步优化版）
 * 真正异步执行，不会阻塞UI线程
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

function initializeCoefficients(
  needs: Map<string, number>,
  totalSlots: number,
  isWeek2: boolean
): Record<string, CardCoefficients> {
  const result: Record<string, CardCoefficients> = {};
  const coeffCount = totalSlots;
  // 初始系数应该从很低的值开始
  // 对于5张卡（如CCC），需要极低系数才能压到4%中奖率
  // 第二周窗口更长（14天），需要比第一周更严格
  const initialGuess = isWeek2 ? 0.001 : 0.02;

  for (const [cardId] of needs.entries()) {
    const coeffs: CardCoefficients = [1.0];
    for (let i = 1; i < coeffCount; i++) {
      // 极端衰减
      const decay = Math.pow(0.1, i - 1);
      const newVal = initialGuess * decay;
      coeffs.push(Math.max(0.00001, newVal));
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
        // 修正索引：holdCount 张 → 继续抽需要第 (holdCount+1) 张
        // 所以索引直接用 holdCount（不是 holdCount-1）
        // 例如：已有 1 张，coeffIndex=1 控制第 2 张的掉落
        const coeffIndex = holdCount;
        if (coeffIndex >= cardCoeffs.length) {
          weightedProbs[card] = 0;
        } else {
          weightedProbs[card] = rawProbs[card] * cardCoeffs[coeffIndex];
        }
      }
    }
  }

  // 归一化 - 关键步骤！
  const total = Object.values(weightedProbs).reduce((a, b) => a + b, 0);
  if (total <= 0) return 'A';

  // 将概率归一化到总和为100%
  const normalizedProbs: Record<string, number> = {};
  for (const card of ALL_CARDS) {
    normalizedProbs[card] = (weightedProbs[card] / total) * 100;
  }

  // 轮盘赌
  const r = Math.random() * 100;
  let sum = 0;
  for (const card of ALL_CARDS) {
    sum += normalizedProbs[card];
    if (r < sum) return card;
  }
  return 'A';
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

/**
 * 分批执行模拟，每批之后让出时间片
 */
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
      // Week 1 only
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

      // Full 2 weeks
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

  // 分批执行，每批后让出时间片
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

/**
 * 异步求解器 - 带进度回调
 */
export async function solveCoefficientsAsync(
  setup: CardSetup,
  targetRate: number = 4.0,
  onProgress?: (progress: SolverProgress) => void
): Promise<SolverResult> {
  const week1Needs = countCardNeeds(setup.week1.cards);
  const week2Needs = countCardNeeds(setup.week2.cards);
  const week1Slots = setup.week1.cards.length;
  const week2Slots = setup.week2.cards.length;

  let week1Coeffs = initializeCoefficients(week1Needs, week1Slots, false);
  let week2Coeffs = initializeCoefficients(week2Needs, week2Slots, true);

  const maxIterations = 50;
  const tolerance = 0.5;
  let learningRate = 0.5;
  let bestError = Infinity;
  let bestCoeffs = {
    week1: JSON.parse(JSON.stringify(week1Coeffs)) as Record<string, CardCoefficients>,
    week2: JSON.parse(JSON.stringify(week2Coeffs)) as Record<string, CardCoefficients>,
  };
  let bestRates = { week1: 0, week2: 0, fullCollection: 0 };

  for (let iter = 0; iter < maxIterations; iter++) {
    // 异步模拟，每批500个场景，共15000次以提高精度
    const result = await monteCarloSimulateAsync(
      setup,
      { week1: week1Coeffs, week2: week2Coeffs },
      15000,
      500,
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

    // 收敛检查
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

    // 更新系数 - 使用比例调整（更激进）
    // error > 0: 中奖率太高，需要大幅降低系数
    // error < 0: 中奖率太低，需要提高系数
    const adjustCoefficients = (coeffs: CardCoefficients, error: number) => {
      for (let i = 1; i < coeffs.length; i++) {
        if (error > 0) {
          // 中奖率太高，需要大幅降低系数
          // 偏差越大，降得越狠
          const ratio = error / targetRate;
          const factor = Math.pow(0.3, ratio * learningRate);
          coeffs[i] *= factor;
        } else {
          // 中奖率太低，适度提高系数
          const ratio = Math.abs(error) / targetRate;
          const factor = Math.pow(1.2, ratio * learningRate);
          coeffs[i] *= factor;
        }
        // 允许系数降到很低（0.00001），上限0.5
        coeffs[i] = Math.max(0.00001, Math.min(0.5, coeffs[i]));
      }
      // 确保单调递减
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

    // 让出时间片
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
