/**
 * 概率计算引擎
 *
 * 核心功能：
 * 1. 计算最终概率分布
 * 2. 生成概率计算案例
 * 3. 可视化计算步骤
 */

import type {
  ProbabilityCase,
  ProbabilityCalculationResult,
  CalculationStep,
  DayState,
} from '@/types';
import {
  DEFAULT_BASE_PROB_TABLE,
  DEFAULT_COEFFICIENT_TABLE,
  TARGET_CARD_IDS,
  FILLER_CARD_IDS,
  LUCKY_CARD_PROB,
  getCoefficient,
} from '@/constants';
import { normalizeProbabilities } from '@/utils';

/**
 * 计算最终概率分布（完整版，带步骤）
 */
export function calculateFinalProbability(
  caseData: ProbabilityCase
): ProbabilityCalculationResult {
  const { backpack, dayState, baseProbTable, coefficientTable } = caseData;
  const steps: CalculationStep[] = [];

  // ========== Step 1: 确定今日类型 ==========
  steps.push({
    stepNumber: 1,
    title: '确定今日类型',
    description: '从本周日程中读取今日信息',
    details: {
      dateIndex: dayState.dayIndex,
      dayType: dayState.dayType,
      luckyCard: dayState.luckyCard,
      luckyCardRarity: getCardRarity(dayState.luckyCard),
      luckyCardBaseProb: baseProbTable[dayState.luckyCard],
    },
  });

  // ========== Step 2: 查询基础概率 ==========
  const baseProbs = { ...baseProbTable };
  const originalProbs = { ...baseProbTable };

  // 幸运卡特殊处理：固定为 1.2%
  steps.push({
    stepNumber: 2,
    title: '查询基础概率',
    description: '根据稀有度查表，幸运卡概率设为 1.2%',
    details: {
      luckyCard: dayState.luckyCard,
      luckyCardOriginalProb: baseProbs[dayState.luckyCard],
      luckyCardFixedProb: LUCKY_CARD_PROB,
      baseProbs: { ...baseProbs },
    },
  });

  // ========== Step 3: 应用降权系数 ==========
  const adjustedProbs = { ...baseProbs };
  const coefficientDetails: Record<string, any> = {};

  for (const cardId of TARGET_CARD_IDS) {
    const holdCount = backpack[cardId] || 0;
    const coefficient = getCoefficient(coefficientTable, cardId, holdCount);
    const oldProb = adjustedProbs[cardId];
    adjustedProbs[cardId] = oldProb * coefficient;

    coefficientDetails[cardId] = {
      holdCount,
      coefficient,
      oldProb: oldProb.toFixed(4),
      newProb: (oldProb * coefficient).toFixed(4),
      formula: `${oldProb.toFixed(2)}% × ${coefficient} = ${(oldProb * coefficient).toFixed(4)}%`,
    };
  }

  // 填充卡第 2 张概率为 0
  for (const cardId of FILLER_CARD_IDS) {
    if (cardId !== dayState.luckyCard && (backpack[cardId] || 0) >= 1) {
      const oldProb = adjustedProbs[cardId];
      adjustedProbs[cardId] = 0;
      coefficientDetails[cardId] = {
        holdCount: backpack[cardId],
        coefficient: 0,
        oldProb: oldProb.toFixed(4),
        newProb: '0',
        formula: '填充卡第 2 张起概率为 0',
      };
    }
  }

  steps.push({
    stepNumber: 3,
    title: '应用降权系数',
    description: '根据用户持有数量应用对应系数',
    details: coefficientDetails,
  });

  // ========== Step 4: 设置幸运卡概率 ==========
  adjustedProbs[dayState.luckyCard] = LUCKY_CARD_PROB;

  steps.push({
    stepNumber: 4,
    title: '设置幸运卡概率',
    description: `将幸运卡 ${dayState.luckyCard} 的概率设为 ${LUCKY_CARD_PROB}%`,
    details: {
      luckyCard: dayState.luckyCard,
      fixedProb: LUCKY_CARD_PROB,
    },
  });

  // ========== Step 5: 归一化处理 ==========
  const abcdProb = TARGET_CARD_IDS.reduce((sum, card) => sum + adjustedProbs[card], 0);
  const remainingProb = 100 - abcdProb - LUCKY_CARD_PROB;

  // 其他卡片（不含幸运卡）的请求概率总和
  const otherCards = FILLER_CARD_IDS.filter(c => c !== dayState.luckyCard);
  const otherCardsTotalBaseProb = otherCards.reduce((sum, card) => {
    if (adjustedProbs[card] === 0) return sum;
    return sum + baseProbs[card];
  }, 0);

  const distributionDetails: Record<string, any> = {};

  steps.push({
    stepNumber: 5,
    title: '归一化处理',
    description: '确保 10 张卡概率之和为 100%',
    details: {
      ABCD_ProbSum: abcdProb.toFixed(4),
      luckyCardProb: LUCKY_CARD_PROB,
      remainingProb: remainingProb.toFixed(4),
      otherCardsTotalBaseProb: otherCardsTotalBaseProb.toFixed(4),
      distribution: distributionDetails,
    },
  });

  // ========== Step 6: 计算最终概率 ==========
  const finalProbs: Record<string, number> = {};

  // A/B/C/D 直接使用新概率
  for (const card of TARGET_CARD_IDS) {
    finalProbs[card] = adjustedProbs[card];
  }

  // 幸运卡固定为 1.2%
  finalProbs[dayState.luckyCard] = LUCKY_CARD_PROB;

  // 其他卡片按权重分配剩余概率
  for (const card of otherCards) {
    if (adjustedProbs[card] === 0) {
      finalProbs[card] = 0;
      distributionDetails[card] = {
        baseProb: baseProbs[card],
        weight: '0%',
        finalProb: '0%',
        reason: '已有2张以上',
      };
    } else {
      const weight = baseProbs[card] / otherCardsTotalBaseProb;
      finalProbs[card] = weight * remainingProb;
      distributionDetails[card] = {
        baseProb: baseProbs[card],
        weight: (weight * 100).toFixed(2) + '%',
        finalProb: finalProbs[card].toFixed(4) + '%',
        formula: `(${baseProbs[card]} / ${otherCardsTotalBaseProb.toFixed(4)}) × ${remainingProb.toFixed(4)} = ${finalProbs[card].toFixed(4)}%`,
      };
    }
  }

  // 验证总和
  const total = Object.values(finalProbs).reduce((sum, prob) => sum + prob, 0);

  steps.push({
    stepNumber: 6,
    title: '最终概率分布',
    description: '10 张卡的最终概率分布',
    details: {
      finalProbs: Object.entries(finalProbs).reduce((acc, [card, prob]) => ({
        ...acc,
        [card]: prob.toFixed(4) + '%',
      }), {}),
      total: total.toFixed(4) + '%',
      isValid: Math.abs(total - 100) < 0.0001,
    },
  });

  return {
    steps,
    finalProbs,
    originalProbs,
    validation: {
      total,
      isValid: Math.abs(total - 100) < 0.0001,
    },
  };
}

/**
 * 快速计算最终概率（不带步骤，用于模拟）
 */
export function quickCalculateFinalProbability(
  backpack: Record<string, number>,
  dayState: DayState,
  baseProbTable: Record<string, number> = DEFAULT_BASE_PROB_TABLE,
  coefficientTable: Record<string, number[]> = DEFAULT_COEFFICIENT_TABLE
): Record<string, number> {
  const { finalProbs } = normalizeProbabilities(
    baseProbTable,
    coefficientTable,
    backpack,
    dayState.luckyCard
  );
  return finalProbs;
}

/**
 * 创建默认概率案例
 */
export function createDefaultCase(): ProbabilityCase {
  return {
    backpack: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0, I: 0, J: 0 },
    dayState: {
      dayIndex: 1,
      dayType: 'COMMON',
      luckyCard: 'F',
    },
    baseProbTable: { ...DEFAULT_BASE_PROB_TABLE },
    coefficientTable: { ...DEFAULT_COEFFICIENT_TABLE },
  };
}

/**
 * 获取卡片稀有度名称
 */
function getCardRarity(cardId: string): string {
  if (cardId === 'A') return '神奇卡';
  if (['B', 'C', 'D', 'E'].includes(cardId)) return '稀有卡';
  return '普通卡';
}

/**
 * 计算期望值
 *
 * 基于概率计算获得特定卡片所需的期望抽卡次数
 */
export function calculateExpectedDraws(
  probability: number,
  targetCount: number = 1
): number {
  // 几何分布期望：E = 1/p
  const singleDrawExpected = 100 / probability;
  return singleDrawExpected * targetCount;
}

/**
 * 计算组合完成概率
 *
 * 计算在给定抽卡次数下完成特定组合的概率
 */
export function calculateCombinationProbability(
  requirements: Record<string, number>,
  probabilities: Record<string, number>,
  totalDraws: number
): number {
  // 简化计算：使用泊松近似
  // 实际应该用更复杂的组合概率计算

  let logProb = 0;

  for (const [cardId, count] of Object.entries(requirements)) {
    const prob = probabilities[cardId] / 100;
    const lambda = prob * totalDraws;

    // 泊松分布 P(X >= count) = 1 - P(X < count)
    const poissonProb = 1 - poissonCDF(count - 1, lambda);
    logProb += Math.log(poissonProb);
  }

  return Math.exp(logProb) * 100;
}

/**
 * 泊松分布累积分布函数
 */
function poissonCDF(k: number, lambda: number): number {
  let sum = 0;
  for (let i = 0; i <= k; i++) {
    sum += Math.pow(lambda, i) * Math.exp(-lambda) / factorial(i);
  }
  return sum;
}

/**
 * 阶乘
 */
function factorial(n: number): number {
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
}
