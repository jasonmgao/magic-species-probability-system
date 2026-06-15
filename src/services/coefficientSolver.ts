/**
 * 降权系数求解器（修正版）
 * 参考用户的Python代码逻辑
 */

import type { CardSetup, CoefficientResult } from '@/types';

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
  trials: number = 2000
): SolverResult {

  // 按组合分组收集卡片及其最大需求
  const comboCards: Array<{cards: string[], maxCounts: number[]}> = [];
  for (const combo of setup.combinations) {
    const cards: string[] = [];
    const maxCounts: number[] = [];
    for (const req of combo.requirements) {
      cards.push(req.cardId);
      maxCounts.push(req.count);
    }
    comboCards.push({ cards, maxCounts });
  }

  // 网格搜索范围：更精细的搜索
  // 第一组系数（对应 AaB/A/B等）
  const rangeA: number[] = [];
  for (let v = 0.001; v <= 0.08; v += 0.002) {
    rangeA.push(parseFloat(v.toFixed(4)));
  }
  // 第二组系数（对应 CcD/C/D等）
  const rangeC: number[] = [];
  for (let v = 0.001; v <= 0.03; v += 0.001) {
    rangeC.push(parseFloat(v.toFixed(4)));
  }

  let bestResult: SolverResult | null = null;
  let minError = Infinity;

  // 只搜索前40个组合以避免过长计算
  let searchCount = 0;
  const maxSearch = 40;

  for (const coeffA of rangeA) {
    for (const coeffC of rangeC) {
      searchCount++;
      if (searchCount > maxSearch) break;

      // 构建系数表
      const coefficients: Record<string, number> = {};

      // 为第一组组合的卡设置系数 coeffA
      if (comboCards[0]) {
        for (const card of comboCards[0].cards) {
          coefficients[card] = coeffA;
        }
      }
      // 为第二组组合的卡设置系数 coeffC
      if (comboCards[1]) {
        for (const card of comboCards[1].cards) {
          // 如果卡片也在第一组中，使用较小的系数（更严格）
          coefficients[card] = Math.min(coefficients[card] ?? 1, coeffC);
        }
      }

      // 运行加权模拟（考虑所有幸运卡组合分布）
      const rates = runWeightedSim(comboCards, coefficients, trials);

      // 计算误差（加权平均与目标的偏差）
      let totalError = 0;
      for (let i = 0; i < setup.combinations.length; i++) {
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
          fullCollectionRate: rates[2] ?? 0,
          converged: totalError < 0.5,
          error: totalError,
        };
      }

      // 如果误差很小，提前退出
      if (totalError < 0.3) break;
    }
    if (searchCount > maxSearch) break;
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
  comboCards: Array<{cards: string[], maxCounts: number[]}>,
  coefficients: Record<string, number>,
  trials: number
): number[] {
  // 每人每组的加权成功率
  let w1Sum = 0, w2Sum = 0;
  let totalWeight = 0;

  for (const [aType, cType, weight] of COMBO_DIST) {
    const [r1, r2] = runSim(comboCards, coefficients, aType as any, cType as any, trials);
    w1Sum += r1 * weight;
    w2Sum += r2 * weight;
    totalWeight += weight;
  }

  // 计算加权平均成功率（百分比）
  const targetRates: number[] = [
    (w1Sum / totalWeight) * 100,
    (w2Sum / totalWeight) * 100,
  ];

  return targetRates;
}

/**
 * 单次模拟（一个幸运卡组合场景）
 */
function runSim(
  comboCards: Array<{cards: string[], maxCounts: number[]}>,
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
      const groupA = comboCards[0];
      const pA: number[] = [];
      if (groupA) {
        for (let i = 0; i < groupA.cards.length; i++) {
          const card = groupA.cards[i];
          const cardType = getCardType(card);
          let p = getSingleP(cardType, dayType, isALucky);
          // 应用降权系数
          const count = bag[card] || 0;
          const coeff = coefficients[card] ?? 0.02;
          if (count === 1) p *= coeff;
          else if (count >= 2) p = 0;
          pA.push(p);
        }
      }

      // 第二组卡的抽卡概率
      const groupC = comboCards[1];
      const pC: number[] = [];
      if (groupC) {
        for (let i = 0; i < groupC.cards.length; i++) {
          const card = groupC.cards[i];
          const cardType = getCardType(card);
          let p = getSingleP(cardType, dayType, isCLucky);
          // 应用降权系数
          const count = bag[card] || 0;
          const coeff = coefficients[card] ?? 0.008;
          if (count === 1) p *= coeff;
          else if (count >= 2) p = 0;
          pC.push(p);
        }
      }

      // 模拟抽卡（每天4次=>转换为每日概率）
      if (groupA) {
        for (let i = 0; i < groupA.cards.length; i++) {
          if (Math.random() < singleToDay(pA[i])) {
            bag[groupA.cards[i]] = (bag[groupA.cards[i]] || 0) + 1;
          }
        }
      }
      if (groupC) {
        for (let i = 0; i < groupC.cards.length; i++) {
          if (Math.random() < singleToDay(pC[i])) {
            bag[groupC.cards[i]] = (bag[groupC.cards[i]] || 0) + 1;
          }
        }
      }

      // 第6天检查第一组（第7天截止前的最后一天）
      if (day === 6 && groupA) {
        const countsA = groupA.cards.map(c => bag[c] || 0);
        const maxCountsA = groupA.maxCounts;
        // 检查是否满足需求：counts[i] >= maxCounts[i]
        let satisfiedA = true;
        for (let i = 0; i < countsA.length; i++) {
          if (countsA[i] < maxCountsA[i]) {
            satisfiedA = false;
            break;
          }
        }
        if (satisfiedA) s1++;
      }

      // 第13天检查第二组（第14天截止前的最后一天）
      if (day === 13 && groupC) {
        const countsC = groupC.cards.map(c2 => bag[c2] || 0);
        const maxCountsC = groupC.maxCounts;
        let satisfiedC = true;
        for (let i = 0; i < countsC.length; i++) {
          if (countsC[i] < maxCountsC[i]) {
            satisfiedC = false;
            break;
          }
        }
        if (satisfiedC) s2++;
      }
    }

    // 循环结束后再检查一次第二组（确保第14天检查）
    const groupC2 = comboCards[1];
    if (groupC2 && s2 === 0) {
      const countsC2 = groupC2.cards.map(c3 => bag[c3] || 0);
      const maxCountsC2 = groupC2.maxCounts;
      let satisfiedC2 = true;
      for (let i = 0; i < countsC2.length; i++) {
        if (countsC2[i] < maxCountsC2[i]) {
          satisfiedC2 = false;
          break;
        }
      }
      if (satisfiedC2) s2++;
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
 * 关键：根据每张卡的需求数量，正确分类到缺3/2/1张
 */
export function generateCoefficientReport(
  setup: CardSetup,
  solverResult: SolverResult
): CoefficientResult {
  const { coefficients, combinationRates, fullCollectionRate } = solverResult;

  // 按组合分组，记录每张卡的最大需求
  const cardMaxNeeds: Record<string, number> = {};

  for (const combo of setup.combinations) {
    for (const req of combo.requirements) {
      cardMaxNeeds[req.cardId] = Math.max(
        cardMaxNeeds[req.cardId] || 0,
        req.count
      );
    }
  }

  // 按组合分组提取卡片
  const firstComboCards = setup.combinations[0]?.requirements.map(r => r.cardId) || [];
  const secondComboCards = setup.combinations[1]?.requirements.map(r => r.cardId) || [];

  // 构建结果结构
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

  // 处理第一组卡片
  for (const card of firstComboCards) {
    const maxNeed = cardMaxNeeds[card] || 1;
    const coeff = coefficients[card] ?? 0.02;

    // 根据最大需求数量分类
    // 需要3张：缺3(0张)->100%, 缺2(1张)->coeff, 缺1(2张)->0%
    // 需要2张：缺2(0张)->100%, 缺1(1张)->coeff
    // 需要1张：缺1(0张)->100%
    if (maxNeed >= 3) {
      result.byMissingCount.missing3[card] = 1.0;
      result.byMissingCount.missing2[card] = coeff;
      result.byMissingCount.missing1[card] = 0;
    } else if (maxNeed === 2) {
      result.byMissingCount.missing2[card] = 1.0;  // 缺2张时持有0张，系数100%
      result.byMissingCount.missing1[card] = coeff; // 缺1张时持有1张，系数coeff
    } else {
      result.byMissingCount.missing1[card] = 1.0;  // 缺1张时持有0张，系数100%
    }
    result.allCoefficients[card] = coeff;
  }

  // 处理第二组卡片
  for (const card of secondComboCards) {
    const maxNeed = cardMaxNeeds[card] || 1;
    const coeff = coefficients[card] ?? 0.008;

    // 如果卡片已在第一组，使用较小的系数
    const finalCoeff = result.allCoefficients[card]
      ? Math.min(result.allCoefficients[card], coeff)
      : coeff;

    if (maxNeed >= 3) {
      result.byMissingCount.missing3[card] = 1.0;
      result.byMissingCount.missing2[card] = finalCoeff;
      result.byMissingCount.missing1[card] = 0;
    } else if (maxNeed === 2) {
      result.byMissingCount.missing2[card] = 1.0;
      result.byMissingCount.missing1[card] = finalCoeff;
    } else {
      result.byMissingCount.missing1[card] = 1.0;
    }
    result.allCoefficients[card] = finalCoeff;
  }

  return result;
}

export type { SolverResult };
export { ALL_CARDS };
