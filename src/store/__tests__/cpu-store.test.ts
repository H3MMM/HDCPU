import { ImmType, Stage } from '../../types';
import { createCPUStore } from '../cpu-store';

describe('cpu-store', () => {
  it('starts with a loaded config, engine-backed snapshot state, and a preview of the first instruction', () => {
    const store = createCPUStore();
    const state = store.getState();

    expect(state.stage).toBe(Stage.IF);
    expect(state.currentSnapshot.stage).toBe(Stage.IF);
    expect(state.datapathConfig.components.length).toBeGreaterThan(0);
    expect(state.sourceCode).toContain('addi x1, x0, 5');
    expect(state.registerDisplayFormat).toBe('hex');
    expect(state.memoryViewStartAddress).toBe(0x40);
    expect(state.historyTimeline).toHaveLength(1);
    expect(state.historyTimeline[0].cycleNumber).toBe(0);
    expect(state.historyTimeline[0].stage).toBe(Stage.IF);
    expect(state.machineCodeRows.length).toBeGreaterThan(0);
    expect(state.machineCodeRows[0].assembly).toContain('addi');
    expect(state.machineCodeRows[0].current).toBe(true);
    expect(state.currentInstruction?.asmString).toBe('addi x1, x0, 5');
    expect(state.controlSignals.PCWrite).toBe(true);
    expect(state.controlSignals.MemRead).toBe(true);
    expect(state.controlSignals.IRWrite).toBe(true);
  });

  it('advances a single cycle through the real engine pipeline', () => {
    const store = createCPUStore();

    store.getState().stepCycle();

    const state = store.getState();
    expect(state.stage).toBe(Stage.ID);
    expect(state.cycleCount).toBe(1);
    expect(state.instructionCount).toBe(0);
    expect(state.currentInstruction?.asmString).toBe('addi x1, x0, 5');
    expect(state.controlSignals.ALUSrcB).toBe(2);
    expect(state.controlSignals.ImmSrc).toBe(ImmType.I);
  });

  it('keeps the store in running mode across cycles and pauses when execution finishes', () => {
    const store = createCPUStore();

    store.getState().run();
    expect(store.getState().runStatus).toBe('running');

    store.getState().stepCycle();
    expect(store.getState().runStatus).toBe('running');

    for (let index = 0; index < 40 && store.getState().runStatus === 'running'; index++) {
      store.getState().stepCycle();
    }

    const state = store.getState();
    expect(state.runStatus).toBe('paused');
    expect(state.currentInstruction).toBeNull();
    expect(state.instructionCount).toBeGreaterThanOrEqual(5);
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
    expect(state.cycleCount).toBe(4);
    expect(state.instructionCount).toBe(1);
    expect(state.historyTimeline).toHaveLength(5);
    expect(state.currentSnapshot.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ target: 'registers[1]', newValue: 5 }),
      ])
    );

    store.getState().reset();
    state = store.getState();
    expect(state.stage).toBe(Stage.IF);
    expect(state.cycleCount).toBe(0);
    expect(state.instructionCount).toBe(0);
    expect(state.runStatus).toBe('idle');
  });

  it('projects register and memory views from real CPU execution', () => {
    const store = createCPUStore();

    for (let index = 0; index < 5; index++) {
      store.getState().stepInstruction();
    }

    const state = store.getState();

    expect(state.registers[1]).toBe(5);
    expect(state.registers[2]).toBe(9);
    expect(state.registers[3]).toBe(14);
    expect(state.registers[4]).toBe(14);
    expect(Array.from(state.memoryBytes.slice(0x40, 0x44))).toEqual([0x0e, 0x00, 0x00, 0x00]);
    expect(state.currentInstruction).toBeNull();
    expect(state.machineCodeRows.every((row) => !row.current)).toBe(true);
    expect(state.latestMemoryAccess).toEqual(
      expect.objectContaining({ type: 'read', address: 0x40, data: 14 })
    );
    expect(state.currentSnapshot.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ target: 'registers[4]', newValue: 14 }),
      ])
    );
  });

  it('syncs the memory window to the latest accessed address during memory instructions', () => {
    const store = createCPUStore();

    store.getState().jumpToMemoryAddress(0x80);
    store.getState().stepInstruction();
    store.getState().stepInstruction();
    store.getState().stepInstruction();
    store.getState().stepInstruction();

    const state = store.getState();
    expect(state.latestMemoryAccess).toEqual(
      expect.objectContaining({ type: 'write', address: 0x40, data: 14 })
    );
    expect(state.memoryViewStartAddress).toBe(0x40);
  });

  it('records cycle-by-cycle history and rewinds to earlier checkpoints', () => {
    const store = createCPUStore();

    store.getState().stepCycle();
    store.getState().stepCycle();
    store.getState().stepInstruction();

    let state = store.getState();
    expect(state.historyTimeline).toHaveLength(5);
    const latestEntry = state.historyTimeline[state.historyTimeline.length - 1];
    expect(latestEntry?.cycleNumber).toBe(4);
    expect(latestEntry?.stage).toBe(Stage.IF);

    store.getState().rewindToCycle(1);
    state = store.getState();
    expect(state.cycleCount).toBe(1);
    expect(state.stage).toBe(Stage.ID);
    expect(state.instructionCount).toBe(0);
    expect(state.runStatus).toBe('paused');

    store.getState().rewindToCycle(0);
    state = store.getState();
    expect(state.cycleCount).toBe(0);
    expect(state.stage).toBe(Stage.IF);
  });

  it('rebuilds machine code, reports assembly errors, and blocks execution when source changes', () => {
    const store = createCPUStore();

    store.getState().setSourceCode('bogus x1, x0, 1');

    let state = store.getState();
    expect(state.machineCodeRows.length).toBe(1);
    expect(state.historyTimeline).toHaveLength(1);
    expect(state.assembleErrors.length).toBeGreaterThan(0);
    expect(state.assembleErrors[0].message).toContain('Unsupported instruction');
    expect(state.cycleCount).toBe(0);

    store.getState().stepCycle();
    state = store.getState();
    expect(state.cycleCount).toBe(0);
    expect(state.lastAction).toContain('汇编错误');
  });
});
