import { describe, expect, it } from 'vitest';
import { Stage, type CycleSnapshot } from '../../../types';
import { Assembler } from '../../assembler/encoder';
import { PipelineCPU } from '../pipeline-cpu';

describe('PipelineCPU', () => {
  const assembler = new Assembler();

  const assemble = (source: string): Uint32Array => {
    const result = assembler.assemble(source);
    expect(result.errors).toEqual([]);
    return result.machineCode;
  };

  const expectRawStall = (
    snapshot: CycleSnapshot,
    producerStage: Stage,
    consumerAsm: string,
    producerAsm: string,
    register: number
  ): void => {
    expect(snapshot.pipeline.hazard).toEqual(
      expect.objectContaining({
        type: 'raw',
        action: 'stall',
        insertBubble: true,
      })
    );
    expect(snapshot.pipeline.hazard.raw).toEqual(
      expect.objectContaining({
        register,
        consumer: expect.objectContaining({ asmString: consumerAsm }),
        producer: expect.objectContaining({
          stage: producerStage,
          asmString: producerAsm,
        }),
      })
    );
    expect(snapshot.pipeline.registers.ifId.decodedInstruction?.asmString).toBe(consumerAsm);
    expect(snapshot.pipeline.registers.idEx.status).toBe('bubble');
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

  it('stalls on RAW hazards until the producer completes write-back', () => {
    const cpu = new PipelineCPU();
    const program = assemble(`
      addi x1, x0, 5
      add x2, x1, x1
      addi x3, x0, 7
    `);

    cpu.loadProgram(program);
    cpu.tick();
    cpu.tick();

    const firstStall = cpu.tick();
    expect(firstStall.pipeline.hazard).toEqual(
      expect.objectContaining({
        type: 'raw',
        action: 'stall',
        pcWrite: false,
        ifIdWrite: false,
        insertBubble: true,
      })
    );
    expect(firstStall.pipeline.hazard.raw).toEqual(
      expect.objectContaining({
        register: 1,
        source: 'rs1',
      })
    );
    expect(firstStall.pipeline.conflicts).toEqual([
      expect.objectContaining({
        type: 'data',
        resolution: 'stall',
        register: 1,
        source: 'rs1',
        forwardingSignal: null,
      }),
    ]);
    expect(firstStall.pipeline.conflicts[0].consumer?.asmString).toBe('add x2, x1, x1');
    expect(firstStall.pipeline.conflicts[0].producer?.asmString).toBe('addi x1, x0, 5');
    expect(firstStall.pipeline.registers.ifId.decodedInstruction?.asmString).toBe('add x2, x1, x1');
    expect(firstStall.pipeline.registers.idEx.status).toBe('bubble');
    expect(firstStall.pipeline.hazard.raw?.producer.stage).toBe(Stage.EX);

    const secondStall = cpu.tick();
    expect(secondStall.pipeline.hazard.raw?.producer.stage).toBe(Stage.MEM);
    expect(secondStall.pipeline.registers.ifId.decodedInstruction?.asmString).toBe('add x2, x1, x1');

    const thirdStall = cpu.tick();
    expect(thirdStall.pipeline.hazard.raw?.producer.stage).toBe(Stage.WB);
    expect(thirdStall.pipeline.registers.ifId.decodedInstruction?.asmString).toBe('add x2, x1, x1');
    expect(thirdStall.pipeline.registers.idEx.status).toBe('bubble');
    expect(thirdStall.registers[1]).toBe(5);

    const released = cpu.tick();
    expect(released.pipeline.hazard.type).toBe('none');
    expect(released.pipeline.registers.idEx.decodedInstruction?.asmString).toBe('add x2, x1, x1');
    expect(released.pipeline.registers.idEx.rs1Value).toBe(5);
    expect(released.pipeline.registers.idEx.rs2Value).toBe(5);

    for (let index = 0; index < 8; index++) {
      cpu.tick();
    }

    const completed = cpu.getSnapshot();
    expect(completed.registers[1]).toBe(5);
    expect(completed.registers[2]).toBe(10);
    expect(completed.registers[3]).toBe(7);
  });

  it('matches the textbook no-forwarding RAW schedule through WB for chained dependencies', () => {
    const cpu = new PipelineCPU(4096, { forwardingEnabled: false });
    const program = assemble(`
      addi x1, x0, 4
      add x2, x1, x1
      sub x3, x2, x1
      sw x3, 64(x0)
    `);

    cpu.loadProgram(program);

    const snapshots = Array.from({ length: 14 }, () => cpu.tick());

    expectRawStall(snapshots[2], Stage.EX, 'add x2, x1, x1', 'addi x1, x0, 4', 1);
    expectRawStall(snapshots[3], Stage.MEM, 'add x2, x1, x1', 'addi x1, x0, 4', 1);
    expectRawStall(snapshots[4], Stage.WB, 'add x2, x1, x1', 'addi x1, x0, 4', 1);
    expect(snapshots[5].pipeline.hazard.type).toBe('none');
    expect(snapshots[5].pipeline.registers.idEx.decodedInstruction?.asmString).toBe('add x2, x1, x1');
    expect(snapshots[5].pipeline.registers.idEx.rs1Value).toBe(4);
    expect(snapshots[5].pipeline.registers.idEx.rs2Value).toBe(4);

    expectRawStall(snapshots[6], Stage.EX, 'sub x3, x2, x1', 'add x2, x1, x1', 2);
    expectRawStall(snapshots[7], Stage.MEM, 'sub x3, x2, x1', 'add x2, x1, x1', 2);
    expectRawStall(snapshots[8], Stage.WB, 'sub x3, x2, x1', 'add x2, x1, x1', 2);
    expect(snapshots[9].pipeline.hazard.type).toBe('none');
    expect(snapshots[9].pipeline.registers.idEx.decodedInstruction?.asmString).toBe('sub x3, x2, x1');
    expect(snapshots[9].pipeline.registers.idEx.rs1Value).toBe(8);
    expect(snapshots[9].pipeline.registers.idEx.rs2Value).toBe(4);

    expectRawStall(snapshots[10], Stage.EX, 'sw x3, 64(x0)', 'sub x3, x2, x1', 3);
    expectRawStall(snapshots[11], Stage.MEM, 'sw x3, 64(x0)', 'sub x3, x2, x1', 3);
    expectRawStall(snapshots[12], Stage.WB, 'sw x3, 64(x0)', 'sub x3, x2, x1', 3);
    expect(snapshots[13].pipeline.hazard.type).toBe('none');
    expect(snapshots[13].pipeline.registers.idEx.decodedInstruction?.asmString).toBe('sw x3, 64(x0)');
    expect(snapshots[13].pipeline.registers.idEx.rs2Value).toBe(4);

    for (let index = 0; index < 5; index++) {
      cpu.tick();
    }

    expect(Array.from(cpu.getDataMemory().slice(64, 68))).toEqual([4, 0, 0, 0]);
  });

  it('does not treat x0 writes as RAW producers when forwarding is disabled', () => {
    const cpu = new PipelineCPU(4096, { forwardingEnabled: false });
    const program = assemble(`
      addi x0, x0, 4
      add x2, x0, x0
    `);

    cpu.loadProgram(program);
    cpu.tick();
    cpu.tick();

    const noStall = cpu.tick();
    expect(noStall.pipeline.hazard.type).toBe('none');
    expect(noStall.pipeline.registers.idEx.decodedInstruction?.asmString).toBe('add x2, x0, x0');
  });

  it('uses ForwardA and ForwardB for adjacent ALU dependencies when forwarding is enabled', () => {
    const cpu = new PipelineCPU(4096, { forwardingEnabled: true });
    const program = assemble(`
      addi x1, x0, 5
      add x2, x1, x1
      addi x3, x0, 7
    `);

    cpu.loadProgram(program);
    cpu.tick();
    cpu.tick();

    const noStall = cpu.tick();
    expect(noStall.pipeline.hazard.type).toBe('none');
    expect(noStall.pipeline.registers.idEx.decodedInstruction?.asmString).toBe('add x2, x1, x1');

    const forwarded = cpu.tick();
    expect(forwarded.pipeline.forwarding.enabled).toBe(true);
    expect(forwarded.pipeline.forwarding.ForwardA).toEqual(
      expect.objectContaining({
        source: 'exMem',
        register: 1,
      })
    );
    expect(forwarded.pipeline.forwarding.ForwardB).toEqual(
      expect.objectContaining({
        source: 'exMem',
        register: 1,
      })
    );
    expect(forwarded.pipeline.forwarding.ForwardA.producer?.asmString).toBe('addi x1, x0, 5');
    expect(forwarded.pipeline.conflicts).toEqual([
      expect.objectContaining({
        type: 'data',
        resolution: 'forward',
        register: 1,
        source: 'rs1',
        forwardingSignal: 'ForwardA',
      }),
      expect.objectContaining({
        type: 'data',
        resolution: 'forward',
        register: 1,
        source: 'rs2',
        forwardingSignal: 'ForwardB',
      }),
    ]);
    expect(forwarded.pipeline.registers.exMem.decodedInstruction?.asmString).toBe('add x2, x1, x1');
    expect(forwarded.pipeline.registers.exMem.aluResult).toBe(10);

    for (let index = 0; index < 6; index++) {
      cpu.tick();
    }

    const completed = cpu.getSnapshot();
    expect(completed.registers[1]).toBe(5);
    expect(completed.registers[2]).toBe(10);
    expect(completed.registers[3]).toBe(7);
  });

  it('forwards load data from MEM to EX for load-use dependencies when forwarding is enabled', () => {
    const cpu = new PipelineCPU(4096, { forwardingEnabled: true });
    const program = assemble(`
      lw x1, 64(x0)
      add x2, x1, x1
    `);

    cpu.loadProgram(program);
    cpu.setDataMemoryByte(64, 0x2A);
    cpu.tick();
    cpu.tick();

    const noStall = cpu.tick();
    expect(noStall.pipeline.hazard.type).toBe('none');
    expect(noStall.pipeline.registers.idEx.decodedInstruction?.asmString).toBe('add x2, x1, x1');

    const forwarded = cpu.tick();
    expect(forwarded.memoryAccess).toEqual(
      expect.objectContaining({
        type: 'read',
        address: 64,
        data: 42,
      })
    );
    expect(forwarded.pipeline.forwarding.ForwardA.source).toBe('exMem');
    expect(forwarded.pipeline.forwarding.ForwardB.source).toBe('exMem');
    expect(forwarded.pipeline.conflicts.map((event) => event.forwardingSignal)).toEqual(['ForwardA', 'ForwardB']);
    expect(forwarded.pipeline.conflicts.every((event) => event.resolution === 'forward')).toBe(true);
    expect(forwarded.pipeline.conflicts[0].producer?.asmString).toBe('lw x1, 64(x0)');
    expect(forwarded.pipeline.registers.exMem.aluResult).toBe(84);

    for (let index = 0; index < 5; index++) {
      cpu.tick();
    }

    const completed = cpu.getSnapshot();
    expect(completed.registers[1]).toBe(42);
    expect(completed.registers[2]).toBe(84);
  });

  it('uses StoreForward for store write data dependencies when forwarding is enabled', () => {
    const cpu = new PipelineCPU(4096, { forwardingEnabled: true });
    const program = assemble(`
      addi x1, x0, 99
      sw x1, 64(x0)
      lw x2, 64(x0)
    `);

    cpu.loadProgram(program);
    cpu.tick();
    cpu.tick();
    cpu.tick();

    const forwarded = cpu.tick();
    expect(forwarded.pipeline.forwarding.StoreForward).toEqual(
      expect.objectContaining({
        source: 'exMem',
        register: 1,
      })
    );
    expect(forwarded.pipeline.forwarding.StoreForward.producer?.asmString).toBe('addi x1, x0, 99');
    expect(forwarded.pipeline.conflicts).toEqual([
      expect.objectContaining({
        type: 'data',
        resolution: 'forward',
        register: 1,
        source: 'storeData',
        forwardingSignal: 'StoreForward',
      }),
    ]);
    expect(forwarded.pipeline.conflicts[0].consumer?.asmString).toBe('sw x1, 64(x0)');
    expect(forwarded.pipeline.registers.exMem.decodedInstruction?.asmString).toBe('sw x1, 64(x0)');
    expect(forwarded.pipeline.registers.exMem.writeData).toBe(99);

    for (let index = 0; index < 7; index++) {
      cpu.tick();
    }

    const completed = cpu.getSnapshot();
    expect(Array.from(cpu.getDataMemory().slice(64, 68))).toEqual([99, 0, 0, 0]);
    expect(completed.registers[2]).toBe(99);
  });

  it('flushes younger stages when a control transfer resolves in EX', () => {
    const cpu = new PipelineCPU();
    const program = assemble(`
      beq x0, x0, 8
      addi x1, x0, 1
      addi x2, x0, 2
    `);

    cpu.loadProgram(program);
    cpu.tick();
    cpu.tick();

    const flushed = cpu.tick();
    expect(flushed.pipeline.hazard).toEqual(
      expect.objectContaining({
        type: 'control',
        action: 'flush',
        ifIdFlush: true,
        idExFlush: true,
      })
    );
    expect(flushed.pipeline.hazard.control?.redirectPC).toBe(8);
    expect(flushed.pipeline.conflicts).toEqual([
      expect.objectContaining({
        type: 'control',
        resolution: 'flush',
        redirectPC: 8,
      }),
    ]);
    expect(flushed.pipeline.conflicts[0].producer?.asmString).toBe('beq x0, x0, 8');
    expect(flushed.pipeline.registers.ifId.status).toBe('flushed');
    expect(flushed.pipeline.registers.idEx.status).toBe('flushed');
    expect(flushed.pipeline.stages.IF.decodedInstruction?.asmString).toBe('addi x2, x0, 2');

    for (let index = 0; index < 8; index++) {
      cpu.tick();
    }

    const completed = cpu.getSnapshot();
    expect(completed.registers[1]).toBe(0);
    expect(completed.registers[2]).toBe(2);
  });

  it('can stall fetch until a control transfer reaches EX', () => {
    const cpu = new PipelineCPU(4096, { controlHazardStrategy: 'stall-until-resolved' });
    const program = assemble(`
      beq x0, x0, 8
      addi x1, x0, 1
      addi x2, x0, 2
    `);

    cpu.loadProgram(program);
    cpu.tick();

    const stalled = cpu.tick();
    expect(stalled.pipeline.controlStrategy).toBe('stall-until-resolved');
    expect(stalled.pipeline.hazard).toEqual(
      expect.objectContaining({
        type: 'control',
        action: 'stall',
        pcWrite: false,
      })
    );
    expect(stalled.pipeline.stages.IF.status).toBe('stalled');
    expect(stalled.pipeline.stages.ID.status).toBe('stalled');
    expect(stalled.pipeline.stages.EX.decodedInstruction?.asmString).toBe('beq x0, x0, 8');
    expect(stalled.pipeline.conflicts).toEqual([
      expect.objectContaining({
        type: 'control',
        resolution: 'stall',
      }),
    ]);

    const flushed = cpu.tick();
    expect(flushed.pipeline.hazard.action).toBe('flush');
    expect(flushed.pipeline.hazard.control?.redirectPC).toBe(8);

    for (let index = 0; index < 8; index++) {
      cpu.tick();
    }

    const completed = cpu.getSnapshot();
    expect(completed.registers[1]).toBe(0);
    expect(completed.registers[2]).toBe(2);
  });
});
