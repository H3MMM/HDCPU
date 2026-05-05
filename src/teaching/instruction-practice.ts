import { Stage } from '../types';

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
export type ALUSourceSignalId = 'alu-src-reg' | 'alu-src-imm' | 'alu-src-pc' | 'alu-src-4';
export type ALUOpSignalId =
  | 'alu-op-add'
  | 'alu-op-sub'
  | 'alu-op-and'
  | 'alu-op-or'
  | 'alu-op-xor'
  | 'alu-op-slt'
  | 'alu-op-sltu'
  | 'alu-op-sll'
  | 'alu-op-srl'
  | 'alu-op-sra';
export type PracticeControlSignalId =
  | ALUSourceSignalId
  | ALUOpSignalId
  | 'reg-write'
  | 'mem-write'
  | 'pc-write'
  | 'pc-src-branch'
  | 'pc-src-jump'
  | 'wb-src-imm'
  | 'wb-src-pc-plus-4';

export interface PracticeControlSignalOption {
  id: PracticeControlSignalId;
  label: string;
}

export interface PracticeStageQuestion {
  prompt: string;
  options: readonly Stage[];
  correctStages: readonly Stage[];
}

export interface PracticeSignalQuestion {
  stage: Stage;
  prompt: string;
  options: readonly PracticeControlSignalOption[];
  correctSignalIds: readonly PracticeControlSignalId[];
  correctMessage: string;
  explanation: string;
}

export interface InstructionPracticeItem {
  id: InstructionPracticeId;
  category: InstructionPracticeCategory;
  mnemonic: string;
  title: string;
  stageQuestion: PracticeStageQuestion;
  signalQuestions: Partial<Record<Stage, PracticeSignalQuestion>>;
}

export interface InstructionPracticeAnswer {
  instructionId: InstructionPracticeId;
  selectedStages: readonly Stage[];
  selectedSignalsByStage: Partial<Record<Stage, readonly PracticeControlSignalId[]>>;
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

export interface PracticeSignalCheckResult extends PracticeChoiceResult<PracticeControlSignalId> {
  stage: Stage;
  prompt: string;
  correctMessage: string;
  message: string;
  explanation: string;
}

export interface InstructionPracticeCheckResult {
  instructionId: InstructionPracticeId;
  stages: PracticeStageCheckResult;
  signalsByStage: Partial<Record<Stage, PracticeSignalCheckResult>>;
  correct: boolean;
}

interface InstructionPracticeDefinition<TId extends InstructionPracticeId> {
  id: TId;
  category: InstructionPracticeCategory;
  title: string;
  correctStages: readonly Stage[];
  correctSignalIds: readonly PracticeControlSignalId[];
  explanation: string;
}

export const PRACTICE_STAGE_ORDER: readonly Stage[] = [
  Stage.IF,
  Stage.ID,
  Stage.EX,
  Stage.MEM,
  Stage.WB,
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

const EX_SIGNAL_OPTIONS: readonly PracticeControlSignalOption[] = [
  { id: 'alu-src-pc', label: 'ALUSrcA = PC' },
  { id: 'alu-src-reg', label: 'ALUSrcB = rs2' },
  { id: 'alu-src-imm', label: 'ALUSrcB = imm' },
  { id: 'alu-src-4', label: 'ALUSrcB = 4' },
  { id: 'alu-op-add', label: 'ALUOp = ADD' },
  { id: 'alu-op-sub', label: 'ALUOp = SUB' },
  { id: 'alu-op-and', label: 'ALUOp = AND' },
  { id: 'alu-op-or', label: 'ALUOp = OR' },
  { id: 'alu-op-xor', label: 'ALUOp = XOR' },
  { id: 'alu-op-slt', label: 'ALUOp = SLT' },
  { id: 'alu-op-sltu', label: 'ALUOp = SLTU' },
  { id: 'alu-op-sll', label: 'ALUOp = SLL' },
  { id: 'alu-op-srl', label: 'ALUOp = SRL' },
  { id: 'alu-op-sra', label: 'ALUOp = SRA' },
  { id: 'reg-write', label: 'RegWrite' },
  { id: 'mem-write', label: 'MemWrite' },
  { id: 'pc-write', label: 'PCWrite' },
  { id: 'pc-src-branch', label: 'PCSrc = branch' },
  { id: 'pc-src-jump', label: 'PCSrc = jump' },
  { id: 'wb-src-imm', label: 'WriteBack = imm' },
  { id: 'wb-src-pc-plus-4', label: 'WriteBack = PC+4' },
];

const R_TYPE_DEFINITIONS: readonly InstructionPracticeDefinition<RTypePracticeId>[] = [
  createRegisterALUDefinition('add', 'ADD', 'alu-op-add', 'Reg[rs1] + Reg[rs2]'),
  createRegisterALUDefinition('sub', 'SUB', 'alu-op-sub', 'Reg[rs1] - Reg[rs2]'),
  createRegisterALUDefinition('and', 'AND', 'alu-op-and', 'Reg[rs1] & Reg[rs2]'),
  createRegisterALUDefinition('or', 'OR', 'alu-op-or', 'Reg[rs1] | Reg[rs2]'),
  createRegisterALUDefinition('xor', 'XOR', 'alu-op-xor', 'Reg[rs1] ^ Reg[rs2]'),
  createRegisterALUDefinition('sll', 'SLL', 'alu-op-sll', 'Reg[rs1] << Reg[rs2]'),
  createRegisterALUDefinition('srl', 'SRL', 'alu-op-srl', 'Reg[rs1] >> Reg[rs2]'),
  createRegisterALUDefinition('sra', 'SRA', 'alu-op-sra', 'Reg[rs1] 算术右移 Reg[rs2]'),
  createRegisterALUDefinition('slt', 'SLT', 'alu-op-slt', 'Reg[rs1] < Reg[rs2]'),
  createRegisterALUDefinition('sltu', 'SLTU', 'alu-op-sltu', 'Reg[rs1] < Reg[rs2]（无符号）'),
];

const I_TYPE_ALU_DEFINITIONS: readonly InstructionPracticeDefinition<ITypePracticeId>[] = [
  createImmediateALUDefinition('addi', 'ADD', 'alu-op-add', 'Reg[rs1] + imm'),
  createImmediateALUDefinition('andi', 'AND', 'alu-op-and', 'Reg[rs1] & imm'),
  createImmediateALUDefinition('ori', 'OR', 'alu-op-or', 'Reg[rs1] | imm'),
  createImmediateALUDefinition('xori', 'XOR', 'alu-op-xor', 'Reg[rs1] ^ imm'),
  createImmediateALUDefinition('slti', 'SLT', 'alu-op-slt', 'Reg[rs1] < imm'),
  createImmediateALUDefinition('sltiu', 'SLTU', 'alu-op-sltu', 'Reg[rs1] < imm（无符号）'),
  createImmediateALUDefinition('slli', 'SLL', 'alu-op-sll', 'Reg[rs1] << shamt'),
  createImmediateALUDefinition('srli', 'SRL', 'alu-op-srl', 'Reg[rs1] >> shamt'),
  createImmediateALUDefinition('srai', 'SRA', 'alu-op-sra', 'Reg[rs1] 算术右移 shamt'),
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
  correctSignalIds: ['alu-src-imm', 'alu-op-add'],
  explanation: 'jalr 在 EX 阶段用 Reg[rs1] + imm 计算跳转目标，所以 ALU_B 需要选择 imm，ALU_OP 需要选择 ADD。',
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
    correctSignalIds: ['reg-write', 'wb-src-imm'],
    explanation: 'lui 在 EX 阶段把 U 型立即数作为写回数据，所以需要打开 RegWrite，并选择 imm 作为写回来源。',
  },
  {
    id: 'auipc',
    category: 'U',
    title: 'auipc U 型 PC 相对指令',
    correctStages: ALU_WRITEBACK_STAGES,
    correctSignalIds: ['alu-src-pc', 'alu-src-imm', 'alu-op-add'],
    explanation: 'auipc 在 EX 阶段计算 PC + imm，所以 ALU_A 需要选择 PC，ALU_B 需要选择 imm，ALU_OP 需要选择 ADD。',
  },
];

const J_TYPE_DEFINITIONS: readonly InstructionPracticeDefinition<JTypePracticeId>[] = [
  {
    id: 'jal',
    category: 'J',
    title: 'jal J 型跳转指令',
    correctStages: DIRECT_EX_STAGES,
    correctSignalIds: [
      'alu-src-pc',
      'alu-src-4',
      'alu-op-add',
      'pc-write',
      'pc-src-jump',
      'reg-write',
      'wb-src-pc-plus-4',
    ],
    explanation: 'jal 在 EX 阶段写入跳转目标 PC，同时把 PC+4 写回 rd，所以需要 PCWrite、PCSrc=jump、RegWrite，并选择 PC+4 作为写回来源。',
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

export function createEmptyPracticeAnswer(
  instructionId: InstructionPracticeId = DEFAULT_INSTRUCTION_PRACTICE_ID
): InstructionPracticeAnswer {
  const item = getInstructionPracticeItem(instructionId);
  const selectedSignalsByStage: Partial<Record<Stage, readonly PracticeControlSignalId[]>> = {};

  for (const stage of PRACTICE_STAGE_ORDER) {
    if (item.signalQuestions[stage]) {
      selectedSignalsByStage[stage] = [];
    }
  }

  return {
    instructionId,
    selectedStages: [],
    selectedSignalsByStage,
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

export function setPracticeSignalSelected(
  answer: InstructionPracticeAnswer,
  stage: Stage,
  signalId: PracticeControlSignalId,
  selected: boolean
): InstructionPracticeAnswer {
  const item = getInstructionPracticeItem(answer.instructionId);
  const question = item.signalQuestions[stage];
  if (!question) {
    return answer;
  }

  const optionIds = question.options.map((option) => option.id);
  return {
    ...answer,
    selectedSignalsByStage: {
      ...answer.selectedSignalsByStage,
      [stage]: setSelectedChoice(
        answer.selectedSignalsByStage[stage] ?? [],
        optionIds,
        signalId,
        selected
      ),
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
  const signalsByStage: Partial<Record<Stage, PracticeSignalCheckResult>> = {};

  for (const stage of PRACTICE_STAGE_ORDER) {
    const question = item.signalQuestions[stage];
    if (!question) {
      continue;
    }

    const optionIds = question.options.map((option) => option.id);
    const signalResult = createChoiceResult(
      answer.selectedSignalsByStage[stage] ?? [],
      question.correctSignalIds,
      optionIds
    );

    signalsByStage[stage] = {
      ...signalResult,
      stage,
      prompt: question.prompt,
      correctMessage: question.correctMessage,
      message: signalResult.correct ? question.correctMessage : `${stage} 阶段还不对。`,
      explanation: question.explanation,
    };
  }

  const signalResults = Object.values(signalsByStage);

  return {
    instructionId: item.id,
    stages: {
      ...stageResult,
      prompt: item.stageQuestion.prompt,
    },
    signalsByStage,
    correct: stageResult.correct && signalResults.every((result) => result.correct),
  };
}

function createRegisterALUDefinition(
  id: RTypePracticeId,
  aluOpLabel: string,
  aluSignalId: ALUOpSignalId,
  expression: string
): InstructionPracticeDefinition<RTypePracticeId> {
  return {
    id,
    category: 'R',
    title: `${id} R 型运算指令`,
    correctStages: ALU_WRITEBACK_STAGES,
    correctSignalIds: ['alu-src-reg', aluSignalId],
    explanation: `${id} 在 EX 阶段计算 ${expression}，所以 ALU_B 需要选择 rs2，ALU_OP 需要选择 ${aluOpLabel}。`,
  };
}

function createImmediateALUDefinition(
  id: ITypePracticeId,
  aluOpLabel: string,
  aluSignalId: ALUOpSignalId,
  expression: string
): InstructionPracticeDefinition<ITypePracticeId> {
  return {
    id,
    category: 'I',
    title: `${id} I 型立即数运算指令`,
    correctStages: ALU_WRITEBACK_STAGES,
    correctSignalIds: ['alu-src-imm', aluSignalId],
    explanation: `${id} 在 EX 阶段计算 ${expression}，所以 ALU_B 需要选择 imm，ALU_OP 需要选择 ${aluOpLabel}。`,
  };
}

function createAddressDefinition<TId extends ITypePracticeId | STypePracticeId>(
  id: TId,
  category: InstructionPracticeCategory,
  correctStages: readonly Stage[],
  accessKind: string
): InstructionPracticeDefinition<TId> {
  return {
    id,
    category,
    title: `${id} ${category} 型${accessKind}指令`,
    correctStages,
    correctSignalIds: ['alu-src-imm', 'alu-op-add'],
    explanation: `${id} 在 EX 阶段用 Reg[rs1] + imm 计算有效地址，所以 ALU_B 需要选择 imm，ALU_OP 需要选择 ADD。`,
  };
}

function createBranchDefinition(id: BTypePracticeId, conditionLabel: string): InstructionPracticeDefinition<BTypePracticeId> {
  return {
    id,
    category: 'B',
    title: `${id} B 型${conditionLabel}分支指令`,
    correctStages: BRANCH_STAGES,
    correctSignalIds: ['alu-src-reg', 'alu-op-sub', 'pc-src-branch'],
    explanation: `${id} 在 EX 阶段比较 Reg[rs1] 和 Reg[rs2] 并决定分支，所以 ALU_B 需要选择 rs2，ALU_OP 需要选择 SUB，PCSrc 需要选择 branch。`,
  };
}

function createInstructionPracticeItem(
  definition: InstructionPracticeDefinition<InstructionPracticeId>
): InstructionPracticeItem {
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
    signalQuestions: {
      [Stage.EX]: {
        stage: Stage.EX,
        prompt: 'EX 阶段需要哪些控制信号？',
        options: EX_SIGNAL_OPTIONS,
        correctSignalIds: definition.correctSignalIds,
        correctMessage: 'EX 阶段正确。',
        explanation: definition.explanation,
      },
    },
  };
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
