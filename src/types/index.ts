// ==================== 卡片相关类型 ====================

/** 卡片稀有度 */
export type Rarity = 'MAGIC' | 'RARE' | 'COMMON';

/** 卡片信息 */
export interface Card {
  id: string;
  name: string;
  rarity: Rarity;
  baseProb: number; // 基础概率（百分比）
}

/** 卡片稀有度配置 */
export interface CardRarityConfig {
  id: string;
  rarity: Rarity;
}

// ==================== 模拟相关类型 ====================

/** 日期类型 */
export type DayType = 'COMMON' | 'RARE' | 'MAGIC';

/** 日期状态 */
export interface DayState {
  dayIndex: number;      // 1-14
  dayType: DayType;
  luckyCard: string;     // 幸运卡ID
}

/** 模拟参数 */
export interface SimulationParams {
  iterations: number;    // 模拟次数，默认 100000
  drawsPerDay: number;   // 每天抽卡次数，默认 4
  week1Days: number;     // Week1 天数，默认 7
  week2Days: number;     // Week2 天数，默认 14
}

/** 概率计算案例 */
export interface ProbabilityCase {
  backpack: Record<string, number>;
  dayState: DayState;
  baseProbTable: Record<string, number>;
  coefficientTable: Record<string, number[]>;
}

/** 计算步骤 */
export interface CalculationStep {
  stepNumber: number;
  title: string;
  description: string;
  details: Record<string, any>;
}

/** 概率计算结果 */
export interface ProbabilityCalculationResult {
  steps: CalculationStep[];
  finalProbs: Record<string, number>;
  originalProbs: Record<string, number>;
  validation: {
    total: number;
    isValid: boolean;
  };
}

/** 归一化步骤 */
export interface NormalizationStep {
  desc: string;
  card?: string;
  prob?: number;
  oldProb?: number;
  newProb?: number;
  coefficient?: number;
  value?: number;
  weight?: number;
  finalProb?: number;
}

/** 归一化结果 */
export interface NormalizationResult {
  finalProbs: Record<string, number>;
  steps: NormalizationStep[];
}

// ==================== 状态管理相关类型 ====================

/** 降权系数配置 */
export interface CoefficientConfig {
  A: number;  // 第一套第2张的系数（默认0.02）
  C: number;  // 第二套第2张的系数（默认0.008）
}

/** 全局状态 */
export interface AppState {
  // 降权系数配置
  coefficientConfig: CoefficientConfig;

  // Actions
  setCoefficientA: (value: number) => void;
  setCoefficientC: (value: number) => void;
  resetCoefficients: () => void;
}
