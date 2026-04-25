// CPU 核心类型定义

// 多周期阶段
export enum Stage {
  IF = 'IF',   // 取指
  ID = 'ID',   // 译码
  EX = 'EX',   // 执行
  MEM = 'MEM', // 访存
  WB = 'WB',   // 写回
}

// ALU 操作类型
export enum ALUOp {
  ADD = 'ADD',
  SUB = 'SUB',
  AND = 'AND',
  OR = 'OR',
  XOR = 'XOR',
  SLT = 'SLT',
  SLTU = 'SLTU',
  SLL = 'SLL',
  SRL = 'SRL',
  SRA = 'SRA',
}

// 立即数类型
export enum ImmType {
  I = 'I',
  S = 'S',
  B = 'B',
  U = 'U',
  J = 'J',
  NONE = 'NONE',
}

// 指令格式类型
export type InstructionFormat = 'R' | 'I' | 'S' | 'B' | 'U' | 'J';

// 控制信号
export interface ControlSignals {
  // 主控制信号
  PCWrite: boolean;        // PC 写使能
  PCWriteCond: boolean;    // 条件 PC 写（分支）
  IorD: boolean;           // 存储器地址来源: 0=PC, 1=ALUOut
  MemRead: boolean;        // 存储器读使能
  MemWrite: boolean;       // 存储器写使能
  MemToReg: 0 | 1 | 2 | 3; // 写回数据来源: 0=ALUOut, 1=MDR, 2=PC+4, 3=imm32
  IRWrite: boolean;        // IR 写使能
  RegWrite: boolean;       // 寄存器堆写使能

  // ALU 控制
  ALUSrcA: 0 | 1;         // ALU 输入 A: 0=PC, 1=寄存器A
  ALUSrcB: 0 | 1 | 2 | 3; // ALU 输入 B: 0=寄存器B, 1=4, 2=立即数, 3=立即数<<1
  ALUOp: ALUOp;           // ALU 操作类型

  // 分支/跳转
  PCSource: 0 | 1 | 2;    // PC 来源: 0=ALU结果, 1=ALUOut, 2=跳转地址
  Branch: boolean;         // 是否为分支指令

  // 扩展信号（便于可视化）
  ImmSrc: ImmType;         // 立即数类型
}

// 解码后的指令
export interface DecodedInstruction {
  raw: number;                   // 原始 32 位机器码
  format: InstructionFormat;
  opcode: number;                // [6:0]
  rd: number;                    // [11:7]  目的寄存器
  funct3: number;                // [14:12]
  rs1: number;                   // [19:15] 源寄存器 1
  rs2: number;                   // [24:20] 源寄存器 2
  funct7: number;                // [31:25]
  immediate: number;             // 符号扩展后的立即数
  asmString: string;             // 反汇编字符串
  description: string;           // 人类可读描述
}

// 部件ID类型
export type ComponentID = string;

// 连线ID类型
export type WireID = string;
