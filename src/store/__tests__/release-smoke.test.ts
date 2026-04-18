import { describe, expect, it } from 'vitest';
import { EXAMPLE_PROGRAMS } from '../../content/example-programs';
import { createCPUStore } from '../cpu-store';

describe('release smoke', () => {
  it('executes every bundled example end-to-end without blocking assembly errors', () => {
    EXAMPLE_PROGRAMS.forEach((program) => {
      const store = createCPUStore();
      store.getState().setSourceCode(program.source);

      let state = store.getState();
      expect(state.assembleErrors, program.id).toEqual([]);

      let guard = 0;
      while (
        state.currentInstruction !== null &&
        guard < 320
      ) {
        store.getState().stepCycle();
        state = store.getState();
        guard += 1;
      }

      expect(guard, `${program.id} exceeded cycle budget`).toBeLessThan(320);
      expect(state.assembleErrors, `${program.id} should stay assembly-clean`).toEqual([]);
      expect(state.currentInstruction, `${program.id} should finish execution`).toBeNull();
      expect(state.cycleCount, `${program.id} should advance at least one cycle`).toBeGreaterThan(0);
    });
  });
});
