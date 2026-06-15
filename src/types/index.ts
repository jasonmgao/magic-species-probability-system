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

/** 卡片稀有度配置（用户选择的特定卡的稀有度） */
export interface CardRarityConfig {
  id: string;
  rarity: Rarity;
}

// ==================== 卡槽相关类型 ====================

/** 卡槽位置 */
export type SlotPosition = 'A' | 'a' | 'B' | 'C' | 'c' | 'D';

/** 卡槽信息 */
export interface CardSlot {
  position: SlotPosition;
  cardId: string | null;
  cardRarity: Rarity | null;
  label: string;
  week: 1 | 2;
}

/** 完整卡组配置（6个卡槽） */
export interface CardCombination {
  week1: {
    A: CardRarityConfig;  // 第1张A
    a: CardRarityConfig;  // 第2张A
    B: CardRarityConfig;  // 第1张B
  };
  week2: {
    C: CardRarityConfig;  // 第1张C
    c: CardRarityConfig;  // 第2张C
    D: CardRarityConfig;  // 第1张D
  };
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

/** 单次模拟结果 */
export interface SingleSimulationResult {
  week1Complete: boolean;
  week2Complete: boolean;
  dayResults: DayResult[];
}

/** 每天的结果 */
export interface DayResult {
  dayIndex: number;
  draws: string[]; // 抽到的卡片ID列表
  backpack: Record<string, number>; // 当天结束后的背包状态
}

/** 蒙特卡洛模拟结果 */
export interface SimulationResult {
  combination: CardCombination;
  week1CompletionRate: number;   // Week1 集齐率 (%)
  week2CompletionRate: number;   // Week2 集齐率 (%)
  week1TargetRate: number;       // Week1 目标中奖率 (4%)
  week2TargetRate: number;       // Week2 目标中奖率 (4%)
  recommendation: '不推荐' | '可接受' | '推荐';
  recommendationReason: string;
  expectedWeek1Draws: number;    // Week1 期望抽卡次数
  expectedWeek2Draws: number;    // Week2 期望抽卡次数
}

/** 所有组合的模拟结果 */
export interface AllCombinationsResult {
  results: SimulationResult[];
  top3Recommendations: SimulationResult[];
  worstCombination: SimulationResult;
  bestCombination: SimulationResult;
}

// ==================== 概率计算相关类型 ====================

/** 概率计算案例 */
export interface ProbabilityCase {
  backpack: Record<string, number>;     // 用户背包：卡片 ID -> 持有数量
  dayState: DayState;
  baseProbTable: Record<string, number>; // 基础概率表
  coefficientTable: Record<string, number[]>; // 降权系数表 [0张系数, 1张系数, 2张+系数]
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

// ==================== 推荐相关类型 ====================

/** 推荐等级 */
export type RecommendationLevel = '不推荐' | '可接受' | '推荐';

/** 推荐配置 */
export interface Recommendation {
  cards: CardCombination;
  week1Rate: number;
  week2Rate: number;
  level: RecommendationLevel;
  reason: string;
}

// ==================== 状态管理相关类型 ====================

/** 全局状态 */
export interface AppState {
  // 卡面选择页状态
  selectedCombination: CardCombination | null;
  simulationResult: SimulationResult | null;
  isSimulating: boolean;
  simulationProgress: number;

  // 概率配置页状态
  baseProbTable: Record<string, number>;
  coefficientTable: Record<string, number[]>;
  currentCase: ProbabilityCase | null;
  calculationResult: ProbabilityCalculationResult | null;

  // Actions
  setSelectedCombination: (combination: CardCombination) => void;
  setSimulationResult: (result: SimulationResult) => void;
  setIsSimulating: (isSimulating: boolean) => void;
  setSimulationProgress: (progress: number) => void;
  updateBaseProb: (cardId: string, prob: number) => void;
  updateCoefficient: (cardId: string, holdCount: number, coefficient: number) => void;
  setCurrentCase: (caseData: ProbabilityCase) => void;
  setCalculationResult: (result: ProbabilityCalculationResult) => void;
  resetToDefault: () => void;
}
