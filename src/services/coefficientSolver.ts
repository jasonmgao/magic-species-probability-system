/**
 * 降权系数求解器（完整版）
 * 包含：1. 降权系数求解  2. 10张卡集齐率计算
 */

import type { CardSetup, Combination, CoefficientResult } from '@/types';

const ALL_CARDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const OTHER_CARDS = ['E', 'F', 'G', 'H', 'I', 'J'];

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

// 组合分布权重
const COMBO_FULL: Array<[string, string, number]> = [
  ['magic', 'common', 0.06],
  ['magic', 'rare', 0.04],
  ['common', 'magic', 0.06],
  ['common', 'rare', 0.22],
  ['rare', 'magic', 0.04],
  ['rare', 'common', 0.22],
  ['common', 'common', 0.22],
  ['rare', 'rare', 0.13],
];

const FAST_COMBO: Array<[string, string, number]> = [
  ['common', 'common', 0.22],
  ['common', 'rare', 0.22],
  ['rare', 'common', 0.22],
  ['rare', 'rare', 0.13],
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

// 每套组合的系数：缺3张、缺2张、缺1张时的系数
interface ComboCoefficients {
  missing3: number;  // 缺3张时（持有0张）
  missing2: number;  // 缺2张时（持有1张）
  missing1: number;  // 缺1张时（持有2张）
}

interface SolverResult {
  comboCoeffs: Record<string, ComboCoefficients>;
  combinationRates: Record<string, number>;
  fullCollectionRate: number;
  converged: boolean;
  error: number;
}

/**
 * 求解降权系数
 */
export function solveCoefficients(
  setup: CardSetup,
  targetRate: number = 4.0,
  trials: number = 200
): SolverResult {

  if (setup.combinations.length < 2) {
    return {
      comboCoeffs: {},
      combinationRates: {},
      fullCollectionRate: 0,
      converged: false,
      error: 999,
    };
  }

  const combo1 = setup.combinations[0];
  const combo2 = setup.combinations[1];

  // 搜索范围：缺3张=100%（固定），只搜索缺2张和缺1张的系数
  const rangeM2 = [0.05, 0.10, 0.15, 0.20, 0.30, 0.50];  // 缺2张系数
  const rangeM1 = [0.01, 0.02, 0.03, 0.05, 0.08, 0.12];  // 缺1张系数

  let bestResult: SolverResult | null = null;
  let minError = Infinity;

  // 第一套搜索
  for (const m2_1 of rangeM2) {
    for (const m1_1 of rangeM1) {
      if (m1_1 > m2_1) continue; // 缺1张系数应<=缺2张系数

      // 第二套搜索
      for (const m2_2 of rangeM2) {
        for (const m1_2 of rangeM1) {
          if (m1_2 > m2_2) continue;

          const rates = runFastSim(
            combo1, combo2,
            { missing3: 1.0, missing2: m2_1, missing1: m1_1 },
            { missing3: 1.0, missing2: m2_2, missing1: m1_2 },
            trials
          );

          const error = Math.abs(rates[0] - targetRate) + Math.abs(rates[1] - targetRate);

          if (error < minError) {
            minError = error;
            bestResult = {
              comboCoeffs: {
                [combo1.name]: { missing3: 1.0, missing2: m2_1, missing1: m1_1 },
                [combo2.name]: { missing3: 1.0, missing2: m2_2, missing1: m1_2 },
              },
              combinationRates: {
                [combo1.name]: rates[0],
                [combo2.name]: rates[1],
              },
              fullCollectionRate: 0,
              converged: error < 0.5,
              error,
            };
          }
          if (minError < 0.3) break;
        }
        if (minError < 0.3) break;
      }
      if (minError < 0.3) break;
    }
    if (minError < 0.3) break;
  }

  // 计算最终全收集率
  if (bestResult) {
    const finalRates = runFastSim(
      combo1, combo2,
      bestResult.comboCoeffs[combo1.name],
      bestResult.comboCoeffs[combo2.name],
      500
    );
    bestResult.fullCollectionRate = calculateFullCollectionRate(
      combo1, combo2,
      bestResult.comboCoeffs[combo1.name],
      bestResult.comboCoeffs[combo2.name]
    );
  }

  return bestResult || {
    comboCoeffs: {
      [combo1.name]: { missing3: 1.0, missing2: 0.03, missing1: 0.01 },
      [combo2.name]: { missing3: 1.0, missing2: 0.015, missing1: 0.005 },
    },
    combinationRates: {},
    fullCollectionRate: 0,
    converged: false,
    error: minError,
  };
}

/**
 * 计算10张卡集齐率（参考用户Python逻辑）
 */
function calculateFullCollectionRate(
  combo1: Combination,
  combo2: Combination,
  coeffs1: ComboCoefficients,
  coeffs2: ComboCoefficients,
  trials: number = 1000
): number {
  const combo1Cards = combo1.requirements.map(r => r.cardId);
  const combo2Cards = combo2.requirements.map(r => r.cardId);

  // 推断 A,B 类型和 C,D 类型
  const aType = getCardType(combo1Cards[0]);
  const cType = getCardType(combo2Cards[0]);

  let successCount = 0;

  for (let t = 0; t < trials; t++) {
    // 生成日程
    const week1 = ['common', 'common', 'common', 'common', 'common', 'rare', 'magic'];
    const week2 = ['common', 'common', 'common', 'common', 'common', 'rare', 'magic'];
    shuffleArray(week1);
    shuffleArray(week2);
    const days = [...week1, ...week2];

    // 10张卡背包
    const bag: Record<string, number> = {
      'A': 0, 'B': 0, 'C': 0, 'D': 0,
      'E': 0, 'F': 0, 'G': 0, 'H': 0, 'I': 0, 'J': 0
    };

    const luckyA = [0, 0];
    const luckyC = [0, 0];

    for (let day = 0; day < 14; day++) {
      const dayType = days[day] as 'common' | 'rare' | 'magic';
      const week = day < 7 ? 0 : 1;

      const isALucky = (dayType === aType && luckyA[week] === 0);
      if (isALucky) luckyA[week] = 1;
      const isCLucky = (dayType === cType && luckyC[week] === 0);
      if (isCLucky) luckyC[week] = 1;

      const isBLucky = isALucky;
      const isDLucky = isCLucky;

      // 获取基础概率（原始概率，用于计算Others）
      const p_raw: Record<string, number> = {
        'A': getSingleP(aType, dayType, isALucky),
        'B': getSingleP(aType, dayType, isBLucky),
        'C': getSingleP(cType, dayType, isCLucky),
        'D': getSingleP(cType, dayType, isDLucky),
        'E': getSingleP(aType, dayType, false),
        'F': getSingleP(aType, dayType, false),
        'G': getSingleP(cType, dayType, false),
        'H': getSingleP(cType, dayType, false),
        'I': getSingleP(aType, dayType, false),
        'J': getSingleP(cType, dayType, false),
      };

      // 复制一份用于应用降权
      const p_s = { ...p_raw };

      // 计算各套组合的缺卡数量
      const w1Missing = calculateMissingCount(combo1, bag);
      const w2Missing = calculateMissingCount(combo2, bag);

      // 获取对应的系数
      const w1Coeff = w1Missing >= 3 ? coeffs1.missing3 :
                     w1Missing === 2 ? coeffs1.missing2 : coeffs1.missing1;
      const w2Coeff = w2Missing >= 3 ? coeffs2.missing3 :
                     w2Missing === 2 ? coeffs2.missing2 : coeffs2.missing1;

      // 应用降权系数：只对组合卡生效，填充卡不应用降权
      for (const card of combo1Cards) {
        if (bag[card] >= 1) p_s[card] *= w1Coeff;
      }
      for (const card of combo2Cards) {
        if (bag[card] >= 1) p_s[card] *= w2Coeff;
      }
      // 填充卡E-J：不应用任何降权，可以无限获得

      // 转换为日概率（应用降权后的）
      const w: Record<string, number> = {};
      for (const card of ALL_CARDS) {
        w[card] = singleToDay(p_s[card]);
      }

      // Others权重 = 1 - 原始权重之和（参考Python代码）
      const wRawSum = ALL_CARDS.reduce((sum, card) => sum + singleToDay(p_raw[card]), 0);
      const wOthers = Math.max(0, 1.0 - wRawSum);

      // 归一化并轮盘赌
      const wSum = ALL_CARDS.reduce((sum, card) => sum + w[card], 0);
      const total = wSum + wOthers;
      const r = Math.random() * total;
      let cumsum = 0;

      for (const card of ALL_CARDS) {
        cumsum += w[card];
        if (r < cumsum) {
          bag[card]++;
          break;
        }
      }
      // 如果没获得卡，就是Others（不增加任何卡）
    }

    // 检查是否10张全齐
    if (ALL_CARDS.every(c => bag[c] >= 1)) {
      successCount++;
    }
  }

  return (successCount / trials) * 100;
}

/**
 * 快速模拟（只求组合中奖率）
 */
function runFastSim(
  combo1: Combination,
  combo2: Combination,
  coeffs1: ComboCoefficients,
  coeffs2: ComboCoefficients,
  trials: number
): [number, number] {
  let w1Sum = 0, w2Sum = 0;
  let totalWeight = 0;

  for (const [aType, cType, weight] of FAST_COMBO) {
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
    const week1 = ['common', 'common', 'common', 'common', 'common', 'rare', 'magic'];
    const week2 = ['common', 'common', 'common', 'common', 'common', 'rare', 'magic'];
    shuffleArray(week1);
    shuffleArray(week2);
    const days = [...week1, ...week2];

    const bag: Record<string, number> = {};
    const luckyA = [0, 0];
    const luckyC = [0, 0];

    for (let day = 0; day < 7; day++) {
      const dayType = days[day] as 'common' | 'rare' | 'magic';
      const week = 0;

      const isALucky = (dayType === aType && luckyA[week] === 0);
      if (isALucky) luckyA[week] = 1;
      const isCLucky = (dayType === cType && luckyC[week] === 0);
      if (isCLucky) luckyC[week] = 1;

      const w1Missing = calculateMissingCount(combo1, bag);
      const w2Missing = calculateMissingCount(combo2, bag);

      // 根据缺卡数量选择对应的系数
      const w1Coeff = w1Missing >= 3 ? coeffs1.missing3 :
                     w1Missing === 2 ? coeffs1.missing2 : coeffs1.missing1;
      const w2Coeff = w2Missing >= 3 ? coeffs2.missing3 :
                     w2Missing === 2 ? coeffs2.missing2 : coeffs2.missing1;

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

    if (calculateMissingCount(combo1, bag) === 0) s1++;

    for (let day = 7; day < 14; day++) {
      const dayType = days[day] as 'common' | 'rare' | 'magic';
      const week = 1;

      const isALucky = (dayType === aType && luckyA[week] === 0);
      if (isALucky) luckyA[week] = 1;
      const isCLucky = (dayType === cType && luckyC[week] === 0);
      if (isCLucky) luckyC[week] = 1;

      const w1Missing = calculateMissingCount(combo1, bag);
      const w1Coeff = w1Missing >= 3 ? coeffs1.missing3 :
                     w1Missing === 2 ? coeffs1.missing2 :
                     w1Missing === 1 ? coeffs1.missing1 : 0.001;
      const w2Missing = calculateMissingCount(combo2, bag);
      const w2Coeff = w2Missing >= 3 ? coeffs2.missing3 :
                     w2Missing === 2 ? coeffs2.missing2 :
                     w2Missing === 1 ? coeffs2.missing1 : 0.001;

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
  const { comboCoeffs, combinationRates, fullCollectionRate } = solverResult;

  const result: CoefficientResult = {
    byMissingCount: { missing3: {}, missing2: {}, missing1: {} },
    allCoefficients: {},
    comboCoeffs,
    combinationRates,
    fullCollectionRate,
    converged: solverResult.converged,
    error: solverResult.error,
  };

  for (const combo of setup.combinations) {
    const coeffs = comboCoeffs[combo.name] ?? { missing3: 1.0, missing2: 0.02, missing1: 0.01 };
    const cards = combo.requirements.map(r => r.cardId);

    for (const card of cards) {
      result.byMissingCount.missing3[card] = coeffs.missing3;
      result.byMissingCount.missing2[card] = coeffs.missing2;
      result.byMissingCount.missing1[card] = coeffs.missing1;
      result.allCoefficients[card] = coeffs.missing2; // 默认用缺2张的系数
    }
  }

  return result;
}

export type { SolverResult };
export { ALL_CARDS };
