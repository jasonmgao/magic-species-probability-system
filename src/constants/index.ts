import type { Card, Rarity, SimulationParams } from '@/types';

// ==================== 卡片数据 ====================

/** 卡片稀有度配置 */
export const RARITY_CONFIG: Record<Rarity, { label: string; color: string; bgColor: string }> = {
  MAGIC: {
    label: '神奇卡',
    color: '#FFD700',
    bgColor: '#FFF8DC',
  },
  RARE: {
    label: '稀有卡',
    color: '#9B59B6',
    bgColor: '#F3E5F5',
  },
  COMMON: {
    label: '普通卡',
    color: '#95A5A6',
    bgColor: '#ECEFF1',
  },
};

/** 基础卡片池（10张卡） */
export const BASE_CARDS: Card[] = [
  { id: 'A', name: '神奇卡 A', rarity: 'MAGIC', baseProb: 2 },
  { id: 'B', name: '稀有卡 B', rarity: 'RARE', baseProb: 7 },
  { id: 'C', name: '稀有卡 C', rarity: 'RARE', baseProb: 7 },
  { id: 'D', name: '稀有卡 D', rarity: 'RARE', baseProb: 7 },
  { id: 'E', name: '稀有卡 E', rarity: 'RARE', baseProb: 7 },
  { id: 'F', name: '普通卡 F', rarity: 'COMMON', baseProb: 14 },
  { id: 'G', name: '普通卡 G', rarity: 'COMMON', baseProb: 14 },
  { id: 'H', name: '普通卡 H', rarity: 'COMMON', baseProb: 14 },
  { id: 'I', name: '普通卡 I', rarity: 'COMMON', baseProb: 14 },
  { id: 'J', name: '普通卡 J', rarity: 'COMMON', baseProb: 14 },
];

/** 卡片ID列表 */
export const CARD_IDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

/** 组合卡ID列表（A/B/C/D） */
export const TARGET_CARD_IDS = ['A', 'B', 'C', 'D'];

/** 填充卡ID列表（E-J） */
export const FILLER_CARD_IDS = ['E', 'F', 'G', 'H', 'I', 'J'];

// ==================== 默认概率配置 ====================

/** 默认基础概率表 */
export const DEFAULT_BASE_PROB_TABLE: Record<string, number> = {
  A: 2,
  B: 7,
  C: 7,
  D: 7,
  E: 7,
  F: 14,
  G: 14,
  H: 14,
  I: 14,
  J: 14,
};

/** 验证基础概率表总和是否为100% */
export function validateBaseProbTable(table: Record<string, number>): boolean {
  const total = Object.values(table).reduce((sum, prob) => sum + prob, 0);
  return Math.abs(total - 100) < 0.0001;
}

// ==================== 降权系数配置 ====================

/**
 * 默认降权系数表
 * 结构：{ 卡片ID: [持有0张系数, 持有1张系数, 持有2张+系数] }
 *
 * 设计原理：
 * - A/B 的第二张系数为 0.02（2%），因为第一套只有 7 天窗口
 * - C/D 的第二张系数为 0.008（0.8%），因为第二套有 14 天窗口，累积效应更强
 * - 填充卡第 2 张概率为 0，确保只掉落 1 张
 */
export const DEFAULT_COEFFICIENT_TABLE: Record<string, number[]> = {
  // 第一套（Week1）：A卡 ×2 + B卡 ×1
  A: [1.0, 0.02, 0],    // 第1张A：持有0张=1.0, 持有1张=0.02, 持有2张+=0
  a: [1.0, 0.02, 0],    // 第2张A：持有0张=1.0, 持有1张=0.02, 持有2张+=0
  B: [1.0, 0.02, 0],    // 第1张B
  b: [1.0, 0.02, 0],    // 第2张B

  // 第二套（Week2）：C卡 ×2 + D卡 ×1
  C: [1.0, 0.008, 0],   // 第1张C：持有0张=1.0, 持有1张=0.008, 持有2张+=0
  c: [1.0, 0.008, 0],   // 第2张C
  D: [1.0, 0.008, 0],   // 第1张D
  d: [1.0, 0.008, 0],   // 第2张D

  // 填充卡（E-J）
  E: [1.0, 0, 0],
  F: [1.0, 0, 0],
  G: [1.0, 0, 0],
  H: [1.0, 0, 0],
  I: [1.0, 0, 0],
  J: [1.0, 0, 0],
};

/** 获取降权系数 */
export function getCoefficient(
  coefficientTable: Record<string, number[]>,
  cardId: string,
  holdCount: number
): number {
  const coefficients = coefficientTable[cardId] || [1.0, 0, 0];
  if (holdCount === 0) return coefficients[0];
  if (holdCount === 1) return coefficients[1];
  return coefficients[2];
}

// ==================== 模拟参数配置 ====================

/** 默认模拟参数 */
export const DEFAULT_SIMULATION_PARAMS: SimulationParams = {
  iterations: 100000,   // 10万次迭代
  drawsPerDay: 4,       // 每天4次抽卡
  week1Days: 7,         // Week1 7天
  week2Days: 14,        // Week2 14天
};

/** 幸运卡概率（固定值） */
export const LUCKY_CARD_PROB = 1.2; // 1.2%

/** 推荐阈值配置 */
export const RECOMMENDATION_THRESHOLDS = {
  NOT_RECOMMENDED: 80,  // < 80% 不推荐
  ACCEPTABLE: 95,       // 80% - 95% 可接受
  // >= 95% 推荐
};

/** 目标中奖率（用于对比） */
export const TARGET_WIN_RATES = {
  WEEK1: 4.0,  // Week1 目标 4%
  WEEK2: 4.0,  // Week2 目标 4%
};

// ==================== 背包预设配置 ====================

/** 背包预设选项 */
export const BACKPACK_PRESETS = [
  {
    key: 'newbie',
    label: '全新用户',
    description: '所有卡片持有0张',
    backpack: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0, I: 0, J: 0 },
  },
  {
    key: 'week1_need3',
    label: 'Week1 差3张集齐',
    description: 'A×1, a×0, B×0',
    backpack: { A: 1, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0, I: 0, J: 0 },
  },
  {
    key: 'week1_need2',
    label: 'Week1 差2张集齐',
    description: 'A×2, a×0, B×0',
    backpack: { A: 2, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0, I: 0, J: 0 },
  },
  {
    key: 'week1_need1',
    label: 'Week1 差1张集齐',
    description: 'A×2, a×1, B×0',
    backpack: { A: 2, B: 1, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0, I: 0, J: 0 },
  },
  {
    key: 'week1_complete',
    label: 'Week1 已集齐',
    description: 'A×2, a×1, B×1',
    backpack: { A: 2, B: 1, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0, I: 0, J: 0 },
  },
  {
    key: 'week2_need3',
    label: 'Week2 差3张集齐',
    description: 'C×1, c×0, D×0',
    backpack: { A: 2, B: 1, C: 1, D: 0, E: 0, F: 0, G: 0, H: 0, I: 0, J: 0 },
  },
  {
    key: 'week2_complete',
    label: '全部集齐',
    description: '两套组合都已完成',
    backpack: { A: 2, B: 1, C: 2, D: 1, E: 0, F: 0, G: 0, H: 0, I: 0, J: 0 },
  },
];

/** 日状态预设选项 */
export const DAY_STATE_PRESETS = [
  {
    key: 'common_F',
    label: '普通日（幸运卡=F）',
    dayType: 'COMMON' as const,
    luckyCard: 'F',
  },
  {
    key: 'common_G',
    label: '普通日（幸运卡=G）',
    dayType: 'COMMON' as const,
    luckyCard: 'G',
  },
  {
    key: 'rare_B',
    label: '稀有日（幸运卡=B）',
    dayType: 'RARE' as const,
    luckyCard: 'B',
  },
  {
    key: 'rare_C',
    label: '稀有日（幸运卡=C）',
    dayType: 'RARE' as const,
    luckyCard: 'C',
  },
  {
    key: 'magic_A',
    label: '神奇日（幸运卡=A）',
    dayType: 'MAGIC' as const,
    luckyCard: 'A',
  },
];

// ==================== 卡槽配置 ====================

/** 卡槽配置 */
export const SLOT_CONFIG: Record<string, { label: string; week: 1 | 2; description: string }> = {
  A: { label: 'A (第1张)', week: 1, description: 'Week1 第1张A卡' },
  a: { label: 'a (第2张)', week: 1, description: 'Week1 第2张A卡' },
  B: { label: 'B (第1张)', week: 1, description: 'Week1 第1张B卡' },
  C: { label: 'C (第1张)', week: 2, description: 'Week2 第1张C卡' },
  c: { label: 'c (第2张)', week: 2, description: 'Week2 第2张C卡' },
  D: { label: 'D (第1张)', week: 2, description: 'Week2 第1张D卡' },
};

/**
 * 创建默认概率案例
 */
export function createDefaultCase() {
  return {
    backpack: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0, I: 0, J: 0 },
    dayState: {
      dayIndex: 1,
      dayType: 'COMMON' as const,
      luckyCard: 'F',
    },
    baseProbTable: { ...DEFAULT_BASE_PROB_TABLE },
    coefficientTable: { ...DEFAULT_COEFFICIENT_TABLE },
  };
}
