/**
 * Zustand 全局状态管理
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { AppState, CardCombination, ProbabilityCase, ProbabilityCalculationResult, SimulationResult } from '@/types';
import {
  DEFAULT_BASE_PROB_TABLE,
  DEFAULT_COEFFICIENT_TABLE,
  createDefaultCase,
} from '@/constants';

export const useStore = create<AppState>()(
  devtools(
    persist(
      (set) => ({
        // ===== 卡面选择页状态 =====
        selectedCombination: null,
        simulationResult: null,
        isSimulating: false,
        simulationProgress: 0,

        // ===== 概率配置页状态 =====
        baseProbTable: { ...DEFAULT_BASE_PROB_TABLE },
        coefficientTable: JSON.parse(JSON.stringify(DEFAULT_COEFFICIENT_TABLE)),
        currentCase: createDefaultCase(),
        calculationResult: null,

        // ===== Actions =====
        setSelectedCombination: (combination: CardCombination) =>
          set({ selectedCombination: combination }),

        setSimulationResult: (result: SimulationResult) =>
          set({ simulationResult: result }),

        setIsSimulating: (isSimulating: boolean) =>
          set({ isSimulating }),

        setSimulationProgress: (progress: number) =>
          set({ simulationProgress: progress }),

        updateBaseProb: (cardId: string, prob: number) =>
          set((state) => ({
            baseProbTable: { ...state.baseProbTable, [cardId]: prob },
          })),

        updateCoefficient: (cardId: string, holdCount: number, coefficient: number) =>
          set((state) => {
            const newTable = JSON.parse(JSON.stringify(state.coefficientTable));
            if (!newTable[cardId]) {
              newTable[cardId] = [1.0, 0, 0];
            }
            newTable[cardId][holdCount] = coefficient;
            return { coefficientTable: newTable };
          }),

        setCurrentCase: (caseData: ProbabilityCase) =>
          set({ currentCase: caseData }),

        setCalculationResult: (result: ProbabilityCalculationResult) =>
          set({ calculationResult: result }),

        resetToDefault: () =>
          set({
            baseProbTable: { ...DEFAULT_BASE_PROB_TABLE },
            coefficientTable: JSON.parse(JSON.stringify(DEFAULT_COEFFICIENT_TABLE)),
            currentCase: createDefaultCase(),
            selectedCombination: null,
            simulationResult: null,
            calculationResult: null,
            isSimulating: false,
            simulationProgress: 0,
          }),
      }),
      {
        name: 'magic-species-probability-storage',
        partialize: (state) => ({
          baseProbTable: state.baseProbTable,
          coefficientTable: state.coefficientTable,
        }),
      }
    )
  )
);
