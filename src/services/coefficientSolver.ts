/**
 * 降权系数求解器
 * 使用二分搜索找到合适的降权系数，使得目标组合中奖率=4%
 */

import type { CardSetup, CoefficientSet, CoefficientResult } from '@/types';

const ALL_CARDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

// 基础概率配置
const BASE_PROBS: Record<string, number> = {
  A: 2,   // 神奇卡 2%
  B: 7, C: 7, D: 7, E: 7,  // 稀有卡 7% each
  F: 14, G: 14, H: 14, I: 14, J: 14,  // 普通卡 14% each
};

// 验证概率总和
const TOTAL_BASE_PROB = Object.values(BASE_PROBS).reduce((a, b) => a + b, 0);
console.assert(Math.abs(TOTAL_BASE_PROB - 100) < 0.1, '基础概率总和应为100%');

interface SolverResult {
  coefficients: CoefficientSet;
  combinationRates: Record<string, number>;  // 每组组合的中奖率
  fullCollectionRate: number;  // 14天集齐10张卡的概率
  converged: boolean;
  iterations: number;
}

/**
 * 求解降权系数
 * 目标：使每组组合的中奖率都接近 targetRate (默认4%)
 */
export function solveCoefficients(
  setup: CardSetup,
  targetRate: number = 4.0,
  tolerance: number = 0.2,  // 容许误差±0.2%
  maxIterations: number = 50
): SolverResult {

  // 确定哪些卡需要降权（出现在组合中的卡）
  const cardsInCombos = new Set<string>();
  for (const combo of setup.combinations) {
    for (const req of combo.requirements) {
      cardsInCombos.add(req.cardId);
    }
  }

  // 初始化系数搜索范围
  let lowCoeff = 0.001;   // 最小降权系数 0.1%
  let highCoeff = 0.5;    // 最大降权系数 50%

  let bestResult: SolverResult | null = null;
  let minError = Infinity;

  for (let iter = 0; iter < maxIterations; iter++) {
    const midCoeff = (lowCoeff + highCoeff) / 2;

    // 构建系数表
    const coefficients = buildCoefficients(cardsInCombos, midCoeff);

    // 运行模拟
    const simResult = runSimulation(setup, coefficients, 10000);

    // 计算误差（所有组合与目标率的偏差）
    let maxError = 0;
    let totalError = 0;
    for (const rate of Object.values(simResult.combinationRates)) {
      const error = Math.abs(rate - targetRate);
      maxError = Math.max(maxError, error);
      totalError += error;
    }

    // 记录最佳结果
    if (totalError < minError) {
      minError = totalError;
      bestResult = {
        coefficients,
        combinationRates: simResult.combinationRates,
        fullCollectionRate: simResult.fullCollectionRate,
        converged: maxError <= tolerance,
        iterations: iter + 1,
      };
    }

    // 检查是否收敛
    if (maxError <= tolerance) {
      return {
        coefficients,
        combinationRates: simResult.combinationRates,
        fullCollectionRate: simResult.fullCollectionRate,
        converged: true,
        iterations: iter + 1,
      };
    }

    // 二分搜索调整
    // 如果中奖率太高，说明降权不够，需要增大系数（让用户更容易获得）
    // 如果中奖率太低，说明降权太多，需要减小系数
    const avgRate = Object.values(simResult.combinationRates).reduce((a, b) => a + b, 0)
      / Object.values(simResult.combinationRates).length;

    if (avgRate > targetRate) {
      // 中奖率太高，需要更强降权（减小系数）
      highCoeff = midCoeff;
    } else {
      // 中奖率太低，需要更弱降权（增大系数）
      lowCoeff = midCoeff;
    }
  }

  // 返回最佳结果（即使未完全收敛）
  return bestResult || {
    coefficients: buildCoefficients(cardsInCombos, 0.02),
    combinationRates: {},
    fullCollectionRate: 0,
    converged: false,
    iterations: maxIterations,
  };
}

/**
 * 构建系数表
 * 规则：
 * - 持有0张：系数 1.0（不降权）
 * - 持有1张：系数 = baseCoeff
 * - 持有2张及以上：系数 = 0（完全禁止）
 *
 * 对于组合中的卡，需要细分状态：
 * - 缺3张（持有0张）：系数 1.0
 * - 缺2张（持有1张）：系数 = baseCoeff
 * - 缺1张（持有2张）：系数 = 0
 */
function buildCoefficients(
  cardsInCombos: Set<string>,
  baseCoeff: number
): CoefficientSet {
  const coeffs: CoefficientSet = {};

  for (const card of ALL_CARDS) {
    if (cardsInCombos.has(card)) {
      // 组合中的卡：三级降权
      // [持有0张系数, 持有1张系数, 持有2张系数]
      coeffs[card] = [1.0, baseCoeff, 0];
    } else {
      // 非组合卡（填充卡）：二级降权
      // [持有0张系数, 持有1张系数]（持有1张后不能再获得）
      coeffs[card] = [1.0, 0];
    }
  }

  return coeffs;
}

/**
 * 运行蒙特卡洛模拟
 */
function runSimulation(
  setup: CardSetup,
  coefficients: CoefficientSet,
  trials: number
): { combinationRates: Record<string, number>; fullCollectionRate: number } {
  const comboSuccesses: Record<string, number> = {};
  for (const combo of setup.combinations) {
    comboSuccesses[combo.name] = 0;
  }
  let fullCollectionCount = 0;

  for (let i = 0; i < trials; i++) {
    const result = simulateOneRound(setup, coefficients);

    for (const [name, success] of Object.entries(result.comboSuccess)) {
      if (success) comboSuccesses[name]++;
    }
    if (result.fullCollection) fullCollectionCount++;
  }

  const combinationRates: Record<string, number> = {};
  for (const combo of setup.combinations) {
    combinationRates[combo.name] = (comboSuccesses[combo.name] / trials) * 100;
  }

  return {
    combinationRates,
    fullCollectionRate: (fullCollectionCount / trials) * 100,
  };
}

/**
 * 单次完整模拟（14天）
 * 考虑第二周卡组在第一周也会积累
 */
function simulateOneRound(
  setup: CardSetup,
  coefficients: CoefficientSet
): { comboSuccess: Record<string, boolean>; fullCollection: boolean } {
  // 初始化背包（空）
  const bag: Record<string, number> = {};

  // 跟踪每组组合是否已获得奖励
  const comboSuccess: Record<string, boolean> = {};
  for (const combo of setup.combinations) {
    comboSuccess[combo.name] = false;
  }

  // 生成14天的日程（5普通日 + 1稀有日 + 1神奇日，每周循环）
  const schedule = generateSchedule(14);

  // 模拟14天
  for (let day = 1; day <= 14; day++) {
    const dayType = schedule[day - 1];

    // 每天4次抽卡
    for (let draw = 0; draw < 4; draw++) {
      const card = drawCard(bag, coefficients, dayType);
      if (card) {
        bag[card] = (bag[card] || 0) + 1;
      }
    }

    // 检查每组组合是否满足条件（在截止日期内）
    for (const combo of setup.combinations) {
      if (!comboSuccess[combo.name] && day <= combo.deadline) {
        const isComplete = combo.requirements.every(req =>
          (bag[req.cardId] || 0) >= req.count
        );
        if (isComplete) {
          comboSuccess[combo.name] = true;
        }
      }
    }
  }

  // 检查是否集齐10张卡
  const fullCollection = ALL_CARDS.every(c => (bag[c] || 0) >= 1);

  return { comboSuccess, fullCollection };
}

/**
 * 生成随机日程
 * 每周：5普通日 + 1稀有日 + 1神奇日（顺序随机）
 */
function generateSchedule(days: number): ('normal' | 'rare' | 'legendary')[] {
  const schedule: ('normal' | 'rare' | 'legendary')[] = [];

  for (let week = 0; week < Math.ceil(days / 7); week++) {
    // 每周的7天类型
    const weekTypes: ('normal' | 'rare' | 'legendary')[] = [
      'normal', 'normal', 'normal', 'normal', 'normal',
      'rare', 'legendary'
    ];
    // 随机打乱
    for (let i = weekTypes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [weekTypes[i], weekTypes[j]] = [weekTypes[j], weekTypes[i]];
    }
    schedule.push(...weekTypes);
  }

  return schedule.slice(0, days);
}

/**
 * 抽卡逻辑
 */
function drawCard(
  bag: Record<string, number>,
  coefficients: CoefficientSet,
  dayType: 'normal' | 'rare' | 'legendary'
): string | null {
  // 复制基础概率
  const probs: Record<string, number> = { ...BASE_PROBS };

  // 应用幸运日加成
  if (dayType === 'rare') {
    // 稀有日：B,C,D,E 概率变为 1.2%（但这里需要相对于原概率的倍数）
    for (const card of ['B', 'C', 'D', 'E']) {
      probs[card] *= 1.2 / 0.07; // 调整：从7%提升到约12%
    }
  } else if (dayType === 'legendary') {
    // 神奇日：A 概率变为 1.2%
    probs['A'] *= 1.2 / 0.02; // 调整：从2%提升到约12%
  }

  // 应用降权系数
  for (const card of ALL_CARDS) {
    const count = bag[card] || 0;
    const coeffList = coefficients[card] || [1, 0];
    const coeff = count < coeffList.length ? coeffList[count] : 0;
    probs[card] *= coeff;
  }

  // 归一化
  const total = Object.values(probs).reduce((a, b) => a + b, 0);
  if (total <= 0) return null;

  for (const card of ALL_CARDS) {
    probs[card] = (probs[card] / total) * 100;
  }

  // 轮盘赌选择
  const r = Math.random() * 100;
  let sum = 0;
  for (const [card, prob] of Object.entries(probs)) {
    sum += prob;
    if (r < sum) return card;
  }

  return 'A';
}

/**
 * 生成系数结果报告
 */
export function generateCoefficientReport(
  setup: CardSetup,
  solverResult: SolverResult
): CoefficientResult {
  const { coefficients, combinationRates, fullCollectionRate } = solverResult;

  // 分析需要的卡
  const cardsInCombos = new Set<string>();
  const cardMaxNeeds: Record<string, number> = {};
  for (const combo of setup.combinations) {
    for (const req of combo.requirements) {
      cardsInCombos.add(req.cardId);
      cardMaxNeeds[req.cardId] = Math.max(
        cardMaxNeeds[req.cardId] || 0,
        req.count
      );
    }
  }

  // 构建结果结构
  const result: CoefficientResult = {
    // 各组合的推荐系数（按缺卡数量）
    byMissingCount: {
      missing3: {},  // 缺3张时的系数（持有0张）
      missing2: {},  // 缺2张时的系数（持有1张）
      missing1: {},  // 缺1张时的系数（持有2张）
    },
    // 所有涉及的降权系数
    allCoefficients: coefficients,
    // 组合成功率
    combinationRates,
    // 14天全收集率
    fullCollectionRate,
    // 收敛状态
    converged: solverResult.converged,
    iterations: solverResult.iterations,
  };

  // 填充按缺卡数量的系数
  for (const card of cardsInCombos) {
    const maxNeed = cardMaxNeeds[card] || 1;
    const coeffs = coefficients[card] || [1, 0, 0];

    // 缺3张 = 需要3张，持有0张
    // 缺2张 = 需要2张，持有1张
    // 缺1张 = 需要1张，持有2张
    if (maxNeed >= 3) {
      result.byMissingCount.missing3[card] = coeffs[0];  // 持有0张时的系数
      result.byMissingCount.missing2[card] = coeffs[1];  // 持有1张时的系数
      result.byMissingCount.missing1[card] = coeffs[2] ?? 0;  // 持有2张时的系数
    } else if (maxNeed === 2) {
      result.byMissingCount.missing2[card] = coeffs[0];  // 持有0张时的系数
      result.byMissingCount.missing1[card] = coeffs[1];  // 持有1张时的系数
    } else {
      result.byMissingCount.missing1[card] = coeffs[0];  // 持有0张时的系数
    }
  }

  return result;
}

export type { SolverResult };
export { ALL_CARDS, BASE_PROBS };
