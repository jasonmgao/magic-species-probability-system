/**
 * 蒙特卡洛模拟引擎（异步分块版）
 */

import type {
  Combination,
  CardSetup,
  CoefficientSet,
  BackpackState,
  SingleStateResult,
  FullSimulationResult,
} from '@/types';

const ALL_CARDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

// 简化的背包状态
export const BACKPACK_STATES: BackpackState[] = [
  { state: 'empty', label: '全新用户', description: '0张', initialBag: {} },
  { state: 'progress', label: '进行中', description: '部分卡片', initialBag: { A: 1 } },
  { state: 'near', label: '接近完成', description: '缺少量', initialBag: { A: 2, B: 1 } },
];

/**
 * 异步运行完整模拟
 */
export async function runFullSimulationAsync(
  setup: CardSetup,
  targetRate: number = 4.0,
  trials: number = 5000,
  onProgress?: (completed: number, total: number) => void
): Promise<FullSimulationResult> {
  const results: SingleStateResult[] = [];

  for (let i = 0; i < BACKPACK_STATES.length; i++) {
    const backpack = BACKPACK_STATES[i];

    // 计算系数（简化版，快速估算）
    const coefficients = calculateSimpleCoefficients(setup, targetRate);

    // 异步模拟，分块执行
    const result = await simulateStateAsync(setup, backpack, coefficients, trials);
    results.push(result);

    if (onProgress) {
      onProgress(i + 1, BACKPACK_STATES.length);
    }

    // 让出控制权
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  const bestState = results.reduce((best, current) =>
    current.fullCollectionRate > best.fullCollectionRate ? current : best,
    results[0]
  );

  return { stateResults: results, bestState };
}

/**
 * 异步模拟单个状态
 */
async function simulateStateAsync(
  setup: CardSetup,
  backpack: BackpackState,
  coefficients: CoefficientSet,
  trials: number
): Promise<SingleStateResult> {
  const chunkSize = 100;
  let completed = 0;

  const bag: Record<string, number> = { ...backpack.initialBag };
  let fullCollectionCount = 0;
  const comboSuccess: Record<string, number> = {};
  for (const combo of setup.combinations) {
    comboSuccess[combo.name] = 0;
  }

  // 分块模拟
  while (completed < trials) {
    const currentChunk = Math.min(chunkSize, trials - completed);

    for (let i = 0; i < currentChunk; i++) {
      const result = simulateOneRoundSimple(setup, bag, coefficients);
      if (result.fullCollection) fullCollectionCount++;
      for (const [name, success] of Object.entries(result.comboSuccess)) {
        if (success) comboSuccess[name]++;
      }
    }

    completed += currentChunk;

    // 让出控制权给UI
    if (completed < trials) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  const combinationRates: Record<string, number> = {};
  for (const combo of setup.combinations) {
    combinationRates[combo.name] = (comboSuccess[combo.name] / trials) * 100;
  }

  return {
    state: backpack.state,
    label: backpack.label,
    description: backpack.description,
    coefficients,
    fullCollectionRate: (fullCollectionCount / trials) * 100,
    combinationRates,
  };
}

/**
 * 计算简单系数（快速估算）
 */
function calculateSimpleCoefficients(
  setup: CardSetup,
  targetRate: number
): CoefficientSet {
  const coeffs: CoefficientSet = {};

  // 收集每张卡的最大需求
  const maxNeeds: Record<string, number> = {};
  for (const combo of setup.combinations) {
    for (const req of combo.requirements) {
      maxNeeds[req.cardId] = Math.max(maxNeeds[req.cardId] || 0, req.count);
    }
  }

  // 估算系数：中奖率4%经验值
  // 简化计算，使用经验公式
  const baseCoeff = targetRate / 100; // 基于目标率

  for (const card of ALL_CARDS) {
    const maxNeed = maxNeeds[card] || 1;
    coeffs[card] = [];
    for (let i = 0; i <= maxNeed; i++) {
      if (i === 0) coeffs[card].push(1.0);
      else if (i < maxNeed) coeffs[card].push(baseCoeff / Math.pow(2, i - 1));
      else coeffs[card].push(0);
    }
  }

  return coeffs;
}

/**
 * 单次模拟（简化版）
 */
function simulateOneRoundSimple(
  setup: CardSetup,
  initialBag: Record<string, number>,
  coefficients: CoefficientSet
): { fullCollection: boolean; comboSuccess: Record<string, boolean> } {
  const bag: Record<string, number> = { ...initialBag };
  const comboSuccess: Record<string, boolean> = {};
  for (const combo of setup.combinations) {
    comboSuccess[combo.name] = false;
  }

  // 简化：每天都是普通日，随机幸运卡
  for (let day = 1; day <= 14; day++) {
    // 每天4次抽卡
    for (let draw = 0; draw < 4; draw++) {
      const card = drawCardSimple(bag, coefficients);
      if (card) bag[card] = (bag[card] || 0) + 1;
    }

    // 检查组合
    for (const combo of setup.combinations) {
      if (!comboSuccess[combo.name] && day <= combo.deadline) {
        const isComplete = combo.requirements.every(req =>
          (bag[req.cardId] || 0) >= req.count
        );
        if (isComplete) comboSuccess[combo.name] = true;
      }
    }
  }

  const fullCollection = ALL_CARDS.every(c => (bag[c] || 0) >= 1);
  return { fullCollection, comboSuccess };
}

/**
 * 简单抽卡
 */
function drawCardSimple(
  bag: Record<string, number>,
  coefficients: CoefficientSet
): string {
  // 基础概率
  const probs: Record<string, number> = {
    A: 2, B: 7, C: 7, D: 7, E: 7,
    F: 14, G: 14, H: 14, I: 14, J: 14,
  };

  // 应用降权
  for (const card of ALL_CARDS) {
    const count = bag[card] || 0;
    const coeffList = coefficients[card] || [1, 0];
    const coeff = count < coeffList.length ? coeffList[count] : 0;
    probs[card] *= coeff;
  }

  // 归一化
  const total = Object.values(probs).reduce((a, b) => a + b, 0);
  if (total <= 0) return 'A';

  // 轮盘赌
  const r = Math.random() * total;
  let sum = 0;
  for (const [card, prob] of Object.entries(probs)) {
    sum += prob;
    if (r < sum) return card;
  }
  return 'A';
}
