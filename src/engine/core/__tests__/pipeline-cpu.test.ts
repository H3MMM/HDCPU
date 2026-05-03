import { describe, expect, it } from 'vitest';
import { Stage } from '../../../types';
import { Assembler } from '../../assembler/encoder';
import { PipelineCPU } from '../pipeline-cpu';

describe('PipelineCPU', () => {
  const assembler = new Assembler();

  const assemble = (source: string): Uint32Array => {
    const result = assembler.assemble(source);
    expect(result.errors).toEqual([]);
    return result.machineCode;
  };

  it('advances one instruction through IF/ID, ID/EX, EX/MEM, and MEM/WB', () => {
    const cpu = new PipelineCPU();
    const program = assemble('addi x1, x0, 10');

    cpu.loadProgram(program);

    const afterFetch = cpu.tick();
    expect(afterFetch.pipeline.registers.ifId).toEqual(
      expect.objectContaining({
        status: 'valid',
        pc: 0,
        instructionWord: program[0],
      })
    );
    expect(afterFetch.pipeline.stages.ID.decodedInstruction?.asmString).toBe('addi x1, x0, 10');
    expect(afterFetch.stage).toBe(Stage.ID);

    const afterDecode = cpu.tick();
    expect(afterDecode.pipeline.registers.idEx).toEqual(
      expect.objectContaining({
        status: 'valid',
        pc: 0,
        rd: 1,
        rs1: 0,
        immediate: 10,
      })
    );
    expect(afterDecode.stage).toBe(Stage.EX);

    const afterExecute = cpu.tick();
    expect(afterExecute.pipeline.registers.exMem).toEqual(
      expect.objectContaining({
        status: 'valid',
        pc: 0,
        rd: 1,
        aluResult: 10,
      })
    );
    expect(afterExecute.stage).toBe(Stage.MEM);

    const afterMemory = cpu.tick();
    expect(afterMemory.pipeline.registers.memWb).toEqual(
      expect.objectContaining({
        status: 'valid',
        pc: 0,
        rd: 1,
        writeData: 10,
      })
    );
    expect(afterMemory.stage).toBe(Stage.WB);

    const afterWriteBack = cpu.tick();
    expect(afterWriteBack.registers[1]).toBe(10);
    expect(afterWriteBack.instructionIndex).toBe(1);
    expect(afterWriteBack.pipeline.registers.memWb.status).toBe('empty');
  });

  it('overlaps independent instructions in adjacent pipeline stages', () => {
    const cpu = new PipelineCPU();
    const program = assemble(`
      addi x1, x0, 10
      addi x2, x0, 20
    `);

    cpu.loadProgram(program);
    cpu.tick();
    const afterSecondCycle = cpu.tick();

    expect(afterSecondCycle.pipeline.stages.ID.decodedInstruction?.asmString).toBe('addi x2, x0, 20');
    expect(afterSecondCycle.pipeline.stages.EX.decodedInstruction?.asmString).toBe('addi x1, x0, 10');

    cpu.tick();
    cpu.tick();
    cpu.tick();
    const completed = cpu.tick();

    expect(completed.instructionIndex).toBe(2);
    expect(completed.registers[1]).toBe(10);
    expect(completed.registers[2]).toBe(20);
  });
});
