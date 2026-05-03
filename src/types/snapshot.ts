import { Stage, ControlSignals, DecodedInstruction, ALUOp, ComponentID } from './cpu';

// 数据通路活动：描述本周期内哪些连线是"活跃"的
export interface DataPathActivity {
  from: ComponentID;    // 源部件
  to: ComponentID;      // 目标部件
  portFrom: string;     // 源端口名
  portTo: string;       // 目标端口名
  value: number;        // 传输的数据值
  busWidth: number;     // 总线宽度 (1/5/12/32)
  signalType: 'data' | 'control' | 'address'; // 信号类型
}

// 状态变更记录
export interface StateChange {
  target: string;       // 如 "registers[1]", "pc", "ALUOut"
  oldValue: number;
  newValue: number;
}

export type PipelineStageKey = 'IF' | 'ID' | 'EX' | 'MEM' | 'WB';
export type PipelineRegisterStatus = 'empty' | 'valid' | 'bubble' | 'flushed' | 'stalled';
export type PipelineHazardType = 'none' | 'raw' | 'control';
export type PipelineHazardAction = 'none' | 'stall' | 'flush';
export type PipelineSourceRegister = 'rs1' | 'rs2';
export type PipelineForwardingSource = 'none' | 'exMem' | 'memWb';

export interface PipelineInstructionSlot {
  stage: Stage;
  status: PipelineRegisterStatus;
  pc: number;
  instructionWord: number;
  decodedInstruction: DecodedInstruction | null;
}

export interface PipelineRegisterBase {
  status: PipelineRegisterStatus;
  pc: number;
  pcPlus4: number;
  instructionWord: number;
  decodedInstruction: DecodedInstruction | null;
}

export type IFIDPipelineRegister = PipelineRegisterBase;

export interface IDEXPipelineRegister extends PipelineRegisterBase {
  rs1: number;
  rs2: number;
  rd: number;
  rs1Value: number;
  rs2Value: number;
  immediate: number;
  controlSignals: Readonly<ControlSignals>;
}

export interface EXMEMPipelineRegister extends PipelineRegisterBase {
  rd: number;
  aluResult: number;
  writeData: number;
  branchTarget: number;
  branchTaken: boolean;
  zero: boolean;
  controlSignals: Readonly<ControlSignals>;
}

export interface MEMWBPipelineRegister extends PipelineRegisterBase {
  rd: number;
  aluResult: number;
  readData: number;
  immediate: number;
  writeData: number;
  controlSignals: Readonly<ControlSignals>;
}

export interface PipelineInstructionRef {
  stage: Stage;
  pc: number;
  instructionWord: number;
  asmString: string;
}

export interface PipelineRawHazardDetail {
  register: number;
  source: PipelineSourceRegister;
  consumer: PipelineInstructionRef;
  producer: PipelineInstructionRef;
}

export interface PipelineControlHazardDetail {
  redirectPC: number;
  producer: PipelineInstructionRef;
}

export interface PipelineHazardSnapshot {
  type: PipelineHazardType;
  action: PipelineHazardAction;
  pcWrite: boolean;
  ifIdWrite: boolean;
  ifIdFlush: boolean;
  idExFlush: boolean;
  stallFetch: boolean;
  stallDecode: boolean;
  insertBubble: boolean;
  reason: string;
  raw: PipelineRawHazardDetail | null;
  control: PipelineControlHazardDetail | null;
}

export interface PipelineForwardingSignal {
  source: PipelineForwardingSource;
  register: number;
  producer: PipelineInstructionRef | null;
}

export interface PipelineForwardingSnapshot {
  enabled: boolean;
  ForwardA: PipelineForwardingSignal;
  ForwardB: PipelineForwardingSignal;
  StoreForward: PipelineForwardingSignal;
}

export interface PipelineSnapshot {
  cycleNumber: number;
  stages: Readonly<Record<PipelineStageKey, PipelineInstructionSlot>>;
  registers: Readonly<{
    ifId: IFIDPipelineRegister;
    idEx: IDEXPipelineRegister;
    exMem: EXMEMPipelineRegister;
    memWb: MEMWBPipelineRegister;
  }>;
  hazard: Readonly<PipelineHazardSnapshot>;
  forwarding: Readonly<PipelineForwardingSnapshot>;
}

// 完整的周期快照
export interface CycleSnapshot {
  // 元信息
  cycleNumber: number;
  stage: Stage;
  instructionIndex: number;
  instructionAddress: number;
  decodedInstruction: DecodedInstruction;

  // 程序员可见状态
  pc: number;
  nextPC: number;
  registers: readonly number[];  // 不可变数组

  // 段间暂存器
  pipelineRegs: Readonly<{
    IR: number;
    MDR: number;
    A: number;
    B: number;
    ALUOut: number;
  }>;

  // Five-stage pipeline state for IF/ID, ID/EX, EX/MEM, and MEM/WB.
  pipeline: Readonly<PipelineSnapshot>;

  // 控制信号
  controlSignals: Readonly<ControlSignals>;

  // ALU 详情
  aluDetail: Readonly<{
    inputA: number;
    inputB: number;
    operation: ALUOp;
    result: number;
    zero: boolean;
  }>;

  // 数据通路活动
  activeDataPaths: readonly DataPathActivity[];

  // 存储器访问
  memoryAccess: Readonly<{
    type: 'none' | 'read' | 'write';
    address: number;
    data: number;
  }>;

  // 状态变更
  changes: readonly StateChange[];
}
