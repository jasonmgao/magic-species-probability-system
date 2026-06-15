/**
 * 降权系数求解器（最终版）
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

// 单日概率转换：4次独立抽卡=>至少1次的概率
function singleToDay(p: number): number {
  if (p >= 1.0) return 1.0;
  if (p <= 0.0) return 0.0;
  return 1.0 - Math.pow(1.0 - p, 4.0);
}

// 基础概率配置（按比例，非百分比）
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

// 组合分布权重（第一组幸运卡类型，第二组幸运卡类型，权重）
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

/**
 * 获取单次抽卡基础概率
 */
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

// 组合系数配置：针对该组合的缺卡状态
interface ComboCoefficients {
  missing3: number;  // 缺3张时的系数（空组合）
  missing2: number;  // 缺2张时的系数（持有1张）
  missing1: number;  // 缺1张时的系数（持有2张或1张满足1需求）
}

interface SolverResult {
  comboCoeffs: Record<string, ComboCoefficients>; // 每个组合的系数配置
  combinationRates: Record<string, number>;
  fullCollectionRate: number;
  converged: boolean;
  error: number;
}

/**
 * 计算组合当前缺几张
 * 例如：AAB组合，用户持有2A0B => 只需要1张B，缺1张
 *       AAB组合，用户持有1A0B => 还需要1A1B，缺2张
 *       AAB组合，用户持有1A1B => 只需要1张A，缺1张
 */
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
 * 求解降权系数
 * 目标：使每组组合的加权中奖率都接近 targetRate (默认4%)
 */
export function solveCoefficients(
  setup: CardSetup,
  targetRate: number = 4.0,
  trials: number = 2000
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

  // 为每个组合独立配置系数
  // 第一组：AaB（A需要2张，B需要1张，总需求3张）
  // 第二组：CcD（C需要2张，D需要1张，总需求3张）

  // 网格搜索：为两组分别找到最佳系数
  // 第一组系数范围
  const rangeW1 = [0.005, 0.01, 0.015, 0.02, 0.03, 0.04, 0.05, 0.06, 0.08, 0.10, 0.12, 0.15];
  // 第二组系数范围
  const rangeW2 = [0.003, 0.005, 0.008, 0.01, 0.012, 0.015, 0.02, 0.025, 0.03, 0.04, 0.05];

  let bestResult: SolverResult | null = null;
  let minError = Infinity;

  for (const coeffW1_m3 of rangeW1) {        // 第一组缺3张系数
    for (const coeffW1_m2 of rangeW1) {      // 第一组缺2张系数
      if (coeffW1_m2 > coeffW1_m3) continue; // 缺得少，系数应更小或相等
      for (const coeffW1_m1 of rangeW1) {    // 第一组缺1张系数
        if (coeffW1_m1 > coeffW1_m2) continue;

        for (const coeffW2_m3 of rangeW2) {      // 第二组缺3张系数
          for (const coeffW2_m2 of rangeW2) {    // 第二组缺2张系数
            if (coeffW2_m2 > coeffW2_m3) continue;
            for (const coeffW2_m1 of rangeW2) {  // 第二组缺1张系数
              if (coeffW2_m1 > coeffW2_m2) continue;

              const w1coeffs: ComboCoefficients = {
                missing3: coeffW1_m3,
                missing2: coeffW1_m2,
                missing1: coeffW1_m1,
              };
              const w2coeffs: ComboCoefficients = {
                missing3: coeffW2_m3,
                missing2: coeffW2_m2,
                missing1: coeffW2_m1,
              };

              const rates = runWeightedSim(
                combo1, combo2, w1coeffs, w2coeffs, trials
              );

              const error = Math.abs(rates[0] - targetRate) + Math.abs(rates[1] - targetRate);

              if (error < minError) {
                minError = error;
                bestResult = {
                  comboCoeffs: {
                    [combo1.name]: w1coeffs,
                    [combo2.name]: w2coeffs,
                  },
                  combinationRates: {
                    [combo1.name]: rates[0],
                    [combo2.name]: rates[1],
                  },
                  fullCollectionRate: 0, // 暂不算
                  converged: error < 0.5,
                  error,
                };
              }

              if (error < 0.3) break;
            }
            if (minError < 0.3) break;
          }
          if (minError < 0.3) break;
        }
        if (minError < 0.3) break;
      }
      if (minError < 0.3) break;
    }
    if (minError < 0.3) break;
  }

  return bestResult || {
    comboCoeffs: {
      [combo1.name]: { missing3: 0.02, missing2: 0.01, missing1: 0.005 },
      [combo2.name]: { missing3: 0.01, missing2: 0.005, missing1: 0.002 },
    },
    combinationRates: {},
    fullCollectionRate: 0,
    converged: false,
    error: minError,
  };
}

/**
 * 运行加权模拟（考虑幸运卡组合分布）
 */
function runWeightedSim(
  combo1: Combination,
  combo2: Combination,
  coeffs1: ComboCoefficients,
  coeffs2: ComboCoefficients,
  trials: number
): [number, number] {
  let w1Sum = 0, w2Sum = 0;
  let totalWeight = 0;

  for (const [aType, cType, weight] of COMBO_DIST) {
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

/**
 * 单次模拟（一个幸运卡组合场景）
 */
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

  // 收集所有组合涉及的卡
  const combo1Cards = combo1.requirements.map(r => r.cardId);
  const combo2Cards = combo2.requirements.map(r => r.cardId);

  for (let t = 0; t < trials; t++) {
    // 生成两周日程
    const week1 = ['common', 'common', 'common', 'common', 'common', 'rare', 'magic'];
    const week2 = ['common', 'common', 'common', 'common', 'common', 'rare', 'magic'];
    shuffleArray(week1);
    shuffleArray(week2);
    const days = [...week1, ...week2];

    // 背包状态
    const bag: Record<string, number> = {};
    const luckyA = [0, 0];
    const luckyC = [0, 0];

    // 第一周模拟（第0-6天）
    for (let day = 0; day < 7; day++) {
      const dayType = days[day] as 'common' | 'rare' | 'magic';
      const week = 0;

      const isALucky = (dayType === aType && luckyA[week] === 0);
      if (isALucky) luckyA[week] = 1;
      const isCLucky = (dayType === cType && luckyC[week] === 0);
      if (isCLucky) luckyC[week] = 1;

      // 计算第一组缺几张
      const w1Missing = calculateMissingCount(combo1, bag);
      // 计算第二组缺几张
      const w2Missing = calculateMissingCount(combo2, bag);

      // 获得第一组的系数（基于第一组自己的缺卡状态）
      const w1Coeff = w1Missing >= 3 ? coeffs1.missing3 :
                     w1Missing === 2 ? coeffs1.missing2 : coeffs1.missing1;

      // 获得第二组的系数（基于第二组自己的缺卡状态）
      const w2Coeff = w2Missing >= 3 ? coeffs2.missing3 :
                     w2Missing === 2 ? coeffs2.missing2 : coeffs2.missing1;

      // 抽卡
      for (const card of combo1Cards) {
        const cardType = getCardType(card);
        let p = getSingleP(cardType, dayType, isALucky);
        p *= w1Coeff; // 应用第一组缺卡状态的系数
        if (Math.random() < singleToDay(p)) {
          bag[card] = (bag[card] || 0) + 1;
        }
      }
      for (const card of combo2Cards) {
        const cardType = getCardType(card);
        let p = getSingleP(cardType, dayType, isCLucky);
        p *= w2Coeff; // 应用第二组缺卡状态的系数
        if (Math.random() < singleToDay(p)) {
          bag[card] = (bag[card] || 0) + 1;
        }
      }
    }

    // 第6天检查第一组
    if (calculateMissingCount(combo1, bag) === 0) s1++;

    // 第二周模拟（第7-13天）
    for (let day = 7; day < 14; day++) {
      const dayType = days[day] as 'common' | 'rare' | 'magic';
      const week = 1;

      const isALucky = (dayType === aType && luckyA[week] === 0);
      if (isALucky) luckyA[week] = 1;
      const isCLucky = (dayType === cType && luckyC[week] === 0);
      if (isCLucky) luckyC[week] = 1;

      // 第二周继续积累卡片，但第一组已完成，第二组继续
      // 注意：第二周第一组的卡也会获得，但第一组已不计算中奖

      // 计算当前缺几张（第二组）
      const w2Missing = calculateMissingCount(combo2, bag);
      const w2Coeff = w2Missing >= 3 ? coeffs2.missing3 :
                     w2Missing === 2 ? coeffs2.missing2 : coeffs2.missing1;

      // 抽卡（两组都可能继续获得）
      for (const card of combo1Cards) {
        const cardType = getCardType(card);
        let p = getSingleP(cardType, dayType, isALucky);
        // 第一组已完成，使用缺0张系数（很小）
        const w1Missing = calculateMissingCount(combo1, bag);
        const w1Coeff = w1Missing >= 3 ? coeffs1.missing3 :
                       w1Missing === 2 ? coeffs1.missing2 :
                       w1Missing === 1 ? coeffs1.missing1 : 0.001;
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

/**
 * Fisher-Yates 洗牌算法
 */
function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

/**
 * 生成系数结果报告
 */
export function generateCoefficientReport(
  setup: CardSetup,
  solverResult: SolverResult
): CoefficientResult {
  const { comboCoeffs, combinationRates, fullCollectionRate } = solverResult;

  // 提取每个组合的卡
  const cardsByCombo: Record<string, string[]> = {};
  for (const combo of setup.combinations) {
    cardsByCombo[combo.name] = combo.requirements.map(r => r.cardId);
  }

  // 构建结果
  const result: CoefficientResult = {
    byMissingCount: {
      missing3: {},
      missing2: {},
      missing1: {},
    },
    allCoefficients: {},
    combinationRates,
    fullCollectionRate: 0, // 简化版不算全收集
    converged: solverResult.converged,
    error: solverResult.error,
  };

  // 为每个组合的系数生成显示
  for (const [comboName, coeffs] of Object.entries(comboCoeffs)) {
    const cards = cardsByCombo[comboName] || [];

    // 缺3张：所有卡都用这个系数
    for (const card of cards) {
      result.byMissingCount.missing3[card] = coeffs.missing3;
    }
    // 缺2张
    for (const card of cards) {
      result.byMissingCount.missing2[card] = coeffs.missing2;
    }
    // 缺1张
    for (const card of cards) {
      result.byMissingCount.missing1[card] = coeffs.missing1;
    }
  }

  // 简化：只记录第一组的系数作为allCoefficients
  if (setup.combinations[0]) {
    const c1 = comboCoeffs[setup.combinations[0].name];
    if (c1) {
      for (const card of cardsByCombo[setup.combinations[0].name]) {
        result.allCoefficients[card] = c1.missing2; // 主要用缺2张的系数
      }
    }
  }
  if (setup.combinations[1]) {
    const c2 = comboCoeffs[setup.combinations[1].name];
    if (c2) {
      for (const card of cardsByCombo[setup.combinations[1].name]) {
        result.allCoefficients[card] = c2.missing2;
      }
    }
  }

  return result;
}

export type { SolverResult };
export { ALL_CARDS };
