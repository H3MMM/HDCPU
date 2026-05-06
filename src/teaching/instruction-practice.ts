import { Stage, type DecodedInstruction } from '../types';

export type DatapathInteractionMode = 'free-drag' | 'practice';
export type InstructionPracticeCategory = 'R' | 'I' | 'S' | 'B' | 'U' | 'J';
export type RTypePracticeId =
  | 'add'
  | 'sub'
  | 'and'
  | 'or'
  | 'xor'
  | 'sll'
  | 'srl'
  | 'sra'
  | 'slt'
  | 'sltu';
export type ITypePracticeId =
  | 'addi'
  | 'andi'
  | 'ori'
  | 'xori'
  | 'slti'
  | 'sltiu'
  | 'slli'
  | 'srli'
  | 'srai'
  | 'lb'
  | 'lh'
  | 'lw'
  | 'lbu'
  | 'lhu'
  | 'jalr';
export type STypePracticeId = 'sb' | 'sh' | 'sw';
export type BTypePracticeId = 'beq' | 'bne' | 'blt' | 'bge' | 'bltu' | 'bgeu';
export type UTypePracticeId = 'lui' | 'auipc';
export type JTypePracticeId = 'jal';
export type InstructionPracticeId =
  | RTypePracticeId
  | ITypePracticeId
  | STypePracticeId
  | BTypePracticeId
  | UTypePracticeId
  | JTypePracticeId;

export type PracticeControlName =
  | 'ALUSrcA'
  | 'ALUSrcB'
  | 'ALUOp'
  | 'RegWrite'
  | 'MemWrite'
  | 'PCWrite'
  | 'PCSrc'
  | 'WriteBack';

export type PracticeControlValue =
  | 'none'
  | 'pc'
  | 'rs1'
  | 'rs2'
  | 'imm'
  | '4'
  | 'ADD'
  | 'SUB'
  | 'AND'
  | 'OR'
  | 'XOR'
  | 'SLT'
  | 'SLTU'
  | 'SLL'
  | 'SRL'
  | 'SRA'
  | '0'
  | '1'
  | 'branch'
  | 'jump'
  | 'alu'
  | 'mem'
  | 'pc-plus-4';

export type PracticeControlSelection = Readonly<Record<PracticeControlName, PracticeControlValue>>;
export type PracticeControlAnswer = Partial<Record<PracticeControlName, PracticeControlValue>>;

export interface PracticeControlValueOption {
  value: PracticeControlValue;
  label: string;
}

export interface PracticeControlDefinition {
  name: PracticeControlName;
  label: string;
  options: readonly PracticeControlValueOption[];
}

export interface PracticeStageQuestion {
  prompt: string;
  options: readonly Stage[];
  correctStages: readonly Stage[];
}

export interface PracticeControlQuestion {
  stage: Stage;
  prompt: string;
  controls: readonly PracticeControlDefinition[];
  correctControls: PracticeControlSelection;
  correctMessage: string;
  explanation: string;
}

export interface InstructionPracticeItem {
  id: InstructionPracticeId;
  category: InstructionPracticeCategory;
  mnemonic: string;
  title: string;
  stageQuestion: PracticeStageQuestion;
  controlQuestions: Partial<Record<Stage, PracticeControlQuestion>>;
}

export interface InstructionPracticeAnswer {
  instructionId: InstructionPracticeId;
  selectedStages: readonly Stage[];
  selectedControlsByStage: Partial<Record<Stage, PracticeControlAnswer>>;
}

export interface PracticeChoiceResult<TChoice extends string> {
  selected: readonly TChoice[];
  expected: readonly TChoice[];
  missing: readonly TChoice[];
  extra: readonly TChoice[];
  correct: boolean;
}

export interface PracticeStageCheckResult extends PracticeChoiceResult<Stage> {
  prompt: string;
}

export interface PracticeControlMismatch {
  control: PracticeControlName;
  expected: PracticeControlValue;
  selected: PracticeControlValue | null;
}

export interface PracticeControlCheckResult {
  stage: Stage;
  prompt: string;
  correctMessage: string;
  message: string;
  explanation: string;
  expectedControls: PracticeControlSelection;
  selectedControls: PracticeControlAnswer;
  mismatches: readonly PracticeControlMismatch[];
  correct: boolean;
}

export interface InstructionPracticeCheckResult {
  instructionId: InstructionPracticeId;
  stages: PracticeStageCheckResult;
  controlsByStage: Partial<Record<Stage, PracticeControlCheckResult>>;
  correct: boolean;
}

interface InstructionPracticeDefinition<TId extends InstructionPracticeId> {
  id: TId;
  category: InstructionPracticeCategory;
  title: string;
  correctStages: readonly Stage[];
  controlsByStage: Partial<Record<Stage, PracticeControlSelection>>;
  explanationsByStage: Partial<Record<Stage, string>>;
}

export const PRACTICE_STAGE_ORDER: readonly Stage[] = [
  Stage.IF,
  Stage.ID,
  Stage.EX,
  Stage.MEM,
  Stage.WB,
];

export const PRACTICE_CONTROL_ORDER: readonly PracticeControlName[] = [
  'ALUSrcA',
  'ALUSrcB',
  'ALUOp',
  'RegWrite',
  'MemWrite',
  'PCWrite',
  'PCSrc',
  'WriteBack',
];

const ALU_WRITEBACK_STAGES: readonly Stage[] = [
  Stage.IF,
  Stage.ID,
  Stage.EX,
  Stage.WB,
];

const MEMORY_LOAD_STAGES: readonly Stage[] = PRACTICE_STAGE_ORDER;

const MEMORY_STORE_STAGES: readonly Stage[] = [
  Stage.IF,
  Stage.ID,
  Stage.EX,
  Stage.MEM,
];

const BRANCH_STAGES: readonly Stage[] = [
  Stage.IF,
  Stage.ID,
  Stage.EX,
];

const DIRECT_EX_STAGES: readonly Stage[] = [
  Stage.IF,
  Stage.EX,
];

const R_TYPE_PRACTICE_IDS: readonly RTypePracticeId[] = [
  'add',
  'sub',
  'and',
  'or',
  'xor',
  'sll',
  'srl',
  'sra',
  'slt',
  'sltu',
];

const I_TYPE_PRACTICE_IDS: readonly ITypePracticeId[] = [
  'addi',
  'andi',
  'ori',
  'xori',
  'slti',
  'sltiu',
  'slli',
  'srli',
  'srai',
  'lb',
  'lh',
  'lw',
  'lbu',
  'lhu',
  'jalr',
];

const S_TYPE_PRACTICE_IDS: readonly STypePracticeId[] = ['sb', 'sh', 'sw'];

const B_TYPE_PRACTICE_IDS: readonly BTypePracticeId[] = [
  'beq',
  'bne',
  'blt',
  'bge',
  'bltu',
  'bgeu',
];

const U_TYPE_PRACTICE_IDS: readonly UTypePracticeId[] = ['lui', 'auipc'];

const J_TYPE_PRACTICE_IDS: readonly JTypePracticeId[] = ['jal'];

export const INSTRUCTION_PRACTICE_IDS_BY_CATEGORY: Readonly<
  Record<InstructionPracticeCategory, readonly InstructionPracticeId[]>
> = {
  R: R_TYPE_PRACTICE_IDS,
  I: I_TYPE_PRACTICE_IDS,
  S: S_TYPE_PRACTICE_IDS,
  B: B_TYPE_PRACTICE_IDS,
  U: U_TYPE_PRACTICE_IDS,
  J: J_TYPE_PRACTICE_IDS,
};

export const DEFAULT_INSTRUCTION_PRACTICE_ID: InstructionPracticeId = 'lw';

export const PRACTICE_CONTROL_OPTIONS: Readonly<Record<PracticeControlName, readonly PracticeControlValueOption[]>> = {
  ALUSrcA: [
    { value: 'none', label: '不使用' },
    { value: 'pc', label: 'PC' },
    { value: 'rs1', label: 'Reg[rs1]' },
  ],
  ALUSrcB: [
    { value: 'none', label: '不使用' },
    { value: 'rs2', label: 'Reg[rs2]' },
    { value: 'imm', label: 'imm' },
    { value: '4', label: '4' },
  ],
  ALUOp: [
    { value: 'none', label: '不使用' },
    { value: 'ADD', label: 'ADD' },
    { value: 'SUB', label: 'SUB' },
    { value: 'AND', label: 'AND' },
    { value: 'OR', label: 'OR' },
    { value: 'XOR', label: 'XOR' },
    { value: 'SLT', label: 'SLT' },
    { value: 'SLTU', label: 'SLTU' },
    { value: 'SLL', label: 'SLL' },
    { value: 'SRL', label: 'SRL' },
    { value: 'SRA', label: 'SRA' },
  ],
  RegWrite: [
    { value: '0', label: '0' },
    { value: '1', label: '1' },
  ],
  MemWrite: [
    { value: '0', label: '0' },
    { value: '1', label: '1' },
  ],
  PCWrite: [
    { value: '0', label: '0' },
    { value: '1', label: '1' },
  ],
  PCSrc: [
    { value: 'none', label: '不使用' },
    { value: 'pc-plus-4', label: 'PC+4' },
    { value: 'alu', label: 'ALUOut' },
    { value: 'branch', label: 'branch' },
    { value: 'jump', label: 'jump' },
  ],
  WriteBack: [
    { value: 'none', label: '不使用' },
    { value: 'alu', label: 'ALUOut' },
    { value: 'mem', label: 'MemData' },
    { value: 'imm', label: 'imm' },
    { value: 'pc-plus-4', label: 'PC+4' },
  ],
};

export const PRACTICE_CONTROL_DEFINITIONS: readonly PracticeControlDefinition[] = PRACTICE_CONTROL_ORDER.map((name) => ({
  name,
  label: name,
  options: PRACTICE_CONTROL_OPTIONS[name],
}));

const NO_STAGE_ACTION_CONTROLS: PracticeControlSelection = {
  ALUSrcA: 'none',
  ALUSrcB: 'none',
  ALUOp: 'none',
  RegWrite: '0',
  MemWrite: '0',
  PCWrite: '0',
  PCSrc: 'none',
  WriteBack: 'none',
};

const IF_CONTROLS = withStageControls({
  ALUSrcA: 'pc',
  ALUSrcB: '4',
  ALUOp: 'ADD',
  PCWrite: '1',
  PCSrc: 'pc-plus-4',
});

const ID_CONTROLS = withStageControls({
  ALUSrcA: 'pc',
  ALUSrcB: 'imm',
  ALUOp: 'ADD',
});

const MEMORY_READ_CONTROLS = withStageControls({});

const MEMORY_WRITE_CONTROLS = withStageControls({
  MemWrite: '1',
});

const WB_ALU_CONTROLS = withStageControls({
  RegWrite: '1',
  WriteBack: 'alu',
});

const WB_MEMORY_CONTROLS = withStageControls({
  RegWrite: '1',
  WriteBack: 'mem',
});

const WB_JALR_CONTROLS = withStageControls({
  RegWrite: '1',
  PCWrite: '1',
  PCSrc: 'alu',
  WriteBack: 'pc-plus-4',
});

const IF_EXPLANATION = 'IF 阶段用 PC 取指并计算 PC+4，所以 ALUSrcA 选择 PC，ALUSrcB 选择 4，ALUOp 选择 ADD，并写回 PC。';
const ID_EXPLANATION = 'ID 阶段读取寄存器并准备立即数，同时可用 PC + imm 预备目标地址，所以 ALUSrcA 选择 PC，ALUSrcB 选择 imm，ALUOp 选择 ADD。';
const MEM_LOAD_EXPLANATION = 'MEM 阶段 load 指令读取数据存储器，不写内存，所以 MemWrite=0，其余列出的控制信号不在这个阶段使用。';
const MEM_STORE_EXPLANATION = 'MEM 阶段 store 指令把寄存器数据写入数据存储器，所以 MemWrite=1，其余列出的控制信号不在这个阶段使用。';
const WB_ALU_EXPLANATION = 'WB 阶段把 ALUOut 写回寄存器，所以 RegWrite=1，WriteBack 选择 ALUOut。';
const WB_MEMORY_EXPLANATION = 'WB 阶段把数据存储器读出的值写回寄存器，所以 RegWrite=1，WriteBack 选择 MemData。';

const R_TYPE_DEFINITIONS: readonly InstructionPracticeDefinition<RTypePracticeId>[] = [
  createRegisterALUDefinition('add', 'ADD', 'Reg[rs1] + Reg[rs2]'),
  createRegisterALUDefinition('sub', 'SUB', 'Reg[rs1] - Reg[rs2]'),
  createRegisterALUDefinition('and', 'AND', 'Reg[rs1] & Reg[rs2]'),
  createRegisterALUDefinition('or', 'OR', 'Reg[rs1] | Reg[rs2]'),
  createRegisterALUDefinition('xor', 'XOR', 'Reg[rs1] ^ Reg[rs2]'),
  createRegisterALUDefinition('sll', 'SLL', 'Reg[rs1] << Reg[rs2]'),
  createRegisterALUDefinition('srl', 'SRL', 'Reg[rs1] >> Reg[rs2]'),
  createRegisterALUDefinition('sra', 'SRA', 'Reg[rs1] 算术右移 Reg[rs2]'),
  createRegisterALUDefinition('slt', 'SLT', 'Reg[rs1] < Reg[rs2]'),
  createRegisterALUDefinition('sltu', 'SLTU', 'Reg[rs1] < Reg[rs2]（无符号）'),
];

const I_TYPE_ALU_DEFINITIONS: readonly InstructionPracticeDefinition<ITypePracticeId>[] = [
  createImmediateALUDefinition('addi', 'ADD', 'Reg[rs1] + imm'),
  createImmediateALUDefinition('andi', 'AND', 'Reg[rs1] & imm'),
  createImmediateALUDefinition('ori', 'OR', 'Reg[rs1] | imm'),
  createImmediateALUDefinition('xori', 'XOR', 'Reg[rs1] ^ imm'),
  createImmediateALUDefinition('slti', 'SLT', 'Reg[rs1] < imm'),
  createImmediateALUDefinition('sltiu', 'SLTU', 'Reg[rs1] < imm（无符号）'),
  createImmediateALUDefinition('slli', 'SLL', 'Reg[rs1] << shamt'),
  createImmediateALUDefinition('srli', 'SRL', 'Reg[rs1] >> shamt'),
  createImmediateALUDefinition('srai', 'SRA', 'Reg[rs1] 算术右移 shamt'),
];

const I_TYPE_LOAD_DEFINITIONS: readonly InstructionPracticeDefinition<ITypePracticeId>[] = [
  createAddressDefinition('lb', 'I', MEMORY_LOAD_STAGES, '字节读取'),
  createAddressDefinition('lh', 'I', MEMORY_LOAD_STAGES, '半字读取'),
  createAddressDefinition('lw', 'I', MEMORY_LOAD_STAGES, '字读取'),
  createAddressDefinition('lbu', 'I', MEMORY_LOAD_STAGES, '无符号字节读取'),
  createAddressDefinition('lhu', 'I', MEMORY_LOAD_STAGES, '无符号半字读取'),
];

const JALR_DEFINITION: InstructionPracticeDefinition<ITypePracticeId> = {
  id: 'jalr',
  category: 'I',
  title: 'jalr 间接跳转指令',
  correctStages: ALU_WRITEBACK_STAGES,
  controlsByStage: createControlsByStage(ALU_WRITEBACK_STAGES, {
    [Stage.EX]: withStageControls({
      ALUSrcA: 'rs1',
      ALUSrcB: 'imm',
      ALUOp: 'ADD',
    }),
    [Stage.WB]: WB_JALR_CONTROLS,
  }),
  explanationsByStage: createExplanationsByStage(ALU_WRITEBACK_STAGES, {
    [Stage.EX]: 'jalr 在 EX 阶段用 Reg[rs1] + imm 计算跳转目标，所以 ALUSrcA 选择 Reg[rs1]，ALUSrcB 选择 imm，ALUOp 选择 ADD。',
    [Stage.WB]: 'jalr 的 WB 阶段写回 PC+4，并把 PC 更新为 EX 阶段算出的跳转目标，所以 RegWrite=1，PCWrite=1，PCSrc=ALUOut，WriteBack=PC+4。',
  }),
};

const S_TYPE_DEFINITIONS: readonly InstructionPracticeDefinition<STypePracticeId>[] = [
  createAddressDefinition('sb', 'S', MEMORY_STORE_STAGES, '字节写入'),
  createAddressDefinition('sh', 'S', MEMORY_STORE_STAGES, '半字写入'),
  createAddressDefinition('sw', 'S', MEMORY_STORE_STAGES, '字写入'),
];

const B_TYPE_DEFINITIONS: readonly InstructionPracticeDefinition<BTypePracticeId>[] = [
  createBranchDefinition('beq', '相等'),
  createBranchDefinition('bne', '不相等'),
  createBranchDefinition('blt', '小于'),
  createBranchDefinition('bge', '大于等于'),
  createBranchDefinition('bltu', '无符号小于'),
  createBranchDefinition('bgeu', '无符号大于等于'),
];

const U_TYPE_DEFINITIONS: readonly InstructionPracticeDefinition<UTypePracticeId>[] = [
  {
    id: 'lui',
    category: 'U',
    title: 'lui U 型高位立即数指令',
    correctStages: DIRECT_EX_STAGES,
    controlsByStage: createControlsByStage(DIRECT_EX_STAGES, {
      [Stage.EX]: withStageControls({
        RegWrite: '1',
        WriteBack: 'imm',
      }),
    }),
    explanationsByStage: createExplanationsByStage(DIRECT_EX_STAGES, {
      [Stage.EX]: 'lui 在 EX 阶段把 U 型立即数作为写回数据，所以 RegWrite=1，WriteBack 选择 imm。',
    }),
  },
  {
    id: 'auipc',
    category: 'U',
    title: 'auipc U 型 PC 相对指令',
    correctStages: ALU_WRITEBACK_STAGES,
    controlsByStage: createControlsByStage(ALU_WRITEBACK_STAGES, {
      [Stage.EX]: withStageControls({
        ALUSrcA: 'pc',
        ALUSrcB: 'imm',
        ALUOp: 'ADD',
      }),
      [Stage.WB]: WB_ALU_CONTROLS,
    }),
    explanationsByStage: createExplanationsByStage(ALU_WRITEBACK_STAGES, {
      [Stage.EX]: 'auipc 在 EX 阶段计算 PC + imm，所以 ALUSrcA 选择 PC，ALUSrcB 选择 imm，ALUOp 选择 ADD。',
      [Stage.WB]: WB_ALU_EXPLANATION,
    }),
  },
];

const J_TYPE_DEFINITIONS: readonly InstructionPracticeDefinition<JTypePracticeId>[] = [
  {
    id: 'jal',
    category: 'J',
    title: 'jal J 型跳转指令',
    correctStages: DIRECT_EX_STAGES,
    controlsByStage: createControlsByStage(DIRECT_EX_STAGES, {
      [Stage.EX]: withStageControls({
        ALUSrcA: 'pc',
        ALUSrcB: '4',
        ALUOp: 'ADD',
        RegWrite: '1',
        PCWrite: '1',
        PCSrc: 'jump',
        WriteBack: 'pc-plus-4',
      }),
    }),
    explanationsByStage: createExplanationsByStage(DIRECT_EX_STAGES, {
      [Stage.EX]: 'jal 在 EX 阶段写入跳转目标 PC，同时把 PC+4 写回 rd，所以 PCWrite=1、PCSrc=jump、RegWrite=1，并选择 PC+4 作为写回来源。',
    }),
  },
];

const ALL_INSTRUCTION_DEFINITIONS: readonly InstructionPracticeDefinition<InstructionPracticeId>[] = [
  ...R_TYPE_DEFINITIONS,
  ...I_TYPE_ALU_DEFINITIONS,
  ...I_TYPE_LOAD_DEFINITIONS,
  JALR_DEFINITION,
  ...S_TYPE_DEFINITIONS,
  ...B_TYPE_DEFINITIONS,
  ...U_TYPE_DEFINITIONS,
  ...J_TYPE_DEFINITIONS,
];

export const INSTRUCTION_PRACTICE_ITEMS: Readonly<Record<InstructionPracticeId, InstructionPracticeItem>> =
  Object.fromEntries(
    ALL_INSTRUCTION_DEFINITIONS.map((definition) => [definition.id, createInstructionPracticeItem(definition)])
  ) as Readonly<Record<InstructionPracticeId, InstructionPracticeItem>>;

export function getInstructionPracticeItem(instructionId: InstructionPracticeId): InstructionPracticeItem {
  return INSTRUCTION_PRACTICE_ITEMS[instructionId];
}

export function getInstructionPracticeItemsByCategory(
  category: InstructionPracticeCategory
): readonly InstructionPracticeItem[] {
  return INSTRUCTION_PRACTICE_IDS_BY_CATEGORY[category].map(getInstructionPracticeItem);
}

export function resolveInstructionPracticeId(instruction: DecodedInstruction | null): InstructionPracticeId | null {
  if (!instruction) {
    return null;
  }

  switch (instruction.opcode) {
    case 0x33:
      return resolveRTypePracticeId(instruction);
    case 0x13:
      return resolveITypeALUPracticeId(instruction);
    case 0x03:
      return resolveLoadPracticeId(instruction);
    case 0x67:
      return 'jalr';
    case 0x23:
      return resolveStorePracticeId(instruction);
    case 0x63:
      return resolveBranchPracticeId(instruction);
    case 0x37:
      return 'lui';
    case 0x17:
      return 'auipc';
    case 0x6F:
      return 'jal';
    default:
      return null;
  }
}

export function createEmptyPracticeAnswer(
  instructionId: InstructionPracticeId = DEFAULT_INSTRUCTION_PRACTICE_ID
): InstructionPracticeAnswer {
  const item = getInstructionPracticeItem(instructionId);
  const selectedControlsByStage: Partial<Record<Stage, PracticeControlAnswer>> = {};

  for (const stage of PRACTICE_STAGE_ORDER) {
    if (item.controlQuestions[stage]) {
      selectedControlsByStage[stage] = {};
    }
  }

  return {
    instructionId,
    selectedStages: [],
    selectedControlsByStage,
  };
}

export function setPracticeStageSelected(
  answer: InstructionPracticeAnswer,
  stage: Stage,
  selected: boolean
): InstructionPracticeAnswer {
  const item = getInstructionPracticeItem(answer.instructionId);
  return {
    ...answer,
    selectedStages: setSelectedChoice(answer.selectedStages, item.stageQuestion.options, stage, selected),
  };
}

export function setPracticeControlValue(
  answer: InstructionPracticeAnswer,
  stage: Stage,
  controlName: PracticeControlName,
  value: PracticeControlValue | null
): InstructionPracticeAnswer {
  const item = getInstructionPracticeItem(answer.instructionId);
  const question = item.controlQuestions[stage];
  if (!question || !isValidControlValue(controlName, value)) {
    return answer;
  }

  const currentControls = { ...(answer.selectedControlsByStage[stage] ?? {}) };
  if (value === null) {
    delete currentControls[controlName];
  } else {
    currentControls[controlName] = value;
  }

  return {
    ...answer,
    selectedControlsByStage: {
      ...answer.selectedControlsByStage,
      [stage]: currentControls,
    },
  };
}

export function evaluateInstructionPracticeAnswer(
  answer: InstructionPracticeAnswer
): InstructionPracticeCheckResult {
  const item = getInstructionPracticeItem(answer.instructionId);
  const stageResult = createChoiceResult(
    answer.selectedStages,
    item.stageQuestion.correctStages,
    item.stageQuestion.options
  );
  const controlsByStage: Partial<Record<Stage, PracticeControlCheckResult>> = {};

  for (const stage of PRACTICE_STAGE_ORDER) {
    const question = item.controlQuestions[stage];
    if (!question) {
      continue;
    }

    const selectedControls = answer.selectedControlsByStage[stage] ?? {};
    const mismatches = question.controls
      .map((control): PracticeControlMismatch | null => {
        const selected = selectedControls[control.name] ?? null;
        const expected = question.correctControls[control.name];
        return selected === expected ? null : { control: control.name, expected, selected };
      })
      .filter((mismatch): mismatch is PracticeControlMismatch => mismatch !== null);

    controlsByStage[stage] = {
      stage,
      prompt: question.prompt,
      correctMessage: question.correctMessage,
      message: mismatches.length === 0 ? question.correctMessage : `${stage} 阶段还不对。`,
      explanation: question.explanation,
      expectedControls: question.correctControls,
      selectedControls,
      mismatches,
      correct: mismatches.length === 0,
    };
  }

  const controlResults = Object.values(controlsByStage);

  return {
    instructionId: item.id,
    stages: {
      ...stageResult,
      prompt: item.stageQuestion.prompt,
    },
    controlsByStage,
    correct: stageResult.correct && controlResults.every((result) => result.correct),
  };
}

export function getPracticeControlValueLabel(
  controlName: PracticeControlName,
  value: PracticeControlValue | null
): string {
  if (value === null) {
    return '未选择';
  }

  return PRACTICE_CONTROL_OPTIONS[controlName].find((option) => option.value === value)?.label ?? value;
}

function withStageControls(overrides: Partial<PracticeControlSelection>): PracticeControlSelection {
  return {
    ...NO_STAGE_ACTION_CONTROLS,
    ...overrides,
  };
}

function createControlsByStage(
  correctStages: readonly Stage[],
  overridesByStage: Partial<Record<Stage, PracticeControlSelection>>
): Partial<Record<Stage, PracticeControlSelection>> {
  const controlsByStage: Partial<Record<Stage, PracticeControlSelection>> = {};

  for (const stage of correctStages) {
    controlsByStage[stage] =
      overridesByStage[stage] ??
      (stage === Stage.IF ? IF_CONTROLS : stage === Stage.ID ? ID_CONTROLS : NO_STAGE_ACTION_CONTROLS);
  }

  return controlsByStage;
}

function createExplanationsByStage(
  correctStages: readonly Stage[],
  overridesByStage: Partial<Record<Stage, string>>
): Partial<Record<Stage, string>> {
  const explanationsByStage: Partial<Record<Stage, string>> = {};

  for (const stage of correctStages) {
    explanationsByStage[stage] =
      overridesByStage[stage] ??
      (stage === Stage.IF
        ? IF_EXPLANATION
        : stage === Stage.ID
          ? ID_EXPLANATION
          : `${stage} 阶段控制信号已匹配。`);
  }

  return explanationsByStage;
}

function createRegisterALUDefinition(
  id: RTypePracticeId,
  aluOp: Extract<PracticeControlValue, 'ADD' | 'SUB' | 'AND' | 'OR' | 'XOR' | 'SLT' | 'SLTU' | 'SLL' | 'SRL' | 'SRA'>,
  expression: string
): InstructionPracticeDefinition<RTypePracticeId> {
  return {
    id,
    category: 'R',
    title: `${id} R 型运算指令`,
    correctStages: ALU_WRITEBACK_STAGES,
    controlsByStage: createControlsByStage(ALU_WRITEBACK_STAGES, {
      [Stage.EX]: withStageControls({
        ALUSrcA: 'rs1',
        ALUSrcB: 'rs2',
        ALUOp: aluOp,
      }),
      [Stage.WB]: WB_ALU_CONTROLS,
    }),
    explanationsByStage: createExplanationsByStage(ALU_WRITEBACK_STAGES, {
      [Stage.EX]: `${id} 在 EX 阶段计算 ${expression}，所以 ALUSrcA 选择 Reg[rs1]，ALUSrcB 选择 Reg[rs2]，ALUOp 选择 ${aluOp}。`,
      [Stage.WB]: WB_ALU_EXPLANATION,
    }),
  };
}

function createImmediateALUDefinition(
  id: ITypePracticeId,
  aluOp: Extract<PracticeControlValue, 'ADD' | 'AND' | 'OR' | 'XOR' | 'SLT' | 'SLTU' | 'SLL' | 'SRL' | 'SRA'>,
  expression: string
): InstructionPracticeDefinition<ITypePracticeId> {
  return {
    id,
    category: 'I',
    title: `${id} I 型立即数运算指令`,
    correctStages: ALU_WRITEBACK_STAGES,
    controlsByStage: createControlsByStage(ALU_WRITEBACK_STAGES, {
      [Stage.EX]: withStageControls({
        ALUSrcA: 'rs1',
        ALUSrcB: 'imm',
        ALUOp: aluOp,
      }),
      [Stage.WB]: WB_ALU_CONTROLS,
    }),
    explanationsByStage: createExplanationsByStage(ALU_WRITEBACK_STAGES, {
      [Stage.EX]: `${id} 在 EX 阶段计算 ${expression}，所以 ALUSrcA 选择 Reg[rs1]，ALUSrcB 选择 imm，ALUOp 选择 ${aluOp}。`,
      [Stage.WB]: WB_ALU_EXPLANATION,
    }),
  };
}

function createAddressDefinition<TId extends ITypePracticeId | STypePracticeId>(
  id: TId,
  category: InstructionPracticeCategory,
  correctStages: readonly Stage[],
  accessKind: string
): InstructionPracticeDefinition<TId> {
  const isLoad = correctStages.includes(Stage.WB);

  return {
    id,
    category,
    title: `${id} ${category} 型${accessKind}指令`,
    correctStages,
    controlsByStage: createControlsByStage(correctStages, {
      [Stage.EX]: withStageControls({
        ALUSrcA: 'rs1',
        ALUSrcB: 'imm',
        ALUOp: 'ADD',
      }),
      [Stage.MEM]: isLoad ? MEMORY_READ_CONTROLS : MEMORY_WRITE_CONTROLS,
      ...(isLoad ? { [Stage.WB]: WB_MEMORY_CONTROLS } : {}),
    }),
    explanationsByStage: createExplanationsByStage(correctStages, {
      [Stage.EX]: `${id} 在 EX 阶段用 Reg[rs1] + imm 计算有效地址，所以 ALUSrcA 选择 Reg[rs1]，ALUSrcB 选择 imm，ALUOp 选择 ADD。`,
      [Stage.MEM]: isLoad ? MEM_LOAD_EXPLANATION : MEM_STORE_EXPLANATION,
      ...(isLoad ? { [Stage.WB]: WB_MEMORY_EXPLANATION } : {}),
    }),
  };
}

function createBranchDefinition(id: BTypePracticeId, conditionLabel: string): InstructionPracticeDefinition<BTypePracticeId> {
  return {
    id,
    category: 'B',
    title: `${id} B 型${conditionLabel}分支指令`,
    correctStages: BRANCH_STAGES,
    controlsByStage: createControlsByStage(BRANCH_STAGES, {
      [Stage.EX]: withStageControls({
        ALUSrcA: 'rs1',
        ALUSrcB: 'rs2',
        ALUOp: 'SUB',
        PCSrc: 'branch',
      }),
    }),
    explanationsByStage: createExplanationsByStage(BRANCH_STAGES, {
      [Stage.EX]: `${id} 在 EX 阶段比较 Reg[rs1] 和 Reg[rs2] 并决定分支，所以 ALUSrcA 选择 Reg[rs1]，ALUSrcB 选择 Reg[rs2]，ALUOp 选择 SUB，PCSrc 选择 branch。`,
    }),
  };
}

function createInstructionPracticeItem(
  definition: InstructionPracticeDefinition<InstructionPracticeId>
): InstructionPracticeItem {
  const controlQuestions = Object.fromEntries(
    definition.correctStages.map((stage) => [
      stage,
      {
        stage,
        prompt: `${stage} 阶段各控制信号应取什么值？`,
        controls: PRACTICE_CONTROL_DEFINITIONS,
        correctControls: definition.controlsByStage[stage] ?? NO_STAGE_ACTION_CONTROLS,
        correctMessage: `${stage} 阶段正确。`,
        explanation: definition.explanationsByStage[stage] ?? `${stage} 阶段控制信号已匹配。`,
      },
    ])
  ) as Partial<Record<Stage, PracticeControlQuestion>>;

  return {
    id: definition.id,
    category: definition.category,
    mnemonic: definition.id,
    title: definition.title,
    stageQuestion: {
      prompt: `这条 ${definition.id} 指令需要哪些拍？`,
      options: PRACTICE_STAGE_ORDER,
      correctStages: definition.correctStages,
    },
    controlQuestions,
  };
}

function resolveRTypePracticeId(instruction: DecodedInstruction): RTypePracticeId | null {
  switch (instruction.funct3) {
    case 0x0:
      return instruction.funct7 === 0x20 ? 'sub' : 'add';
    case 0x1:
      return 'sll';
    case 0x2:
      return 'slt';
    case 0x3:
      return 'sltu';
    case 0x4:
      return 'xor';
    case 0x5:
      return instruction.funct7 === 0x20 ? 'sra' : 'srl';
    case 0x6:
      return 'or';
    case 0x7:
      return 'and';
    default:
      return null;
  }
}

function resolveITypeALUPracticeId(instruction: DecodedInstruction): ITypePracticeId | null {
  switch (instruction.funct3) {
    case 0x0:
      return 'addi';
    case 0x1:
      return 'slli';
    case 0x2:
      return 'slti';
    case 0x3:
      return 'sltiu';
    case 0x4:
      return 'xori';
    case 0x5:
      return instruction.funct7 === 0x20 ? 'srai' : 'srli';
    case 0x6:
      return 'ori';
    case 0x7:
      return 'andi';
    default:
      return null;
  }
}

function resolveLoadPracticeId(instruction: DecodedInstruction): ITypePracticeId | null {
  switch (instruction.funct3) {
    case 0x0:
      return 'lb';
    case 0x1:
      return 'lh';
    case 0x2:
      return 'lw';
    case 0x4:
      return 'lbu';
    case 0x5:
      return 'lhu';
    default:
      return null;
  }
}

function resolveStorePracticeId(instruction: DecodedInstruction): STypePracticeId | null {
  switch (instruction.funct3) {
    case 0x0:
      return 'sb';
    case 0x1:
      return 'sh';
    case 0x2:
      return 'sw';
    default:
      return null;
  }
}

function resolveBranchPracticeId(instruction: DecodedInstruction): BTypePracticeId | null {
  switch (instruction.funct3) {
    case 0x0:
      return 'beq';
    case 0x1:
      return 'bne';
    case 0x4:
      return 'blt';
    case 0x5:
      return 'bge';
    case 0x6:
      return 'bltu';
    case 0x7:
      return 'bgeu';
    default:
      return null;
  }
}

function setSelectedChoice<TChoice extends string>(
  current: readonly TChoice[],
  options: readonly TChoice[],
  choice: TChoice,
  selected: boolean
): readonly TChoice[] {
  if (!options.includes(choice)) {
    return current;
  }

  const selectedChoices = new Set(normalizeChoices(current, options));
  if (selected) {
    selectedChoices.add(choice);
  } else {
    selectedChoices.delete(choice);
  }

  return options.filter((option) => selectedChoices.has(option));
}

function createChoiceResult<TChoice extends string>(
  selected: readonly TChoice[],
  expected: readonly TChoice[],
  options: readonly TChoice[]
): PracticeChoiceResult<TChoice> {
  const normalizedSelected = normalizeChoices(selected, options);
  const selectedSet = new Set(normalizedSelected);
  const expectedSet = new Set(expected);
  const missing = expected.filter((choice) => !selectedSet.has(choice));
  const extra = normalizedSelected.filter((choice) => !expectedSet.has(choice));

  return {
    selected: normalizedSelected,
    expected,
    missing,
    extra,
    correct: missing.length === 0 && extra.length === 0,
  };
}

function normalizeChoices<TChoice extends string>(
  choices: readonly TChoice[],
  options: readonly TChoice[]
): readonly TChoice[] {
  const selected = new Set(choices);
  return options.filter((option) => selected.has(option));
}

function isValidControlValue(
  controlName: PracticeControlName,
  value: PracticeControlValue | null
): boolean {
  return value === null || PRACTICE_CONTROL_OPTIONS[controlName].some((option) => option.value === value);
}
