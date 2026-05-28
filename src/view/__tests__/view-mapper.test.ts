import { describe, expect, it } from 'vitest';
import { Stage, type ViewState } from '../../types';
import { EXAMPLE_PROGRAMS } from '../../content/example-programs';
import { Assembler } from '../../engine/assembler/encoder';
import { CPU } from '../../engine/core/cpu';
import { PipelineCPU } from '../../engine/core/pipeline-cpu';
import { getDatapathConfig } from '../../config/load-datapath-config';
import { ViewMapper } from '../view-mapper';

describe('ViewMapper', () => {
  const assembler = new Assembler();

  const assemble = (source: string): Uint32Array => {
    const result = assembler.assemble(source);
    expect(result.errors).toEqual([]);
    return result.machineCode;
  };

  const expectWiresActive = (viewState: ViewState, wireIds: readonly string[]) => {
    for (const wireId of wireIds) {
      expect(viewState.wires.get(wireId)?.active).toBe(true);
    }
  };

  it('maps an IF snapshot to highlighted components and active wires', () => {
    const cpu = new CPU();
    const mapper = new ViewMapper();
    const program = assemble('addi x1, x0, 5');

    cpu.loadProgram(program);
    const snapshot = cpu.tick();
    const viewState = mapper.mapSnapshot(snapshot);

    expect(viewState.stage).toBe(Stage.IF);
    expect(viewState.cycleInfo.instructionASM).toBe('addi x1, x0, 5');
    expect(viewState.components.get('pc')?.highlighted).toBe(true);
    expect(viewState.components.get('instr-mem')?.highlighted).toBe(true);
    expect(viewState.wires.get('pc-to-imem')?.active).toBe(true);
    expect(viewState.wires.get('imem-to-ir')?.value).toBe(program[0]);
    expect(viewState.wires.get('ctrl-to-ir-write')?.active).toBe(true);
  });

  it('maps a WB snapshot to write-back visuals and changed register state', () => {
    const cpu = new CPU();
    const mapper = new ViewMapper();
    const program = assemble('addi x1, x0, 10');

    cpu.loadProgram(program);
    cpu.tick();
    cpu.tick();
    cpu.tick();
    const wbSnapshot = cpu.tick();
    const viewState = mapper.mapSnapshot(wbSnapshot);

    expect(viewState.stage).toBe(Stage.WB);
    expect(viewState.components.get('reg-file')?.highlighted).toBe(true);
    expect(viewState.components.get('reg-file')?.displayValues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'x1', value: '0x0000000a' }),
      ])
    );
    expect(viewState.wires.get('ctrl-to-regfile-write')?.active).toBe(true);
    expect(viewState.wires.get('aluout-to-muxwb')?.active).toBe(true);
  });

  it('only highlights guarded control wires when their enable signal is active', () => {
    const cpu = new CPU();
    const mapper = new ViewMapper();
    const program = assemble('addi x1, x0, 10');

    cpu.loadProgram(program);
    cpu.tick();
    cpu.tick();
    const exSnapshot = cpu.tick();
    const exViewState = mapper.mapSnapshot(exSnapshot);

    expect(exViewState.stage).toBe(Stage.EX);
    expect(exViewState.wires.get('ctrl-to-pc-select')?.active).toBe(false);
    expect(exViewState.wires.get('ctrl-to-muxwb-select')?.active).toBe(false);

    const wbSnapshot = cpu.tick();
    const wbViewState = mapper.mapSnapshot(wbSnapshot);

    expect(wbViewState.stage).toBe(Stage.WB);
    expect(wbViewState.wires.get('ctrl-to-muxwb-select')?.active).toBe(true);
  });

  it('does not highlight PC+4 for addi write-back in the multicycle datapath', () => {
    const cpu = new CPU();
    const mapper = new ViewMapper();
    const program = assemble('addi x1, x0, 10');

    cpu.loadProgram(program);
    cpu.tick();
    cpu.tick();
    cpu.tick();
    const wbSnapshot = cpu.tick();
    const viewState = mapper.mapSnapshot(wbSnapshot);

    expect(viewState.stage).toBe(Stage.WB);
    expect(viewState.components.get('pc-plus4')?.highlighted).toBe(false);
    expect(viewState.components.get('mux-wb')?.highlighted).toBe(true);
  });

  it('does not highlight branch and PC redirect components for addi in EX', () => {
    const cpu = new CPU();
    const mapper = new ViewMapper();
    const program = assemble('addi x1, x0, 10');

    cpu.loadProgram(program);
    cpu.tick();
    cpu.tick();
    const exSnapshot = cpu.tick();
    const viewState = mapper.mapSnapshot(exSnapshot);

    expect(viewState.stage).toBe(Stage.EX);
    expect(viewState.components.get('pc0')?.highlighted).toBe(false);
    expect(viewState.components.get('jump-target')?.highlighted).toBe(false);
    expect(viewState.components.get('alu-src-a')?.highlighted).toBe(false);
    expect(viewState.components.get('branch-logic')?.highlighted).toBe(false);
    expect(viewState.components.get('flag-reg')?.highlighted).toBe(false);
    expect(viewState.components.get('alu')?.highlighted).toBe(true);
    expect(viewState.components.get('alu-src-b')?.highlighted).toBe(true);
  });

  it('does not highlight unused select and branch-control wires for jal in EX', () => {
    const cpu = new CPU();
    const mapper = new ViewMapper();
    const program = assemble('jal x1, 16');

    cpu.loadProgram(program);
    cpu.tick();
    const exSnapshot = cpu.tick();
    const viewState = mapper.mapSnapshot(exSnapshot);

    expect(viewState.stage).toBe(Stage.EX);
    expect(viewState.wires.get('ctrl-to-rs2mux-select')?.active).toBe(false);
    expect(viewState.wires.get('alu-to-branchlogic')?.active).toBe(false);
    expect(viewState.wires.get('branchlogic-to-flagreg')?.active).toBe(false);
    expect(viewState.wires.get('immgen-to-jumptarget')?.active).toBe(true);
  });

  it('keeps the multicycle branch MEM/PC redirect chain highlighted in the loop example', () => {
    const cpu = new CPU();
    const mapper = new ViewMapper();
    const program = assemble(`
      addi x1, x0, 4
      addi x2, x0, 1
      loop:
      sub  x1, x1, x2
      bne  x1, x0, loop
      sw   x1, 80(x0)
    `);

    cpu.loadProgram(program);
    let snapshot = cpu.getSnapshot();
    for (let index = 0; index < 30; index++) {
      const nextSnapshot = cpu.tick();
      snapshot = nextSnapshot;
      if (nextSnapshot.stage === Stage.WB && nextSnapshot.decodedInstruction.asmString === 'bne x1, x0, -4') {
        break;
      }
    }

    expect(snapshot.stage).toBe(Stage.WB);
    expect(snapshot.decodedInstruction.asmString).toBe('bne x1, x0, -4');
    expect(snapshot.controlSignals.PCSource).toBe(2);

    const viewState = mapper.mapSnapshot(snapshot);
    for (const wireId of [
      'flagreg-to-ctrl',
      'ctrl-to-pc-select',
      'ctrl-to-pc-write',
      'pc0-to-jumptarget',
      'immgen-to-jumptarget',
      'jumptarget-to-pcsrc',
      'pcsrc-to-pc',
    ]) {
      expect(viewState.wires.get(wireId)?.active).toBe(true);
    }
    expect(viewState.wires.get('ctrl-to-pc-select')?.value).toBe(2);
  });

  it('shows a not-taken multicycle branch decision without lighting the PC write-back leg', () => {
    const cpu = new CPU();
    const mapper = new ViewMapper();
    const program = assemble(`
      addi x1, x0, 1
      beq  x1, x0, 8
      addi x2, x0, 2
    `);

    cpu.loadProgram(program);
    let snapshot = cpu.getSnapshot();
    for (let index = 0; index < 16; index++) {
      const nextSnapshot = cpu.tick();
      snapshot = nextSnapshot;
      if (nextSnapshot.stage === Stage.WB && nextSnapshot.decodedInstruction.asmString === 'beq x1, x0, 8') {
        break;
      }
    }

    expect(snapshot.stage).toBe(Stage.WB);
    expect(snapshot.decodedInstruction.asmString).toBe('beq x1, x0, 8');
    expect(snapshot.controlSignals.PCSource).toBe(2);

    const viewState = mapper.mapSnapshot(snapshot);
    expect(viewState.wires.get('flagreg-to-ctrl')?.active).toBe(true);
    expect(viewState.wires.get('ctrl-to-pc-select')?.active).toBe(true);
    expect(viewState.wires.get('ctrl-to-pc-select')?.value).toBe(2);
    expect(viewState.wires.get('ctrl-to-pc-write')?.active).toBe(false);
    expect(viewState.wires.get('jumptarget-to-pcsrc')?.active).toBe(false);
    expect(viewState.wires.get('pcsrc-to-pc')?.active).toBe(false);
  });

  it('keeps the multicycle jalr WB redirect control wires highlighted', () => {
    const cpu = new CPU();
    const mapper = new ViewMapper();
    const program = assemble(`
      addi x1, x0, 8
      jalr x2, 0(x1)
    `);

    cpu.loadProgram(program);
    let snapshot = cpu.getSnapshot();
    for (let index = 0; index < 12; index++) {
      const nextSnapshot = cpu.tick();
      snapshot = nextSnapshot;
      if (nextSnapshot.stage === Stage.WB && nextSnapshot.decodedInstruction.asmString === 'jalr x2, 0(x1)') {
        break;
      }
    }

    expect(snapshot.stage).toBe(Stage.WB);
    expect(snapshot.decodedInstruction.asmString).toBe('jalr x2, 0(x1)');

    const viewState = mapper.mapSnapshot(snapshot);
    expect(viewState.wires.get('ctrl-to-pc-select')?.active).toBe(true);
    expect(viewState.wires.get('ctrl-to-pc-select')?.value).toBe(1);
    expect(viewState.wires.get('ctrl-to-pc-write')?.active).toBe(true);
    expect(viewState.wires.get('aluout-to-pcsrc')?.active).toBe(true);
    expect(viewState.wires.get('pcsrc-to-pc')?.active).toBe(true);
  });

  it('activates pipeline stage wires across IF, ID, and EX', () => {
    const cpu = new PipelineCPU();
    const mapper = new ViewMapper(getDatapathConfig('pipeline'));
    const program = assemble('addi x1, x0, 5');

    cpu.loadProgram(program);
    const ifViewState = mapper.mapSnapshot(cpu.getSnapshot());

    expect(ifViewState.stage).toBe(Stage.IF);
    expect(ifViewState.wires.get('pipeline-wire-469-instr-mem-ir-to-if-id')?.active).toBe(true);
    expect(ifViewState.wires.get('pipeline-wire-426-pc-plus4-to-pc-mux')?.active).toBe(true);

    const idViewState = mapper.mapSnapshot(cpu.tick());

    expect(idViewState.stage).toBe(Stage.ID);
    expect(idViewState.wires.get('pipeline-wire-557-if-id-imm-to-imm-gen')?.active).toBe(true);
    expect(idViewState.wires.get('pipeline-wire-558-imm-gen-offset-to-id-ex')?.active).toBe(true);
    expect(idViewState.wires.get('pipeline-wire-515-control-unit-to-id-ex-control')?.active).toBe(true);
    expect(idViewState.wires.get('pipeline-wire-491-regfile-rd-b-to-id-ex')?.active).toBe(true);

    const exViewState = mapper.mapSnapshot(cpu.tick());

    expect(exViewState.stage).toBe(Stage.EX);
    expect(exViewState.wires.get('pipeline-wire-559-id-ex-imm32-to-imm-junction')?.active).toBe(true);
    expect(exViewState.wires.get('pipeline-wire-457-id-ex-imm32-to-alu-src-b')?.active).toBe(true);
    expect(exViewState.wires.get('pipeline-wire-517-id-ex-pc4-to-ex-mem')?.active).toBe(true);
    expect(exViewState.wires.get('pipeline-wire-511-branch-logic-to-branch-target')?.active).toBe(false);
    expect(exViewState.wires.get('pipeline-wire-500-alu-result-to-ex-mem')?.active).toBe(true);
    expect(exViewState.components.get('pc-plus4')?.highlighted).toBe(false);
  });

  it('keeps the basic arithmetic store B pass-through connected at cycle 11', () => {
    const cpu = new PipelineCPU(4096, {
      forwardingEnabled: false,
      controlHazardStrategy: 'stall-until-resolved',
    });
    const mapper = new ViewMapper(getDatapathConfig('pipeline'));
    const example = EXAMPLE_PROGRAMS.find((program) => program.id === 'multicycle-demo');

    expect(example).toBeDefined();
    cpu.loadProgram(assemble(example!.source));

    let snapshot = cpu.getSnapshot();
    for (let index = 0; index < 11; index++) {
      snapshot = cpu.tick();
    }

    const viewState = mapper.mapSnapshot(snapshot);

    expect(snapshot.cycleNumber).toBe(11);
    expect(snapshot.pipeline.stages.EX.decodedInstruction?.asmString).toBe('sw x3, 64(x0)');
    expect(viewState.wires.get('pipeline-wire-561-id-ex-b-to-bypass-junction')?.active).toBe(true);
    expect(viewState.wires.get('pipeline-wire-419-bypass-b-to-ex-mem')?.active).toBe(true);
    expect(viewState.wires.get('pipeline-wire-493-id-ex-b-to-alu-src-b')?.active).toBe(false);
  });

  it('keeps held ID decode wires visible during the basic arithmetic RAW wait', () => {
    const cpu = new PipelineCPU(4096, {
      forwardingEnabled: false,
      controlHazardStrategy: 'predict-not-taken',
    });
    const mapper = new ViewMapper(getDatapathConfig('pipeline'));
    const example = EXAMPLE_PROGRAMS.find((program) => program.id === 'multicycle-demo');

    expect(example).toBeDefined();
    cpu.loadProgram(assemble(example!.source));

    let snapshot = cpu.getSnapshot();
    for (let index = 0; index < 3; index++) {
      snapshot = cpu.tick();
    }

    const viewState = mapper.mapSnapshot(snapshot);

    expect(snapshot.cycleNumber).toBe(3);
    expect(snapshot.stage).toBe(Stage.MEM);
    expect(snapshot.pipeline.forwarding.enabled).toBe(false);
    expect(snapshot.pipeline.controlStrategy).toBe('predict-not-taken');
    expect(snapshot.pipeline.stages.MEM.decodedInstruction?.asmString).toBe('addi x1, x0, 5');
    expect(snapshot.pipeline.stages.EX.decodedInstruction?.asmString).toBe('addi x2, x0, 9');
    expect(snapshot.pipeline.stages.ID.decodedInstruction?.asmString).toBe('add x3, x1, x2');

    expectWiresActive(viewState, [
      'pipeline-wire-472-if-id-pc4-to-id-ex',
      'pipeline-wire-473-if-id-pc0-to-id-ex',
      'pipeline-wire-437-if-id-rd-to-id-ex',
      'pipeline-wire-435-if-id-rs1-to-regfile',
      'pipeline-wire-436-if-id-rs2-to-regfile',
      'pipeline-wire-557-if-id-imm-to-imm-gen',
      'pipeline-wire-558-imm-gen-offset-to-id-ex',
      'pipeline-wire-492-regfile-rd-a-to-id-ex',
      'pipeline-wire-491-regfile-rd-b-to-id-ex',
    ]);
  });

  it('does not light the IF fetch path when the basic arithmetic cycle 11 IF slot is empty', () => {
    const cpu = new PipelineCPU(4096, {
      forwardingEnabled: false,
      controlHazardStrategy: 'predict-not-taken',
    });
    const mapper = new ViewMapper(getDatapathConfig('pipeline'));
    const example = EXAMPLE_PROGRAMS.find((program) => program.id === 'multicycle-demo');

    expect(example).toBeDefined();
    cpu.loadProgram(assemble(example!.source));

    let snapshot = cpu.getSnapshot();
    for (let index = 0; index < 11; index++) {
      snapshot = cpu.tick();
    }

    const viewState = mapper.mapSnapshot(snapshot);

    expect(snapshot.cycleNumber).toBe(11);
    expect(snapshot.pipeline.forwarding.enabled).toBe(false);
    expect(snapshot.pipeline.controlStrategy).toBe('predict-not-taken');
    expect(snapshot.pipeline.stages.EX.decodedInstruction?.asmString).toBe('sw x3, 64(x0)');
    expect(snapshot.pipeline.stages.ID.decodedInstruction?.asmString).toBe('lw x4, 64(x0)');
    expect(snapshot.pipeline.stages.IF.status).toBe('empty');
    expect(snapshot.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ target: 'pc', oldValue: 16, newValue: 20 }),
      ])
    );

    expect(viewState.components.get('pc')?.highlighted).toBe(false);
    expect(viewState.components.get('instr-mem')?.highlighted).toBe(false);
    expect(viewState.wires.get('pipeline-wire-418-pc-to-instr-mem-addr')?.active).toBe(false);
    expect(viewState.wires.get('pipeline-wire-469-instr-mem-ir-to-if-id')?.active).toBe(false);
  });

  it('does not highlight the pipeline register file from a retired write-back change alone', () => {
    const cpu = new PipelineCPU(4096, {
      forwardingEnabled: false,
      controlHazardStrategy: 'predict-not-taken',
    });
    const mapper = new ViewMapper(getDatapathConfig('pipeline'));
    const example = EXAMPLE_PROGRAMS.find((program) => program.id === 'multicycle-demo');

    expect(example).toBeDefined();
    cpu.loadProgram(assemble(example!.source));

    let snapshot = cpu.getSnapshot();
    for (let index = 0; index < 15; index++) {
      snapshot = cpu.tick();
    }

    const viewState = mapper.mapSnapshot(snapshot);

    expect(snapshot.cycleNumber).toBe(15);
    expect(snapshot.changes.some((change) => change.target.startsWith('registers['))).toBe(true);
    expect(snapshot.pipeline.stages.WB.decodedInstruction).toBeNull();
    expect(viewState.components.get('reg-file')?.highlighted).toBe(false);
    expect(viewState.wires.get('pipeline-wire-554-mem-wb-reg-write-to-regfile')?.active).toBe(false);
  });

  it('keeps the jump PC4 pipeline chain highlighted through MEM', () => {
    const cpu = new PipelineCPU();
    const mapper = new ViewMapper(getDatapathConfig('pipeline'));
    const program = assemble(`
      jal x1, 8
      addi x2, x0, 2
      addi x3, x0, 3
    `);

    cpu.loadProgram(program);
    cpu.tick();
    cpu.tick();
    const memSnapshot = cpu.tick();
    const viewState = mapper.mapSnapshot(memSnapshot);

    expect(memSnapshot.pipeline.stages.MEM.decodedInstruction?.asmString).toBe('jal x1, 8');
    expect(viewState.wires.get('pipeline-wire-543-ex-mem-pc4-to-mem-wb')?.active).toBe(true);
  });

  it('keeps the branch EX PC4 register transfer highlighted in the loop example', () => {
    const cpu = new PipelineCPU(4096, { forwardingEnabled: true });
    const mapper = new ViewMapper(getDatapathConfig('pipeline'));
    const program = assemble(`
      addi x1, x0, 4
      addi x2, x0, 1
      loop:
      sub  x1, x1, x2
      bne  x1, x0, loop
      sw   x1, 80(x0)
    `);

    cpu.loadProgram(program);
    for (let index = 0; index < 5; index++) {
      cpu.tick();
    }

    const snapshot = cpu.getSnapshot();
    const viewState = mapper.mapSnapshot(snapshot);

    expect(snapshot.pipeline.stages.WB.decodedInstruction?.asmString).toBe('addi x2, x0, 1');
    expect(snapshot.pipeline.stages.EX.decodedInstruction?.asmString).toBe('bne x1, x0, -4');
    expect(viewState.wires.get('pipeline-wire-517-id-ex-pc4-to-ex-mem')?.active).toBe(true);
  });

  it('keeps the stalled branch EX ALU and flag path connected in the loop example', () => {
    const cpu = new PipelineCPU(4096, {
      forwardingEnabled: false,
      controlHazardStrategy: 'stall-until-resolved',
    });
    const mapper = new ViewMapper(getDatapathConfig('pipeline'));
    const program = assemble(`
      addi x1, x0, 4
      addi x2, x0, 1
      loop:
      sub  x1, x1, x2
      bne  x1, x0, loop
      sw   x1, 80(x0)
    `);

    cpu.loadProgram(program);
    let snapshot = cpu.getSnapshot();
    for (let index = 0; index < 16; index++) {
      const nextSnapshot = cpu.tick();
      snapshot = nextSnapshot;
      if (
        nextSnapshot.pipeline.hazard.type === 'control' &&
        nextSnapshot.pipeline.hazard.action === 'stall' &&
        nextSnapshot.pipeline.stages.EX.decodedInstruction?.asmString === 'bne x1, x0, -4'
      ) {
        break;
      }
    }

    const viewState = mapper.mapSnapshot(snapshot);

    expect(snapshot.cycleNumber).toBe(11);
    expect(snapshot.pipeline.hazard).toMatchObject({ type: 'control', action: 'stall' });
    expect(snapshot.pipeline.stages.EX.decodedInstruction?.asmString).toBe('bne x1, x0, -4');
    for (const wireId of [
      'pipeline-wire-501-id-ex-a-to-alu',
      'pipeline-wire-493-id-ex-b-to-alu-src-b',
      'pipeline-wire-420-alu-src-b-to-alu-b',
      'pipeline-wire-500-alu-result-to-ex-mem',
      'pipeline-wire-512-alu-flag-to-branch-logic',
      'pipeline-wire-514-alu-branch-flag-to-branch-logic',
      'pipeline-wire-538-branch-adder-to-branch-logic',
      'pipeline-wire-511-branch-logic-to-branch-target',
    ]) {
      expect(viewState.wires.get(wireId)?.active).toBe(true);
    }
  });

  it('does not leave the imm32 trunk half-lit for a register-register EX instruction in the loop example', () => {
    const cpu = new PipelineCPU(4096, {
      forwardingEnabled: true,
      controlHazardStrategy: 'predict-not-taken',
    });
    const mapper = new ViewMapper(getDatapathConfig('pipeline'));
    const program = assemble(`
      addi x1, x0, 4
      addi x2, x0, 1
      loop:
      sub  x1, x1, x2
      bne  x1, x0, loop
      sw   x1, 80(x0)
    `);

    cpu.loadProgram(program);
    for (let index = 0; index < 12; index++) {
      cpu.tick();
    }

    const snapshot = cpu.getSnapshot();
    const viewState = mapper.mapSnapshot(snapshot);

    expect(snapshot.cycleNumber).toBe(12);
    expect(snapshot.pipeline.stages.EX.decodedInstruction?.asmString).toBe('sub x1, x1, x2');
    expect(viewState.wires.get('pipeline-wire-493-id-ex-b-to-alu-src-b')?.active).toBe(true);
    expect(viewState.wires.get('pipeline-wire-559-id-ex-imm32-to-imm-junction')?.active).toBe(false);
    expect(viewState.wires.get('pipeline-wire-457-id-ex-imm32-to-alu-src-b')?.active).toBe(false);
  });

  it('does not light the F feedback path for a stalled branch redirect in the loop example', () => {
    const cpu = new PipelineCPU(4096, {
      forwardingEnabled: true,
      controlHazardStrategy: 'stall-until-resolved',
    });
    const mapper = new ViewMapper(getDatapathConfig('pipeline'));
    const program = assemble(`
      addi x1, x0, 4
      addi x2, x0, 1
      loop:
      sub  x1, x1, x2
      bne  x1, x0, loop
      sw   x1, 80(x0)
    `);

    cpu.loadProgram(program);
    for (let index = 0; index < 6; index++) {
      cpu.tick();
    }

    const snapshot = cpu.getSnapshot();
    const viewState = mapper.mapSnapshot(snapshot);

    expect(snapshot.cycleNumber).toBe(6);
    expect(snapshot.pipeline.hazard).toMatchObject({ type: 'control', action: 'flush' });
    expect(snapshot.pipeline.stages.MEM.decodedInstruction?.asmString).toBe('bne x1, x0, -4');
    expect(viewState.wires.get('pipeline-wire-465-branch-target-to-pc-mux')?.active).toBe(true);
    expect(viewState.wires.get('pipeline-wire-535-pc-select-to-pc-mux')?.active).toBe(true);
    expect(viewState.wires.get('pipeline-wire-466-pc-mux-to-pc')?.active).toBe(true);
    expect(viewState.components.get('alu')?.highlighted).toBe(false);
    expect(viewState.components.get('branch-logic')?.highlighted).toBe(false);
    expect(viewState.wires.get('pipeline-wire-501-id-ex-a-to-alu')?.active).toBe(false);
    expect(viewState.wires.get('pipeline-wire-500-alu-result-to-ex-mem')?.active).toBe(false);
    expect(viewState.wires.get('pipeline-wire-560-ex-mem-alu-result-to-feedback-junction')?.active).toBe(false);
    expect(viewState.wires.get('pipeline-wire-536-ex-mem-feedback-to-pc-mux')?.active).toBe(false);
  });

  it('uses a complete F feedback path for jalr redirects', () => {
    const cpu = new PipelineCPU(4096, { forwardingEnabled: true });
    const mapper = new ViewMapper(getDatapathConfig('pipeline'));
    const program = assemble(`
      addi x2, x0, 8
      jalr x1, 0(x2)
      addi x3, x0, 3
      addi x4, x0, 4
    `);

    cpu.loadProgram(program);
    let snapshot = cpu.getSnapshot();
    for (let index = 0; index < 10; index++) {
      snapshot = cpu.tick();
      if (
        snapshot.pipeline.hazard.action === 'flush' &&
        snapshot.pipeline.hazard.control?.producer.asmString.startsWith('jalr ')
      ) {
        break;
      }
    }

    const viewState = mapper.mapSnapshot(snapshot);

    expect(snapshot.pipeline.hazard.control?.producer.asmString).toBe('jalr x1, 0(x2)');
    expect(viewState.wires.get('pipeline-wire-560-ex-mem-alu-result-to-feedback-junction')?.active).toBe(true);
    expect(viewState.wires.get('pipeline-wire-536-ex-mem-feedback-to-pc-mux')?.active).toBe(true);
    expect(viewState.wires.get('pipeline-wire-465-branch-target-to-pc-mux')?.active).toBe(false);
  });

  it('highlights all occupied pipeline stages once the pipeline is filled', () => {
    const cpu = new PipelineCPU();
    const mapper = new ViewMapper(getDatapathConfig('pipeline'));
    const program = assemble(`
      addi x1, x0, 1
      addi x2, x0, 2
      addi x3, x0, 3
      addi x4, x0, 4
      addi x5, x0, 5
    `);

    cpu.loadProgram(program);
    for (let index = 0; index < 4; index++) {
      cpu.tick();
    }

    const viewState = mapper.mapSnapshot(cpu.getSnapshot());

    expect(viewState.wires.get('pipeline-wire-469-instr-mem-ir-to-if-id')?.active).toBe(true);
    expect(viewState.wires.get('pipeline-wire-557-if-id-imm-to-imm-gen')?.active).toBe(true);
    expect(viewState.wires.get('pipeline-wire-457-id-ex-imm32-to-alu-src-b')?.active).toBe(true);
    expect(viewState.wires.get('pipeline-wire-517-id-ex-pc4-to-ex-mem')?.active).toBe(true);
    expect(viewState.wires.get('pipeline-wire-543-ex-mem-pc4-to-mem-wb')?.active).toBe(true);
    expect(viewState.wires.get('pipeline-wire-467-mem-wb-alu-result-to-wb-mux')?.active).toBe(true);
    expect(viewState.components.get('if-id')?.highlighted).toBe(true);
    expect(viewState.components.get('id-ex')?.highlighted).toBe(true);
    expect(viewState.components.get('ex-mem')?.highlighted).toBe(true);
    expect(viewState.components.get('mem-wb')?.highlighted).toBe(true);
  });

  it('adds forwarding event highlights to the pipeline datapath', () => {
    const cpu = new PipelineCPU(4096, { forwardingEnabled: true });
    const mapper = new ViewMapper(getDatapathConfig('pipeline'));
    const program = assemble(`
      addi x1, x0, 1
      add x2, x1, x1
    `);

    cpu.loadProgram(program);
    for (let index = 0; index < 4; index++) {
      cpu.tick();
    }

    const snapshot = cpu.getSnapshot();
    const viewState = mapper.mapSnapshot(snapshot);

    expect(snapshot.pipeline.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ resolution: 'forward', forwardingSignal: 'ForwardA' }),
        expect.objectContaining({ resolution: 'forward', forwardingSignal: 'ForwardB' }),
      ])
    );
    expect(viewState.wires.get('pipeline-wire-501-id-ex-a-to-alu')?.active).toBe(true);
    expect(viewState.wires.get('pipeline-wire-493-id-ex-b-to-alu-src-b')?.active).toBe(true);
    expect(viewState.wires.get('pipeline-wire-500-alu-result-to-ex-mem')?.active).toBe(true);
    expect(viewState.components.get('alu')?.highlighted).toBe(true);
  });

  it('adds stall event highlights when forwarding is disabled', () => {
    const cpu = new PipelineCPU();
    const mapper = new ViewMapper(getDatapathConfig('pipeline'));
    const program = assemble(`
      addi x1, x0, 1
      add x2, x1, x1
    `);

    cpu.loadProgram(program);
    for (let index = 0; index < 3; index++) {
      cpu.tick();
    }

    const snapshot = cpu.getSnapshot();
    const viewState = mapper.mapSnapshot(snapshot);

    expect(snapshot.pipeline.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ resolution: 'stall', register: 1 }),
      ])
    );
    expect(viewState.wires.get('pipeline-wire-515-control-unit-to-id-ex-control')?.active).toBe(true);
    expect(viewState.components.get('pc')?.highlighted).toBe(true);
  });

  it('keeps held ID decode wires visible for a no-forwarding RAW wait overlap', () => {
    const cpu = new PipelineCPU(4096, { forwardingEnabled: false });
    const mapper = new ViewMapper(getDatapathConfig('pipeline'));
    const program = assemble(`
      add x1, x2, x3
      sub x4, x1, x5
    `);

    cpu.loadProgram(program);
    cpu.tick();
    const overlap = cpu.tick();
    const viewState = mapper.mapSnapshot(overlap);

    expect(overlap.pipeline.hazard.type).toBe('none');
    expect(overlap.pipeline.stages.EX.decodedInstruction?.asmString).toBe('add x1, x2, x3');
    expect(overlap.pipeline.stages.ID.decodedInstruction?.asmString).toBe('sub x4, x1, x5');
    expectWiresActive(viewState, [
      'pipeline-wire-435-if-id-rs1-to-regfile',
      'pipeline-wire-436-if-id-rs2-to-regfile',
      'pipeline-wire-437-if-id-rd-to-id-ex',
      'pipeline-wire-472-if-id-pc4-to-id-ex',
      'pipeline-wire-473-if-id-pc0-to-id-ex',
      'pipeline-wire-491-regfile-rd-b-to-id-ex',
      'pipeline-wire-492-regfile-rd-a-to-id-ex',
      'pipeline-wire-515-control-unit-to-id-ex-control',
      'pipeline-wire-557-if-id-imm-to-imm-gen',
      'pipeline-wire-558-imm-gen-offset-to-id-ex',
    ]);
    expect(viewState.components.get('pc')?.highlighted).toBe(true);
  });

  it('computes a transition sequence between consecutive snapshots', () => {
    const cpu = new CPU();
    const mapper = new ViewMapper();
    const program = assemble('addi x1, x0, 1');

    cpu.loadProgram(program);
    const ifSnapshot = cpu.tick();
    const idSnapshot = cpu.tick();
    const transition = mapper.computeTransition(ifSnapshot, idSnapshot);
    const targets = transition.steps.flatMap((step) => step.targets);

    expect(transition.totalDuration).toBeGreaterThan(0);
    expect(targets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ componentId: 'reg-file', property: 'highlighted', to: true }),
        expect.objectContaining({ wireId: 'ir-to-decoder', property: 'active', to: true }),
      ])
    );
  });
});
