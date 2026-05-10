import { ImmType, Stage } from '../../types';
import { PRACTICE_STAGE_ORDER, getInstructionPracticeItem } from '../../teaching/instruction-practice';
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

    let state = store.getState();
    expect(state.stage).toBe(Stage.ID);
    expect(state.cycleCount).toBe(1);
    expect(state.instructionCount).toBe(0);
    expect(state.currentInstruction?.asmString).toBe('addi x1, x0, 5');
    expect(state.controlSignals.ALUSrcB).toBe(2);
    expect(state.controlSignals.ImmSrc).toBe(ImmType.I);
    expect(state.currentSnapshot.activeDataPaths).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: 'ir', to: 'id-decoder' }),
        expect.objectContaining({ from: 'id-decoder', to: 'reg-file' }),
        expect.objectContaining({ from: 'reg-file', to: 'reg-a' }),
      ])
    );

    store.getState().stepCycle();

    state = store.getState();
    expect(state.stage).toBe(Stage.EX);
    expect(state.currentSnapshot.activeDataPaths).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: 'reg-a', to: 'alu' }),
        expect.objectContaining({ from: 'id-decoder', to: 'alu-src-b' }),
        expect.objectContaining({ from: 'alu-src-b', to: 'alu' }),
      ])
    );
  });

  it('previews multicycle stage latch values in the same visible stage', () => {
    const store = createCPUStore();

    store.getState().setSourceCode('addi x1, x0, 5');
    store.getState().setRegisterInitialValues([5], 0x00001234);

    store.getState().stepCycle();

    let state = store.getState();
    expect(state.stage).toBe(Stage.ID);
    expect(state.currentSnapshot.pipelineRegs.B).toBe(0x00001234);
    expect(state.currentSnapshot.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ target: 'B', oldValue: 0, newValue: 0x00001234 }),
      ])
    );

    store.getState().stepCycle();

    state = store.getState();
    expect(state.stage).toBe(Stage.EX);
    expect(state.currentSnapshot.pipelineRegs.ALUOut).toBe(5);

    store.getState().stepCycle();

    state = store.getState();
    expect(state.stage).toBe(Stage.WB);
    expect(state.registers[1]).toBe(5);
    expect(state.currentSnapshot.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ target: 'registers[1]', oldValue: 0, newValue: 5 }),
      ])
    );
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

    let state = store.getState();
    expect(state.registerDisplayFormat).toBe('dec');
    expect(state.memoryViewStartAddress).toBe(0x50);

    store.getState().jumpToMemoryAddress(0x12340053);
    state = store.getState();
    expect(state.memoryViewStartAddress).toBe(0x12340050);
  });

  it('switches between multicycle and pipeline datapath diagrams', () => {
    const store = createCPUStore();

    expect(store.getState().datapathMode).toBe('multicycle');

    store.getState().setDatapathMode('pipeline');

    expect(store.getState().datapathMode).toBe('pipeline');
    expect(store.getState().datapathConfig.metadata.type).toBe('pipeline');

    store.getState().setDatapathMode('multicycle');

    expect(store.getState().datapathMode).toBe('multicycle');
    expect(store.getState().datapathConfig.metadata.type).toBe('multicycle');
  });

  it('tracks datapath interaction mode and checks lw practice answers', () => {
    const store = createCPUStore();

    expect(store.getState().datapathInteractionMode).toBe('free-drag');

    store.getState().setDatapathInteractionMode('practice');
    expect(store.getState().datapathInteractionMode).toBe('practice');

    for (const stage of PRACTICE_STAGE_ORDER) {
      store.getState().setPracticeStageSelected(stage, true);
    }
    for (const question of Object.values(getInstructionPracticeItem('lw').controlQuestions)) {
      for (const control of question.controls) {
        store.getState().setPracticeControlValue(
          question.stage,
          control.name,
          question.correctControls[control.name]
        );
      }
    }
    store.getState().checkPracticeAnswer();

    let state = store.getState();
    expect(state.practiceResult?.correct).toBe(true);
    expect(state.practiceResult?.controlsByStage[Stage.EX]?.message).toBe('EX 阶段控制信号正确。');

    store.getState().setPracticeControlValue(Stage.EX, 'rs2_imm_s', '0');
    expect(store.getState().practiceResult).toBeNull();

    store.getState().checkPracticeAnswer();
    state = store.getState();
    expect(state.practiceResult?.correct).toBe(false);
    expect(state.practiceResult?.controlsByStage[Stage.EX]?.mismatches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ control: 'rs2_imm_s', selected: '0', expected: '1' }),
      ])
    );
  });

  it('uses the five-stage pipeline engine in pipeline mode', () => {
    const store = createCPUStore();

    store.getState().setSourceCode(`
      addi x1, x0, 10
      addi x2, x0, 20
    `);
    store.getState().setDatapathMode('pipeline');

    let state = store.getState();
    expect(state.currentSnapshot.pipeline.stages.IF.decodedInstruction?.asmString).toBe('addi x1, x0, 10');
    expect(state.currentSnapshot.pipeline.registers.ifId.status).toBe('empty');

    store.getState().stepCycle();
    state = store.getState();
    expect(state.stage).toBe(Stage.ID);
    expect(state.currentSnapshot.pipeline.registers.ifId.decodedInstruction?.asmString).toBe('addi x1, x0, 10');
    expect(state.currentSnapshot.pipeline.stages.ID.decodedInstruction?.asmString).toBe('addi x1, x0, 10');

    store.getState().stepCycle();
    state = store.getState();
    expect(state.stage).toBe(Stage.EX);
    expect(state.currentSnapshot.pipeline.stages.ID.decodedInstruction?.asmString).toBe('addi x2, x0, 20');
    expect(state.currentSnapshot.pipeline.stages.EX.decodedInstruction?.asmString).toBe('addi x1, x0, 10');
  });

  it('exposes pipeline snapshot history and toggles forwarding for hazard teaching panels', () => {
    const store = createCPUStore();

    store.getState().setSourceCode(`
      addi x1, x0, 1
      add x2, x1, x1
    `);
    store.getState().setDatapathMode('pipeline');

    expect(store.getState().pipelineForwardingEnabled).toBe(false);
    expect(store.getState().pipelineControlStrategy).toBe('predict-not-taken');
    expect(store.getState().currentSnapshot.pipeline.forwarding.enabled).toBe(false);
    expect(store.getState().snapshotHistory).toHaveLength(1);

    store.getState().stepCycle();
    store.getState().stepCycle();
    store.getState().stepCycle();

    let state = store.getState();
    expect(state.snapshotHistory[0]?.cycleNumber).toBe(0);
    expect(state.snapshotHistory.map((snapshot) => snapshot.cycleNumber)).toEqual([0, 1, 2, 3]);
    expect(state.snapshotHistory.length).toBeGreaterThanOrEqual(3);
    expect(state.currentSnapshot.pipeline.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'data', resolution: 'stall', register: 1 }),
      ])
    );

    store.getState().reset();
    store.getState().setPipelineForwardingEnabled(true);
    store.getState().setPipelineControlStrategy('stall-until-resolved');
    expect(store.getState().pipelineForwardingEnabled).toBe(true);
    expect(store.getState().pipelineControlStrategy).toBe('stall-until-resolved');
    expect(store.getState().currentSnapshot.pipeline.controlStrategy).toBe('stall-until-resolved');

    for (let index = 0; index < 4; index++) {
      store.getState().stepCycle();
    }

    state = store.getState();
    expect(state.currentSnapshot.pipeline.forwarding.enabled).toBe(true);
    expect(state.currentSnapshot.pipeline.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'data', resolution: 'forward', forwardingSignal: 'ForwardA' }),
      ])
    );
  });

  it('seeds custom register and memory initial values across resets', () => {
    const store = createCPUStore();

    store.getState().setRegisterInitialValues([8, 9, 0], 0x2A);
    store.getState().setMemoryInitialBytes([0x12340040, 0x00000041], 0x7F);

    let state = store.getState();
    expect(state.registers[8]).toBe(0x2A);
    expect(state.registers[9]).toBe(0x2A);
    expect(state.registers[0]).toBe(0);
    expect(state.memoryBytes[0x0040]).toBe(0x7F);
    expect(state.memoryBytes[0x0041]).toBe(0x7F);

    store.getState().stepInstruction();
    store.getState().reset();

    state = store.getState();
    expect(state.registers[8]).toBe(0x2A);
    expect(state.registers[9]).toBe(0x2A);
    expect(state.memoryBytes[0x0040]).toBe(0x7F);
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
