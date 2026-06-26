/**
 * 🎯 降权系数求解器（V6.5 - 按"下一个副本"降权）
 *
 * V6.5 核心修正：
 * 之前：按"超额数" = have-1 降权（只有有2张才降第3张）
 * 现在：按"下一个副本索引" = have 降权（有1张就降第2张）
 *
 * 关键变化：
 * - HHF的H需求2张，有1张H时，下一个是第2张H → 立即大幅降权
 * - 确保"差1张集齐"时概率骤降
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

function countCardNeeds(cards: string[]): Map<string, number> {
  const needs = new Map<string, number>();
  for (const card of cards) {
    needs.set(card, (needs.get(card) || 0) + 1);
  }
  return needs;
}

/**
 * 🎯 V6.5 核心：判断"下一个副本"是否需要降权
 *
 * 对于需求need的卡：
 * - have=0（没有）：下一个抽副本0（第1张）→ 正常概率
 * - have=1（有1张）：下一个抽副本1（第2张）→ 超额副本，降权！
 * - have=2（有2张）：下一个抽副本2（第3张）→ 继续降权
 *
 * 返回：下一个副本的索引（0=第1张，1=第2张...）
 * 如果下一个副本索引 >= 1（即不是第1张），就需要降权
 */
function getNextCopyIndex(combo: WeeklyCombo, backpack: Record<string, number>, card: string): number {
  const need = countCardNeeds(combo.cards).get(card) || 0;
  if (need <= 1) return 0; // 只需要1张，永远是第1张

  const have = backpack[card] || 0;
  // 下一个副本索引 = 当前持有量（0-based）
  // have=0 → 下一个索引0（第1张）
  // have=1 → 下一个索引1（第2张）✓ 这里开始降权
  return Math.min(have, need - 1); // 限制在最大需求内
}

/**
 * 判断是否需要对即将抽取的副本应用降权
 */
function shouldReduceNextCopy(combo: WeeklyCombo, backpack: Record<string, number>, card: string): boolean {
  const nextIndex = getNextCopyIndex(combo, backpack, card);
  return nextIndex >= 1; // 从第2张开始（索引1）降权
}

/** 计算最大超额槽位数 */
function getMaxExcessSlots(setup: CardSetup, card: string): number {
  const w1Need = countCardNeeds(setup.week1.cards).get(card) || 0;
  const w2Need = countCardNeeds(setup.week2.cards).get(card) || 0;
  return Math.max(Math.max(0, w1Need - 1), Math.max(0, w2Need - 1));
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
 * 🔑 V6.5 抽卡核心（按下一个副本降权）
 *
 * 关键变化：
 * - have=0（无）：coeff=1.0，正常抽第1张
 * - have=1（有1张）：coeff=0.001，极难抽第2张（差1张集齐时猛降！）
 * - have=2（有2张）：继续用超严格系数
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
  const currentCards = new Set(currentCombo.cards);
  const crossCards = new Set(crossCombo.cards);

  const weightedProbs: Record<string, number> = {};

  for (const card of ALL_CARDS) {
    const coeffArray = coefficients[card] || [1.0];
    const isCurrent = currentCards.has(card);
    const isCross = crossCards.has(card);

    let coeff: number;

    if (isCurrent) {
      // 🎯 V6.5：当前周卡，按"下一个副本"决定
      if (shouldReduceNextCopy(currentCombo, backpack, card)) {
        // 下一个抽的是第2张及以后，应用系数
        coeff = coeffArray[1] ?? 0.01;
      } else {
        // 下一个抽的是第1张，正常概率
        coeff = 1.0;
      }
    } else if (isCross) {
      // 🎯 V6.5修正：跨周卡首张正常出，有1张后才卡第2张
      // 这样既防囤积（第2张极难），又保证可获得性（首张正常）
      if (shouldReduceNextCopy(crossCombo, backpack, card)) {
        // 有1张跨周卡，下一个是第2张 → 极难
        coeff = coeffArray[1] ?? 0.001;
      } else {
        // 没有或只有1张需求 → 首张正常出
        coeff = 1.0;
      }
    } else {
      // 背景卡：轻度降权（可选）
      const have = backpack[card] || 0;
      if (have >= 1) {
        coeff = 0.9; // 略降，不像主卡那么猛
      } else {
        coeff = 1.0;
      }
    }

    weightedProbs[card] = getBaseProb(card) * coeff;
  }

  // 幸运卡处理 (V7.0：幸运卡概率直接设为1.2%，然后应用降权系数)
  if (luckyCard) {
    const luckyIsCurrent = currentCards.has(luckyCard);
    const luckyHave = backpack[luckyCard] || 0;
    const luckyIsCrossWithHave = crossCards.has(luckyCard) && luckyHave >= 1;

    if (luckyIsCurrent || luckyIsCrossWithHave) {
      const luckyCoeffArray = coefficients[luckyCard] || [1.0];
      let luckyCoeff: number;

      if (luckyIsCurrent) {
        luckyCoeff = shouldReduceNextCopy(currentCombo, backpack, luckyCard)
          ? (luckyCoeffArray[1] ?? 0.01)
          : 1.0;
      } else if (crossCards.has(luckyCard)) {
        // 跨周且已有1张+，需要降权
        luckyCoeff = shouldReduceNextCopy(crossCombo, backpack, luckyCard)
          ? (luckyCoeffArray[1] ?? 0.001)
          : 1.0;
      } else {
        luckyCoeff = 1.0;
      }

      // V7.0新逻辑：幸运卡概率直接设为1.2%，然后乘以降权系数
      // 非幸运卡保持原概率，最后整体归一化
      const luckyFixedProb = LUCKY_FIXED_PROB; // 1.2%
      weightedProbs[luckyCard] = luckyFixedProb * luckyCoeff;
    }
  }

  // 归一化
  const total = Object.values(weightedProbs).reduce((a, b) => a + b, 0);
  if (total <= 0) return currentCombo.cards[0] || 'A';

  const normalized: Record<string, number> = {};
  for (const card of ALL_CARDS) {
    normalized[card] = (weightedProbs[card] / total) * 100;
  }

  let r = Math.random() * 100;
  for (const card of ALL_CARDS) {
    r -= normalized[card];
    if (r <= 0) return card;
  }
  return currentCombo.cards[0] || 'A';
}

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

function getCardsNeedingCoeff(setup: CardSetup): Array<{ card: string; maxExcess: number }> {
  const result: Array<{ card: string; maxExcess: number }> = [];
  const seen = new Set<string>();

  for (const card of ALL_CARDS) {
    const maxExcess = getMaxExcessSlots(setup, card);
    if (maxExcess > 0 && !seen.has(card)) {
      seen.add(card);
      result.push({ card, maxExcess });
    }
  }
  return result.sort((a, b) => a.maxExcess - b.maxExcess);
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

export async function solveCoefficientsAsync(
  setup: CardSetup,
  _targetRate: number = 4.0,
  onProgress?: (progress: SolverProgress) => void
): Promise<SolverResult> {
  const cardsNeedingCoeff = getCardsNeedingCoeff(setup);
  const tier1Cards = cardsNeedingCoeff.filter(c => c.maxExcess === 1).map(c => c.card);
  const tier2Cards = cardsNeedingCoeff.filter(c => c.maxExcess >= 2).map(c => c.card);

  // V6.5：3张卡需要极低系数，范围收紧到0.00001~0.05
  const tier1Range = [0.00001, 0.00002, 0.00005, 0.0001, 0.0002, 0.0005, 0.001, 0.002, 0.005, 0.01, 0.02, 0.05];
  const tier2Range = [0.0001, 0.0002, 0.0005, 0.001, 0.002, 0.005, 0.01, 0.02, 0.05];

  let bestCoeff1 = 0.001;
  let bestCoeff2 = 0.02;
  let bestW1Rate = 0;
  let bestW2Rate = 0;
  let bestTotalError = 1000;
  let iterCount = 0;
  const totalIters = tier1Range.length * tier2Range.length;

  for (const c1 of tier1Range) {
    for (const c2 of tier2Range) {
      const testCoeffs: Record<string, CardCoefficients> = {};
      for (const card of ALL_CARDS) {
        const maxExcess = getMaxExcessSlots(setup, card);
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
          iteration: iterCount / totalIters * 2,
          totalIterations: 3,
          week1Rate: bestW1Rate,
          week2Rate: bestW2Rate,
          error: bestTotalError,
          isConverged: false,
        });
      }
    }
  }

  // 细网格（8×8=64次，范围±5倍但上限封顶0.05）
  const fine1Steps = 8;
  const fine2Steps = 8;
  const fine1Low = Math.max(0.000005, bestCoeff1 * 0.2);
  const fine1High = Math.min(0.05, bestCoeff1 * 5);
  const fine2Low = Math.max(0.00005, bestCoeff2 * 0.2);
  const fine2High = Math.min(0.05, bestCoeff2 * 5);

  for (let i = 0; i <= fine1Steps; i++) {
    for (let j = 0; j <= fine2Steps; j++) {
      const c1 = fine1Low + (fine1High - fine1Low) * i / fine1Steps;
      const c2 = fine2Low + (fine2High - fine2Low) * j / fine2Steps;

      const testCoeffs: Record<string, CardCoefficients> = {};
      for (const card of ALL_CARDS) {
        const maxExcess = getMaxExcessSlots(setup, card);
        if (maxExcess === 1) {
          testCoeffs[card] = [1.0, c1];
        } else if (maxExcess >= 2) {
          testCoeffs[card] = [1.0, c2];
        } else {
          testCoeffs[card] = [1.0];
        }
      }

      const res = await simulateBothWeeks(setup, testCoeffs, 3000);
      const error = Math.abs(res.week1Rate - 4) + Math.abs(res.week2Rate - 4);

      if (error < bestTotalError) {
        bestTotalError = error;
        bestCoeff1 = c1;
        bestCoeff2 = c2;
        bestW1Rate = res.week1Rate;
        bestW2Rate = res.week2Rate;
      }

      // 🆕 细网格进度更新（每8次更新一次避免太频繁）
      const fineProgress = (i * (fine2Steps + 1) + j) / ((fine1Steps + 1) * (fine2Steps + 1));
      if (onProgress && ((i * 9 + j) % 8 === 0 || fineProgress > 0.95)) {
        onProgress({
          iteration: 2 + fineProgress * 0.8,
          totalIterations: 3,
          week1Rate: bestW1Rate,
          week2Rate: bestW2Rate,
          error: bestTotalError,
          isConverged: false,
        });
      }
    }
  }

  if (onProgress) {
    onProgress({
      iteration: 2.9, // 最终验证前
      totalIterations: 3,
      week1Rate: bestW1Rate,
      week2Rate: bestW2Rate,
      error: bestTotalError,
      isConverged: false,
    });
  }

  const finalCoeffs: Record<string, CardCoefficients> = {};
  for (const card of ALL_CARDS) {
    const maxExcess = getMaxExcessSlots(setup, card);
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

    // V6.5 修正：对于week1Coeffs，需要同时考虑本周需求和跨周需求
    // 因为跨周卡的第2张也需要降权，且使用相同的globalCoeff
    const week1NeedWithCross = Math.max(w1Need, w2Need);
    if (week1NeedWithCross > 1) {
      const arr: CardCoefficients = [1.0];
      for (let i = 1; i < week1NeedWithCross; i++) arr.push(globalCoeff[1] ?? 1.0);
      week1Coeffs[card] = arr;
    } else {
      week1Coeffs[card] = [1.0];
    }

    // 同理，week2Coeffs也要同时考虑两周的需求
    const week2NeedWithCross = Math.max(w2Need, w1Need);
    if (week2NeedWithCross > 1) {
      const arr: CardCoefficients = [1.0];
      for (let i = 1; i < week2NeedWithCross; i++) arr.push(globalCoeff[1] ?? 1.0);
      week2Coeffs[card] = arr;
    } else {
      week2Coeffs[card] = [1.0];
    }
  }

  return {
    week1: week1Coeffs, week2: week2Coeffs,
    actualRates: { week1: solverResult.week1Rate, week2: solverResult.week2Rate },
    fullCollectionRate: solverResult.fullCollectionRate,
    converged: solverResult.converged,
    iterations: solverResult.iterations,
    finalError: solverResult.finalError,
  };
}
