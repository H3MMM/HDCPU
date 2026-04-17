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

// 完整的周期快照
export interface CycleSnapshot {
  // 元信息
  cycleNumber: number;
  stage: Stage;
  instructionIndex: number;
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
