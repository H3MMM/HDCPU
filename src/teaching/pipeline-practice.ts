import type {
  CycleSnapshot,
  PipelineConflictEvent,
  PipelineForwardingSignalName,
  PipelineForwardingSource,
} from '../types';

export type PipelinePracticeBooleanSignalName =
  | 'PCWrite'
  | 'IF/IDWrite'
  | 'IF/IDFlush'
  | 'ID/EXFlush'
  | 'InsertBubble';

export type PipelinePracticeSignalName =
  | PipelinePracticeBooleanSignalName
  | PipelineForwardingSignalName;

export type PipelinePracticeSelectedValue = boolean | PipelineForwardingSource | null;
export type PipelinePracticeExpectedValue = boolean | PipelineForwardingSource;

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
  booleans: Readonly<Record<PipelinePracticeBooleanSignalName, boolean>>;
  forwarding: Readonly<Record<PipelineForwardingSignalName, PipelineForwardingSource>>;
}

export interface PipelinePracticeAnswer {
  cycleNumber: number;
  selectedBooleans: Partial<Record<PipelinePracticeBooleanSignalName, boolean>>;
  selectedForwarding: Partial<Record<PipelineForwardingSignalName, PipelineForwardingSource>>;
}

export interface PipelinePracticeQuestion {
  cycleNumber: number;
  prompt: string;
  events: readonly PipelineConflictEvent[];
  expected: PipelinePracticeExpectedAnswer;
}

export interface PipelinePracticeMismatch {
  signal: PipelinePracticeSignalName;
  label: string;
  expected: PipelinePracticeExpectedValue;
  selected: PipelinePracticeSelectedValue;
  explanation: string;
}

export interface PipelinePracticeCheckResult {
  cycleNumber: number;
  expected: PipelinePracticeExpectedAnswer;
  selected: PipelinePracticeAnswer;
  mismatches: readonly PipelinePracticeMismatch[];
  correct: boolean;
  message: string;
}

export const PIPELINE_PRACTICE_BOOLEAN_SIGNALS: readonly PipelinePracticeBooleanSignalDefinition[] = [
  {
    name: 'PCWrite',
    label: 'PCWrite',
    hint: 'PC 是否允许写入下一条取指地址。',
  },
  {
    name: 'IF/IDWrite',
    label: 'IF/IDWrite',
    hint: 'IF/ID 段间寄存器是否接收新的取指结果。',
  },
  {
    name: 'IF/IDFlush',
    label: 'IF/IDFlush',
    hint: '是否清空已经进入 IF/ID 的年轻指令。',
  },
  {
    name: 'ID/EXFlush',
    label: 'ID/EXFlush',
    hint: '是否清空 ID/EX，或向 EX 阶段送入 bubble。',
  },
  {
    name: 'InsertBubble',
    label: 'InsertBubble',
    hint: 'RAW 停顿时是否向流水线插入气泡。',
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
    selectedBooleans: {},
    selectedForwarding: {},
  };
}

export function createPipelinePracticeQuestion(snapshot: CycleSnapshot): PipelinePracticeQuestion | null {
  if (!hasPipelinePracticeQuestion(snapshot)) {
    return null;
  }

  return {
    cycleNumber: snapshot.cycleNumber,
    prompt: `周期 C${snapshot.cycleNumber} 发生了冲突，请判断本周期核心控制/旁路信号。`,
    events: snapshot.pipeline.conflicts,
    expected: getPipelinePracticeExpectedAnswer(snapshot),
  };
}

export function hasPipelinePracticeQuestion(snapshot: CycleSnapshot): boolean {
  return snapshot.pipeline.conflicts.length > 0;
}

export function getPipelinePracticeExpectedAnswer(snapshot: CycleSnapshot): PipelinePracticeExpectedAnswer {
  const { hazard, forwarding } = snapshot.pipeline;

  return {
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
): PipelinePracticeCheckResult | null {
  const question = createPipelinePracticeQuestion(snapshot);
  if (!question) {
    return null;
  }

  const normalizedAnswer =
    answer.cycleNumber === snapshot.cycleNumber ? answer : createEmptyPipelinePracticeAnswer(snapshot);
  const mismatches: PipelinePracticeMismatch[] = [];

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
      });
    }
  }

  return {
    cycleNumber: snapshot.cycleNumber,
    expected: question.expected,
    selected: normalizedAnswer,
    mismatches,
    correct: mismatches.length === 0,
    message: mismatches.length === 0 ? '流水线冲突处理信号全部正确。' : '还有信号需要调整。',
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
      return 'none';
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
