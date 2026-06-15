/**
 * 降权系数求解器（可变卡组版）
 * 支持：每套3-5张卡，每套有对应的缺卡系数
 */

import type { CardSetup, Combination, CoefficientResult } from '@/types';

const ALL_CARDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const OTHER_CARDS = ['E', 'F', 'G', 'H', 'I', 'J'];

// 卡片类型映射
function getCardType(card: string): 'common' | 'rare' | 'magic' {
  if (card === 'A') return 'magic';
  if (['B', 'C', 'D', 'E'].includes(card)) return 'rare';
  return 'common';
}

// 单日概率转换
function singleToDay(p: number): number {
  if (p >= 1.0) return 1.0;
  if (p <= 0.0) return 0.0;
  return 1.0 - Math.pow(1.0 - p, 4.0);
}

// 基础概率配置
const SINGLE_PROBS: Record<string, number> = {
  'common_normal': 0.1608, 'common_lucky': 0.0120, 'common_rare_day': 0.1487, 'common_magic_day': 0.0120,
  'rare_normal': 0.0744, 'rare_lucky': 0.0120, 'rare_common_day': 0.0804, 'rare_magic_day': 0.0706,
  'magic_normal': 0.0000, 'magic_lucky': 0.0120, 'magic_common_day': 0.0230, 'magic_rare_day': 0.0212,
};

const FAST_COMBO: Array<[string, string, number]> = [
  ['common', 'common', 0.22], ['common', 'rare', 0.22],
  ['rare', 'common', 0.22], ['rare', 'rare', 0.13],
];

function getSingleP(cardType: 'common' | 'rare' | 'magic', dayType: 'common' | 'rare' | 'magic', isLucky: boolean): number {
  if (cardType === 'common') {
    if (dayType === 'common') return SINGLE_PROBS[isLucky ? 'common_lucky' : 'common_normal'];
    if (dayType === 'rare') return SINGLE_PROBS['common_rare_day'];
    if (dayType === 'magic') return SINGLE_PROBS['common_magic_day'];
  } else if (cardType === 'rare') {
    if (dayType === 'rare') return SINGLE_PROBS[isLucky ? 'rare_lucky' : 'rare_normal'];
    if (dayType === 'common') return SINGLE_PROBS['rare_common_day'];
    if (dayType === 'magic') return SINGLE_PROBS['rare_magic_day'];
  } else if (cardType === 'magic') {
    if (dayType === 'magic') return SINGLE_PROBS[isLucky ? 'magic_lucky' : 'magic_normal'];
    if (dayType === 'common') return SINGLE_PROBS['magic_common_day'];
    if (dayType === 'rare') return SINGLE_PROBS['magic_rare_day'];
  }
  return 0.0;
}

// 计算组合总需求张数
function getComboTotalNeed(combo: Combination): number {
  return combo.requirements.reduce((sum, r) => sum + r.count, 0);
}

// 计算组合缺几张
function calculateMissingCount(combo: Combination, bag: Record<string, number>): number {
  let stillNeeded = 0;
  for (const req of combo.requirements) {
    const current = bag[req.cardId] || 0;
    stillNeeded += Math.max(0, req.count - current);
  }
  return stillNeeded;
}

// 组合系数：键为 missingN，值为系数
interface ComboCoefficients {
  [key: string]: number;
}

interface SolverResult {
  comboCoeffs: Record<string, ComboCoefficients>;
  combinationRates: Record<string, number>;
  fullCollectionRate: number;
  converged: boolean;
  error: number;
}

/**
 * 获取缺卡状态对应的系数
 */
function getCoeffForMissing(coeffs: ComboCoefficients, missing: number): number {
  // 优先找对应的 missingN
  const key = `missing${missing}`;
  if (coeffs[key] !== undefined) return coeffs[key];

  // 如果没有精确匹配，找最接近的
  const keys = Object.keys(coeffs)
    .filter(k => k.startsWith('missing'))
    .map(k => parseInt(k.replace('missing', '')))
    .sort((a, b) => b - a); // 从大到小排序

  for (const k of keys) {
    if (k <= missing) return coeffs[`missing${k}`];
  }

  return 1.0; // 默认100%
}

// 搜索范围：更严格的范围（1%-15%）
const COEFF_RANGES = [0.005, 0.008, 0.01, 0.015, 0.02, 0.03, 0.05, 0.08, 0.12, 0.15];

/**
 * 生成所有系数组合
 * 原则：缺卡越少，系数越严格（越小）
 * 例如3张卡：缺3=100%，缺2=10%，缺1=2%
 */
function* generateCoeffCombos(totalNeed: number): Generator<ComboCoefficients> {
  const variableLevels = totalNeed - 1;

  if (variableLevels <= 0) {
    yield { [`missing${totalNeed}`]: 1.0 };
    return;
  }

  for (const baseCoeff of COEFF_RANGES) {
    const coeffs: ComboCoefficients = {};
    coeffs[`missing${totalNeed}`] = 1.0; // 缺最多时100%

    // 缺卡越少，系数越小（更严格）
    for (let i = totalNeed - 1; i >= 1; i--) {
      // 指数递减：缺卡越少，系数越接近于0
      const level = totalNeed - i; // 1, 2, ...
      coeffs[`missing${i}`] = baseCoeff * Math.pow(0.4, level - 1);
    }
    yield coeffs;
  }
}

/**
 * 求解降权系数 - 可变卡组版
 */
export function solveCoefficients(
  setup: CardSetup,
  targetRate: number = 4.0,
  trials: number = 200
): SolverResult {

  if (setup.combinations.length < 2) {
    return { comboCoeffs: {}, combinationRates: {}, fullCollectionRate: 0, converged: false, error: 999 };
  }

  const [combo1, combo2] = setup.combinations;
  const totalNeed1 = getComboTotalNeed(combo1);
  const totalNeed2 = getComboTotalNeed(combo2);

  let bestResult: SolverResult | null = null;
  let minError = Infinity;

  // 网格搜索：每套独立选择系数
  for (const coeffs1 of generateCoeffCombos(totalNeed1)) {
    for (const coeffs2 of generateCoeffCombos(totalNeed2)) {
      const rates = runFastSim(combo1, combo2, coeffs1, coeffs2, trials);
      const error = Math.abs(rates[0] - targetRate) + Math.abs(rates[1] - targetRate);

      if (error < minError) {
        minError = error;
        bestResult = {
          comboCoeffs: { [combo1.name]: coeffs1, [combo2.name]: coeffs2 },
          combinationRates: { [combo1.name]: rates[0], [combo2.name]: rates[1] },
          fullCollectionRate: 0,
          converged: error < 0.5,
          error,
        };
      }
      if (minError < 0.3) break;
    }
    if (minError < 0.3) break;
  }

  // 计算全收集率
  if (bestResult) {
    bestResult.fullCollectionRate = calculateFullCollectionRate(
      combo1, combo2,
      bestResult.comboCoeffs[combo1.name],
      bestResult.comboCoeffs[combo2.name],
      500
    );
  }

  // 生成默认系数
  const defaultCoeffs1: ComboCoefficients = {};
  for (let i = totalNeed1; i >= 1; i--) {
    defaultCoeffs1[`missing${i}`] = i === totalNeed1 ? 1.0 : 0.03;
  }
  const defaultCoeffs2: ComboCoefficients = {};
  for (let i = totalNeed2; i >= 1; i--) {
    defaultCoeffs2[`missing${i}`] = i === totalNeed2 ? 1.0 : 0.015;
  }

  return bestResult || {
    comboCoeffs: { [combo1.name]: defaultCoeffs1, [combo2.name]: defaultCoeffs2 },
    combinationRates: {},
    fullCollectionRate: 0,
    converged: false,
    error: minError,
  };
}

/**
 * 快速模拟
 */
function runFastSim(
  combo1: Combination,
  combo2: Combination,
  coeffs1: ComboCoefficients,
  coeffs2: ComboCoefficients,
  trials: number
): [number, number] {
  let w1Sum = 0, w2Sum = 0;
  let totalWeight = 0;

  // 设置卡片需求数量
  setCardNeeds(combo1);
  setCardNeeds(combo2);

  const combo1Cards = combo1.requirements.map(r => r.cardId);
  const combo2Cards = combo2.requirements.map(r => r.cardId);
  const aType = getCardType(combo1Cards[0]);
  const cType = getCardType(combo2Cards[0]);

  for (const [at, ct, weight] of FAST_COMBO) {
    let s1 = 0, s2 = 0;

    for (let t = 0; t < trials; t++) {
      const days = generateRandomSchedule();
      const bag: Record<string, number> = {};
      const luckyA = [0, 0], luckyC = [0, 0];

      // 第一周
      for (let day = 0; day < 7; day++) {
        const dayType = days[day];
        const week = 0;
        const isALucky = (dayType === at && luckyA[week] === 0);
        if (isALucky) luckyA[week] = 1;
        const isCLucky = (dayType === ct && luckyC[week] === 0);
        if (isCLucky) luckyC[week] = 1;

        const m1 = calculateMissingCount(combo1, bag);
        const m2 = calculateMissingCount(combo2, bag);
        const coeff1 = getCoeffForMissing(coeffs1, m1);
        const coeff2 = getCoeffForMissing(coeffs2, m2);

        drawCards(combo1Cards, aType, dayType, isALucky, coeff1, bag);
        drawCards(combo2Cards, cType, dayType, isCLucky, coeff2, bag);
      }
      if (calculateMissingCount(combo1, bag) === 0) s1++;

      // 第二周
      for (let day = 7; day < 14; day++) {
        const dayType = days[day];
        const week = 1;
        const isALucky = (dayType === at && luckyA[week] === 0);
        if (isALucky) luckyA[week] = 1;
        const isCLucky = (dayType === ct && luckyC[week] === 0);
        if (isCLucky) luckyC[week] = 1;

        const m2 = calculateMissingCount(combo2, bag);
        // 第二周：第一套恢复正常概率(100%)，第二套用系数
        const coeff1 = 1.0;
        const coeff2 = getCoeffForMissing(coeffs2, m2);

        drawCards(combo1Cards, aType, dayType, isALucky, coeff1, bag);
        drawCards(combo2Cards, cType, dayType, isCLucky, coeff2, bag);
      }
      if (calculateMissingCount(combo2, bag) === 0) s2++;
    }

    w1Sum += (s1 / trials) * weight;
    w2Sum += (s2 / trials) * weight;
    totalWeight += weight;
  }

  return [(w1Sum / totalWeight) * 100, (w2Sum / totalWeight) * 100];
}

function generateRandomSchedule(): string[] {
  const week1 = ['common', 'common', 'common', 'common', 'common', 'rare', 'magic'];
  const week2 = ['common', 'common', 'common', 'common', 'common', 'rare', 'magic'];
  shuffleArray(week1);
  shuffleArray(week2);
  return [...week1, ...week2];
}

// 需求数量映射
const cardNeeds: Record<string, number> = {};

function setCardNeeds(combo: Combination) {
  for (const req of combo.requirements) {
    cardNeeds[req.cardId] = req.count;
  }
}

function drawCards(cards: string[], cardType: any, dayType: any, isLucky: boolean, coeff: number, bag: Record<string, number>) {
  for (const card of cards) {
    let p = getSingleP(cardType, dayType, isLucky);
    const need = cardNeeds[card] || 1;
    // 只卡超需求：已达到需求数量后应用降权
    if (bag[card] >= need) p *= coeff;
    if (Math.random() < singleToDay(p)) {
      bag[card] = (bag[card] || 0) + 1;
    }
  }
}

function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

/**
 * 计算10张卡集齐率
 */
function calculateFullCollectionRate(
  combo1: Combination,
  combo2: Combination,
  coeffs1: ComboCoefficients,
  coeffs2: ComboCoefficients,
  trials: number
): number {
  // 设置卡片需求数量
  setCardNeeds(combo1);
  setCardNeeds(combo2);

  const combo1Cards = combo1.requirements.map(r => r.cardId);
  const combo2Cards = combo2.requirements.map(r => r.cardId);
  const aType = getCardType(combo1Cards[0]);
  const cType = getCardType(combo2Cards[0]);

  let successCount = 0;

  for (let t = 0; t < trials; t++) {
    const bag: Record<string, number> = Object.fromEntries(ALL_CARDS.map(c => [c, 0]));
    const luckyA = [0, 0], luckyC = [0, 0];
    const days = generateRandomSchedule();

    for (let day = 0; day < 14; day++) {
      const dayType = days[day] as any;
      const week = day < 7 ? 0 : 1;

      const isALucky = (dayType === aType && luckyA[week] === 0);
      if (isALucky) luckyA[week] = 1;
      const isCLucky = (dayType === cType && luckyC[week] === 0);
      if (isCLucky) luckyC[week] = 1;

      const m1 = calculateMissingCount(combo1, bag);
      const m2 = calculateMissingCount(combo2, bag);
      const coeff1 = m1 > 0 ? getCoeffForMissing(coeffs1, m1) : 0.001;
      const coeff2 = m2 > 0 ? getCoeffForMissing(coeffs2, m2) : 0.001;

      // 基础概率
      const pRaw: Record<string, number> = {};
      for (const card of ALL_CARDS) {
        const ct = combo1Cards.includes(card) ? aType :
                   combo2Cards.includes(card) ? cType : 'common';
        const isLucky = combo1Cards.includes(card) ? isALucky :
                       combo2Cards.includes(card) ? isCLucky : false;
        pRaw[card] = getSingleP(ct, dayType, isLucky);
      }

      // 应用降权：达到需求数量后才降权
      const pS = { ...pRaw };
      for (const card of combo1Cards) {
        const need = cardNeeds[card] || 1;
        if (bag[card] >= need) pS[card] *= coeff1;
      }
      for (const card of combo2Cards) {
        const need = cardNeeds[card] || 1;
        if (bag[card] >= need) pS[card] *= coeff2;
      }

      // 轮盘赌
      const w: Record<string, number> = {};
      for (const card of ALL_CARDS) {
        w[card] = singleToDay(pS[card]);
      }
      const wRawSum = ALL_CARDS.reduce((sum, c) => sum + singleToDay(pRaw[c]), 0);
      const wOthers = Math.max(0, 1.0 - wRawSum);
      const total = Object.values(w).reduce((a, b) => a + b, 0) + wOthers;

      const r = Math.random() * total;
      let cumsum = 0;
      for (const card of ALL_CARDS) {
        cumsum += w[card];
        if (r < cumsum) {
          bag[card]++;
          break;
        }
      }
    }

    if (ALL_CARDS.every(c => bag[c] >= 1)) successCount++;
  }

  return (successCount / trials) * 100;
}

/**
 * 生成报告
 */
export function generateCoefficientReport(
  setup: CardSetup,
  solverResult: SolverResult
): CoefficientResult {
  const { comboCoeffs, combinationRates, fullCollectionRate } = solverResult;

  const byMissingCount: Record<string, any> = {};
  const allCoefficients: Record<string, number> = {};

  for (const combo of setup.combinations) {
    const coeffs = comboCoeffs[combo.name] || {};
    const cards = combo.requirements.map(r => r.cardId);

    for (const [key, value] of Object.entries(coeffs)) {
      if (!byMissingCount[key]) byMissingCount[key] = {};
      for (const card of cards) {
        byMissingCount[key][card] = value;
      }
    }

    // allCoefficients 用缺1张的系数作为代表
    for (const card of cards) {
      allCoefficients[card] = coeffs['missing1'] || 0.02;
    }
  }

  return {
    byMissingCount,
    allCoefficients,
    comboCoeffs,
    combinationRates,
    fullCollectionRate,
    converged: solverResult.converged,
    error: solverResult.error,
  };
}

export type { SolverResult };
export { ALL_CARDS };
