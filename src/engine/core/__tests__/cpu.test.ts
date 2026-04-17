import { describe, expect, it } from 'vitest';
import { Stage } from '../../../types';
import { Assembler } from '../../assembler/encoder';
import { CPU } from '../cpu';

describe('CPU', () => {
  const assembler = new Assembler();

  const assemble = (source: string): Uint32Array => {
    const result = assembler.assemble(source);
    expect(result.errors).toEqual([]);
    return result.machineCode;
  };

  it('should fetch, decode, execute, and write back an addi instruction across cycles', () => {
    const cpu = new CPU();
    const program = assemble('addi x1, x0, 10');

    cpu.loadProgram(program);

    const ifSnapshot = cpu.tick();
    expect(ifSnapshot.stage).toBe(Stage.IF);
    expect(ifSnapshot.pipelineRegs.IR).toBe(program[0]);
    expect(ifSnapshot.pc).toBe(4);
    expect(ifSnapshot.controlSignals.IRWrite).toBe(true);

    const idSnapshot = cpu.tick();
    expect(idSnapshot.stage).toBe(Stage.ID);
    expect(idSnapshot.pipelineRegs.A).toBe(0);
    expect(idSnapshot.decodedInstruction.asmString).toBe('addi x1, x0, 10');

    const exSnapshot = cpu.tick();
    expect(exSnapshot.stage).toBe(Stage.EX);
    expect(exSnapshot.pipelineRegs.ALUOut).toBe(10);
    expect(exSnapshot.aluDetail.result).toBe(10);

    const wbSnapshot = cpu.tick();
    expect(wbSnapshot.stage).toBe(Stage.WB);
    expect(wbSnapshot.registers[1]).toBe(10);
    expect(cpu.getSnapshot().registers[1]).toBe(10);
    expect(cpu.getSnapshot().stage).toBe(Stage.IF);
  });

  it('should execute a simple three-instruction arithmetic program via step()', () => {
    const cpu = new CPU();
    const program = assemble(`
      addi x1, x0, 10
      addi x2, x0, 20
      add x3, x1, x2
    `);

    cpu.loadProgram(program);

    expect(cpu.step().map((snapshot) => snapshot.stage)).toEqual([Stage.IF, Stage.ID, Stage.EX, Stage.WB]);
    expect(cpu.step().map((snapshot) => snapshot.stage)).toEqual([Stage.IF, Stage.ID, Stage.EX, Stage.WB]);
    const addSnapshots = cpu.step();

    expect(addSnapshots.map((snapshot) => snapshot.stage)).toEqual([Stage.IF, Stage.ID, Stage.EX, Stage.WB]);
    expect(cpu.getSnapshot().registers[1]).toBe(10);
    expect(cpu.getSnapshot().registers[2]).toBe(20);
    expect(cpu.getSnapshot().registers[3]).toBe(30);
    expect(cpu.getHistory()).toHaveLength(12);
  });

  it('should execute memory and branch logic and support rewind', () => {
    const cpu = new CPU();
    const program = assemble(`
      addi x1, x0, 16
      addi x2, x0, 42
      sw x2, 0(x1)
      lw x3, 0(x1)
      beq x2, x3, 8
      addi x4, x0, 1
      addi x5, x0, 2
    `);

    cpu.loadProgram(program);

    cpu.step();
    cpu.step();
    cpu.step();
    cpu.step();
    const branchSnapshots = cpu.step();

    expect(cpu.getSnapshot().registers[3]).toBe(42);
    expect(branchSnapshots.map((snapshot) => snapshot.stage)).toEqual([Stage.IF, Stage.ID, Stage.EX]);
    expect(cpu.getSnapshot().registers[4]).toBe(0);

    const finalSnapshots = cpu.step();
    expect(finalSnapshots.map((snapshot) => snapshot.stage)).toEqual([Stage.IF, Stage.ID, Stage.EX, Stage.WB]);
    expect(cpu.getSnapshot().registers[5]).toBe(2);

    const rewindSnapshot = cpu.rewindTo(4);
    expect(rewindSnapshot.cycleNumber).toBe(4);
    expect(cpu.getSnapshot().registers[1]).toBe(16);
    expect(cpu.getSnapshot().registers[2]).toBe(0);
  });
});
