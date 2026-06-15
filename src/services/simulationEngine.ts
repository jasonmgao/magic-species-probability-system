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
  _trials?: number,
  onProgress?: (completed: number, total: number) => void
): Promise<CoefficientResult> {

  // 模拟进度
  const totalSteps = 100;

  return new Promise((resolve) => {
    let step = 0;

    const runProgress = () => {
      step++;
      if (onProgress) {
        onProgress(step, totalSteps);
      }
      if (step < totalSteps) {
        setTimeout(runProgress, 20);
      }
    };

    runProgress();

    // 执行求解
    setTimeout(() => {
      const solverResult = solveCoefficients(setup, targetRate, 3000);
      const report = generateCoefficientReport(setup, solverResult);
      resolve(report);
    }, 100);
  });
}

/**
 * 生成示例案例
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

  const firstCombo = setup.combinations[0];
  const secondCombo = setup.combinations[1];

  // 情况1：全新用户
  cases.push({
    name: '全新用户',
    description: '背包为空（0张组合卡）',
    initialBag: {},
    expectedSuccess: `约 ${coefficientResult.combinationRates[firstCombo?.name] ?? 4}%`,
  });

  // 情况2：第一套缺2张
  if (firstCombo && firstCombo.requirements.length >= 2) {
    const partialBag: Record<string, number> = {};
    const firstCard = firstCombo.requirements[0].cardId;
    partialBag[firstCard] = 1;
    cases.push({
      name: '第一套缺2张',
      description: `已持有 ${firstCard}×1，触发降权系数 ${((coefficientResult.allCoefficients[firstCard] ?? 0.02) * 100).toFixed(1)}%`,
      initialBag: partialBag,
      expectedSuccess: '概率降低（受系数影响）',
    });
  }

  // 情况3：第二套进行中
  if (secondCombo) {
    cases.push({
      name: '第二周状态',
      description: `目标：${secondCombo.requirements.map(r => `${r.cardId}×${r.count}`).join(' + ')}`,
      initialBag: {},
      expectedSuccess: `约 ${coefficientResult.combinationRates[secondCombo?.name] ?? 4}%`,
    });
  }

  // 情况4：接近完成
  if (firstCombo) {
    const nearBag: Record<string, number> = {};
    for (const req of firstCombo.requirements) {
      nearBag[req.cardId] = Math.max(0, req.count - 1);
    }
    cases.push({
      name: '接近完成',
      description: '第一套只差1张（持有2张时系数=0，无法获得）',
      initialBag: nearBag,
      expectedSuccess: '极低（需等待下周重置）',
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
    const coeff = allCoefficients[card];
    const isComboCard = comboCards.has(card);

    if (!isComboCard) {
      return {
        card,
        isComboCard: false,
        coeff0: '100%',
        coeff1: '0%',
        coeff2: 'N/A',
        description: '填充卡，只能获得1张',
      };
    }

    return {
      card,
      isComboCard: true,
      coeff0: '100%',
      coeff1: coeff ? `${(coeff * 100).toFixed(2)}%` : '2.00%',
      coeff2: '0%',
      description: '组合卡，最多2张',
    };
  });

  return {
    baseProbTable,
    coefficientTable,
    combinationRates,
    fullCollectionRate,
  };
}
