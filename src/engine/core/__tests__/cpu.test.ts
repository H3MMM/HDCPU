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

    const initialSnapshot = cpu.getSnapshot();
    expect(initialSnapshot.stage).toBe(Stage.IF);
    expect(initialSnapshot.aluDetail).toEqual(
      expect.objectContaining({ inputA: 0, inputB: 4, result: 4 })
    );

    const ifSnapshot = cpu.tick();
    expect(ifSnapshot.stage).toBe(Stage.IF);
    expect(ifSnapshot.pipelineRegs.IR).toBe(program[0]);
    expect(ifSnapshot.pc).toBe(4);
    expect(ifSnapshot.aluDetail).toEqual(
      expect.objectContaining({ inputA: 0, inputB: 4, result: 4 })
    );
    expect(ifSnapshot.controlSignals.IRWrite).toBe(true);
    expect(ifSnapshot.activeDataPaths).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: 'pc', to: 'instr-mem', value: 0 }),
        expect.objectContaining({ from: 'instr-mem', to: 'ir', value: program[0] }),
      ])
    );
    expect(ifSnapshot.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ target: 'pc', oldValue: 0, newValue: 4 }),
        expect.objectContaining({ target: 'IR', oldValue: 0, newValue: program[0] }),
      ])
    );
    expect(cpu.getSnapshot().stage).toBe(Stage.ID);
    expect(cpu.getSnapshot().aluDetail).toEqual(
      expect.objectContaining({ inputA: 0, inputB: 0, result: 0 })
    );

    const idSnapshot = cpu.tick();
    expect(idSnapshot.stage).toBe(Stage.ID);
    expect(idSnapshot.pipelineRegs.A).toBe(0);
    expect(idSnapshot.decodedInstruction.asmString).toBe('addi x1, x0, 10');
    expect(cpu.getSnapshot().aluDetail).toEqual(
      expect.objectContaining({ inputA: 0, inputB: 10, result: 10 })
    );

    const exSnapshot = cpu.tick();
    expect(exSnapshot.stage).toBe(Stage.EX);
    expect(exSnapshot.pipelineRegs.ALUOut).toBe(10);
    expect(exSnapshot.aluDetail.result).toBe(10);

    const wbSnapshot = cpu.tick();
    expect(wbSnapshot.stage).toBe(Stage.WB);
    expect(wbSnapshot.registers[1]).toBe(10);
    expect(wbSnapshot.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ target: 'registers[1]', oldValue: 0, newValue: 10 }),
      ])
    );
    expect(cpu.getSnapshot().registers[1]).toBe(10);
    expect(cpu.getSnapshot().stage).toBe(Stage.IF);
  });

  it('includes five-stage pipeline register state in snapshots', () => {
    const cpu = new CPU();
    const program = assemble('addi x1, x0, 10');

    cpu.loadProgram(program);
    const snapshot = cpu.getSnapshot();

    expect(Object.keys(snapshot.pipeline.stages)).toEqual(['IF', 'ID', 'EX', 'MEM', 'WB']);
    expect(snapshot.pipeline.cycleNumber).toBe(snapshot.cycleNumber);
    expect(snapshot.pipeline.registers.ifId).toEqual(
      expect.objectContaining({
        status: 'empty',
        pc: 0,
        pcPlus4: 0,
        instructionWord: 0,
        decodedInstruction: null,
      })
    );
    expect(snapshot.pipeline.registers.idEx).toEqual(
      expect.objectContaining({
        status: 'empty',
        rs1: 0,
        rs2: 0,
        rd: 0,
        rs1Value: 0,
        rs2Value: 0,
        immediate: 0,
      })
    );
    expect(snapshot.pipeline.registers.exMem).toEqual(
      expect.objectContaining({
        status: 'empty',
        rd: 0,
        aluResult: 0,
        writeData: 0,
        branchTaken: false,
      })
    );
    expect(snapshot.pipeline.registers.memWb).toEqual(
      expect.objectContaining({
        status: 'empty',
        rd: 0,
        aluResult: 0,
        readData: 0,
        writeData: 0,
      })
    );
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

  it('should execute lui as a direct imm32 write without using the ALU result path', () => {
    const cpu = new CPU();
    const program = assemble('lui x2, 0x12345');

    cpu.loadProgram(program);
    const snapshots = cpu.step();

    expect(snapshots.map((snapshot) => snapshot.stage)).toEqual([Stage.IF, Stage.EX]);
    expect(cpu.getSnapshot().registers[2]).toBe(0x12345000);
    expect(snapshots[1].activeDataPaths).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: 'id-decoder', to: 'mux-wb', portFrom: 'imm32', portTo: 'in3' }),
        expect.objectContaining({ from: 'mux-wb', to: 'reg-file', portTo: 'write_data' }),
      ])
    );
    expect(snapshots[1].activeDataPaths).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: 'alu', to: 'alu-out' }),
      ])
    );
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

  it('should map wide data addresses onto the configured data memory space', () => {
    const cpu = new CPU(0x10000);
    const program = assemble(`
      lui x1, 0x12340
      addi x1, x1, 64
      addi x2, x0, 99
      sw x2, 0(x1)
      lw x3, 0(x1)
    `);

    cpu.loadProgram(program);

    for (let index = 0; index < 5; index++) {
      cpu.step();
    }

    expect(cpu.getSnapshot().registers[3]).toBe(99);
    expect(Array.from(cpu.getDataMemory().slice(0x40, 0x44))).toEqual([99, 0, 0, 0]);
  });
});
