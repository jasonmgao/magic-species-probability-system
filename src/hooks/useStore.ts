/**
 * Zustand 全局状态管理（简化版）
 */

import { create } from 'zustand';
import type { CoefficientConfig } from '@/types';

export interface AppState {
  // 降权系数配置
  coefficientConfig: CoefficientConfig;

  // Actions
  setCoefficientA: (value: number) => void;
  setCoefficientC: (value: number) => void;
  resetCoefficients: () => void;
}

const DEFAULT_COEFFICIENT: CoefficientConfig = {
  A: 0.02,
  C: 0.008,
};

export const useStore = create<AppState>()((set) => ({
  coefficientConfig: { ...DEFAULT_COEFFICIENT },

  setCoefficientA: (value: number) =>
    set((state) => ({
      coefficientConfig: { ...state.coefficientConfig, A: value },
    })),

  setCoefficientC: (value: number) =>
    set((state) => ({
      coefficientConfig: { ...state.coefficientConfig, C: value },
    })),

  resetCoefficients: () =>
    set({
      coefficientConfig: { ...DEFAULT_COEFFICIENT },
    }),
}));
