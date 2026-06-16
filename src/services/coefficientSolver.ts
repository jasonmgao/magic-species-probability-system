/**
 * 🎯 降权系数求解器（V5 - 跨周关联）
 *
 * 核心改进：
 * 1. 按周总进度统一降权（V4）
 * 2. 跨周关联：持有下周卡也会影响本周概率（防止提前储备轻松完成下周）
 *
 * 对于 AAB/CCC：
 *   - 第一周：AAB是当周卡，CCC跨周卡
 *   - 如果玩家已有 C×2（下周卡在包里）→ 本周系数也受影响
 *   - 第二周：AAB是跨周卡，CCC是当周卡
 *   - 如果玩家已有 A×2（上周卡在包里，虽然已完成）→ 第二周CCC的权重
 */

import type { CardSetup, WeeklyCombo, CoefficientResult, CardCoefficients, SolverProgress } from '@/types';

export const ALL_CARDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

const BASE_PROBS: Record<string, number> = {
  A: 2,
  B: 7, C: 7, D: 7, E: 7,
  F: 14, G: 14, H: 14, I: 14, J: 14,
};

const LUCKY_FIXED_PROB = 1.2;

export function getCardType(card: string): 'common' | 'rare' | 'magic' {
  if (card === 'A') return 'magic';
  if (['B', 'C', 'D', 'E'].includes(card)) return 'rare';
  return 'common';
}

export function getBaseProb(card: string): number {
  return BASE_PROBS[card] ?? 14;
}

function countCardNeeds(cards: string[]): Map<string, number> {
  const needs = new Map<string, number>();
  for (const card of cards) {
    needs.set(card, (needs.get(card) || 0) + 1);
  }
  return needs;
}

/**
 * 计算当前周已持有的总数（核心逻辑 - 按当周的combo计算）
 */
function getWeekHoldCount(combo: WeeklyCombo, backpack: Record<string, number>): number {
  const needs = countCardNeeds(combo.cards);
  let holdCount = 0;
  for (const [card, need] of needs.entries()) {
    const have = backpack[card] || 0;
    holdCount += Math.min(have, need);
  }
  return holdCount;
}

/**
 * V5 新增：计算跨周持有数
 * 用于衡量"进度储备"对其他周的影响
 */
function getCrossWeekHoldCount(otherWeekCombo: WeeklyCombo, backpack: Record<string, number>): number {
  return getWeekHoldCount(otherWeekCombo, backpack);
}

/**
 * 🔑 核心 V4：按周总进度生成系数数组
 *
 * 对于 AAB（totalSlots=3）：
 *   - 持0张（A=0,B=0）→ 系数1.0
 *   - 持1张（A=1或B=1）→ 系数coeff
 *   - 持2张（A=2或A=1+B=1或B=2）→ 系数coeff
 *
 * 对于 CCC（totalSlots=3）：
 *   - 持0张 → 系数1.0
 *   - 持1张 → 系数coeff
 *   - 持2张 → 系数coeff
 *
 * 返回的数组索引 = 已持有的张数（0,1,2...）
 * 但按照原有类型格式，实际需要[1.0, coeff, coeff]
 */
function createProgressCoefficients(
  combo: WeeklyCombo,
  coeff: number
): CardCoefficients {
  const totalSlots = combo.cards.length;  // AAB=3, CCC=3
  const coefficients: CardCoefficients = [1.0]; // 持0张时系数为1

  // 持1张、2张……都使用同一个降权系数
  for (let holdCount = 1; holdCount < totalSlots; holdCount++) {
    coefficients.push(coeff);
  }

  return coefficients;
}

/**
 * 🔑 为模拟生成完整的系数配置
 * 第一周和第二周各自有独立的系数数组
 */
function createFullCoefficients(
  setup: CardSetup,
  week1Coeff: number,
  week2Coeff: number
): { week1: CardCoefficients; week2: CardCoefficients } {
  return {
    week1: createProgressCoefficients(setup.week1, week1Coeff),
    week2: createProgressCoefficients(setup.week2, week2Coeff),
  };
}

/**
 * 🔍 二分搜索找正确系数（V4版本 - 保留备用）
 *
 * 给定一个周配置，二分搜索合适的统一系数
 * 目标：完成率 ≈ targetRate
 */
async function binarySearchCoeff(
  setup: CardSetup,
  week: 'week1' | 'week2',
  targetRate: number,
  onProgress?: (rate: number, coeff: number) => void,
  fixedWeek1Coeff?: CardCoefficients, // 搜索week2时传入（V4：直接传系数数组）
): Promise<{ coeff: number; finalRate: number }> {
  // 根据周确定搜索范围
  const isWeek1 = week === 'week1';
  const weekCombo = isWeek1 ? setup.week1 : setup.week2;

  // 初始搜索范围（经验值）
  let low = isWeek1 ? 0.001 : 0.0001;   // 下限
  let high = isWeek1 ? 0.1 : 0.01;       // 上限

  // 先验证范围是否包含目标（少量trial快速定位）
  // 测试 low
  let coeffsLow = createProgressCoefficients(weekCombo, low);
  let resLow = await simulateWeek(setup, week, coeffsLow, 2000, fixedWeek1Coeff);
  await new Promise(r => setTimeout(r, 0));

  // 测试 high
  let coeffsHigh = createProgressCoefficients(weekCombo, high);
  let resHigh = await simulateWeek(setup, week, coeffsHigh, 2000, fixedWeek1Coeff);
  await new Promise(r => setTimeout(r, 0));

  // 如果范围不对，扩展范围（最多3次）
  let adjustAttempts = 0;
  while (resLow.rate > targetRate && adjustAttempts < 3) {
    low *= 0.5;
    coeffsLow = createProgressCoefficients(weekCombo, low);
    resLow = await simulateWeek(setup, week, coeffsLow, 2000, fixedWeek1Coeff);
    await new Promise(r => setTimeout(r, 0));
    adjustAttempts++;
  }
  adjustAttempts = 0;
  while (resHigh.rate < targetRate && adjustAttempts < 3) {
    high *= 2;
    coeffsHigh = createProgressCoefficients(weekCombo, high);
    resHigh = await simulateWeek(setup, week, coeffsHigh, 2000, fixedWeek1Coeff);
    await new Promise(r => setTimeout(r, 0));
    adjustAttempts++;
  }

  // 二分搜索
  let bestCoeff = (low + high) / 2;
  let bestRate = resLow.rate;
  let bestError = Math.abs(bestRate - targetRate);

  for (let iter = 0; iter < 6; iter++) {
    const mid = (low + high) / 2;
    const coeffsMid = createProgressCoefficients(weekCombo, mid);
    const resMid = await simulateWeek(setup, week, coeffsMid, 4000, fixedWeek1Coeff);

    const error = Math.abs(resMid.rate - targetRate);
    if (error < bestError) {
      bestError = error;
      bestCoeff = mid;
      bestRate = resMid.rate;
    }

    if (onProgress) {
      onProgress(resMid.rate, mid);
    }

    if (resMid.rate > targetRate) {
      // 完成率太高，系数太大，要降低
      high = mid;
    } else {
      // 完成率太低，系数太小，要提高
      low = mid;
    }

    // 让出主线程，避免卡死
    await new Promise(r => setTimeout(r, 0));

    // 如果已经够接近，提前退出
    if (bestError < 0.5) break;
  }

  return { coeff: bestCoeff, finalRate: bestRate };
}

/**
 * 模拟单个周的完成率（分块执行避免阻塞）
 *
 * 注意：搜索week2时需要传入week1Coeffs，否则前7天的降权不生效！
 */
async function simulateWeek(
  setup: CardSetup,
  week: 'week1' | 'week2',
  weekCoeff: CardCoefficients,  // V4: 直接传入一周的系数数组
  trials: number,
  fixedWeek1Coeff?: CardCoefficients, // 搜索week2时传入已固定的week1系数
): Promise<{ rate: number }> {
  const isWeek1 = week === 'week1';
  const weekCombo = isWeek1 ? setup.week1 : setup.week2;
  const deadline = weekCombo.deadline;

  // V4: 使用新的系数格式
  const w1Coeff = isWeek1 ? weekCoeff : (fixedWeek1Coeff || [1.0]);
  const w2Coeff = !isWeek1 ? weekCoeff : [1.0];

  const fullCoeffs = { week1: w1Coeff, week2: w2Coeff };

  let completed = 0;
  const allCards = new Set([...setup.week1.cards, ...setup.week2.cards]);

  // 分块执行，每500次让出一次主线程
  const chunkSize = 500;
  const chunks = Math.ceil(trials / chunkSize);
  const lastChunkSize = trials % chunkSize || chunkSize;

  for (let chunk = 0; chunk < chunks; chunk++) {
    const currentChunkSize = chunk === chunks - 1 ? lastChunkSize : chunkSize;

    for (let t = 0; t < currentChunkSize; t++) {
      const bag: Record<string, number> = {};
      const sched = generateSchedule().slice(0, deadline);
      const luckySet = new Set<string>();

      for (let d = 1; d <= deadline; d++) {
        const dt = sched[d - 1];
        const lc = getLuckyCard(dt, allCards, luckySet);
        for (let i = 0; i < 4; i++) {
          const c = drawOneCard(bag, setup, fullCoeffs, d, dt, lc);
          bag[c] = (bag[c] || 0) + 1;
        }
      }

      if (checkComboComplete(weekCombo, bag)) completed++;
    }

    // 让出主线程，允许UI更新
    if (chunk < chunks - 1) {
      await new Promise(r => setTimeout(r, 0));
    }
  }

  return { rate: (completed / trials) * 100 };
}

function generateSchedule(): Array<'common' | 'rare' | 'magic'> {
  const week = ['common', 'common', 'common', 'common', 'common', 'rare', 'magic'] as Array<'common' | 'rare' | 'magic'>;
  const shuffle = (arr: Array<'common' | 'rare' | 'magic'>) => {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  };
  return [...shuffle(week), ...shuffle(week)];
}

function checkComboComplete(combo: WeeklyCombo, backpack: Record<string, number>): boolean {
  const needs = countCardNeeds(combo.cards);
  for (const [card, need] of needs.entries()) {
    if ((backpack[card] || 0) < need) return false;
  }
  return true;
}

function checkFullCollection(backpack: Record<string, number>): boolean {
  return ALL_CARDS.every(card => (backpack[card] || 0) >= 1);
}

function getLuckyCard(
  dayType: 'common' | 'rare' | 'magic',
  comboCards: Set<string>,
  weekHasLucky: Set<string>
): string | null {
  const typeKey = `${dayType}_lucky`;
  if (weekHasLucky.has(typeKey)) return null;

  let candidates: string[] = [];
  if (dayType === 'magic') {
    candidates = ['A'];
  } else if (dayType === 'rare') {
    const rareCards = ['B', 'C', 'D', 'E'];
    candidates = rareCards.filter(c => comboCards.has(c));
    if (candidates.length === 0) candidates = rareCards;
  } else {
    const commonCards = ['F', 'G', 'H', 'I', 'J'];
    candidates = commonCards.filter(c => comboCards.has(c));
    if (candidates.length === 0) candidates = commonCards;
  }

  if (candidates.length === 0) return null;
  weekHasLucky.add(typeKey);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/**
 * 🎯 V5 抽卡逻辑：跨周关联降权
 *
 * 核心改进：
 * 1. 当周卡：根据当周持有数 × 当周系数
 * 2. 跨周卡：根据跨周持有数 × 跨周系数（另一周的系数）
 * 3. 其他卡：基础概率
 *
 * 这样：
 * - 第一周存储大量C → 第二周C初始降权，但第一周A/B也降权
 * - 第二周开始时，如果玩家前7天拿到很多C，第二周C的降权会更大
 * - 第一周时A/B被降权，C也被降权（如果已有储备）
 *
 * 最终效果：两周互相压制，避免第二周70%的极端情况
 */
function drawOneCard(
  backpack: Record<string, number>,
  setup: CardSetup,
  coefficients: { week1: CardCoefficients; week2: CardCoefficients },
  day: number,
  dayType: 'common' | 'rare' | 'magic',
  luckyCard: string | null
): string {
  const isWeek1 = day <= 7;
  const currentCombo = isWeek1 ? setup.week1 : setup.week2;
  const crossCombo = isWeek1 ? setup.week2 : setup.week1; // 另一周
  const weekCoeffs = isWeek1 ? coefficients.week1 : coefficients.week2;
  const crossCoeffs = isWeek1 ? coefficients.week2 : coefficients.week1; // 另一周系数

  // 计算各项持有数
  const weekHoldCount = getWeekHoldCount(currentCombo, backpack);
  const crossHoldCount = getCrossWeekHoldCount(crossCombo, backpack);

  // 获取系数索引（限制在数组范围内）
  const weekCoeffIndex = Math.min(weekHoldCount, weekCoeffs.length - 1);
  const crossCoeffIndex = Math.min(crossHoldCount, crossCoeffs.length - 1);
  const weekCoeff = weekCoeffs[weekCoeffIndex];
  const crossCoeff = crossCoeffs[crossCoeffIndex];

  // 基础概率
  const rawProbs: Record<string, number> = {};
  for (const card of ALL_CARDS) {
    rawProbs[card] = getBaseProb(card);
  }

  // V5 应用跨周关联降权
  const weightedProbs: Record<string, number> = {};
  for (const card of ALL_CARDS) {
    const isInCurrentWeek = currentCombo.cards.includes(card);
    const isInCrossWeek = crossCombo.cards.includes(card);

    if (isInCurrentWeek) {
      // 当周卡：使用当周系数
      weightedProbs[card] = rawProbs[card] * weekCoeff;
    } else if (isInCrossWeek) {
      // 跨周卡：使用跨周系数（V5关键！）
      weightedProbs[card] = rawProbs[card] * crossCoeff;
    } else {
      // 其他卡：基础概率
      weightedProbs[card] = rawProbs[card];
    }
  }

  // 归一化
  const total = Object.values(weightedProbs).reduce((a, b) => a + b, 0);
  if (total <= 0) return 'A';

  const normalized: Record<string, number> = {};
  for (const card of ALL_CARDS) {
    normalized[card] = (weightedProbs[card] / total) * 100;
  }

  // 轮盘赌
  let r = Math.random() * 100;
  for (const card of ALL_CARDS) {
    r -= normalized[card];
    if (r <= 0) return card;
  }
  return 'A';
}


export interface SolverResult {
  // V4: 系数改为按周存储的数组，不是按卡存储的对象
  coefficients: { week1: CardCoefficients; week2: CardCoefficients };
  week1Rate: number;
  week2Rate: number;
  fullCollectionRate: number;
  converged: boolean;
  iterations: number;
  finalError: number;
}

/**
 * 主入口 V5：网格搜索找正确系数（跨周关联版）
 *
 * V5改进：
 * 1. 网格更细，范围更广（0.1~1.0 + 0.01~0.1）
 * 2. 两层搜索：粗网格 + 细网格在最佳附近
 * 3. 跨周关联让系数影响更平滑
 */
export async function solveCoefficientsAsync(
  setup: CardSetup,
  _targetRate: number = 4.0,
  onProgress?: (progress: SolverProgress) => void
): Promise<SolverResult> {
  // V5: 跨周关联后，系数概率调为更宽范围（线性影响而非指数）
  const w2CoeffArray = createProgressCoefficients(setup.week2, 0.5); // 占位

  // ========== 搜索第一周系数（粗）==========
  // 更宽的网格：0.05, 0.1, 0.2, 0.3, 0.5, 0.7, 1.0（跨周关联后需要更高系数）
  const coarseGrid = [0.02, 0.05, 0.08, 0.1, 0.15, 0.2, 0.3, 0.5, 0.7, 1.0];
  let w1BestCoeff = 0.1;
  let w1BestRate = 0;
  let w1BestError = 100;

  for (let i = 0; i < coarseGrid.length; i++) {
    const coeff = coarseGrid[i];
    const testW1Coeffs = createProgressCoefficients(setup.week1, coeff);
    const res = await simulateBothWeeks(setup, testW1Coeffs, w2CoeffArray, 2000);

    const error = Math.abs(res.week1Rate - 4);
    if (error < w1BestError) {
      w1BestError = error;
      w1BestCoeff = coeff;
      w1BestRate = res.week1Rate;
    }

    if (onProgress) {
      onProgress({
        iteration: 1 + i / coarseGrid.length,
        totalIterations: 4,
        week1Rate: res.week1Rate,
        week2Rate: 0,
        error: error,
        isConverged: false,
      });
    }
  }

  // ========== 搜索第一周系数（细）==========
  // 在最佳值附近精细搜索 ±0.03，步长0.005
  const w1Low = Math.max(0.01, w1BestCoeff - 0.03);
  const w1High = Math.min(1.0, w1BestCoeff + 0.03);
  const w1FineSteps = 12;

  for (let i = 0; i <= w1FineSteps; i++) {
    const coeff = w1Low + (w1High - w1Low) * i / w1FineSteps;
    const testW1Coeffs = createProgressCoefficients(setup.week1, coeff);
    const res = await simulateBothWeeks(setup, testW1Coeffs, w2CoeffArray, 3000);

    const error = Math.abs(res.week1Rate - 4);
    if (error < w1BestError) {
      w1BestError = error;
      w1BestCoeff = coeff;
      w1BestRate = res.week1Rate;
    }

    if (onProgress) {
      onProgress({
        iteration: 2 + i / w1FineSteps,
        totalIterations: 4,
        week1Rate: res.week1Rate,
        week2Rate: 0,
        error: error,
        isConverged: false,
      });
    }
  }

  // ========== 搜索第二周系数（粗）==========
  const w1FinalCoeffs = createProgressCoefficients(setup.week1, w1BestCoeff);
  let w2BestCoeff = 0.1;
  let w2BestRate = 0;
  let w2BestError = 100;

  for (let i = 0; i < coarseGrid.length; i++) {
    const coeff = coarseGrid[i];
    const testW2Coeffs = createProgressCoefficients(setup.week2, coeff);
    const res = await simulateBothWeeks(setup, w1FinalCoeffs, testW2Coeffs, 2000);

    const error = Math.abs(res.week2Rate - 4);
    if (error < w2BestError) {
      w2BestError = error;
      w2BestCoeff = coeff;
      w2BestRate = res.week2Rate;
    }

    if (onProgress) {
      onProgress({
        iteration: 2.5 + i / coarseGrid.length,
        totalIterations: 4,
        week1Rate: w1BestRate,
        week2Rate: res.week2Rate,
        error: (w1BestError + error),
        isConverged: false,
      });
    }
  }

  // ========== 搜索第二周系数（细）==========
  const w2Low = Math.max(0.01, w2BestCoeff - 0.03);
  const w2High = Math.min(1.0, w2BestCoeff + 0.03);
  const w2FineSteps = 12;

  for (let i = 0; i <= w2FineSteps; i++) {
    const coeff = w2Low + (w2High - w2Low) * i / w2FineSteps;
    const testW2Coeffs = createProgressCoefficients(setup.week2, coeff);
    const res = await simulateBothWeeks(setup, w1FinalCoeffs, testW2Coeffs, 3000);

    const error = Math.abs(res.week2Rate - 4);
    if (error < w2BestError) {
      w2BestError = error;
      w2BestCoeff = coeff;
      w2BestRate = res.week2Rate;
    }

    if (onProgress) {
      onProgress({
        iteration: 3 + i / w2FineSteps,
        totalIterations: 4,
        week1Rate: w1BestRate,
        week2Rate: res.week2Rate,
        error: (w1BestError + error),
        isConverged: false,
      });
    }
  }



  if (onProgress) {
    onProgress({
      iteration: 4,
      totalIterations: 4,
      week1Rate: w1BestRate,
      week2Rate: w2BestRate,
      error: w2BestError,
      isConverged: false,
    });
  }

  // ========== 最终结果 ==========
  const finalW1Coeffs = createProgressCoefficients(setup.week1, w1BestCoeff);
  const finalW2Coeffs = createProgressCoefficients(setup.week2, w2BestCoeff);
  const final = await simulateBothWeeks(setup, finalW1Coeffs, finalW2Coeffs, 12000);

  return {
    coefficients: { week1: finalW1Coeffs, week2: finalW2Coeffs },
    week1Rate: final.week1Rate,
    week2Rate: final.week2Rate,
    fullCollectionRate: final.fullCollectionRate,
    converged: (w1BestError < 0.5 && w2BestError < 0.5),
    iterations: 48,  // 10 + 13 + 10 + 13 + 2 (最终验证)
    finalError: Math.abs(final.week1Rate - 4) + Math.abs(final.week2Rate - 4),
  };
}

/**
 * 模拟两周的完整游戏（用于最终验证，分块执行）
 */
async function simulateBothWeeks(
  setup: CardSetup,
  w1Coeff: CardCoefficients,  // V4: 直接传入系数数组
  w2Coeff: CardCoefficients,
  trials: number
): Promise<{ week1Rate: number; week2Rate: number; fullCollectionRate: number }> {
  let w1 = 0, w2 = 0, fc = 0;
  const allCards = new Set([...setup.week1.cards, ...setup.week2.cards]);

  // V4: 直接传递系数数组
  const fullCoeffs = { week1: w1Coeff, week2: w2Coeff };

  // 分块执行，每500次让出一次主线程
  const chunkSize = 500;
  const chunks = Math.ceil(trials / chunkSize);
  const lastChunkSize = trials % chunkSize || chunkSize;

  for (let chunk = 0; chunk < chunks; chunk++) {
    const currentChunkSize = chunk === chunks - 1 ? lastChunkSize : chunkSize;

    for (let t = 0; t < currentChunkSize; t++) {
      // Week 1 simulation (7 days)
      const bag1: Record<string, number> = {};
      const sched1 = generateSchedule().slice(0, 7);
      const lucky1 = new Set<string>();
      for (let d = 1; d <= 7; d++) {
        const dt = sched1[d - 1];
        const lc = getLuckyCard(dt, allCards, lucky1);
        for (let i = 0; i < 4; i++) {
          const c = drawOneCard(bag1, setup, fullCoeffs, d, dt, lc);
          bag1[c] = (bag1[c] || 0) + 1;
        }
      }
      if (checkComboComplete(setup.week1, bag1)) w1++;

      // Full 2 weeks simulation (14 days)
      const bag2: Record<string, number> = {};
      const sched2 = generateSchedule();
      const lucky2a = new Set<string>(), lucky2b = new Set<string>();
      for (let d = 1; d <= 14; d++) {
        const dt = sched2[d - 1];
        const lc = getLuckyCard(dt, allCards, d <= 7 ? lucky2a : lucky2b);
        for (let i = 0; i < 4; i++) {
          const c = drawOneCard(bag2, setup, fullCoeffs, d, dt, lc);
          bag2[c] = (bag2[c] || 0) + 1;
        }
      }
      if (checkComboComplete(setup.week2, bag2)) w2++;
      if (checkFullCollection(bag2)) fc++;
    }

    // 让出主线程
    if (chunk < chunks - 1) {
      await new Promise(r => setTimeout(r, 0));
    }
  }

  return {
    week1Rate: (w1 / trials) * 100,
    week2Rate: (w2 / trials) * 100,
    fullCollectionRate: (fc / trials) * 100,
  };
}

// V4: 扩展 CoefficientResult 类型以支持按周总进度的显示
export function generateCoefficientReport(
  solverResult: SolverResult,
  setup: CardSetup
): CoefficientResult {
  // V4: 生成按卡显示的系数（用于UI兼容）
  // 第一周所有卡显示相同的系数数组
  const week1CardCoeffs: Record<string, CardCoefficients> = {};
  for (const card of ALL_CARDS) {
    // 属于第一周的卡：显示完整系数数组
    if (setup.week1.cards.includes(card)) {
      week1CardCoeffs[card] = solverResult.coefficients.week1;
    } else {
      // 不属于的：显示只有1.0的数组（表示不降权）
      week1CardCoeffs[card] = [1.0];
    }
  }

  // 第二周同理
  const week2CardCoeffs: Record<string, CardCoefficients> = {};
  for (const card of ALL_CARDS) {
    if (setup.week2.cards.includes(card)) {
      week2CardCoeffs[card] = solverResult.coefficients.week2;
    } else {
      week2CardCoeffs[card] = [1.0];
    }
  }

  return {
    week1: week1CardCoeffs,
    week2: week2CardCoeffs,
    actualRates: {
      week1: solverResult.week1Rate,
      week2: solverResult.week2Rate,
    },
    fullCollectionRate: solverResult.fullCollectionRate,
    converged: solverResult.converged,
    iterations: solverResult.iterations,
    finalError: solverResult.finalError,
  };
}
