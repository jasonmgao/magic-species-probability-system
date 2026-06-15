/**
 * 蒙特卡洛模拟引擎
 *
 * 核心功能：
 * 1. 模拟单次抽卡流程
 * 2. 模拟完整14天游戏过程
 * 3. 批量运行蒙特卡洛模拟（10万次迭代）
 * 4. 计算集齐率、期望抽卡次数等指标
 */

import type {
  CardCombination,
  SimulationParams,
  SimulationResult,
  SingleSimulationResult,
  DayState,
  AllCombinationsResult,
  Rarity,
} from '@/types';
import {
  DEFAULT_SIMULATION_PARAMS,
  DEFAULT_BASE_PROB_TABLE,
  DEFAULT_COEFFICIENT_TABLE,
  TARGET_CARD_IDS,
  FILLER_CARD_IDS,
  LUCKY_CARD_PROB,
  RECOMMENDATION_THRESHOLDS,
  TARGET_WIN_RATES,
} from '@/constants';
import {
  generateFullSchedule,
  normalizeProbabilities,
  rouletteSelect,
  getBaseProbByRarity,
  generateSlotRarityCombinations,
} from '@/utils';

/**
 * 运行蒙特卡洛模拟（单次卡组配置）
 */
export function runMonteCarloSimulation(
  combination: CardCombination,
  params: SimulationParams = DEFAULT_SIMULATION_PARAMS
): SimulationResult {
  let week1Success = 0;
  let week2Success = 0;
  let totalWeek1Draws = 0;
  let totalWeek2Draws = 0;

  for (let i = 0; i < params.iterations; i++) {
    const result = simulateFullGame(combination, params);

    if (result.week1Complete) {
      week1Success++;
      // 计算完成时用了多少抽（简化计算：按天数比例）
      totalWeek1Draws += estimateDrawsToComplete(result, 'week1', params);
    }

    if (result.week2Complete) {
      week2Success++;
      totalWeek2Draws += estimateDrawsToComplete(result, 'week2', params);
    }
  }

  const week1Rate = (week1Success / params.iterations) * 100;
  const week2Rate = (week2Success / params.iterations) * 100;

  return {
    combination,
    week1CompletionRate: week1Rate,
    week2CompletionRate: week2Rate,
    week1TargetRate: TARGET_WIN_RATES.WEEK1,
    week2TargetRate: TARGET_WIN_RATES.WEEK2,
    recommendation: getRecommendation(week1Rate, week2Rate),
    recommendationReason: getRecommendationReason(week1Rate, week2Rate),
    expectedWeek1Draws: week1Success > 0 ? totalWeek1Draws / week1Success : 0,
    expectedWeek2Draws: week2Success > 0 ? totalWeek2Draws / week2Success : 0,
  };
}

/**
 * 生成用户指定的基础概率表（根据卡片稀有度配置）
 */
function generateBaseProbTable(
  combination: CardCombination
): Record<string, number> {
  const baseTable = { ...DEFAULT_BASE_PROB_TABLE };

  // Week1 的 A/A/B
  baseTable.A = getBaseProbByRarity(combination.week1.A.rarity);
  baseTable.B = getBaseProbByRarity(combination.week1.B.rarity);

  // Week2 的 C/C/D
  baseTable.C = getBaseProbByRarity(combination.week2.C.rarity);
  baseTable.D = getBaseProbByRarity(combination.week2.D.rarity);

  return baseTable;
}

/**
 * 简化估算：计算集齐时用了多少抽
 * 实际实现可以更精确，这里用简化版本
 */
function estimateDrawsToComplete(
  result: SingleSimulationResult,
  week: 'week1' | 'week2',
  params: SimulationParams
): number {
  // 简化计算：如果完成，假设在第7天或第14天完成
  if (week === 'week1') {
    return params.drawsPerDay * 7; // 简化：假设用完了所有抽数
  } else {
    return params.drawsPerDay * 14;
  }
}

/**
 * 模拟完整游戏流程（14 天）
 */
function simulateFullGame(
  combination: CardCombination,
  params: SimulationParams
): SingleSimulationResult {
  // 构建背包：key 是卡片ID，value 是持有数量
  const backpack: Record<string, number> = {};

  // 获取14天日程
  const schedule = generateFullSchedule();

  const dayResults: SingleSimulationResult['dayResults'] = [];

  // Week1 (第 1-7 天)
  for (let day = 1; day <= params.week1Days; day++) {
    const dayState = schedule[day - 1];
    const dayDraws: string[] = [];

    for (let draw = 0; draw < params.drawsPerDay; draw++) {
      const cardId = simulateSingleDraw(
        backpack,
        combination,
        dayState,
        generateBaseProbTable(combination)
      );
      dayDraws.push(cardId);
      backpack[cardId] = (backpack[cardId] || 0) + 1;
    }

    dayResults.push({
      dayIndex: day,
      draws: dayDraws,
      backpack: { ...backpack },
    });
  }

  // 检查 Week1 是否集齐：A×2 + B×1
  const week1Complete =
    (backpack[combination.week1.A.id] || 0) >= 2 &&
    (backpack[combination.week1.B.id] || 0) >= 1;

  // Week2 (第 8-14 天)，背包继承 Week1
  for (let day = 8; day <= params.week2Days; day++) {
    const dayState = schedule[day - 1];
    const dayDraws: string[] = [];

    for (let draw = 0; draw < params.drawsPerDay; draw++) {
      const cardId = simulateSingleDraw(
        backpack,
        combination,
        dayState,
        generateBaseProbTable(combination)
      );
      dayDraws.push(cardId);
      backpack[cardId] = (backpack[cardId] || 0) + 1;
    }

    dayResults.push({
      dayIndex: day,
      draws: dayDraws,
      backpack: { ...backpack },
    });
  }

  // 检查 Week2 是否集齐：C×2 + D×1
  const week2Complete =
    (backpack[combination.week2.C.id] || 0) >= 2 &&
    (backpack[combination.week2.D.id] || 0) >= 1;

  return {
    week1Complete,
    week2Complete,
    dayResults,
  };
}

/**
 * 模拟单次抽卡
 *
 * 步骤：
 * 1. 获取基础概率表（根据卡组配置的稀有度）
 * 2. 设置幸运卡概率为 1.2%
 * 3. 应用降权系数
 * 4. 归一化处理
 * 5. 轮盘赌随机抽卡
 */
function simulateSingleDraw(
  backpack: Record<string, number>,
  combination: CardCombination,
  dayState: DayState,
  baseProbTable: Record<string, number>
): string {
  // Step 1: 设置幸运卡概率为 1.2%
  const adjustedProbs = { ...baseProbTable };
  adjustedProbs[dayState.luckyCard] = LUCKY_CARD_PROB;

  // Step 2: 应用降权系数（A/B/C/D）
  for (const cardId of TARGET_CARD_IDS) {
    const holdCount = backpack[cardId] || 0;
    const coefficient = getCoefficientFromTable(cardId, holdCount);
    adjustedProbs[cardId] = adjustedProbs[cardId] * coefficient;
  }

  // Step 3: 填充卡第 2 张概率为 0
  for (const cardId of FILLER_CARD_IDS) {
    if (cardId !== dayState.luckyCard && (backpack[cardId] || 0) >= 1) {
      adjustedProbs[cardId] = 0;
    }
  }

  // Step 4: 归一化处理
  const { finalProbs } = normalizeProbabilities(
    adjustedProbs,
    DEFAULT_COEFFICIENT_TABLE,
    backpack,
    dayState.luckyCard
  );

  // Step 5: 轮盘赌随机抽卡
  // 将百分比转换为权重
  const weights: Record<string, number> = {};
  for (const [cardId, prob] of Object.entries(finalProbs)) {
    weights[cardId] = prob;
  }

  return rouletteSelect(weights);
}

/**
 * 从默认系数表获取系数
 */
function getCoefficientFromTable(cardId: string, holdCount: number): number {
  const coefficients = DEFAULT_COEFFICIENT_TABLE[cardId] || [1.0, 0, 0];
  if (holdCount === 0) return coefficients[0] ?? 1.0;
  if (holdCount === 1) return coefficients[1] ?? 0;
  return coefficients[2] ?? 0;
}

/**
 * 获取推荐等级
 */
function getRecommendation(
  week1Rate: number,
  week2Rate: number
): '不推荐' | '可接受' | '推荐' {
  const minRate = Math.min(week1Rate, week2Rate);
  if (minRate < RECOMMENDATION_THRESHOLDS.NOT_RECOMMENDED) return '不推荐';
  if (minRate < RECOMMENDATION_THRESHOLDS.ACCEPTABLE) return '可接受';
  return '推荐';
}

/**
 * 获取推荐原因
 */
function getRecommendationReason(week1Rate: number, week2Rate: number): string {
  const minRate = Math.min(week1Rate, week2Rate);
  if (minRate < RECOMMENDATION_THRESHOLDS.NOT_RECOMMENDED) {
    return `集齐率过低 (${minRate.toFixed(1)}%)，用户难以完成收集，可能导致负面体验`;
  }
  if (minRate < RECOMMENDATION_THRESHOLDS.ACCEPTABLE) {
    return `集齐率可接受 (${minRate.toFixed(1)}%)，大部分用户可完成，但有优化空间`;
  }
  return `集齐率理想 (${minRate.toFixed(1)}%)，推荐此配置`;
}

/**
 * 运行所有组合的模拟（3^4 = 81 种组合）
 *
 * 注意：这会很慢，应该在 Web Worker 中运行
 */
export function runAllCombinationsSimulation(
  params: SimulationParams = DEFAULT_SIMULATION_PARAMS,
  onProgress?: (progress: number) => void
): AllCombinationsResult {
  const results: SimulationResult[] = [];

  // 生成所有可能的组合
  const combinations = generateAllCombinations();
  const totalCombinations = combinations.length;

  for (let i = 0; i < totalCombinations; i++) {
    const combo = combinations[i];

    // 构建完整卡组配置
    const cardCombination: CardCombination = {
      week1: {
        A: { id: combo.A, rarity: getRarityFromCardId(combo.A) },
        a: { id: combo.A, rarity: getRarityFromCardId(combo.A) }, // 第2张A和第1张A稀有度相同
        B: { id: combo.B, rarity: getRarityFromCardId(combo.B) },
      },
      week2: {
        C: { id: combo.C, rarity: getRarityFromCardId(combo.C) },
        c: { id: combo.C, rarity: getRarityFromCardId(combo.C) }, // 第2张C和第1张C稀有度相同
        D: { id: combo.D, rarity: getRarityFromCardId(combo.D) },
      },
    };

    const result = runMonteCarloSimulation(cardCombination, params);
    results.push(result);

    if (onProgress) {
      onProgress((i + 1) / totalCombinations);
    }
  }

  // 按集齐率排序
  results.sort((a, b) => {
    const minA = Math.min(a.week1CompletionRate, a.week2CompletionRate);
    const minB = Math.min(b.week1CompletionRate, b.week2CompletionRate);
    return minB - minA;
  });

  return {
    results,
    top3Recommendations: results.slice(0, 3),
    worstCombination: results[results.length - 1],
    bestCombination: results[0],
  };
}

/**
 * 运行所有卡槽稀有度组合的模拟（3^6 = 729 种组合）
 *
 * 用户可以独立选择每个卡槽的卡片和它的稀有度
 */
export function runAllSlotCombinationsSimulation(
  params: SimulationParams = DEFAULT_SIMULATION_PARAMS,
  onProgress?: (progress: number) => void
): AllCombinationsResult {
  const results: SimulationResult[] = [];
  const generator = generateSlotRarityCombinations();

  let count = 0;
  const total = 729; // 3^6

  for (const rarityCombo of generator) {
    const cardCombination: CardCombination = {
      week1: {
        A: { id: 'A', rarity: rarityCombo.A },
        a: { id: 'A', rarity: rarityCombo.a },
        B: { id: 'B', rarity: rarityCombo.B },
      },
      week2: {
        C: { id: 'C', rarity: rarityCombo.C },
        c: { id: 'C', rarity: rarityCombo.c },
        D: { id: 'D', rarity: rarityCombo.D },
      },
    };

    const result = runMonteCarloSimulation(cardCombination, params);
    results.push(result);

    count++;
    if (onProgress) {
      onProgress(count / total);
    }
  }

  // 按最低集齐率排序
  results.sort((a, b) => {
    const minA = Math.min(a.week1CompletionRate, a.week2CompletionRate);
    const minB = Math.min(b.week1CompletionRate, b.week2CompletionRate);
    return minB - minA;
  });

  return {
    results,
    top3Recommendations: results.slice(0, 3),
    worstCombination: results[results.length - 1],
    bestCombination: results[0],
  };
}

/**
 * 生成所有可能的 A/B/C/D 组合
 * 注意：返回的是卡片ID（从卡池中选择的具体卡）
 */
function generateAllCombinations(): Array<{ A: string; B: string; C: string; D: string }> {
  // 从10张卡中选择4张不同的卡作为 A/B/C/D
  const cards = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  const combinations: Array<{ A: string; B: string; C: string; D: string }> = [];

  // 简化：固定 A=A(神奇), B/C/D 从稀有和普通中选
  // 实际上我们要枚举的是每张卡可以被分配为 神奇/稀有/普通
  // 但为了简化，我们只考虑卡片本身的稀有度

  for (let a = 0; a < 10; a++) {
    for (let b = 0; b < 10; b++) {
      if (b === a) continue;
      for (let c = 0; c < 10; c++) {
        if (c === a || c === b) continue;
        for (let d = 0; d < 10; d++) {
          if (d === a || d === b || d === c) continue;
          combinations.push({
            A: cards[a],
            B: cards[b],
            C: cards[c],
            D: cards[d],
          });
        }
      }
    }
  }

  return combinations;
}

/**
 * 根据卡片ID获取稀有度
 */
function getRarityFromCardId(cardId: string): Rarity {
  if (cardId === 'A') return 'MAGIC';
  if (['B', 'C', 'D', 'E'].includes(cardId)) return 'RARE';
  return 'COMMON';
}

/**
 * 分块运行模拟（避免阻塞UI）
 */
export async function runSimulationInChunks(
  combination: CardCombination,
  params: SimulationParams = DEFAULT_SIMULATION_PARAMS,
  onProgress?: (progress: number) => void
): Promise<SimulationResult> {
  const chunkSize = 1000;
  const totalIterations = params.iterations;
  let week1Success = 0;
  let week2Success = 0;

  for (let i = 0; i < totalIterations; i += chunkSize) {
    const currentChunkSize = Math.min(chunkSize, totalIterations - i);

    for (let j = 0; j < currentChunkSize; j++) {
      const result = simulateFullGame(combination, {
        ...params,
        iterations: 1,
      });

      if (result.week1Complete) week1Success++;
      if (result.week2Complete) week2Success++;
    }

    if (onProgress) {
      onProgress(Math.min((i + currentChunkSize) / totalIterations, 1));
    }

    // 让出控制权给事件循环
    if (i + chunkSize < totalIterations) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  const week1Rate = (week1Success / totalIterations) * 100;
  const week2Rate = (week2Success / totalIterations) * 100;

  return {
    combination,
    week1CompletionRate: week1Rate,
    week2CompletionRate: week2Rate,
    week1TargetRate: TARGET_WIN_RATES.WEEK1,
    week2TargetRate: TARGET_WIN_RATES.WEEK2,
    recommendation: getRecommendation(week1Rate, week2Rate),
    recommendationReason: getRecommendationReason(week1Rate, week2Rate),
    expectedWeek1Draws: 0,
    expectedWeek2Draws: 0,
  };
}
