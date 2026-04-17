import { CycleSnapshot } from './snapshot';

// CPU 引擎接口
export interface ICPUEngine {
  // 初始化：加载程序到指令存储器
  loadProgram(instructions: Uint32Array): void;

  // 核心：推进一个时钟周期，返回新的快照
  tick(): CycleSnapshot;

  // 推进一个完整指令（自动执行多个 tick 直到指令完成）
  step(): CycleSnapshot[];

  // 重置 CPU 状态
  reset(): void;

  // 获取当前快照（不推进时钟）
  getSnapshot(): CycleSnapshot;

  // 获取完整执行历史（支持时间旅行调试）
  getHistory(): CycleSnapshot[];

  // 回退到指定周期
  rewindTo(cycleNumber: number): CycleSnapshot;
}

// 汇编错误
export interface AssembleError {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
}

// 汇编器接口
export interface IAssembler {
  // 汇编文本 → 机器码
  assemble(source: string): {
    machineCode: Uint32Array;
    errors: AssembleError[]
  };

  // 机器码 → 汇编文本
  disassemble(machineCode: number): string;
}
