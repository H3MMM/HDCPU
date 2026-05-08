import {
  ALUOp,
  Stage,
  type ControlSignals,
  type CycleSnapshot,
  type DecodedInstruction,
} from '../types';

export type TextbookSignalGroup = 'fetch' | 'memory' | 'alu' | 'writeback';
export type TextbookSignalValue = string | number | boolean;

export type MulticycleTextbookSignalName =
  | 'PC_s'
  | 'PC_Write'
  | 'PC0_Write'
  | 'IR_Write'
  | 'Reg_Write'
  | 'rs2_imm_s'
  | 'ALU_OP'
  | 'Mem_Write'
  | 'w_data_s'
  | 'Size_s'
  | 'SE_s';

export type PipelineTextbookSignalName =
  | 'PC_s'
  | 'bcc'
  | 'ALU_OP'
  | 'rs2_imm_s'
  | 'Reg_Write'
  | 'Mem_Write'
  | 'w_data_s';

export interface TextbookSignalRow<TName extends string = string> {
  label: TName;
  group: TextbookSignalGroup;
  value: TextbookSignalValue;
  active: boolean;
  meaning: string;
}

export interface MulticycleTextbookSignalContext {
  stage: Stage;
  controlSignals: ControlSignals;
  currentInstruction: DecodedInstruction | null;
}

interface MulticycleTextbookSignalDefinition {
  label: MulticycleTextbookSignalName;
  group: TextbookSignalGroup;
  getValue: (context: MulticycleTextbookSignalContext) => TextbookSignalValue;
  isActive: (context: MulticycleTextbookSignalContext) => boolean;
  describe: (context: MulticycleTextbookSignalContext) => string;
}

export const TEXTBOOK_SIGNAL_GROUP_LABELS: Record<TextbookSignalGroup, string> = {
  fetch: '取指 / PC',
  memory: '访存',
  alu: '运算',
  writeback: '写回',
};

export const PIPELINE_TEXTBOOK_SIGNAL_GROUP_LABELS: Record<TextbookSignalGroup, string> = {
  fetch: 'IF / PC',
  alu: 'EX',
  memory: 'MEM',
  writeback: 'WB',
};

export const MULTICYCLE_TEXTBOOK_SIGNAL_NAMES: readonly MulticycleTextbookSignalName[] = [
  'PC_s',
  'PC_Write',
  'PC0_Write',
  'IR_Write',
  'Reg_Write',
  'rs2_imm_s',
  'ALU_OP',
  'Mem_Write',
  'w_data_s',
  'Size_s',
  'SE_s',
];

export const PIPELINE_TEXTBOOK_SIGNAL_NAMES: readonly PipelineTextbookSignalName[] = [
  'PC_s',
  'bcc',
  'ALU_OP',
  'rs2_imm_s',
  'Reg_Write',
  'Mem_Write',
  'w_data_s',
];

export const ALU_OP_BINARY: Record<ALUOp, string> = {
  [ALUOp.ADD]: '0000',
  [ALUOp.SUB]: '0001',
  [ALUOp.AND]: '0010',
  [ALUOp.OR]: '0011',
  [ALUOp.XOR]: '0100',
  [ALUOp.SLT]: '0101',
  [ALUOp.SLTU]: '0110',
  [ALUOp.SLL]: '0111',
  [ALUOp.SRL]: '1000',
  [ALUOp.SRA]: '1001',
};

const ALU_OP_OPTIONS = Object.values(ALUOp).map(formatALUOpSignal);

const SIGNAL_OPTIONS: Readonly<Record<string, readonly string[]>> = {
  PC_s: ['0', '1', '2'],
  PC_Write: ['0', '1'],
  PC0_Write: ['0', '1'],
  IR_Write: ['0', '1'],
  Reg_Write: ['0', '1'],
  rs2_imm_s: ['0', '1'],
  ALU_OP: ALU_OP_OPTIONS,
  Mem_Write: ['0', '1'],
  w_data_s: ['0', '1', '2', '3', '4'],
  Size_s: ['00', '01', '10', '11'],
  SE_s: ['0', '1'],
  bcc: ['none', 'beq(000)', 'bne(001)', 'blt(100)', 'bge(101)', 'bltu(110)', 'bgeu(111)'],
};

function isStage(stage: Stage, stages: readonly Stage[]): boolean {
  return stages.includes(stage);
}

export function boolSignal(value: boolean): string {
  return value ? '1' : '0';
}

export function formatALUOpSignal(value: ALUOp): string {
  return `${value}(${ALU_OP_BINARY[value] ?? '----'})`;
}

export function formatTextbookSignalValue(value: TextbookSignalValue): string {
  if (typeof value === 'boolean') {
    return boolSignal(value);
  }

  return String(value);
}

export function getTextbookSignalOptions(signalName: string): readonly string[] {
  return SIGNAL_OPTIONS[signalName] ?? [];
}

export function buildMulticycleTextbookSignalRows(
  context: MulticycleTextbookSignalContext
): Array<TextbookSignalRow<MulticycleTextbookSignalName>> {
  return MULTICYCLE_TEXTBOOK_SIGNAL_DEFINITIONS.map((definition) => ({
    label: definition.label,
    group: definition.group,
    value: definition.getValue(context),
    active: definition.isActive(context),
    meaning: definition.describe(context),
  }));
}

export function buildPipelineTextbookSignalRows(
  snapshot: CycleSnapshot
): Array<TextbookSignalRow<PipelineTextbookSignalName>> {
  const { idEx, exMem, memWb } = snapshot.pipeline.registers;
  const pcSelect = getPipelinePCSelect(snapshot);
  const rs2ImmSelect = idEx.controlSignals.ALUSrcB === 2 || idEx.controlSignals.ALUSrcB === 3 ? 1 : 0;
  const writeBackSelect = mapPipelineWriteBackSelect(memWb.controlSignals.MemToReg);
  const idExValid = idEx.status === 'valid' && idEx.decodedInstruction !== null;
  const exMemValid = exMem.status === 'valid' && exMem.decodedInstruction !== null;
  const memWbValid = memWb.status === 'valid' && memWb.decodedInstruction !== null;

  return [
    {
      label: 'PC_s',
      group: 'fetch',
      value: pcSelect,
      active: pcSelect !== 2,
      meaning: describePipelinePCSelect(pcSelect),
    },
    {
      label: 'bcc',
      group: 'alu',
      value: formatBranchConditionSignal(idEx.decodedInstruction),
      active: idExValid && isBranchInstruction(idEx.decodedInstruction),
      meaning: idExValid && isBranchInstruction(idEx.decodedInstruction)
        ? 'EX 段分支判定使用当前分支条件码'
        : 'EX 段当前不是分支指令',
    },
    {
      label: 'ALU_OP',
      group: 'alu',
      value: formatALUOpSignal(idEx.controlSignals.ALUOp),
      active: idExValid && usesExecuteStageALU(idEx.decodedInstruction),
      meaning: idExValid
        ? `EX 段 ALU 执行 ${formatALUOpSignal(idEx.controlSignals.ALUOp)}`
        : 'EX 段当前没有有效指令',
    },
    {
      label: 'rs2_imm_s',
      group: 'alu',
      value: rs2ImmSelect,
      active: idExValid && rs2ImmSelect === 1,
      meaning: idExValid ? describeALUSrcBSelect(idEx.controlSignals.ALUSrcB) : 'EX 段当前没有有效指令',
    },
    {
      label: 'Reg_Write',
      group: 'writeback',
      value: memWb.controlSignals.RegWrite,
      active: memWbValid && memWb.controlSignals.RegWrite,
      meaning: memWbValid && memWb.controlSignals.RegWrite ? 'WB 段写回寄存器堆' : 'WB 段不写回寄存器堆',
    },
    {
      label: 'Mem_Write',
      group: 'memory',
      value: exMem.controlSignals.MemWrite,
      active: exMemValid && exMem.controlSignals.MemWrite,
      meaning: exMemValid && exMem.controlSignals.MemWrite ? 'MEM 段写数据存储器' : 'MEM 段不写数据存储器',
    },
    {
      label: 'w_data_s',
      group: 'writeback',
      value: writeBackSelect,
      active: memWbValid && memWb.controlSignals.RegWrite,
      meaning: memWbValid && memWb.controlSignals.RegWrite
        ? describePipelineWriteBackSelect(memWb.controlSignals.MemToReg)
        : 'WB 段没有寄存器写回，w_data_s 不生效',
    },
  ];
}

function getFunct3(context: MulticycleTextbookSignalContext): number {
  return context.currentInstruction?.funct3 ?? 0;
}

function getSizeSelect(context: MulticycleTextbookSignalContext): string {
  return (getFunct3(context) & 0x3).toString(2).padStart(2, '0');
}

function getSignExtendSelect(context: MulticycleTextbookSignalContext): string {
  const instruction = context.currentInstruction;
  if (!instruction || instruction.opcode !== 0x03) {
    return '0';
  }

  return instruction.funct3 === 0x0 || instruction.funct3 === 0x1 ? '1' : '0';
}

function usesExecuteStageALU(instruction: DecodedInstruction | null): boolean {
  if (!instruction) {
    return false;
  }

  return instruction.opcode !== 0x37 && instruction.opcode !== 0x6F;
}

function describePCSource(value: ControlSignals['PCSource']): string {
  if (value === 0) {
    return '选择 PC+4 顺序地址';
  }

  if (value === 1) {
    return '选择 ALUOut 保存的分支目标';
  }

  return '选择跳转目标地址';
}

function describeWriteBackSelect(value: ControlSignals['MemToReg']): string {
  if (value === 1) {
    return '写回数据来自 MDR';
  }

  if (value === 2) {
    return '写回数据来自 PC+4';
  }

  if (value === 3) {
    return '写回数据来自 imm32';
  }

  return '写回数据来自 ALUOut';
}

function describeALUSrcBSelect(value: ControlSignals['ALUSrcB']): string {
  if (value === 1) {
    return 'ALU B 端选择常数 4';
  }

  if (value === 2) {
    return 'ALU B 端选择立即数';
  }

  if (value === 3) {
    return 'ALU B 端选择立即数左移 1 位';
  }

  return 'ALU B 端选择寄存器 B';
}

function describeSizeSelect(value: string): string {
  if (value === '00') {
    return '字节访问';
  }

  if (value === '01') {
    return '半字访问';
  }

  return '字访问';
}

function getPipelinePCSelect(snapshot: CycleSnapshot): number {
  const { hazard } = snapshot.pipeline;
  if (hazard.type !== 'control' || hazard.action !== 'flush') {
    return 2;
  }

  const redirectOpcode = hazard.control?.producer.instructionWord ?? 0;
  return (redirectOpcode & 0x7F) === 0x67 ? 0 : 1;
}

function describePipelinePCSelect(value: number): string {
  if (value === 0) {
    return 'PC 多路选择器取 JALR 反馈目标';
  }

  if (value === 1) {
    return 'PC 多路选择器取分支或 JAL 目标';
  }

  return 'PC 多路选择器取 PC+4 顺序地址';
}

function isBranchInstruction(instruction: DecodedInstruction | null): boolean {
  return instruction?.opcode === 0x63;
}

function formatBranchConditionSignal(instruction: DecodedInstruction | null): string {
  if (!isBranchInstruction(instruction)) {
    return 'none';
  }

  switch (instruction?.funct3) {
    case 0x0:
      return 'beq(000)';
    case 0x1:
      return 'bne(001)';
    case 0x4:
      return 'blt(100)';
    case 0x5:
      return 'bge(101)';
    case 0x6:
      return 'bltu(110)';
    case 0x7:
      return 'bgeu(111)';
    default:
      return 'branch';
  }
}

function mapPipelineWriteBackSelect(value: ControlSignals['MemToReg']): number {
  if (value === 2) {
    return 3;
  }

  if (value === 3) {
    return 2;
  }

  return value;
}

function describePipelineWriteBackSelect(value: ControlSignals['MemToReg']): string {
  const textbookValue = mapPipelineWriteBackSelect(value);
  if (textbookValue === 1) {
    return 'WB 多路选择器取数据存储器读数';
  }

  if (textbookValue === 2) {
    return 'WB 多路选择器取立即数';
  }

  if (textbookValue === 3) {
    return 'WB 多路选择器取 PC+4';
  }

  if (textbookValue === 4) {
    return 'WB 多路选择器取 offset';
  }

  return 'WB 多路选择器取 ALU 结果';
}

const MULTICYCLE_TEXTBOOK_SIGNAL_DEFINITIONS: readonly MulticycleTextbookSignalDefinition[] = [
  {
    label: 'PC_s',
    group: 'fetch',
    getValue: ({ controlSignals }) => controlSignals.PCSource,
    isActive: ({ stage, controlSignals }) => isStage(stage, [Stage.IF, Stage.EX]) && controlSignals.PCWrite,
    describe: ({ controlSignals }) =>
      controlSignals.PCWrite ? describePCSource(controlSignals.PCSource) : 'PCWrite=0 时，PC_s 不生效',
  },
  {
    label: 'PC_Write',
    group: 'fetch',
    getValue: ({ controlSignals }) => controlSignals.PCWrite,
    isActive: ({ stage, controlSignals }) => isStage(stage, [Stage.IF, Stage.EX]) && controlSignals.PCWrite,
    describe: ({ controlSignals }) => (controlSignals.PCWrite ? '允许 PC 锁存新地址' : 'PC 保持当前值'),
  },
  {
    label: 'PC0_Write',
    group: 'fetch',
    getValue: ({ stage, controlSignals }) => stage === Stage.IF && controlSignals.PCWrite,
    isActive: ({ stage, controlSignals }) => stage === Stage.IF && controlSignals.PCWrite,
    describe: ({ stage, controlSignals }) =>
      stage === Stage.IF && controlSignals.PCWrite ? '本周期锁存取指 PC' : 'PC0 不写入',
  },
  {
    label: 'IR_Write',
    group: 'fetch',
    getValue: ({ controlSignals }) => controlSignals.IRWrite,
    isActive: ({ stage, controlSignals }) => stage === Stage.IF && controlSignals.IRWrite,
    describe: ({ controlSignals }) => (controlSignals.IRWrite ? 'IR 锁存新取回的指令' : 'IR 保持当前指令'),
  },
  {
    label: 'Reg_Write',
    group: 'writeback',
    getValue: ({ controlSignals }) => controlSignals.RegWrite,
    isActive: ({ stage, controlSignals }) => isStage(stage, [Stage.EX, Stage.WB]) && controlSignals.RegWrite,
    describe: ({ controlSignals }) => (controlSignals.RegWrite ? '寄存器堆写使能有效' : '寄存器堆不写入'),
  },
  {
    label: 'rs2_imm_s',
    group: 'alu',
    getValue: ({ controlSignals }) => (controlSignals.ALUSrcB === 2 || controlSignals.ALUSrcB === 3 ? 1 : 0),
    isActive: ({ stage, controlSignals }) =>
      stage === Stage.EX && (controlSignals.ALUSrcB === 2 || controlSignals.ALUSrcB === 3),
    describe: ({ controlSignals }) => describeALUSrcBSelect(controlSignals.ALUSrcB),
  },
  {
    label: 'ALU_OP',
    group: 'alu',
    getValue: ({ controlSignals }) => formatALUOpSignal(controlSignals.ALUOp),
    isActive: ({ stage, currentInstruction }) => stage === Stage.EX && usesExecuteStageALU(currentInstruction),
    describe: ({ controlSignals }) => `ALU 执行 ${formatALUOpSignal(controlSignals.ALUOp)}`,
  },
  {
    label: 'Mem_Write',
    group: 'memory',
    getValue: ({ controlSignals }) => controlSignals.MemWrite,
    isActive: ({ stage, controlSignals }) => stage === Stage.MEM && controlSignals.MemWrite,
    describe: ({ controlSignals }) => (controlSignals.MemWrite ? '数据内存写使能有效' : '数据内存不写入'),
  },
  {
    label: 'w_data_s',
    group: 'writeback',
    getValue: ({ controlSignals }) => controlSignals.MemToReg,
    isActive: ({ stage, controlSignals }) => isStage(stage, [Stage.EX, Stage.WB]) && controlSignals.RegWrite,
    describe: ({ controlSignals }) =>
      controlSignals.RegWrite ? describeWriteBackSelect(controlSignals.MemToReg) : 'RegWrite=0 时，w_data_s 不生效',
  },
  {
    label: 'Size_s',
    group: 'memory',
    getValue: getSizeSelect,
    isActive: ({ stage }) => stage === Stage.MEM,
    describe: (context) => describeSizeSelect(getSizeSelect(context)),
  },
  {
    label: 'SE_s',
    group: 'memory',
    getValue: getSignExtendSelect,
    isActive: ({ stage, controlSignals }) => stage === Stage.MEM && controlSignals.MemRead,
    describe: (context) => (getSignExtendSelect(context) === '1' ? '访存读数需要符号扩展' : '不进行符号扩展'),
  },
];
