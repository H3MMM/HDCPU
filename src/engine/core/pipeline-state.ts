import {
  ALUOp,
  ImmType,
  Stage,
  type ControlSignals,
  type EXMEMPipelineRegister,
  type IDEXPipelineRegister,
  type IFIDPipelineRegister,
  type MEMWBPipelineRegister,
  type PipelineInstructionSlot,
  type PipelineSnapshot,
} from '../../types';

export function createPipelineDefaultControlSignals(): ControlSignals {
  return {
    PCWrite: false,
    PCWriteCond: false,
    IorD: false,
    MemRead: false,
    MemWrite: false,
    MemToReg: 0,
    IRWrite: false,
    RegWrite: false,
    ALUSrcA: 0,
    ALUSrcB: 0,
    ALUOp: ALUOp.ADD,
    PCSource: 0,
    Branch: false,
    ImmSrc: ImmType.NONE,
  };
}

export function createEmptyPipelineInstructionSlot(stage: Stage): PipelineInstructionSlot {
  return {
    stage,
    status: 'empty',
    pc: 0,
    instructionWord: 0,
    decodedInstruction: null,
  };
}

export function createEmptyPipelineRegisterBase() {
  return {
    status: 'empty' as const,
    pc: 0,
    pcPlus4: 0,
    instructionWord: 0,
    decodedInstruction: null,
  };
}

export function createEmptyIFIDPipelineRegister(): IFIDPipelineRegister {
  return createEmptyPipelineRegisterBase();
}

export function createEmptyIDEXPipelineRegister(): IDEXPipelineRegister {
  return {
    ...createEmptyPipelineRegisterBase(),
    rs1: 0,
    rs2: 0,
    rd: 0,
    rs1Value: 0,
    rs2Value: 0,
    immediate: 0,
    controlSignals: createPipelineDefaultControlSignals(),
  };
}

export function createEmptyEXMEMPipelineRegister(): EXMEMPipelineRegister {
  return {
    ...createEmptyPipelineRegisterBase(),
    rd: 0,
    aluResult: 0,
    writeData: 0,
    branchTarget: 0,
    branchTaken: false,
    zero: false,
    controlSignals: createPipelineDefaultControlSignals(),
  };
}

export function createEmptyMEMWBPipelineRegister(): MEMWBPipelineRegister {
  return {
    ...createEmptyPipelineRegisterBase(),
    rd: 0,
    aluResult: 0,
    readData: 0,
    immediate: 0,
    writeData: 0,
    controlSignals: createPipelineDefaultControlSignals(),
  };
}

export function createEmptyPipelineSnapshot(cycleNumber: number = 0): PipelineSnapshot {
  return {
    cycleNumber,
    stages: {
      IF: createEmptyPipelineInstructionSlot(Stage.IF),
      ID: createEmptyPipelineInstructionSlot(Stage.ID),
      EX: createEmptyPipelineInstructionSlot(Stage.EX),
      MEM: createEmptyPipelineInstructionSlot(Stage.MEM),
      WB: createEmptyPipelineInstructionSlot(Stage.WB),
    },
    registers: {
      ifId: createEmptyIFIDPipelineRegister(),
      idEx: createEmptyIDEXPipelineRegister(),
      exMem: createEmptyEXMEMPipelineRegister(),
      memWb: createEmptyMEMWBPipelineRegister(),
    },
  };
}
