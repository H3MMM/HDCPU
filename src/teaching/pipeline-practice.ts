import type {
  CycleSnapshot,
  PipelineConflictEvent,
  PipelineForwardingSignalName,
  PipelineForwardingSource,
} from '../types';
import {
  PIPELINE_TEXTBOOK_SIGNAL_NAMES,
  buildPipelineTextbookSignalRows,
  formatTextbookSignalValue,
  getTextbookSignalOptionItems,
  getTextbookSignalOptionLabel,
  getTextbookSignalOptions,
  type TextbookSignalOption,
  type PipelineTextbookSignalName,
} from './textbook-signals';

export type PipelinePracticeBooleanSignalName =
  | 'PCWrite'
  | 'IF/IDWrite'
  | 'IF/IDFlush'
  | 'ID/EXFlush'
  | 'InsertBubble';

export type PipelinePracticeSignalName =
  | PipelineTextbookSignalName
  | PipelinePracticeBooleanSignalName
  | PipelineForwardingSignalName;

export type PipelinePracticeSelectedValue = string | boolean | PipelineForwardingSource | null;
export type PipelinePracticeExpectedValue = string | boolean | PipelineForwardingSource;

export interface PipelinePracticeTextbookSignalDefinition {
  name: PipelineTextbookSignalName;
  label: string;
  hint: string;
  options: readonly TextbookSignalOption[];
}

export interface PipelinePracticeBooleanSignalDefinition {
  name: PipelinePracticeBooleanSignalName;
  label: string;
  hint: string;
}

export interface PipelinePracticeForwardingSignalDefinition {
  name: PipelineForwardingSignalName;
  label: string;
  hint: string;
}

export interface PipelinePracticeExpectedAnswer {
  textbook: Readonly<Record<PipelineTextbookSignalName, string>>;
  booleans: Readonly<Record<PipelinePracticeBooleanSignalName, boolean>>;
  forwarding: Readonly<Record<PipelineForwardingSignalName, PipelineForwardingSource>>;
}

export interface PipelinePracticeAnswer {
  cycleNumber: number;
  selectedTextbookSignals: Partial<Record<PipelineTextbookSignalName, string>>;
  selectedBooleans: Partial<Record<PipelinePracticeBooleanSignalName, boolean>>;
  selectedForwarding: Partial<Record<PipelineForwardingSignalName, PipelineForwardingSource>>;
}

export interface PipelinePracticeQuestion {
  cycleNumber: number;
  textbookPrompt: string;
  conflictPrompt: string;
  events: readonly PipelineConflictEvent[];
  expected: PipelinePracticeExpectedAnswer;
}

export interface PipelinePracticeMismatch {
  signal: PipelinePracticeSignalName;
  label: string;
  expected: PipelinePracticeExpectedValue;
  selected: PipelinePracticeSelectedValue;
  explanation: string;
  section: 'textbook' | 'conflict';
}

export interface PipelinePracticeCheckResult {
  cycleNumber: number;
  expected: PipelinePracticeExpectedAnswer;
  selected: PipelinePracticeAnswer;
  mismatches: readonly PipelinePracticeMismatch[];
  correct: boolean;
  message: string;
}

export const PIPELINE_PRACTICE_TEXTBOOK_SIGNALS: readonly PipelinePracticeTextbookSignalDefinition[] =
  PIPELINE_TEXTBOOK_SIGNAL_NAMES.map((name) => ({
    name,
    label: name,
    hint: getPipelineTextbookSignalHint(name),
    options: getTextbookSignalOptionItems(name, 'pipeline'),
  }));

export const PIPELINE_PRACTICE_BOOLEAN_SIGNALS: readonly PipelinePracticeBooleanSignalDefinition[] = [
  {
    name: 'PCWrite',
    label: '冻结 PC',
    hint: 'RAW 或控制停等时 PC 不应推进；控制 flush 重定向时允许写入新 PC。',
  },
  {
    name: 'IF/IDWrite',
    label: '冻结 IF/ID',
    hint: 'RAW 停顿时消费者留在 IF/ID 中等待生产者结果。',
  },
  {
    name: 'IF/IDFlush',
    label: '清空 IF/ID',
    hint: '控制转移判定后，错误路径中已经取回的年轻指令需要清空。',
  },
  {
    name: 'ID/EXFlush',
    label: '清空 ID/EX',
    hint: 'RAW 停顿插入 bubble，控制 flush 清空已进入 ID/EX 的年轻指令。',
  },
  {
    name: 'InsertBubble',
    label: '插入 bubble',
    hint: 'RAW 停顿时让生产者继续后移，同时阻止消费者进入 EX。',
  },
];

export const PIPELINE_PRACTICE_FORWARDING_SIGNALS: readonly PipelinePracticeForwardingSignalDefinition[] = [
  {
    name: 'ForwardA',
    label: 'ForwardA',
    hint: 'EX 阶段 ALU 输入 A 的旁路来源。',
  },
  {
    name: 'ForwardB',
    label: 'ForwardB',
    hint: 'EX 阶段 ALU 输入 B 的旁路来源。',
  },
  {
    name: 'StoreForward',
    label: 'StoreForward',
    hint: 'store 写数据的旁路来源。',
  },
];

export const PIPELINE_PRACTICE_FORWARDING_OPTIONS: readonly PipelineForwardingSource[] = [
  'none',
  'exMem',
  'memWb',
];

export function createEmptyPipelinePracticeAnswer(
  snapshotOrCycleNumber: CycleSnapshot | number = 0
): PipelinePracticeAnswer {
  const cycleNumber =
    typeof snapshotOrCycleNumber === 'number' ? snapshotOrCycleNumber : snapshotOrCycleNumber.cycleNumber;

  return {
    cycleNumber,
    selectedTextbookSignals: {},
    selectedBooleans: {},
    selectedForwarding: {},
  };
}

export function createPipelinePracticeQuestion(snapshot: CycleSnapshot): PipelinePracticeQuestion {
  return {
    cycleNumber: snapshot.cycleNumber,
    textbookPrompt: `周期 C${snapshot.cycleNumber} 的控制信号应该取什么值？`,
    conflictPrompt: `周期 C${snapshot.cycleNumber} 发生了冲突，请判断本周期核心冲突处理动作。`,
    events: snapshot.pipeline.conflicts,
    expected: getPipelinePracticeExpectedAnswer(snapshot),
  };
}

export function hasPipelinePracticeQuestion(snapshot: CycleSnapshot): boolean {
  return snapshot.pipeline.conflicts.length > 0;
}

export function getPipelinePracticeExpectedAnswer(snapshot: CycleSnapshot): PipelinePracticeExpectedAnswer {
  const { hazard, forwarding } = snapshot.pipeline;
  const textbook = Object.fromEntries(
    buildPipelineTextbookSignalRows(snapshot).map((row) => [row.label, formatTextbookSignalValue(row.value)])
  ) as Readonly<Record<PipelineTextbookSignalName, string>>;

  return {
    textbook,
    booleans: {
      PCWrite: hazard.pcWrite,
      'IF/IDWrite': hazard.ifIdWrite,
      'IF/IDFlush': hazard.ifIdFlush,
      'ID/EXFlush': hazard.idExFlush,
      InsertBubble: hazard.insertBubble,
    },
    forwarding: {
      ForwardA: forwarding.ForwardA.source,
      ForwardB: forwarding.ForwardB.source,
      StoreForward: forwarding.StoreForward.source,
    },
  };
}

export function setPipelinePracticeTextbookSignal(
  answer: PipelinePracticeAnswer,
  signal: PipelineTextbookSignalName,
  value: string | null
): PipelinePracticeAnswer {
  if (value !== null && !getTextbookSignalOptions(signal).includes(value)) {
    return answer;
  }

  const selectedTextbookSignals = { ...answer.selectedTextbookSignals };
  if (value === null) {
    delete selectedTextbookSignals[signal];
  } else {
    selectedTextbookSignals[signal] = value;
  }

  return {
    ...answer,
    selectedTextbookSignals,
  };
}

export function setPipelinePracticeBooleanSignal(
  answer: PipelinePracticeAnswer,
  signal: PipelinePracticeBooleanSignalName,
  value: boolean | null
): PipelinePracticeAnswer {
  const selectedBooleans = { ...answer.selectedBooleans };

  if (value === null) {
    delete selectedBooleans[signal];
  } else {
    selectedBooleans[signal] = value;
  }

  return {
    ...answer,
    selectedBooleans,
  };
}

export function setPipelinePracticeForwardingSignal(
  answer: PipelinePracticeAnswer,
  signal: PipelineForwardingSignalName,
  value: PipelineForwardingSource | null
): PipelinePracticeAnswer {
  if (value !== null && !PIPELINE_PRACTICE_FORWARDING_OPTIONS.includes(value)) {
    return answer;
  }

  const selectedForwarding = { ...answer.selectedForwarding };

  if (value === null) {
    delete selectedForwarding[signal];
  } else {
    selectedForwarding[signal] = value;
  }

  return {
    ...answer,
    selectedForwarding,
  };
}

export function evaluatePipelinePracticeAnswer(
  answer: PipelinePracticeAnswer,
  snapshot: CycleSnapshot
): PipelinePracticeCheckResult {
  const question = createPipelinePracticeQuestion(snapshot);
  const normalizedAnswer =
    answer.cycleNumber === snapshot.cycleNumber ? answer : createEmptyPipelinePracticeAnswer(snapshot);
  const mismatches: PipelinePracticeMismatch[] = [];

  for (const signal of PIPELINE_PRACTICE_TEXTBOOK_SIGNALS) {
    const selected = normalizedAnswer.selectedTextbookSignals[signal.name] ?? null;
    const expected = question.expected.textbook[signal.name];
    if (selected !== expected) {
      mismatches.push({
        signal: signal.name,
        label: signal.label,
        expected,
        selected,
        explanation: explainPipelineTextbookSignal(signal.name, expected),
        section: 'textbook',
      });
    }
  }

  if (question.events.length > 0) {
    for (const signal of PIPELINE_PRACTICE_BOOLEAN_SIGNALS) {
      const selected = normalizedAnswer.selectedBooleans[signal.name] ?? null;
      const expected = question.expected.booleans[signal.name];
      if (selected !== expected) {
        mismatches.push({
          signal: signal.name,
          label: signal.label,
          expected,
          selected,
          explanation: explainBooleanSignal(signal.name, expected),
          section: 'conflict',
        });
      }
    }

    for (const signal of PIPELINE_PRACTICE_FORWARDING_SIGNALS) {
      const selected = normalizedAnswer.selectedForwarding[signal.name] ?? null;
      const expected = question.expected.forwarding[signal.name];
      if (selected !== expected) {
        mismatches.push({
          signal: signal.name,
          label: signal.label,
          expected,
          selected,
          explanation: explainForwardingSignal(signal.name, expected),
          section: 'conflict',
        });
      }
    }
  }

  return {
    cycleNumber: snapshot.cycleNumber,
    expected: question.expected,
    selected: normalizedAnswer,
    mismatches,
    correct: mismatches.length === 0,
    message: mismatches.length === 0 ? '流水线练习全部正确。' : '还有信号需要调整。',
  };
}

export function getPipelinePracticeValueLabel(value: PipelinePracticeSelectedValue): string {
  if (value === null) {
    return '未选择';
  }

  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }

  switch (value) {
    case 'exMem':
      return 'EX/MEM';
    case 'memWb':
      return 'MEM/WB';
    case 'none':
    default:
      return value;
  }
}

export function getPipelinePracticeSignalValueLabel(
  signal: PipelinePracticeSignalName,
  value: PipelinePracticeSelectedValue
): string {
  if (value === null || typeof value === 'boolean') {
    return getPipelinePracticeValueLabel(value);
  }

  if (isPipelineTextbookPracticeSignal(signal)) {
    return getTextbookSignalOptionLabel(signal, value, 'pipeline');
  }

  return getPipelinePracticeValueLabel(value);
}

function isPipelineTextbookPracticeSignal(
  signal: PipelinePracticeSignalName
): signal is PipelineTextbookSignalName {
  return PIPELINE_TEXTBOOK_SIGNAL_NAMES.includes(signal as PipelineTextbookSignalName);
}

function getPipelineTextbookSignalHint(signal: PipelineTextbookSignalName): string {
  switch (signal) {
    case 'PC_s':
      return 'PC 多路选择器选择顺序地址、分支/JAL 目标或 JALR 反馈目标。';
    case 'bcc':
      return 'EX 段分支条件码，非分支时为 none。';
    case 'ALU_OP':
      return 'EX 段 ALU 运算控制。';
    case 'rs2_imm_s':
      return 'EX 段 ALU B 输入选择寄存器 rs2 或立即数。';
    case 'Reg_Write':
      return 'WB 段寄存器堆写使能。';
    case 'Mem_Write':
      return 'MEM 段数据存储器写使能。';
    case 'w_data_s':
      return 'WB 段写回数据来源选择。';
    default:
      return '';
  }
}

function explainPipelineTextbookSignal(
  signal: PipelineTextbookSignalName,
  expected: string
): string {
  switch (signal) {
    case 'PC_s':
      if (expected === '0') {
        return 'PC_s=0 表示本周期要从 JALR 反馈目标更新 PC。';
      }
      if (expected === '1') {
        return 'PC_s=1 表示分支或 JAL 已确定跳转目标，PC 要转向该目标。';
      }
      return 'PC_s=2 表示当前按 PC+4 顺序取指，没有发生重定向。';
    case 'bcc':
      return expected === 'none'
        ? 'EX 段当前不是分支比较，因此 bcc 不需要选择任何分支条件。'
        : `EX 段正在判定分支，bcc 应选择 ${expected} 对应的比较条件。`;
    case 'ALU_OP':
      return `EX 段当前指令需要 ALU 执行 ${expected}，否则运算或比较结果会错误。`;
    case 'rs2_imm_s':
      return expected === '1'
        ? 'rs2_imm_s=1(立即数)，EX 段 ALU B 输入要使用立即数，常见于 I 型运算、访存地址计算和 AUIPC。'
        : 'rs2_imm_s=0(rs2/寄存器)，EX 段 ALU B 输入不选择立即数；当前要么使用 rs2，要么该选择对空拍不生效。';
    case 'Reg_Write':
      return expected === '1'
        ? 'WB 段当前有指令要把结果写入 rd，因此 Reg_Write 应为 1。'
        : 'WB 段当前没有有效寄存器写回，Reg_Write 应为 0，避免误写寄存器。';
    case 'Mem_Write':
      return expected === '1'
        ? 'MEM 段当前是 store 写数据存储器，所以 Mem_Write 应为 1。'
        : 'MEM 段当前不执行 store 写入，Mem_Write 应为 0。';
    case 'w_data_s':
      return explainPipelineWriteBackSelect(expected);
    default:
      return '';
  }
}

function explainPipelineWriteBackSelect(expected: string): string {
  switch (expected) {
    case '1':
      return 'w_data_s=1(数据存储器读数) 表示 WB 写回 load 读出的数据。';
    case '2':
      return 'w_data_s=2(立即数) 表示 WB 写回立即数，LUI 这类指令使用这一路。';
    case '3':
      return 'w_data_s=3(PC+4) 表示 WB 写回返回地址，JAL/JALR 使用这一路。';
    case '4':
      return 'w_data_s=4(offset) 表示 WB 写回 offset 相关结果。';
    case '0':
    default:
      return 'w_data_s=0(ALU结果) 表示 WB 写回 ALU 结果；若本周期不写寄存器，该选择不生效。';
  }
}

function explainBooleanSignal(signal: PipelinePracticeBooleanSignalName, expected: boolean): string {
  switch (signal) {
    case 'PCWrite':
      return expected
        ? '本周期 PC 可以继续更新，或在控制冲突解决后写入重定向目标。'
        : 'RAW 或控制停等会冻结取指，因此 PCWrite 应为 0。';
    case 'IF/IDWrite':
      return expected
        ? 'IF/ID 可以接收新的取指结果。'
        : '消费者指令必须留在 IF/ID 中等待，所以 IF/IDWrite 应为 0。';
    case 'IF/IDFlush':
      return expected
        ? '控制转移已经在 EX 判定，错误路径上的 IF/ID 指令需要清空。'
        : '本周期不需要清空 IF/ID。';
    case 'ID/EXFlush':
      return expected
        ? 'RAW 停顿要向 EX 插入 bubble，控制 flush 要清空已经进入 ID/EX 的年轻指令。'
        : 'ID/EX 保持正常推进，不需要清空。';
    case 'InsertBubble':
      return expected
        ? 'RAW 停顿时需要插入 bubble，让生产者继续向后推进。'
        : '旁路或控制 flush 不通过 RAW bubble 解决。';
    default:
      return '';
  }
}

function explainForwardingSignal(
  signal: PipelineForwardingSignalName,
  expected: PipelineForwardingSource
): string {
  if (expected === 'none') {
    return `${signal} 本周期没有匹配的生产者，不应选择旁路。`;
  }

  const source = getPipelinePracticeValueLabel(expected);
  return `${signal} 应从 ${source} 取得最新结果，避免消费者读到旧寄存器值。`;
}
