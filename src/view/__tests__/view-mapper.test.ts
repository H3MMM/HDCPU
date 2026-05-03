import { describe, expect, it } from 'vitest';
import { Stage } from '../../types';
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
    expect(exViewState.wires.get('pipeline-wire-457-id-ex-imm32-to-alu-src-b')?.active).toBe(true);
    expect(exViewState.wires.get('pipeline-wire-511-branch-logic-to-branch-target')?.active).toBe(false);
    expect(exViewState.wires.get('pipeline-wire-500-alu-result-to-ex-mem')?.active).toBe(true);
    expect(exViewState.components.get('pc-plus4')?.highlighted).toBe(false);
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
