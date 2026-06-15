/**
 * 蒙特卡洛模拟引擎（新版）
 * 使用反向求解找到合适的降权系数
 */

import type {
  CardSetup,
  CoefficientResult,
} from '@/types';
import { solveCoefficients, generateCoefficientReport, ALL_CARDS } from './coefficientSolver';

export { ALL_CARDS };

/**
 * 运行完整模拟并求解系数
 * @param setup 卡组配置
 * @param targetRate 目标中奖率（默认4%）
 * @param onProgress 进度回调
 * @returns 系数求解结果
 */
export async function runFullSimulationAsync(
  setup: CardSetup,
  targetRate: number = 4.0,
  _trials?: number,  // 保持兼容，内部使用固定值
  onProgress?: (completed: number, total: number) => void
): Promise<CoefficientResult> {

  // 模拟进度（二分搜索的迭代次数）
  const maxIterations = 50;

  // 使用 worker 进行异步计算
  return new Promise((resolve) => {
    let iteration = 0;

    const runIteration = () => {
      iteration++;

      if (onProgress) {
        onProgress(iteration, maxIterations);
      }

      // 分片执行，让出控制权
      if (iteration < maxIterations) {
        setTimeout(runIteration, 10);
      }
    };

    // 开始迭代反馈
    runIteration();

    // 执行求解（同步，但会快速返回）
    setTimeout(() => {
      const solverResult = solveCoefficients(setup, targetRate, 0.2, maxIterations);
      const report = generateCoefficientReport(setup, solverResult);
      resolve(report);
    }, 100);
  });
}

/**
 * 生成示例案例
 * 基于求解的系数，生成不同背包状态下的案例
 */
export function generateCases(
  setup: CardSetup,
  coefficientResult: CoefficientResult
): Array<{
  name: string;
  description: string;
  initialBag: Record<string, number>;
  expectedSuccess: string;
}> {
  const cases: Array<{
    name: string;
    description: string;
    initialBag: Record<string, number>;
    expectedSuccess: string;
  }> = [];

  // 获取组合中涉及的所有卡及其最大需求
  const cardNeeds: Record<string, number> = {};
  for (const combo of setup.combinations) {
    for (const req of combo.requirements) {
      cardNeeds[req.cardId] = Math.max(cardNeeds[req.cardId] || 0, req.count);
    }
  }

  // 情况1：全新用户（只有填充卡）
  cases.push({
    name: '全新用户',
    description: '背包中只有填充卡（F-J），组合卡为0张',
    initialBag: {},
    expectedSuccess: `约 ${coefficientResult.combinationRates[setup.combinations[0]?.name] ?? 4}%`,
  });

  // 情况2：持有部分组合卡（第一套缺2张）
  const firstCombo = setup.combinations[0];
  if (firstCombo && firstCombo.requirements.length >= 2) {
    const partialBag: Record<string, number> = {};
    // 持有第一张卡1张
    partialBag[firstCombo.requirements[0].cardId] = 1;
    cases.push({
      name: '第一套缺2张',
      description: `已持有 ${firstCombo.requirements[0].cardId}×1，还需 ${firstCombo.requirements.slice(1).map(r => `${r.cardId}×${r.count}`).join(' + ')}`,
      initialBag: partialBag,
      expectedSuccess: '略低于全新用户',
    });
  }

  // 情况3：持有更多填充卡
  const fillCards = ALL_CARDS.filter(c => !cardNeeds[c]);
  if (fillCards.length >= 2) {
    const fillBag: Record<string, number> = {};
    fillCards.slice(0, 3).forEach(c => {
      fillBag[c] = 1;
    });
    cases.push({
      name: '部分填充卡',
      description: `已持有 ${Object.entries(fillBag).map(([c, n]) => `${c}×${n}`).join(', ')}`,
      initialBag: fillBag,
      expectedSuccess: '与全新用户相近（填充卡不影响）',
    });
  }

  // 情况4：接近完成
  const nearCompleteBag: Record<string, number> = {};
  if (firstCombo) {
    for (const req of firstCombo.requirements) {
      nearCompleteBag[req.cardId] = Math.max(0, req.count - 1);
    }
    cases.push({
      name: '接近完成',
      description: '第一套只差1张卡',
      initialBag: nearCompleteBag,
      expectedSuccess: '受降权影响，概率降低',
    });
  }

  return cases;
}

/**
 * 生成概率配置表
 */
export function generateProbabilityTables(
  setup: CardSetup,
  coefficientResult: CoefficientResult
) {
  const { allCoefficients, combinationRates, fullCollectionRate } = coefficientResult;

  // 收集组合中涉及的卡
  const comboCards = new Set<string>();
  for (const combo of setup.combinations) {
    for (const req of combo.requirements) {
      comboCards.add(req.cardId);
    }
  }

  // 基础概率表
  const baseProbTable = ALL_CARDS.map(card => {
    const baseProb = card === 'A' ? 2 : ['B', 'C', 'D', 'E'].includes(card) ? 7 : 14;
    return {
      card,
      rarity: card === 'A' ? '神奇' : ['B', 'C', 'D', 'E'].includes(card) ? '稀有' : '普通',
      baseProb: `${baseProb}%`,
      isInCombo: comboCards.has(card),
    };
  });

  // 降权系数表
  const coefficientTable = ALL_CARDS.map(card => {
    const coeffs = allCoefficients[card] || [1, 0];
    const isComboCard = comboCards.has(card);

    return {
      card,
      isComboCard,
      // 持有0张时的系数
      coeff0: `${(coeffs[0] * 100).toFixed(2)}%`,
      // 持有1张时的系数
      coeff1: coeffs[1] !== undefined ? `${(coeffs[1] * 100).toFixed(4)}%` : 'N/A',
      // 持有2张时的系数
      coeff2: coeffs[2] !== undefined ? `${(coeffs[2] * 100).toFixed(2)}%` : 'N/A',
      // 说明
      description: isComboCard
        ? `最多可获得${coeffs.length > 2 ? 2 : 1}张`
        : '只能获得1张',
    };
  });

  return {
    baseProbTable,
    coefficientTable,
    combinationRates,
    fullCollectionRate,
  };
}
