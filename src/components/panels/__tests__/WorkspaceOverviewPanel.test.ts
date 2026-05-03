import type { MachineCodeRow } from '../../../store/cpu-store';
import { createEmptyPipelineSnapshot } from '../../../engine/core/pipeline-state';
import { Stage, type CycleSnapshot, type DecodedInstruction } from '../../../types';
import { getNextInstruction } from '../WorkspaceOverviewPanel';

function createInstruction(overrides: Partial<DecodedInstruction>): DecodedInstruction {
  return {
    raw: 0,
    format: 'I',
    opcode: 0x13,
    rd: 0,
    funct3: 0,
    rs1: 0,
    rs2: 0,
    funct7: 0,
    immediate: 0,
    asmString: 'addi x0, x0, 0',
    description: '',
    ...overrides,
  };
}

function createSnapshot(overrides: Partial<CycleSnapshot> = {}): CycleSnapshot {
  return {
    cycleNumber: 0,
    stage: Stage.IF,
    instructionIndex: 0,
    instructionAddress: 0,
    decodedInstruction: createInstruction({}),
    pc: 0,
    nextPC: 0,
    registers: Array<number>(32).fill(0),
    pipelineRegs: {
      IR: 0,
      MDR: 0,
      A: 0,
      B: 0,
      ALUOut: 0,
    },
    pipeline: createEmptyPipelineSnapshot(),
    controlSignals: {} as CycleSnapshot['controlSignals'],
    aluDetail: {} as CycleSnapshot['aluDetail'],
    activeDataPaths: [],
    memoryAccess: {
      type: 'none',
      address: 0,
      data: 0,
    },
    changes: [],
    ...overrides,
  };
}

function createRows(): MachineCodeRow[] {
  return [
    {
      index: 0,
      address: 0,
      machineCode: 0,
      binary: '',
      assembly: 'jal x0, 8',
      current: true,
    },
    {
      index: 1,
      address: 4,
      machineCode: 0,
      binary: '',
      assembly: 'addi x1, x0, 1',
      current: false,
    },
    {
      index: 2,
      address: 8,
      machineCode: 0,
      binary: '',
      assembly: 'addi x2, x0, 2',
      current: false,
    },
  ];
}

describe('WorkspaceOverviewPanel next instruction preview', () => {
  it('uses a jump label target instead of the following row', () => {
    const instruction = createInstruction({
      format: 'J',
      opcode: 0x6F,
      immediate: 8,
      asmString: 'jal x0, 8',
    });

    expect(getNextInstruction(createRows(), instruction, createSnapshot())).toBe('addi x2, x0, 2');
  });

  it('uses the branch target only when the branch condition is true', () => {
    const instruction = createInstruction({
      format: 'B',
      opcode: 0x63,
      funct3: 0x0,
      rs1: 1,
      rs2: 2,
      immediate: 8,
      asmString: 'beq x1, x2, 8',
    });
    const takenRegisters = Array<number>(32).fill(0);
    takenRegisters[1] = 7;
    takenRegisters[2] = 7;
    const fallthroughRegisters = Array<number>(32).fill(0);
    fallthroughRegisters[1] = 7;
    fallthroughRegisters[2] = 8;

    expect(getNextInstruction(createRows(), instruction, createSnapshot({ registers: takenRegisters }))).toBe(
      'addi x2, x0, 2'
    );
    expect(getNextInstruction(createRows(), instruction, createSnapshot({ registers: fallthroughRegisters }))).toBe(
      'addi x1, x0, 1'
    );
  });
});
