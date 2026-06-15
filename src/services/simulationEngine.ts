/**
 * 🎲 蒙特卡洛模拟引擎
 * 适配新的反向求解架构
 */

import type { CardSetup, CoefficientResult, SolverProgress, CaseData, WeeklyCombo } from '@/types';
import type { SolverResult } from './coefficientSolver';
import {
  solveCoefficients,
  solveCoefficientsQuick,
  generateCoefficientReport,
  ALL_CARDS,
  getCardType,
  getBaseProb,
} from './coefficientSolver';

export { ALL_CARDS, getCardType, getBaseProb };

/**
 * 统计卡组中每张卡的需求量
 */
function countCardNeeds(cards: string[]): Map<string, number> {
  const needs = new Map<string, number>();
  for (const card of cards) {
    needs.set(card, (needs.get(card) || 0) + 1);
  }
  return needs;
}

/**
 * 运行完整模拟（异步，支持进度回调）
 */
export async function runFullSimulationAsync(
  setup: CardSetup,
  targetRate: number = 4.0,
  _trials?: number,
  onProgress?: (progress: SolverProgress) => void
): Promise<CoefficientResult> {
  return new Promise((resolve, reject) => {
    try {
      const solverResult = solveCoefficients(
        setup,
        targetRate,
        0.1,     // tolerance
        50,      // maxIterations
        30000,   // trialsPerIteration
        onProgress
      );

      const report = generateCoefficientReport(solverResult);
      resolve(report);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 快速模拟（较少迭代）
 */
export async function runQuickSimulation(
  setup: CardSetup,
  targetRate: number = 4.0,
  onProgress?: (progress: SolverProgress) => void
): Promise<CoefficientResult> {
  return new Promise((resolve, reject) => {
    try {
      const solverResult = solveCoefficientsQuick(setup, targetRate, onProgress);
      const report = generateCoefficientReport(solverResult);
      resolve(report);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 生成示例案例
 * 根据系数结果生成不同背包状态下的案例
 */
export function generateCases(
  setup: CardSetup,
  coefficientResult: CoefficientResult
): CaseData[] {
  const cases: CaseData[] = [];

  // 统计两周的卡牌需求
  const week1Needs = countCardNeeds(setup.week1.cards);
  const week2Needs = countCardNeeds(setup.week2.cards);

  // 案例 1：全新用户（背包为空）
  cases.push({
    name: '全新用户',
    description: '背包为空，刚开始游戏',
    initialBag: {},
    dayType: 'COMMON',
    luckyCard: null,
    expectedSuccess: '第一周概率约 4%，第二周概率约 4%',
  });

  // 案例 2：第一周进行中（持有部分第一周的卡）
  const week1CardList = Array.from(week1Needs.entries());
  if (week1CardList.length > 0) {
    const [firstCard, firstNeed] = week1CardList[0];
    const midBag: Record<string, number> = { [firstCard]: 1 };
    const firstCardCoeffs = coefficientResult.week1[firstCard];
    const coeff1 = firstCardCoeffs ? firstCardCoeffs[1] : 0.05;

    cases.push({
      name: '第一周进行中',
      description: `已持有 ${firstCard}×1，持有 2 张时降权系数 ${(coeff1 * 100).toFixed(2)}%`,
      initialBag: midBag,
      dayType: 'RARE',
      luckyCard: firstCard,
      expectedSuccess: '降权生效，后续抽卡概率降低',
    });
  }

  // 案例 3：第一周接近完成
  const almostDoneBag: Record<string, number> = {};
  for (const [card, need] of week1Needs.entries()) {
    almostDoneBag[card] = Math.max(1, need - 1);
  }
  cases.push({
    name: '第一周差 1 张',
    description: '持有大部分第一周的卡，接近完成',
    initialBag: almostDoneBag,
    dayType: 'MAGIC',
    luckyCard: 'A',
    expectedSuccess: '持有越多，降权越严格',
  });

  // 案例 4：第二周进行中
  const week2CardList = Array.from(week2Needs.entries());
  if (week2CardList.length > 0) {
    const [w2FirstCard] = week2CardList[0];
    const w2MidBag: Record<string, number> = { [w2FirstCard]: 1 };
    const w2Coeffs = coefficientResult.week2[w2FirstCard];
    const w2Coeff1 = w2Coeffs ? w2Coeffs[1] : 0.03;

    cases.push({
      name: '第二周进行中',
      description: `已持有 ${w2FirstCard}×1，持有 2 张时降权系数 ${(w2Coeff1 * 100).toFixed(2)}%`,
      initialBag: w2MidBag,
      dayType: 'RARE',
      luckyCard: w2FirstCard,
      expectedSuccess: '第二周系数通常比第一周更严格',
    });
  }

  // 案例 5：接近全收集
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
 * 生成概率配置表（用于 UI 展示）
 */
export function generateProbabilityTables(
  _setup: CardSetup,
  coefficientResult: CoefficientResult
) {
  // 基础概率表
  const baseProbTable = ALL_CARDS.map(card => {
    const baseProb = getBaseProb(card);
    return {
      card,
      rarity: getCardType(card),
      rarityLabel: card === 'A' ? '神奇' : ['B', 'C', 'D', 'E'].includes(card) ? '稀有' : '普通',
      baseProb: `${baseProb.toFixed(0)}%`,
    };
  });

  // 第一周降权系数表
  const week1CoefficientTable = Object.entries(coefficientResult.week1).map(([card, coeffs]) => {
    const needs = coeffs.length + 1;  // 需求数量 = 系数数量 + 1（因为第1张固定）
    return {
      card,
      needs,
      coeffs: coeffs.map((c, i) => ({
        holdCount: i + 1,
        value: c,
        label: `持有 ${i + 1} 张`,
      })),
    };
  });

  // 第二周降权系数表
  const week2CoefficientTable = Object.entries(coefficientResult.week2).map(([card, coeffs]) => {
    const needs = coeffs.length + 1;
    return {
      card,
      needs,
      coeffs: coeffs.map((c, i) => ({
        holdCount: i + 1,
        value: c,
        label: `持有 ${i + 1} 张`,
      })),
    };
  });

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
 * 验证求解结果
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

  // 验证：中奖率应在 3.5% - 4.5% 之间
  const isValid = Math.abs(week1Rate - 4.0) < 0.5 && Math.abs(week2Rate - 4.0) < 0.5;

  return {
    week1Rate,
    week2Rate,
    fullCollectionRate: fullRate,
    isValid,
  };
}

/**
 * 导出类型
 */
export type { SolverResult };
