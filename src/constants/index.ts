// 基础卡片数据
export const BASE_CARDS = [
  { id: 'A', name: '神奇卡 A', rarity: 'MAGIC' as const, baseProb: 2 },
  { id: 'B', name: '稀有卡 B', rarity: 'RARE' as const, baseProb: 7 },
  { id: 'C', name: '稀有卡 C', rarity: 'RARE' as const, baseProb: 7 },
  { id: 'D', name: '稀有卡 D', rarity: 'RARE' as const, baseProb: 7 },
  { id: 'E', name: '稀有卡 E', rarity: 'RARE' as const, baseProb: 7 },
  { id: 'F', name: '普通卡 F', rarity: 'COMMON' as const, baseProb: 14 },
  { id: 'G', name: '普通卡 G', rarity: 'COMMON' as const, baseProb: 14 },
  { id: 'H', name: '普通卡 H', rarity: 'COMMON' as const, baseProb: 14 },
  { id: 'I', name: '普通卡 I', rarity: 'COMMON' as const, baseProb: 14 },
  { id: 'J', name: '普通卡 J', rarity: 'COMMON' as const, baseProb: 14 },
];

// 稀有度配置
export const RARITY_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  MAGIC: { label: '神奇卡', color: '#FFD700', bgColor: '#FFF8DC' },
  RARE: { label: '稀有卡', color: '#9B59B6', bgColor: '#F3E5F5' },
  COMMON: { label: '普通卡', color: '#95A5A6', bgColor: '#ECEFF1' },
};

// 卡片ID列表
export const CARD_IDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

// 幸运卡概率
export const LUCKY_CARD_PROB = 1.2;
