/**
 * 🎲 蒙特卡洛模拟引擎（异步版）
 */

import type { CardSetup, CoefficientResult, SolverProgress, CaseData } from '@/types';
import type { SolverResult } from './coefficientSolver';
import {
  solveCoefficientsAsync,
  generateCoefficientReport,
  ALL_CARDS,
  getCardType,
  getBaseProb,
} from './coefficientSolver';

export { ALL_CARDS, getCardType, getBaseProb };

function countCardNeeds(cards: string[]): Map<string, number> {
  const needs = new Map<string, number>();
  for (const card of cards) {
    needs.set(card, (needs.get(card) || 0) + 1);
  }
  return needs;
}

/**
 * 运行求解（真正的异步，不会阻塞UI）
 */
export async function runSimulation(
  setup: CardSetup,
  onProgress?: (progress: SolverProgress) => void
): Promise<CoefficientResult> {
  const solverResult = await solveCoefficientsAsync(setup, 4.0, onProgress);
  return generateCoefficientReport(solverResult, setup);
}

/**
 * 生成案例
 */
export function generateCases(
  setup: CardSetup,
  coefficientResult: CoefficientResult
): CaseData[] {
  const cases: CaseData[] = [];
  const week1Needs = countCardNeeds(setup.week1.cards);
  const week2Needs = countCardNeeds(setup.week2.cards);

  cases.push({
    name: '全新用户',
    description: '背包为空，刚开始游戏',
    initialBag: {},
    dayType: 'COMMON',
    luckyCard: null,
    expectedSuccess: '第一周概率约 4%，第二周概率约 4%',
  });

  const week1CardList = Array.from(week1Needs.entries());
  if (week1CardList.length > 0) {
    const [firstCard, need] = week1CardList[0];
    // V6: 记录超额持有（超过第1张的部分）
    const heldCount = 2; // 场景：假设已有2张
    const excessCount = Math.max(0, Math.min(heldCount - 1, need - 1)); // 超额数
    const midBag: Record<string, number> = { [firstCard]: heldCount };
    const firstCardCoeffs = coefficientResult.week1[firstCard];
    // V6: 只要有超额持有，就应用降权系数
    const coeff1 = excessCount > 0 ? (firstCardCoeffs ? firstCardCoeffs[1] : 0.05) : 1.0;

    cases.push({
      name: '第一周(V6超额降权)',
      description: `持有 ${firstCard}×${heldCount}，需求 ${need} 张。超额副本=${excessCount}，降权系数 ${(coeff1 * 100).toFixed(1)}%`,
      initialBag: midBag,
      dayType: 'RARE',
      luckyCard: firstCard,
      expectedSuccess: `V6: 第1张${firstCard}不降权，第2张起才降权`,
    });
  }

  const almostDoneBag: Record<string, number> = {};
  let totalExcess = 0;
  for (const [card, need] of week1Needs.entries()) {
    almostDoneBag[card] = need; // 持有刚好够
    totalExcess += Math.max(0, need - 1); // V6: 每张卡的第2张起都超额
  }
  cases.push({
    name: '第一周刚好完成',
    description: `V6: 所有卡精确持有，超标副本数=${totalExcess}张，新卡获取极难`,
    initialBag: almostDoneBag,
    dayType: 'MAGIC',
    luckyCard: 'A',
    expectedSuccess: '所有超额副本都处于降权状态，最后1张最难拿',
  });

  const week2CardList = Array.from(week2Needs.entries());
  if (week2CardList.length > 0) {
    const [w2FirstCard, w2Need] = week2CardList[0];
    // V6场景：第二周跨周持有（第一周存了下周卡）
    const crossHeld = 2; // 第一周存了2张给第二周
    const excessCount = Math.max(0, Math.min(crossHeld - 1, w2Need - 1));
    const w2MidBag: Record<string, number> = { [w2FirstCard]: crossHeld };
    const w2Coeffs = coefficientResult.week2[w2FirstCard];
    const w2Coeff1 = excessCount > 0 ? (w2Coeffs ? w2Coeffs[1] : 0.03) : 1.0;

    cases.push({
      name: '第二周跨周压制(V6)',
      description: `第二周开始前已持有 ${w2FirstCard}×${crossHeld}（跨周储存）。超额副本=${excessCount}，降权系数 ${(w2Coeff1 * 100).toFixed(1)}%`,
      initialBag: w2MidBag,
      dayType: 'RARE',
      luckyCard: w2FirstCard,
      expectedSuccess: 'V6跨周机制：提前存卡会被降权，无法轻松偷跑',
    });
  }

  const nearFullBag: Record<string, number> = {};
  for (const card of ALL_CARDS.slice(0, 8)) {
    nearFullBag[card] = 1;
  }
  cases.push({
    name: '接近全收集',
    description: '已持有 8 张不同的卡',
    initialBag: nearFullBag,
    dayType: 'COMMON',
    luckyCard: null,
    expectedSuccess: `14天全收集率约 ${coefficientResult.fullCollectionRate.toFixed(2)}%`,
  });

  return cases;
}

/**
 * 生成概率表
 */
export function generateProbabilityTables(
  _setup: CardSetup,
  coefficientResult: CoefficientResult
) {
  const baseProbTable = ALL_CARDS.map(card => ({
    card,
    rarity: getCardType(card),
    rarityLabel: card === 'A' ? '神奇' : ['B', 'C', 'D', 'E'].includes(card) ? '稀有' : '普通',
    baseProb: `${getBaseProb(card).toFixed(0)}%`,
  }));

  const week1CoefficientTable = Object.entries(coefficientResult.week1).map(([card, coeffs]) => ({
    card,
    needs: coeffs.length + 1,
    coeffs: coeffs.map((c, i) => ({
      holdCount: i + 1,
      value: c,
      label: `持有 ${i + 1} 张`,
    })),
  }));

  const week2CoefficientTable = Object.entries(coefficientResult.week2).map(([card, coeffs]) => ({
    card,
    needs: coeffs.length + 1,
    coeffs: coeffs.map((c, i) => ({
      holdCount: i + 1,
      value: c,
      label: `持有 ${i + 1} 张`,
    })),
  }));

  return {
    baseProbTable,
    week1CoefficientTable,
    week2CoefficientTable,
    week1Rate: coefficientResult.actualRates.week1,
    week2Rate: coefficientResult.actualRates.week2,
    fullCollectionRate: coefficientResult.fullCollectionRate,
    converged: coefficientResult.converged,
    iterations: coefficientResult.iterations,
  };
}

/**
 * 验证结果
 */
export async function validateSolution(
  _setup: CardSetup,
  coefficientResult: CoefficientResult,
): Promise<{
  week1Rate: number;
  week2Rate: number;
  fullCollectionRate: number;
  isValid: boolean;
}> {
  const week1Rate = coefficientResult.actualRates.week1;
  const week2Rate = coefficientResult.actualRates.week2;
  const fullRate = coefficientResult.fullCollectionRate;
  const isValid = Math.abs(week1Rate - 4.0) < 0.5 && Math.abs(week2Rate - 4.0) < 0.5;

  return { week1Rate, week2Rate, fullCollectionRate: fullRate, isValid };
}

export type { SolverResult };
