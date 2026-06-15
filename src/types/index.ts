/** 卡片稀有度 */
export type Rarity = 'MAGIC' | 'RARE' | 'COMMON';

/**
 * 组合定义（完全自由）
 * 3张卡，每张卡的数量任意配置
 */
export interface Combination {
  name: string;  // 组合名称
  // 3张卡的需求 [卡ID, 需要数量]
  requirements: Array<{ cardId: string; count: number }>;
  deadline: number;  // 截止日期（第几天）
}

/**
 * 卡组配置
 */
export interface CardSetup {
  combinations: Combination[];  // 多组组合（通常2套）
}

/**
 * 降权系数
 */
export interface CoefficientSet {
  [cardId: string]: number[];  // [0张系数, 1张系数, 2张系数, ...]
}

/**
 * 背包状态
 */
export interface BackpackState {
  state: string;
  label: string;
  description: string;
  initialBag: Record<string, number>;
}

/**
 * 单个状态的模拟结果
 */
export interface SingleStateResult {
  state: string;
  label: string;
  description: string;
  coefficients: CoefficientSet;
  fullCollectionRate: number;
  combinationRates: Record<string, number>;
}

/**
 * 完整模拟结果
 */
export interface FullSimulationResult {
  stateResults: SingleStateResult[];
  bestState: SingleStateResult | null;
}

/**
 * 按缺卡数量划分的系数
 */
export interface MissingCountCoeffs {
  [cardId: string]: number;
}

/**
 * 系数求解结果
 */
export interface CoefficientResult {
  // 按缺卡数量划分的系数
  byMissingCount: {
    missing3: MissingCountCoeffs;  // 缺3张时的系数
    missing2: MissingCountCoeffs;  // 缺2张时的系数
    missing1: MissingCountCoeffs;  // 缺1张时的系数
  };
  // 完整系数表（每张卡持有1张时的降权系数）
  allCoefficients: Record<string, number>;
  // 组合成功率（每组组合的中奖率）
  combinationRates: Record<string, number>;
  // 14天全收集率
  fullCollectionRate: number;
  // 收敛状态
  converged: boolean;
  // 误差值
  error: number;
}
