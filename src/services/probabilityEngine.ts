/**
 * 概率计算引擎
 * 提供基础的概率计算和归一化功能
 */

import { ALL_CARDS, getCardType, getBaseProb } from './coefficientSolver';

export { ALL_CARDS, getCardType, getBaseProb };

// 幸运日固定概率
export const LUCKY_FIXED_PROB = 0.012; // 1.2%

// 基础概率配置
export const BASE_PROBS = {
  magic: 0.02,   // 2%
  rare: 0.07,    // 7%
  common: 0.14,  // 14%
};

/**
 * 计算单日单次抽卡的原始概率（含幸运卡机制）
 * @param card 卡片ID
 * @param dayType 日类型
 * @param luckyCard 幸运卡ID（如果有）
 */
export function calculateRawProb(
  card: string,
  dayType: 'common' | 'rare' | 'magic',
  luckyCard: string | null
): number {
  const cardType = getCardType(card);
  const baseProb = BASE_PROBS[cardType];

  if (luckyCard === card) {
    return LUCKY_FIXED_PROB;
  }

  if (luckyCard !== null) {
    // 非幸运卡需要归一化分配剩余概率
    const otherCards = ALL_CARDS.filter(c => c !== luckyCard);
    const otherTotalRaw = otherCards.reduce((sum, c) => sum + BASE_PROBS[getCardType(c)], 0);
    return (baseProb / otherTotalRaw) * (1 - LUCKY_FIXED_PROB);
  }

  return baseProb;
}

/**
 * 应用降权系数
 * @param baseProb 基础概率
 * @param count 当前持有数量
 * @param maxNeed 需求数量
 * @param coefficient 降权系数（持有超过需求时应用）
 */
export function applyCoefficient(
  baseProb: number,
  count: number,
  maxNeed: number,
  coefficient: number
): number {
  if (count >= maxNeed) {
    return baseProb * coefficient;
  }
  return baseProb;
}

/**
 * 归一化概率分布
 * @param probs 原始概率映射
 * @returns 归一化后的概率映射（和为1）
 */
export function normalizeProbs(probs: Record<string, number>): Record<string, number> {
  const total = Object.values(probs).reduce((a, b) => a + b, 0);

  if (total <= 0) {
    // 异常情况：均匀分布
    const uniform = 1.0 / ALL_CARDS.length;
    return Object.fromEntries(ALL_CARDS.map(c => [c, uniform]));
  }

  return Object.fromEntries(
    Object.entries(probs).map(([card, prob]) => [card, prob / total])
  );
}

/**
 * 计算最终概率分布
 * @param dayType 日类型
 * @param luckyCard 幸运卡
 * @param bag 当前背包
 * @param coefficients 降权系数配置
 * @param comboCards 组合卡集合
 */
export function calculateFinalDistribution(
  dayType: 'common' | 'rare' | 'magic',
  luckyCard: string | null,
  bag: Record<string, number>,
  coefficients: Record<string, Record<number, number>>,
  comboCards: Set<string>
): Record<string, number> {
  // 第一步：计算基础概率
  const rawProbs: Record<string, number> = {};

  for (const card of ALL_CARDS) {
    rawProbs[card] = calculateRawProb(card, dayType, luckyCard);
  }

  // 第二步：应用降权系数
  const weightedProbs: Record<string, number> = {};

  for (const card of ALL_CARDS) {
    const count = bag[card] || 0;
    const isComboCard = comboCards.has(card);

    let coeff: number;
    if (!isComboCard) {
      // 填充卡：0张时100%，≥1张时0%
      coeff = count === 0 ? 1.0 : 0.0;
    } else {
      // 组合卡：根据持有数量选择系数
      const cardCoeffs = coefficients[card] || { 0: 1.0, 1: 0.05, 2: 0.0 };
      coeff = cardCoeffs[Math.min(count, 2)] ?? 0.0;
    }

    weightedProbs[card] = rawProbs[card] * coeff;
  }

  // 第三步：归一化
  return normalizeProbs(weightedProbs);
}

/**
 * 计算单日中奖概率（4次抽卡）
 * @param singleProb 单次抽卡概率
 */
export function singleToDay(singleProb: number): number {
  if (singleProb >= 1.0) return 1.0;
  if (singleProb <= 0.0) return 0.0;
  // 4次独立的伯努利试验
  return 1.0 - Math.pow(1.0 - singleProb, 4.0);
}

/**
 * 计算多日累积中奖概率
 * @param dayProbs 每日中奖概率数组
 */
export function accumulateProb(dayProbs: number[]): number {
  // 多日不中的概率相乘，然后用1减去
  const neverHit = dayProbs.reduce((acc, p) => acc * (1 - p), 1);
  return 1 - neverHit;
}

/**
 * 格式化概率为百分比字符串
 */
export function formatProb(prob: number, decimals: number = 2): string {
  return `${(prob * 100).toFixed(decimals)}%`;
}

/**
 * 计算组合概率分布的统计值
 */
export function calculateStats(probs: Record<string, number>): {
  mean: number;
  variance: number;
  max: { card: string; prob: number };
  min: { card: string; prob: number };
} {
  const entries = Object.entries(probs);
  const values = entries.map(([, p]) => p);

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / values.length;

  const maxEntry = entries.reduce((max, [card, p]) => p > max.prob ? { card, prob: p } : max, { card: '', prob: -1 });
  const minEntry = entries.reduce((min, [card, p]) => p < min.prob ? { card, prob: p } : min, { card: '', prob: Infinity });

  return { mean, variance, max: maxEntry, min: minEntry };
}

/**
 * 验证概率分布是否有效
 */
export function validateProbDistribution(probs: Record<string, number>): {
  isValid: boolean;
  total: number;
  errors: string[];
} {
  const errors: string[] = [];
  const total = Object.values(probs).reduce((a, b) => a + b, 0);

  if (Math.abs(total - 1.0) > 0.0001) {
    errors.push(`概率和不等于1: ${total}`);
  }

  for (const [card, prob] of Object.entries(probs)) {
    if (prob < 0) {
      errors.push(`卡片 ${card} 的概率为负数: ${prob}`);
    }
    if (prob > 1) {
      errors.push(`卡片 ${card} 的概率大于1: ${prob}`);
    }
  }

  return {
    isValid: errors.length === 0,
    total,
    errors,
  };
}
