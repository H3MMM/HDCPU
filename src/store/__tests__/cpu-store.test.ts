import { Stage } from '../../types';
import { createCPUStore } from '../cpu-store';

describe('cpu-store', () => {
  it('starts with a loaded config and default source program', () => {
    const store = createCPUStore();
    const state = store.getState();

    expect(state.stage).toBe(Stage.IF);
    expect(state.datapathConfig.components.length).toBeGreaterThan(0);
    expect(state.sourceCode).toContain('addi x1, x0, 5');
  });

  it('advances a single cycle through the stage pipeline', () => {
    const store = createCPUStore();

    store.getState().stepCycle();

    const state = store.getState();
    expect(state.stage).toBe(Stage.ID);
    expect(state.cycleCount).toBe(1);
    expect(state.instructionCount).toBe(0);
  });

  it('advances a full instruction and resets cleanly', () => {
    const store = createCPUStore();

    store.getState().stepInstruction();
    let state = store.getState();
    expect(state.stage).toBe(Stage.IF);
    expect(state.cycleCount).toBe(5);
    expect(state.instructionCount).toBe(1);

    store.getState().reset();
    state = store.getState();
    expect(state.stage).toBe(Stage.IF);
    expect(state.cycleCount).toBe(0);
    expect(state.instructionCount).toBe(0);
    expect(state.runStatus).toBe('idle');
  });
});
