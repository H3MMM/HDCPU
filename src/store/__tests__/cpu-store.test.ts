import { Stage } from '../../types';
import { createCPUStore } from '../cpu-store';

describe('cpu-store', () => {
  it('starts with a loaded config and default source program', () => {
    const store = createCPUStore();
    const state = store.getState();

    expect(state.stage).toBe(Stage.IF);
    expect(state.datapathConfig.components.length).toBeGreaterThan(0);
    expect(state.sourceCode).toContain('addi x1, x0, 5');
    expect(state.registerDisplayFormat).toBe('hex');
    expect(state.memoryViewStartAddress).toBe(0x40);
  });

  it('advances a single cycle through the stage pipeline', () => {
    const store = createCPUStore();

    store.getState().stepCycle();

    const state = store.getState();
    expect(state.stage).toBe(Stage.ID);
    expect(state.cycleCount).toBe(1);
    expect(state.instructionCount).toBe(0);
  });

  it('updates register display mode and jumps memory windows by aligned rows', () => {
    const store = createCPUStore();

    store.getState().setRegisterDisplayFormat('dec');
    store.getState().jumpToMemoryAddress(0x53);

    const state = store.getState();
    expect(state.registerDisplayFormat).toBe('dec');
    expect(state.memoryViewStartAddress).toBe(0x50);
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

  it('fills the placeholder register and memory views as instructions complete', () => {
    const store = createCPUStore();

    for (let index = 0; index < 5; index++) {
      store.getState().stepInstruction();
    }

    const state = store.getState();

    expect(state.registers[1]).toBe(5);
    expect(state.registers[2]).toBe(9);
    expect(state.registers[3]).toBe(14);
    expect(state.registers[4]).toBe(14);
    expect(state.memoryBytes[0x40]).toBe(0x0e);
    expect(state.memoryBytes[0x44]).toBe(0x0e);
  });
});
