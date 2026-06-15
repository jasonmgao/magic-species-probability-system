/**
 * Web Worker for simulation
 */

import { runFullSimulation } from '../services/simulationEngine';
import type { CombinationRequirement } from '../types';

// Worker context
const ctx = self as unknown as Worker;

ctx.onmessage = (event) => {
  const { combinations, trials } = event.data;

  try {
    const result = runFullSimulation(
      combinations,
      trials,
      (state, stateResult) => {
        // 发送每个状态的中间结果
        ctx.postMessage({
          type: 'stateComplete',
          state,
          result: stateResult,
        });
      }
    );

    // 发送最终结果
    ctx.postMessage({
      type: 'complete',
      result,
    });
  } catch (error) {
    ctx.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export {};
