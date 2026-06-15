/** 卡片稀有度 */
export type Rarity = 'MAGIC' | 'RARE' | 'COMMON';

/** 单张卡需求 */
export interface CardRequirement {
  cardId: string;      // 卡片ID (A-J)
  count: number;       // 需要几张
}

/** 组合需求（任意形式） */
export interface CombinationRequirement {
  name: string;        // 组合名称（如"第一套"）
  cards: CardRequirement[];  // 需要哪些卡，各几张
  deadline: number;    // 截止日期（第几天）
}

/** 日期类型 */
export type DayType = 'COMMON' | 'RARE' | 'MAGIC';

/** 日期状态 */
export interface DayState {
  dayIndex: number;
  dayType: DayType;
  luckyCard: string;
}

/** 背包状态 */
export type BackpackState = 'empty' | 'need3' | 'need2' | 'need1' | 'complete';

/** 背包状态配置 */
export interface BackpackConfig {
  state: BackpackState;
  label: string;
  description: string;
  // 各卡初始持有数量
  initialBag: Record<string, number>;
}

/** 降权系数配置 */
export interface CoefficientSet {
  // 每张卡在不同持有数量下的系数 [0张, 1张, 2张, 3张...]
  [cardId: string]: number[];
}

/** 单个背包状态的模拟结果 */
export interface StateSimulationResult {
  backpackState: BackpackState;
  label: string;
  // 使用的降权系数
  coefficients: CoefficientSet;
  // 结果
  fullCollectionRate: number;
  combinationRates: {
    [combinationName: string]: number;  // 各组合中奖率
  };
}

/** 完整模拟结果 */
export interface SimulationResult {
  // 组合配置
  combinations: CombinationRequirement[];
  // 各背包状态的结果
  stateResults: StateSimulationResult[];
  // 最佳配置（全收集率最高的）
  bestState: StateSimulationResult | null;
}

/** 全局状态 */
export interface AppState {
  // 当前组合配置
  combinations: CombinationRequirement[];
  // Actions
  setCombinations: (combos: CombinationRequirement[]) => void;
}
