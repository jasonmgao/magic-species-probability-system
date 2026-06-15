/**
 * 降权系数求解器（优化版）
 * 核心理解：缺几张是针对组合的状态，不是单张卡
 */

import type { CardSetup, Combination, CoefficientResult } from '@/types';

const ALL_CARDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

// 卡片类型映射
function getCardType(card: string): 'common' | 'rare' | 'magic' {
  if (card === 'A') return 'magic';
  if (['B', 'C', 'D', 'E'].includes(card)) return 'rare';
  return 'common';
}

// 单日概率转换
function singleToDay(p: number): number {
  if (p >= 1.0) return 1.0;
  if (p <= 0.0) return 0.0;
  return 1.0 - Math.pow(1.0 - p, 4.0);
}

// 基础概率配置
const SINGLE_PROBS: Record<string, number> = {
  'common_normal': 0.1608,
  'common_lucky': 0.0120,
  'common_rare_day': 0.1487,
  'common_magic_day': 0.0120,
  'rare_normal': 0.0744,
  'rare_lucky': 0.0120,
  'rare_common_day': 0.0804,
  'rare_magic_day': 0.0706,
  'magic_normal': 0.0000,
  'magic_lucky': 0.0120,
  'magic_common_day': 0.0230,
  'magic_rare_day': 0.0212,
};

const COMBO_DIST: Array<[string, string, number]> = [
  ['common', 'common', 0.22],
  ['common', 'rare', 0.22],
  ['common', 'magic', 0.06],
  ['rare', 'common', 0.22],
  ['rare', 'rare', 0.13],
  ['rare', 'magic', 0.04],
  ['magic', 'common', 0.06],
  ['magic', 'rare', 0.04],
];

function getSingleP(
  cardType: 'common' | 'rare' | 'magic',
  dayType: 'common' | 'rare' | 'magic',
  isLucky: boolean
): number {
  if (cardType === 'common') {
    if (dayType === 'common') return SINGLE_PROBS[isLucky ? 'common_lucky' : 'common_normal'];
    if (dayType === 'rare') return SINGLE_PROBS['common_rare_day'];
    if (dayType === 'magic') return SINGLE_PROBS['common_magic_day'];
  } else if (cardType === 'rare') {
    if (dayType === 'rare') return SINGLE_PROBS[isLucky ? 'rare_lucky' : 'rare_normal'];
    if (dayType === 'common') return SINGLE_PROBS['rare_common_day'];
    if (dayType === 'magic') return SINGLE_PROBS['rare_magic_day'];
  } else if (cardType === 'magic') {
    if (dayType === 'magic') return SINGLE_PROBS[isLucky ? 'magic_lucky' : 'magic_normal'];
    if (dayType === 'common') return SINGLE_PROBS['magic_common_day'];
    if (dayType === 'rare') return SINGLE_PROBS['magic_rare_day'];
  }
  return 0.0;
}

// 简化：每个组合只用1个系数（缺2张时用）
interface ComboCoefficients {
  coeff: number;  // 统一系数：缺3=100%, 缺2/1=应用此系数
}

interface SolverResult {
  comboCoeffs: Record<string, ComboCoefficients>;
  combinationRates: Record<string, number>;
  converged: boolean;
  error: number;
}

// 计算组合缺几张
function calculateMissingCount(combo: Combination, bag: Record<string, number>): number {
  let stillNeeded = 0;
  for (const req of combo.requirements) {
    const current = bag[req.cardId] || 0;
    const need = Math.max(0, req.count - current);
    stillNeeded += need;
  }
  return stillNeeded;
}

/**
 * 求解降权系数 - 极速版
 * 只搜2个参数，大幅减少计算量
 */
export function solveCoefficients(
  setup: CardSetup,
  targetRate: number = 4.0,
  trials: number = 200  // 降低试验次数
): SolverResult {

  if (setup.combinations.length < 2) {
    return {
      comboCoeffs: {},
      combinationRates: {},
      converged: false,
      error: 999,
    };
  }

  const combo1 = setup.combinations[0];
  const combo2 = setup.combinations[1];

  // 粗搜索：更少参数
  const rangeW1 = [0.01, 0.02, 0.03, 0.05, 0.08, 0.12, 0.20];
  const rangeW2 = [0.005, 0.01, 0.015, 0.02, 0.03, 0.05, 0.08];

  let bestResult: SolverResult | null = null;
  let minError = Infinity;
  let bestW1 = 0.03, bestW2 = 0.015;

  // 第一阶段：粗搜索
  for (const coeff1 of rangeW1) {
    for (const coeff2 of rangeW2) {
      const rates = runFastSim(
        combo1, combo2,
        { coeff: coeff1 },
        { coeff: coeff2 },
        trials
      );

      const error = Math.abs(rates[0] - targetRate) + Math.abs(rates[1] - targetRate);

      if (error < minError) {
        minError = error;
        bestW1 = coeff1;
        bestW2 = coeff2;
        bestResult = {
          comboCoeffs: {
            [combo1.name]: { coeff: coeff1 },
            [combo2.name]: { coeff: coeff2 },
          },
          combinationRates: {
            [combo1.name]: rates[0],
            [combo2.name]: rates[1],
          },
          converged: error < 0.5,
          error,
        };
      }
    }
  }

  // 第二阶段：细搜索（最佳值附近）
  const fineW1 = [bestW1 * 0.8, bestW1 * 0.9, bestW1, bestW1 * 1.1, bestW1 * 1.2].filter(x => x <= 0.30);
  const fineW2 = [bestW2 * 0.8, bestW2 * 0.9, bestW2, bestW2 * 1.1, bestW2 * 1.2].filter(x => x <= 0.15);

  for (const coeff1 of fineW1) {
    for (const coeff2 of fineW2) {
      const rates = runFastSim(
        combo1, combo2,
        { coeff: coeff1 },
        { coeff: coeff2 },
        trials * 2  // 细搜用更多试验
      );

      const error = Math.abs(rates[0] - targetRate) + Math.abs(rates[1] - targetRate);

      if (error < minError) {
        minError = error;
        bestW1 = coeff1;
        bestW2 = coeff2;
        bestResult = {
          comboCoeffs: {
            [combo1.name]: { coeff: coeff1 },
            [combo2.name]: { coeff: coeff2 },
          },
          combinationRates: {
            [combo1.name]: rates[0],
            [combo2.name]: rates[1],
          },
          converged: error < 0.5,
          error,
        };
      }
    }
  }

  return bestResult || {
    comboCoeffs: {
      [combo1.name]: { coeff: 0.03 },
      [combo2.name]: { coeff: 0.015 },
    },
    combinationRates: {},
    converged: false,
    error: minError,
  };
}

// 简化的加权模拟：只跑概率最高的4种组合，减少计算量
const FAST_COMBO_DIST: Array<[string, string, number]> = [
  ['common', 'common', 0.22],
  ['common', 'rare', 0.22],
  ['rare', 'common', 0.22],
  ['rare', 'rare', 0.13],
];

function runFastSim(
  combo1: Combination,
  combo2: Combination,
  coeffs1: ComboCoefficients,
  coeffs2: ComboCoefficients,
  trials: number
): [number, number] {
  let w1Sum = 0, w2Sum = 0;
  let totalWeight = 0;

  for (const [aType, cType, weight] of FAST_COMBO_DIST) {
    const [r1, r2] = runSim(combo1, combo2, coeffs1, coeffs2, aType as any, cType as any, trials);
    w1Sum += r1 * weight;
    w2Sum += r2 * weight;
    totalWeight += weight;
  }

  return [
    (w1Sum / totalWeight) * 100,
    (w2Sum / totalWeight) * 100,
  ];
}

function runSim(
  combo1: Combination,
  combo2: Combination,
  coeffs1: ComboCoefficients,
  coeffs2: ComboCoefficients,
  aType: 'common' | 'rare' | 'magic',
  cType: 'common' | 'rare' | 'magic',
  trials: number
): [number, number] {
  let s1 = 0, s2 = 0;

  const combo1Cards = combo1.requirements.map(r => r.cardId);
  const combo2Cards = combo2.requirements.map(r => r.cardId);

  for (let t = 0; t < trials; t++) {
    // 生成日程
    const week1 = ['common', 'common', 'common', 'common', 'common', 'rare', 'magic'];
    const week2 = ['common', 'common', 'common', 'common', 'common', 'rare', 'magic'];
    shuffleArray(week1);
    shuffleArray(week2);
    const days = [...week1, ...week2];

    const bag: Record<string, number> = {};
    const luckyA = [0, 0];
    const luckyC = [0, 0];

    // 第一周（第0-6天）
    for (let day = 0; day < 7; day++) {
      const dayType = days[day] as 'common' | 'rare' | 'magic';
      const week = 0;

      const isALucky = (dayType === aType && luckyA[week] === 0);
      if (isALucky) luckyA[week] = 1;
      const isCLucky = (dayType === cType && luckyC[week] === 0);
      if (isCLucky) luckyC[week] = 1;

      // 计算组合缺几张
      const w1Missing = calculateMissingCount(combo1, bag);
      const w2Missing = calculateMissingCount(combo2, bag);

      // 简化系数：缺3张=1.0，缺2/1/0张=用该组合的coeff
      const w1Coeff = w1Missing >= 3 ? 1.0 : coeffs1.coeff;
      const w2Coeff = w2Missing >= 3 ? 1.0 : coeffs2.coeff;

      // 抽卡
      for (const card of combo1Cards) {
        const cardType = getCardType(card);
        let p = getSingleP(cardType, dayType, isALucky);
        p *= w1Coeff;
        if (Math.random() < singleToDay(p)) {
          bag[card] = (bag[card] || 0) + 1;
        }
      }
      for (const card of combo2Cards) {
        const cardType = getCardType(card);
        let p = getSingleP(cardType, dayType, isCLucky);
        p *= w2Coeff;
        if (Math.random() < singleToDay(p)) {
          bag[card] = (bag[card] || 0) + 1;
        }
      }
    }

    // 第6天检查第一组
    if (calculateMissingCount(combo1, bag) === 0) s1++;

    // 第二周（第7-13天）
    for (let day = 7; day < 14; day++) {
      const dayType = days[day] as 'common' | 'rare' | 'magic';
      const week = 1;

      const isALucky = (dayType === aType && luckyA[week] === 0);
      if (isALucky) luckyA[week] = 1;
      const isCLucky = (dayType === cType && luckyC[week] === 0);
      if (isCLucky) luckyC[week] = 1;

      // 第一组已完成，只用很小系数
      const w1Missing = calculateMissingCount(combo1, bag);
      const w1Coeff = w1Missing >= 3 ? 1.0 : (w1Missing > 0 ? coeffs1.coeff : 0.001);

      const w2Missing = calculateMissingCount(combo2, bag);
      const w2Coeff = w2Missing >= 3 ? 1.0 : coeffs2.coeff;

      for (const card of combo1Cards) {
        const cardType = getCardType(card);
        let p = getSingleP(cardType, dayType, isALucky);
        p *= w1Coeff;
        if (Math.random() < singleToDay(p)) {
          bag[card] = (bag[card] || 0) + 1;
        }
      }
      for (const card of combo2Cards) {
        const cardType = getCardType(card);
        let p = getSingleP(cardType, dayType, isCLucky);
        p *= w2Coeff;
        if (Math.random() < singleToDay(p)) {
          bag[card] = (bag[card] || 0) + 1;
        }
      }
    }

    // 第13天检查第二组
    if (calculateMissingCount(combo2, bag) === 0) s2++;
  }

  return [s1 / trials, s2 / trials];
}

function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

export function generateCoefficientReport(
  setup: CardSetup,
  solverResult: SolverResult
): CoefficientResult {
  const { comboCoeffs, combinationRates } = solverResult;

  const result: CoefficientResult = {
    byMissingCount: {
      missing3: {},
      missing2: {},
      missing1: {},
    },
    allCoefficients: {},
    combinationRates,
    fullCollectionRate: 0,
    converged: solverResult.converged,
    error: solverResult.error,
  };

  // 简化显示：每组只显示一个系数
  for (const combo of setup.combinations) {
    const coeff = comboCoeffs[combo.name]?.coeff ?? 0.02;
    const cards = combo.requirements.map(r => r.cardId);

    // 缺3张：100%
    for (const card of cards) {
      result.byMissingCount.missing3[card] = 1.0;
    }
    // 缺2/1张：用该组合的系数
    for (const card of cards) {
      result.byMissingCount.missing2[card] = coeff;
      result.byMissingCount.missing1[card] = coeff;
    }
    // 记录系数
    for (const card of cards) {
      result.allCoefficients[card] = coeff;
    }
  }

  return result;
}

export type { SolverResult };
export { ALL_CARDS };
