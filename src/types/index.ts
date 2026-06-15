/** 卡片稀有度 */
export type Rarity = 'MAGIC' | 'RARE' | 'COMMON';

/** 日期类型 */
export type DayType = 'COMMON' | 'RARE' | 'MAGIC';

/** 日期状态 */
export interface DayState {
  dayIndex: number;
  dayType: DayType;
  luckyCard: string;
}

/**
 * 组合定义
 * 格式：3张卡，其中一张需要2张，其他各1张
 * 如：{ doubleCard: 'A', singleCards: ['B', 'C'] } 表示 A×2 + B×1 + C×1
 */
export interface Combination {
  name: string;           // 组合名称（第一套/第二套）
  doubleCard: string;     // 需要2张的卡
  singleCards: [string, string];  // 需要各1张的两张卡
}

/**
 * 卡组配置
 * week1: 第一套组合（3张卡）
 * week2: 第二套组合（3张卡，可与第一套重叠）
 */
export interface CardSetup {
  week1: Combination;
  week2: Combination;
}

/**
 * 降权系数
 * 每张卡在不同持有数量下的概率系数
 */
export interface Coefficients {
  [cardId: string]: {
    count0: number;  // 持有0张时的系数
    count1: number;  // 持有1张时的系数
    count2: number;  // 持有2张时的系数
  };
}

/**
 * 背包状态
 */
export type BackpackState = 'empty' | 'need3' | 'need2' | 'need1' | 'complete';

/**
 * 背包配置
 */
export interface BackpackConfig {
  state: BackpackState;
  label: string;
  description: string;
  initialBag: Record<string, number>;  // 各卡初始持有数量
}

/**
 * 单个状态的模拟结果
 */
export interface StateResult {
  backpackState: BackpackState;
  label: string;
  description: string;

  // 降权系数（自动计算的）
  coefficients: Coefficients;

  // 结果
  fullCollectionRate: number;  // 14天10张全收集率（核心指标）
  week1Rate: number;  // 第一套中奖率（目标≈4%）
  week2Rate: number;  // 第二套中奖率（目标≈4%）
}

/**
 * 完整模拟结果
 */
export interface SimulationResult {
  setup: CardSetup;  // 卡组配置
  stateResults: StateResult[];  // 各背包状态的结果
  bestState: StateResult | null;  // 全收集率最高的状态
}
