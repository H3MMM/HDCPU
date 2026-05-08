import { ControlUnit } from '../engine/core/control';
import { Stage, type ControlSignals, type DecodedInstruction, type InstructionFormat } from '../types';
import {
  MULTICYCLE_TEXTBOOK_SIGNAL_NAMES,
  buildMulticycleTextbookSignalRows,
  formatTextbookSignalValue,
  getTextbookSignalOptions,
  type MulticycleTextbookSignalName,
} from './textbook-signals';

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

export type PracticeControlName = MulticycleTextbookSignalName;
export type PracticeControlValue = string;
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
  instruction: DecodedInstruction;
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
const MEMORY_STORE_STAGES: readonly Stage[] = [Stage.IF, Stage.ID, Stage.EX, Stage.MEM];
const BRANCH_STAGES: readonly Stage[] = [Stage.IF, Stage.ID, Stage.EX];
const DIRECT_EX_STAGES: readonly Stage[] = [Stage.IF, Stage.EX];

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
const B_TYPE_PRACTICE_IDS: readonly BTypePracticeId[] = ['beq', 'bne', 'blt', 'bge', 'bltu', 'bgeu'];
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
export const PRACTICE_CONTROL_ORDER: readonly PracticeControlName[] = MULTICYCLE_TEXTBOOK_SIGNAL_NAMES;

export const PRACTICE_CONTROL_OPTIONS: Readonly<Record<PracticeControlName, readonly PracticeControlValueOption[]>> =
  Object.fromEntries(
    PRACTICE_CONTROL_ORDER.map((name) => [
      name,
      getTextbookSignalOptions(name).map((value) => ({ value, label: value })),
    ])
  ) as unknown as Readonly<Record<PracticeControlName, readonly PracticeControlValueOption[]>>;

export const PRACTICE_CONTROL_DEFINITIONS: readonly PracticeControlDefinition[] = PRACTICE_CONTROL_ORDER.map((name) => ({
  name,
  label: name,
  options: PRACTICE_CONTROL_OPTIONS[name],
}));

const controlUnit = new ControlUnit();

const ALL_INSTRUCTION_DEFINITIONS: readonly InstructionPracticeDefinition<InstructionPracticeId>[] = [
  ...R_TYPE_PRACTICE_IDS.map((id) => createDefinition(id, 'R', ALU_WRITEBACK_STAGES, createRTypeInstruction(id))),
  ...I_TYPE_PRACTICE_IDS.map((id) => createDefinition(id, 'I', getITypeStages(id), createITypeInstruction(id))),
  ...S_TYPE_PRACTICE_IDS.map((id) => createDefinition(id, 'S', MEMORY_STORE_STAGES, createSTypeInstruction(id))),
  ...B_TYPE_PRACTICE_IDS.map((id) => createDefinition(id, 'B', BRANCH_STAGES, createBTypeInstruction(id))),
  ...U_TYPE_PRACTICE_IDS.map((id) => createDefinition(id, 'U', getUTypeStages(id), createUTypeInstruction(id))),
  ...J_TYPE_PRACTICE_IDS.map((id) => createDefinition(id, 'J', DIRECT_EX_STAGES, createJTypeInstruction(id))),
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
      message: mismatches.length === 0 ? question.correctMessage : `${stage} 阶段还有教材信号不匹配。`,
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

function createDefinition<TId extends InstructionPracticeId>(
  id: TId,
  category: InstructionPracticeCategory,
  correctStages: readonly Stage[],
  instruction: DecodedInstruction
): InstructionPracticeDefinition<TId> {
  return {
    id,
    category,
    title: `${id} ${category} 型指令`,
    correctStages,
    instruction,
  };
}

function createInstructionPracticeItem(
  definition: InstructionPracticeDefinition<InstructionPracticeId>
): InstructionPracticeItem {
  const controlQuestions = Object.fromEntries(
    definition.correctStages.map((stage) => {
      const correctControls = createTextbookControlsForStage(stage, definition.instruction);
      return [
        stage,
        {
          stage,
          prompt: `${stage} 阶段教材控制信号应该取什么值？`,
          controls: PRACTICE_CONTROL_DEFINITIONS,
          correctControls,
          correctMessage: `${stage} 阶段教材信号正确。`,
          explanation: createStageExplanation(stage, definition.instruction),
        },
      ];
    })
  ) as Partial<Record<Stage, PracticeControlQuestion>>;

  return {
    id: definition.id,
    category: definition.category,
    mnemonic: definition.id,
    title: definition.title,
    stageQuestion: {
      prompt: `这条 ${definition.id} 指令需要哪些阶段？`,
      options: PRACTICE_STAGE_ORDER,
      correctStages: definition.correctStages,
    },
    controlQuestions,
  };
}

function createTextbookControlsForStage(
  stage: Stage,
  instruction: DecodedInstruction
): PracticeControlSelection {
  const controlSignals = createControlSignalsForPractice(stage, instruction);
  const rows = buildMulticycleTextbookSignalRows({
    stage,
    controlSignals,
    currentInstruction: instruction,
  });

  return Object.fromEntries(
    rows.map((row) => [row.label, formatTextbookSignalValue(row.value)])
  ) as PracticeControlSelection;
}

function createControlSignalsForPractice(stage: Stage, instruction: DecodedInstruction): ControlSignals {
  return controlUnit.getControlSignals(stage, stage === Stage.IF ? null : instruction);
}

function createStageExplanation(stage: Stage, instruction: DecodedInstruction): string {
  if (stage === Stage.IF) {
    return 'IF 阶段取指并产生 PC+4，教材信号与状态面板中的取指/PC 控制线保持一致。';
  }

  if (stage === Stage.ID) {
    return 'ID 阶段译码并准备立即数，教材信号取自状态面板同一套控制线。';
  }

  if (stage === Stage.EX) {
    return `${instruction.asmString} 在 EX 阶段使用当前 ALU、PC 或立即数相关控制信号。`;
  }

  if (stage === Stage.MEM) {
    return `${instruction.asmString} 在 MEM 阶段根据是否访存写入来设置 Mem_Write、Size_s 和 SE_s。`;
  }

  return `${instruction.asmString} 在 WB 阶段根据写回来源设置 Reg_Write 和 w_data_s。`;
}

function getITypeStages(id: ITypePracticeId): readonly Stage[] {
  return id === 'lb' || id === 'lh' || id === 'lw' || id === 'lbu' || id === 'lhu'
    ? MEMORY_LOAD_STAGES
    : ALU_WRITEBACK_STAGES;
}

function getUTypeStages(id: UTypePracticeId): readonly Stage[] {
  return id === 'lui' ? DIRECT_EX_STAGES : ALU_WRITEBACK_STAGES;
}

function createDecodedInstruction(
  asmString: string,
  format: InstructionFormat,
  opcode: number,
  overrides: Partial<DecodedInstruction> = {}
): DecodedInstruction {
  return {
    raw: 0,
    format,
    opcode,
    rd: 3,
    funct3: 0,
    rs1: 1,
    rs2: 2,
    funct7: 0,
    immediate: 8,
    asmString,
    description: `${asmString} practice instruction`,
    ...overrides,
  };
}

function createRTypeInstruction(id: RTypePracticeId): DecodedInstruction {
  const functMap: Record<RTypePracticeId, Pick<DecodedInstruction, 'funct3' | 'funct7'>> = {
    add: { funct3: 0x0, funct7: 0x00 },
    sub: { funct3: 0x0, funct7: 0x20 },
    and: { funct3: 0x7, funct7: 0x00 },
    or: { funct3: 0x6, funct7: 0x00 },
    xor: { funct3: 0x4, funct7: 0x00 },
    sll: { funct3: 0x1, funct7: 0x00 },
    srl: { funct3: 0x5, funct7: 0x00 },
    sra: { funct3: 0x5, funct7: 0x20 },
    slt: { funct3: 0x2, funct7: 0x00 },
    sltu: { funct3: 0x3, funct7: 0x00 },
  };

  return createDecodedInstruction(`${id} x3, x1, x2`, 'R', 0x33, functMap[id]);
}

function createITypeInstruction(id: ITypePracticeId): DecodedInstruction {
  if (id === 'jalr') {
    return createDecodedInstruction('jalr x3, 8(x1)', 'I', 0x67, { funct3: 0x0 });
  }

  const loadFunct3: Partial<Record<ITypePracticeId, number>> = {
    lb: 0x0,
    lh: 0x1,
    lw: 0x2,
    lbu: 0x4,
    lhu: 0x5,
  };

  if (loadFunct3[id] !== undefined) {
    return createDecodedInstruction(`${id} x3, 8(x1)`, 'I', 0x03, { funct3: loadFunct3[id] });
  }

  const aluFunctMap: Partial<Record<ITypePracticeId, Pick<DecodedInstruction, 'funct3' | 'funct7'>>> = {
    addi: { funct3: 0x0, funct7: 0x00 },
    slti: { funct3: 0x2, funct7: 0x00 },
    sltiu: { funct3: 0x3, funct7: 0x00 },
    xori: { funct3: 0x4, funct7: 0x00 },
    ori: { funct3: 0x6, funct7: 0x00 },
    andi: { funct3: 0x7, funct7: 0x00 },
    slli: { funct3: 0x1, funct7: 0x00 },
    srli: { funct3: 0x5, funct7: 0x00 },
    srai: { funct3: 0x5, funct7: 0x20 },
  };
  const operands = id === 'slli' || id === 'srli' || id === 'srai' ? 'x3, x1, 2' : 'x3, x1, 8';

  return createDecodedInstruction(`${id} ${operands}`, 'I', 0x13, aluFunctMap[id]);
}

function createSTypeInstruction(id: STypePracticeId): DecodedInstruction {
  const funct3Map: Record<STypePracticeId, number> = {
    sb: 0x0,
    sh: 0x1,
    sw: 0x2,
  };

  return createDecodedInstruction(`${id} x3, 8(x1)`, 'S', 0x23, {
    rd: 0,
    funct3: funct3Map[id],
    rs2: 3,
  });
}

function createBTypeInstruction(id: BTypePracticeId): DecodedInstruction {
  const funct3Map: Record<BTypePracticeId, number> = {
    beq: 0x0,
    bne: 0x1,
    blt: 0x4,
    bge: 0x5,
    bltu: 0x6,
    bgeu: 0x7,
  };

  return createDecodedInstruction(`${id} x1, x2, 8`, 'B', 0x63, {
    rd: 0,
    funct3: funct3Map[id],
  });
}

function createUTypeInstruction(id: UTypePracticeId): DecodedInstruction {
  return createDecodedInstruction(`${id} x3, 0x12345`, 'U', id === 'lui' ? 0x37 : 0x17, {
    rs1: 0,
    rs2: 0,
    immediate: 0x12345000,
  });
}

function createJTypeInstruction(id: JTypePracticeId): DecodedInstruction {
  return createDecodedInstruction(`${id} x3, 8`, 'J', 0x6F, {
    rs1: 0,
    rs2: 0,
    immediate: 8,
  });
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
