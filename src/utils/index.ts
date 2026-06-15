import type { NormalizationResult, NormalizationStep, DayState, DayType } from '@/types';
import { LUCKY_CARD_PROB } from '@/constants';

/**
 * 打乱数组（Fisher-Yates 洗牌算法）
 */
export function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * 打乱数组（原地修改）
 */
export function shuffleInPlace<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

/**
 * 生成 7 天日程（5 普通日 + 1 稀有日 + 1 神奇日，随机打乱）
 */
export function generateWeekSchedule(): DayType[] {
  const weekTemplate: DayType[] = [
    'COMMON', 'COMMON', 'COMMON', 'COMMON', 'COMMON', // 5 个普通日
    'RARE',                                           // 1 个稀有日
    'MAGIC',                                          // 1 个神奇日
  ];
  return shuffleArray(weekTemplate);
}

/**
 * 生成 14 天完整日程
 */
export function generateFullSchedule(): DayState[] {
  const week1 = generateWeekSchedule();
  const week2 = generateWeekSchedule();

  const allDays: DayState[] = [];
  let dayIndex = 1;

  // Week 1
  for (const dayType of week1) {
    allDays.push({
      dayIndex: dayIndex++,
      dayType,
      luckyCard: getLuckyCardForDayType(dayType),
    });
  }

  // Week 2
  for (const dayType of week2) {
    allDays.push({
      dayIndex: dayIndex++,
      dayType,
      luckyCard: getLuckyCardForDayType(dayType),
    });
  }

  return allDays;
}

/**
 * 获取某日期的幸运卡（随机选择）
 */
function getLuckyCardForDayType(dayType: DayType): string {
  switch (dayType) {
    case 'MAGIC':
      return 'A'; // 神奇日只有A卡是幸运卡
    case 'RARE':
      // 稀有日，从 B/C/D/E 中随机选一张
      const rareCards = ['B', 'C', 'D', 'E'];
      return rareCards[Math.floor(Math.random() * rareCards.length)];
    case 'COMMON':
      // 普通日，从 F/G/H/I/J 中随机选一张
      const commonCards = ['F', 'G', 'H', 'I', 'J'];
      return commonCards[Math.floor(Math.random() * commonCards.length)];
    default:
      return 'F';
  }
}

/**
 * 归一化处理概率分布
 *
 * 算法步骤：
 * 1. 设置幸运卡概率为 1.2%
 * 2. 应用降权系数（A/B/C/D）
 * 3. 填充卡第 2 张概率为 0
 * 4. A/B/C/D 使用新概率，剩余概率分配给 F-J
 * 5. 验证总和为 100%
 */
export function normalizeProbabilities(
  baseProbs: Record<string, number>,
  coefficientTable: Record<string, number[]>,
  backpack: Record<string, number>,
  luckyCard: string
): NormalizationResult {
  const steps: NormalizationStep[] = [];

  // Step 1: 复制基础概率
  const adjustedProbs = { ...baseProbs };

  // Step 2: 应用降权系数（A/B/C/D）
  const targetCards = ['A', 'B', 'C', 'D'];
  for (const cardId of targetCards) {
    const holdCount = backpack[cardId] || 0;
    const coefficient = getCoefficient(coefficientTable, cardId, holdCount);
    const oldProb = adjustedProbs[cardId];
    adjustedProbs[cardId] = oldProb * coefficient;

    if (coefficient !== 1.0) {
      steps.push({
        desc: `应用降权系数`,
        card: cardId,
        oldProb,
        newProb: adjustedProbs[cardId],
        coefficient,
      });
    }
  }

  // Step 3: 填充卡第 2 张概率为 0
  const fillerCards = ['E', 'F', 'G', 'H', 'I', 'J'];
  for (const cardId of fillerCards) {
    if (cardId !== luckyCard && (backpack[cardId] || 0) >= 1) {
      adjustedProbs[cardId] = 0;
      steps.push({
        desc: `填充卡第2张概率为0`,
        card: cardId,
        oldProb: baseProbs[cardId],
        newProb: 0,
      });
    }
  }

  // Step 4: 设置幸运卡概率为 1.2%
  adjustedProbs[luckyCard] = LUCKY_CARD_PROB;

  // Step 5: 计算 A/B/C/D 新概率之和
  const abcdProb = targetCards.reduce((sum, card) => sum + adjustedProbs[card], 0);

  // Step 6: 计算剩余概率（分配给 F-J）
  const remainingProb = 100 - abcdProb - LUCKY_CARD_PROB;

  // 其他卡片（不含幸运卡）的原始概率总和
  const otherCards = fillerCards.filter(c => c !== luckyCard);
  const otherCardsTotalBaseProb = otherCards.reduce((sum, card) => {
    // 如果这张卡已经有0概率（第2张），则不计入
    if (adjustedProbs[card] === 0) return sum;
    return sum + baseProbs[card];
  }, 0);

  // Step 7: 计算最终概率
  const finalProbs: Record<string, number> = {};

  // A/B/C/D 直接使用新概率
  for (const card of targetCards) {
    finalProbs[card] = adjustedProbs[card];
  }

  // 幸运卡固定为 1.2%
  finalProbs[luckyCard] = LUCKY_CARD_PROB;

  // 其他卡片按权重分配剩余概率
  for (const card of otherCards) {
    if (adjustedProbs[card] === 0) {
      finalProbs[card] = 0;
    } else {
      const weight = baseProbs[card] / otherCardsTotalBaseProb;
      finalProbs[card] = weight * remainingProb;
      steps.push({
        desc: `按权重分配剩余概率`,
        card,
        weight,
        finalProb: finalProbs[card],
      });
    }
  }

  // Step 8: 验证总和
  const total = Object.values(finalProbs).reduce((sum, p) => sum + p, 0);
  steps.push({
    desc: `验证概率总和`,
    value: total,
  });

  return { finalProbs, steps };
}

/**
 * 获取降权系数
 */
function getCoefficient(
  coefficientTable: Record<string, number[]>,
  cardId: string,
  holdCount: number
): number {
  const coefficients = coefficientTable[cardId] || [1.0, 0, 0];
  if (holdCount === 0) return coefficients[0] ?? 1.0;
  if (holdCount === 1) return coefficients[1] ?? 0;
  return coefficients[2] ?? 0;
}

/**
 * 轮盘赌随机选择
 *
 * @param weights 权重对象 { key: weight }
 * @returns 选中的 key
 */
export function rouletteSelect(weights: Record<string, number>): string {
  const entries = Object.entries(weights);
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);

  let random = Math.random() * totalWeight;

  for (const [key, weight] of entries) {
    random -= weight;
    if (random <= 0) {
      return key;
    }
  }

  // 理论上不会到这里，返回最后一个
  return entries[entries.length - 1]?.[0] || '';
}

/**
 * 格式化百分比
 */
export function formatPercent(value: number, decimals: number = 2): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * 格式化数字（千分位）
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('zh-CN');
}

/**
 * 延迟函数
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 深拷贝对象
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * 计算平均值
 */
export function average(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

/**
 * 计算标准差
 */
export function standardDeviation(arr: number[]): number {
  if (arr.length === 0) return 0;
  const avg = average(arr);
  const variance = arr.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / arr.length;
  return Math.sqrt(variance);
}

/**
 * 生成所有可能的组合（3^4 = 81 种）
 *
 * A、B、C、D 每张卡都可以是 神奇/稀有/普通 三种稀有度
 */
export function generateAllCombinations(): Array<{ A: string; B: string; C: string; D: string }> {
  const rarities = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  const combinations: Array<{ A: string; B: string; C: string; D: string }> = [];

  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      for (let k = 0; k < 3; k++) {
        for (let l = 0; l < 3; l++) {
          combinations.push({
            A: rarities[i],
            B: rarities[j + 1],
            C: rarities[k + 2],
            D: rarities[l + 3],
          });
        }
      }
    }
  }

  return combinations;
}

/**
 * 生成卡槽的所有可能稀有度组合
 * 每个卡槽（A, a, B, C, c, D）都可以是 MAGIC/RARE/COMMON
 * 共 3^6 = 729 种组合
 */
export function* generateSlotRarityCombinations(): Generator<{
  A: 'MAGIC' | 'RARE' | 'COMMON';
  a: 'MAGIC' | 'RARE' | 'COMMON';
  B: 'MAGIC' | 'RARE' | 'COMMON';
  C: 'MAGIC' | 'RARE' | 'COMMON';
  c: 'MAGIC' | 'RARE' | 'COMMON';
  D: 'MAGIC' | 'RARE' | 'COMMON';
}> {
  const rarities: ('MAGIC' | 'RARE' | 'COMMON')[] = ['MAGIC', 'RARE', 'COMMON'];

  for (const A of rarities) {
    for (const a of rarities) {
      for (const B of rarities) {
        for (const C of rarities) {
          for (const c of rarities) {
            for (const D of rarities) {
              yield { A, a, B, C, c, D };
            }
          }
        }
      }
    }
  }
}

/**
 * 获取稀有度对应的基础概率
 */
export function getBaseProbByRarity(rarity: 'MAGIC' | 'RARE' | 'COMMON'): number {
  switch (rarity) {
    case 'MAGIC':
      return 2;
    case 'RARE':
      return 7;
    case 'COMMON':
      return 14;
    default:
      return 14;
  }
}

/**
 * 验证概率总和
 */
export function validateProbSum(probs: Record<string, number>): boolean {
  const total = Object.values(probs).reduce((sum, p) => sum + p, 0);
  return Math.abs(total - 100) < 0.0001;
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return function (...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(null, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return function (...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(null, args), wait);
  };
}
