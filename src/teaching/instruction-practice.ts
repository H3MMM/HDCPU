import { Stage } from '../types';

export type DatapathInteractionMode = 'free-drag' | 'practice';
export type InstructionPracticeCategory = 'R' | 'I';
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
export type InstructionPracticeId = RTypePracticeId | ITypePracticeId;
export type ALUSourceSignalId = 'alu-src-reg' | 'alu-src-imm';
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
  | 'pc-src-branch';

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

interface ALUPracticeDefinition<TId extends InstructionPracticeId> {
  id: TId;
  category: InstructionPracticeCategory;
  title: string;
  correctStages: readonly Stage[];
  sourceSignalId: ALUSourceSignalId;
  sourceLabel: string;
  aluSignalId: ALUOpSignalId;
  aluOpLabel: string;
  expression: string;
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

export const INSTRUCTION_PRACTICE_IDS_BY_CATEGORY: Readonly<
  Record<InstructionPracticeCategory, readonly InstructionPracticeId[]>
> = {
  R: R_TYPE_PRACTICE_IDS,
  I: I_TYPE_PRACTICE_IDS,
};

export const DEFAULT_INSTRUCTION_PRACTICE_ID: InstructionPracticeId = 'lw';

const EX_SIGNAL_OPTIONS: readonly PracticeControlSignalOption[] = [
  { id: 'alu-src-reg', label: 'ALUSrc = rs2' },
  { id: 'alu-src-imm', label: 'ALUSrc = imm' },
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
  { id: 'pc-src-branch', label: 'PCSrc = branch' },
];

const R_TYPE_DEFINITIONS: readonly ALUPracticeDefinition<RTypePracticeId>[] = [
  createRTypeDefinition('add', 'ADD', 'alu-op-add', 'Reg[rs1] + Reg[rs2]'),
  createRTypeDefinition('sub', 'SUB', 'alu-op-sub', 'Reg[rs1] - Reg[rs2]'),
  createRTypeDefinition('and', 'AND', 'alu-op-and', 'Reg[rs1] & Reg[rs2]'),
  createRTypeDefinition('or', 'OR', 'alu-op-or', 'Reg[rs1] | Reg[rs2]'),
  createRTypeDefinition('xor', 'XOR', 'alu-op-xor', 'Reg[rs1] ^ Reg[rs2]'),
  createRTypeDefinition('sll', 'SLL', 'alu-op-sll', 'Reg[rs1] << Reg[rs2]'),
  createRTypeDefinition('srl', 'SRL', 'alu-op-srl', 'Reg[rs1] >> Reg[rs2]'),
  createRTypeDefinition('sra', 'SRA', 'alu-op-sra', 'Reg[rs1] 算术右移 Reg[rs2]'),
  createRTypeDefinition('slt', 'SLT', 'alu-op-slt', 'Reg[rs1] < Reg[rs2]'),
  createRTypeDefinition('sltu', 'SLTU', 'alu-op-sltu', 'Reg[rs1] < Reg[rs2]（无符号）'),
];

const I_TYPE_ALU_DEFINITIONS: readonly ALUPracticeDefinition<ITypePracticeId>[] = [
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

const I_TYPE_LOAD_DEFINITIONS: readonly ALUPracticeDefinition<ITypePracticeId>[] = [
  createAddressDefinition('lb', '字节读取'),
  createAddressDefinition('lh', '半字读取'),
  createAddressDefinition('lw', '字读取'),
  createAddressDefinition('lbu', '无符号字节读取'),
  createAddressDefinition('lhu', '无符号半字读取'),
];

const JALR_DEFINITION: ALUPracticeDefinition<ITypePracticeId> = {
  id: 'jalr',
  category: 'I',
  title: 'jalr 间接跳转指令',
  correctStages: ALU_WRITEBACK_STAGES,
  sourceSignalId: 'alu-src-imm',
  sourceLabel: 'imm',
  aluSignalId: 'alu-op-add',
  aluOpLabel: 'ADD',
  expression: 'Reg[rs1] + imm',
};

const R_TYPE_PRACTICE_ITEMS = Object.fromEntries(
  R_TYPE_DEFINITIONS.map((definition) => [definition.id, createALUPracticeItem(definition)])
) as Record<RTypePracticeId, InstructionPracticeItem>;

const I_TYPE_PRACTICE_ITEMS = Object.fromEntries(
  [...I_TYPE_ALU_DEFINITIONS, ...I_TYPE_LOAD_DEFINITIONS, JALR_DEFINITION].map((definition) => [
    definition.id,
    createALUPracticeItem(definition),
  ])
) as Record<ITypePracticeId, InstructionPracticeItem>;

export const INSTRUCTION_PRACTICE_ITEMS: Readonly<Record<InstructionPracticeId, InstructionPracticeItem>> = {
  ...R_TYPE_PRACTICE_ITEMS,
  ...I_TYPE_PRACTICE_ITEMS,
};

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

function createRTypeDefinition(
  id: RTypePracticeId,
  aluOpLabel: string,
  aluSignalId: ALUOpSignalId,
  expression: string
): ALUPracticeDefinition<RTypePracticeId> {
  return {
    id,
    category: 'R',
    title: `${id} R 型运算指令`,
    correctStages: ALU_WRITEBACK_STAGES,
    sourceSignalId: 'alu-src-reg',
    sourceLabel: 'rs2',
    aluSignalId,
    aluOpLabel,
    expression,
  };
}

function createImmediateALUDefinition(
  id: ITypePracticeId,
  aluOpLabel: string,
  aluSignalId: ALUOpSignalId,
  expression: string
): ALUPracticeDefinition<ITypePracticeId> {
  return {
    id,
    category: 'I',
    title: `${id} I 型立即数运算指令`,
    correctStages: ALU_WRITEBACK_STAGES,
    sourceSignalId: 'alu-src-imm',
    sourceLabel: 'imm',
    aluSignalId,
    aluOpLabel,
    expression,
  };
}

function createAddressDefinition(
  id: ITypePracticeId,
  loadKind: string
): ALUPracticeDefinition<ITypePracticeId> {
  return {
    id,
    category: 'I',
    title: `${id} I 型${loadKind}指令`,
    correctStages: MEMORY_LOAD_STAGES,
    sourceSignalId: 'alu-src-imm',
    sourceLabel: 'imm',
    aluSignalId: 'alu-op-add',
    aluOpLabel: 'ADD',
    expression: 'Reg[rs1] + imm',
  };
}

function createALUPracticeItem(definition: ALUPracticeDefinition<InstructionPracticeId>): InstructionPracticeItem {
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
        correctSignalIds: [definition.sourceSignalId, definition.aluSignalId],
        correctMessage: 'EX 阶段正确。',
        explanation: `${definition.id} 在 EX 阶段计算 ${definition.expression}，所以 ALU_B 需要选择 ${definition.sourceLabel}，ALU_OP 需要选择 ${definition.aluOpLabel}。`,
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
