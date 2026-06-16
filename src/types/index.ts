/**
 * 🎴 神奇物种发卡概率系统 - 类型定义
 * 反向求解降权系数（按持有数量分层）
 */

/** 卡片稀有度 */
export type Rarity = 'MAGIC' | 'RARE' | 'COMMON';

/** 日类型 */
export type DayType = 'COMMON' | 'RARE' | 'MAGIC';

/**
 * 单周卡组配置
 */
export interface WeeklyCombo {
  name: string;           // "第一周" / "第二周"
  cards: string[];        // 卡牌列表，长度 2-5，可重复（如 ["A","A","B"]）
  deadline: number;       // 截止时间（天）：第一周=7，第二周=14
}

/**
 * 完整卡组配置（两周）
 */
export interface CardSetup {
  week1: WeeklyCombo;
  week2: WeeklyCombo;
  /** 每日抽奖次数（默认为4） */
  dailyDraws: number;
}

/**
 * 降权系数：按持有数量分层
 * 索引 0 = 持有 1 张时的系数（固定为 1.0）
 * 索引 1 = 持有 2 张时的系数
 * ...
 * 持有 n+1 张以上时，概率 = 0（不再掉落）
 */
export type CardCoefficients = number[];  // [1.0, x, y, z, ...]

/**
 * 系数求解结果
 */
export interface CoefficientResult {
  /** 第一周每张卡的降权系数（按持有数量分层） */
  week1: Record<string, CardCoefficients>;
  /** 第二周每张卡的降权系数（按持有数量分层） */
  week2: Record<string, CardCoefficients>;
  /** 实际中奖率（验证结果） */
  actualRates: {
    week1: number;  // 第一周实际中奖率（应接近 4%）
    week2: number;  // 第二周实际中奖率（应接近 4%）
  };
  /** 14 天全收集概率（集齐 10 张卡至少 1 张） */
  fullCollectionRate: number;
  /** 是否收敛 */
  converged: boolean;
  /** 迭代次数 */
  iterations: number;
  /** 最终误差（与目标 4% 的偏差） */
  finalError: number;
}

/**
 * 求解进度回调
 */
export interface SolverProgress {
  iteration: number;
  totalIterations: number;
  week1Rate: number;
  week2Rate: number;
  error: number;
  isConverged: boolean;
}

/**
 * 概率分布计算结果（用于展示）
 */
export interface ProbDistributionResult {
  card: string;
  rarity: string;
  baseProb: number;
  coefficient: number;
  weightedProb: number;
  normalizedProb: number;
}

/**
 * 案例数据
 */
export interface CaseData {
  name: string;
  description: string;
  initialBag: Record<string, number>;
  dayType: DayType;
  luckyCard: string | null;
  expectedSuccess: string;
  probabilities?: Record<string, number>;
}

/**
 * 求解器详细结果（用于调试和分析）
 */
export interface SolverDetailedResult {
  coefficients: Record<string, CardCoefficients>;
  week1Rate: number;
  week2Rate: number;
  fullCollectionRate: number;
  converged: boolean;
  iterations: number;
  finalError: number;
  paramHistory: number[][];
  targetRate: number;
}

/**
 * 卡片配置（用于UI）
 */
export interface CardConfig {
  cardId: string;
  count: number;
}
