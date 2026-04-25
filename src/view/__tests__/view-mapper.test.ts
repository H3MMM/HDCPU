import { describe, expect, it } from 'vitest';
import { Stage } from '../../types';
import { Assembler } from '../../engine/assembler/encoder';
import { CPU } from '../../engine/core/cpu';
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
