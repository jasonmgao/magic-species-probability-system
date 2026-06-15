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
