/**
 * 降权系数求解器（修正版）
 * 参考用户的Python代码逻辑
 */

import type { CardSetup, CoefficientSet, CoefficientResult } from '@/types';

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

interface SolverResult {
  coefficients: Record<string, number>; // 每张卡的降权系数（持有1张时）
  combinationRates: Record<string, number>;
  fullCollectionRate: number;
  converged: boolean;
  error: number;
}

/**
 * 求解降权系数
 * 目标：使每组组合的加权中奖率都接近 targetRate (默认4%)
 */
export function solveCoefficients(
  setup: CardSetup,
  targetRate: number = 4.0,
  trials: number = 3000
): SolverResult {

  // 按组合分组收集卡片
  const comboCards: string[][] = [];
  for (const combo of setup.combinations) {
    const cards = combo.requirements.map(r => r.cardId);
    comboCards.push(cards);
  }

  // 网格搜索范围
  // 第一组系数（对应 AaB）
  const rangeA = [0.005, 0.008, 0.010, 0.012, 0.015, 0.020, 0.025, 0.030, 0.035, 0.040, 0.050];
  // 第二组系数（对应 CcD）
  const rangeC = [0.005, 0.006, 0.008, 0.010, 0.012, 0.014, 0.016, 0.018, 0.020];

  let bestResult: SolverResult | null = null;
  let minError = Infinity;

  for (const coeffA of rangeA) {
    for (const coeffC of rangeC) {
      // 构建系数表
      const coefficients: Record<string, number> = {};

      // 为第一组组合的卡设置系数 coeffA
      if (comboCards[0]) {
        for (const card of comboCards[0]) {
          coefficients[card] = coeffA;
        }
      }
      // 为第二组组合的卡设置系数 coeffC
      if (comboCards[1]) {
        for (const card of comboCards[1]) {
          // 如果卡片也在第一组中，使用较小的系数（更严格）
          coefficients[card] = Math.min(coefficients[card] ?? 1, coeffC);
        }
      }

      // 运行加权模拟（考虑所有幸运卡组合分布）
      const rates = runWeightedSim(comboCards, coefficients, trials);

      // 计算误差（加权平均与目标的偏差）
      let totalError = 0;
      for (let i = 0; i < setup.combinations.length; i++) {
        const comboName = setup.combinations[i].name;
        const rate = rates[i] ?? 0;
        totalError += Math.abs(rate - targetRate);
      }

      if (totalError < minError) {
        minError = totalError;
        bestResult = {
          coefficients,
          combinationRates: Object.fromEntries(
            setup.combinations.map((c, i) => [c.name, rates[i] ?? 0])
          ),
          fullCollectionRate: rates[2] ?? 0, // 全收集率
          converged: totalError < 0.5, // 误差<0.5%认为收敛
          error: totalError,
        };
      }
    }
  }

  return bestResult || {
    coefficients: {},
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
  comboCards: string[][],
  coefficients: Record<string, number>,
  trials: number
): number[] {
  // 每人每组的加权成功率
  let w1Sum = 0, w2Sum = 0;
  const targetRates: number[] = [0, 0]; // [第一组成功率, 第二组成功率]

  for (const [aType, cType, weight] of COMBO_DIST) {
    const [r1, r2] = runSim(comboCards, coefficients, aType as any, cType as any, trials);
    w1Sum += r1 * weight;
    w2Sum += r2 * weight;
  }

  // 计算加权平均成功率（百分比）
  const totalWeight = COMBO_DIST.reduce((sum, [,, w]) => sum + w, 0);
  targetRates[0] = (w1Sum / totalWeight) * 100;
  targetRates[1] = (w2Sum / totalWeight) * 100;

  return targetRates;
}

/**
 * 单次模拟（一个幸运卡组合场景）
 */
function runSim(
  comboCards: string[][],
  coefficients: Record<string, number>,
  aType: 'common' | 'rare' | 'magic',
  cType: 'common' | 'rare' | 'magic',
  trials: number
): [number, number] {
  let s1 = 0, s2 = 0;

  for (let t = 0; t < trials; t++) {
    // 生成两周的日程（每周5普通+1稀有+1神奇，随机排序）
    const week1 = ['common', 'common', 'common', 'common', 'common', 'rare', 'magic'];
    const week2 = ['common', 'common', 'common', 'common', 'common', 'rare', 'magic'];
    shuffleArray(week1);
    shuffleArray(week2);
    const days = [...week1, ...week2];

    // 背包状态
    const bag: Record<string, number> = {};
    const luckyA = [0, 0]; // 两周的A组幸运卡状态
    const luckyC = [0, 0]; // 两周的C组幸运卡状态

    // 模拟14天
    for (let day = 0; day < 14; day++) {
      const dayType = days[day] as 'common' | 'rare' | 'magic';
      const week = day < 7 ? 0 : 1;

      // 判断是否是幸运卡日
      const isALucky = (dayType === aType && luckyA[week] === 0);
      if (isALucky) luckyA[week] = 1;
      const isCLucky = (dayType === cType && luckyC[week] === 0);
      if (isCLucky) luckyC[week] = 1;

      // 第一组卡的抽卡概率
      const cardsA = comboCards[0] || [];
      const pA: number[] = [];
      for (const card of cardsA) {
        const cardType = getCardType(card);
        let p = getSingleP(cardType, dayType, isALucky);
        // 应用降权系数
        const count = bag[card] || 0;
        const coeff = coefficients[card] ?? 0.02;
        if (count === 1) p *= coeff;
        else if (count >= 2) p = 0;
        pA.push(p);
      }

      // 第二组卡的抽卡概率
      const cardsC = comboCards[1] || [];
      const pC: number[] = [];
      for (const card of cardsC) {
        const cardType = getCardType(card);
        let p = getSingleP(cardType, dayType, isCLucky);
        // 应用降权系数
        const count = bag[card] || 0;
        const coeff = coefficients[card] ?? 0.008;
        if (count === 1) p *= coeff;
        else if (count >= 2) p = 0;
        pC.push(p);
      }

      // 模拟抽卡（每天4次=>转换为每日概率）
      for (let i = 0; i < cardsA.length; i++) {
        if (Math.random() < singleToDay(pA[i])) {
          bag[cardsA[i]] = (bag[cardsA[i]] || 0) + 1;
        }
      }
      for (let i = 0; i < cardsC.length; i++) {
        if (Math.random() < singleToDay(pC[i])) {
          bag[cardsC[i]] = (bag[cardsC[i]] || 0) + 1;
        }
      }

      // 第6天检查第一组（第7天截止前的最后一天）
      if (day === 6 && comboCards[0]) {
        const reqs = comboCards[0];
        const counts = reqs.map(c => bag[c] || 0);
        // AaB => [2, 1, 0] (A:2张, B:1张)
        if (counts[0] >= 2 && counts[1] >= 1) {
          s1++;
        }
      }
    }

    // 第14天检查第二组
    if (comboCards[1]) {
      const reqs = comboCards[1];
      const counts = reqs.map(c => bag[c] || 0);
      // CcD => [2, 1] (C:2张, D:1张)
      if (counts[0] >= 2 && counts[1] >= 1) {
        s2++;
      }
    }
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
  const { coefficients, combinationRates, fullCollectionRate } = solverResult;

  // 按组合分组
  const result: CoefficientResult = {
    byMissingCount: {
      missing3: {},
      missing2: {},
      missing1: {},
    },
    allCoefficients: {},
    combinationRates,
    fullCollectionRate,
    converged: solverResult.converged,
    error: solverResult.error,
  };

  // 第一组组合的系数 (missing2)
  let firstComboCards: string[] = [];
  let secondComboCards: string[] = [];

  if (setup.combinations[0]) {
    firstComboCards = setup.combinations[0].requirements.map(r => r.cardId);
    for (const card of firstComboCards) {
      const coeff = coefficients[card] ?? 0.02;
      // 缺3张=持有0张(100%)，缺2张=持有1张(系数)，缺1张=持有2张(0%)
      result.byMissingCount.missing3[card] = 1.0;
      result.byMissingCount.missing2[card] = coeff;
      result.byMissingCount.missing1[card] = 0;
      result.allCoefficients[card] = coeff;
    }
  }

  if (setup.combinations[1]) {
    secondComboCards = setup.combinations[1].requirements.map(r => r.cardId);
    for (const card of secondComboCards) {
      const coeff = coefficients[card] ?? 0.008;
      // 如果已经在第一组，用较小的系数
      const finalCoeff = result.allCoefficients[card]
        ? Math.min(result.allCoefficients[card], coeff)
        : coeff;

      result.byMissingCount.missing3[card] = 1.0;
      result.byMissingCount.missing2[card] = finalCoeff;
      result.byMissingCount.missing1[card] = 0;
      result.allCoefficients[card] = finalCoeff;
    }
  }

  return result;
}

export type { SolverResult };
export { ALL_CARDS };
