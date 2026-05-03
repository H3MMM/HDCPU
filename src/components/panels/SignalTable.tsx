import { memo, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useCPUStore } from '../../store/cpu-store';
import {
  ALUOp,
  Stage,
  type ControlSignals,
  type CycleSnapshot,
  type DecodedInstruction,
  type PipelineConflictEvent,
  type PipelineForwardingSignal,
} from '../../types';

type SignalGroup = 'fetch' | 'memory' | 'alu' | 'writeback';
type PipelineSignalGroup = 'hazard' | 'forward' | 'event';
type CanvasSignalValue = string | number | boolean;

interface CanvasSignalContext {
  stage: Stage;
  controlSignals: ControlSignals;
  currentInstruction: DecodedInstruction | null;
}

interface CanvasSignalDefinition {
  label: string;
  group: SignalGroup;
  getValue: (context: CanvasSignalContext) => CanvasSignalValue;
  isActive: (context: CanvasSignalContext) => boolean;
  describe: (context: CanvasSignalContext) => string;
}

interface PipelineSignalRow {
  label: string;
  group: PipelineSignalGroup;
  value: CanvasSignalValue;
  active: boolean;
  meaning: string;
}

const GROUP_LABELS = {
  fetch: '取指 / PC',
  memory: '访存',
  alu: '运算',
  writeback: '写回',
} as const;

const PIPELINE_GROUP_LABELS = {
  hazard: 'HazardUnit',
  forward: 'ForwardingUnit',
  event: '冲突事件',
} as const;

const FORWARD_SOURCE_LABELS: Record<PipelineForwardingSignal['source'], string> = {
  none: 'none',
  exMem: 'EX/MEM',
  memWb: 'MEM/WB',
};

const ALU_OP_BINARY: Record<ALUOp, string> = {
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

function isStage(stage: Stage, stages: readonly Stage[]): boolean {
  return stages.includes(stage);
}

function boolSignal(value: boolean): string {
  return value ? '1' : '0';
}

function formatALUOpSignal(value: ALUOp): string {
  return `${value}(${ALU_OP_BINARY[value] ?? '----'})`;
}

function formatSignalValue(value: CanvasSignalValue): string {
  if (typeof value === 'boolean') {
    return boolSignal(value);
  }

  return String(value);
}

function formatForwardingSignal(signal: PipelineForwardingSignal): string {
  if (signal.source === 'none') {
    return 'none';
  }

  return `${getForwardingSourceLabel(signal)} -> x${signal.register}`;
}

function isLoadProducer(signal: PipelineForwardingSignal): boolean {
  return signal.producer !== null && (signal.producer.instructionWord & 0x7F) === 0x03;
}

function getForwardingSourceLabel(signal: PipelineForwardingSignal): string {
  if (signal.source === 'exMem' && isLoadProducer(signal)) {
    return 'DM 读数';
  }

  return FORWARD_SOURCE_LABELS[signal.source];
}

function describeForwardingSignal(
  signalName: 'ForwardA' | 'ForwardB' | 'StoreForward',
  signal: PipelineForwardingSignal
): string {
  if (signal.source === 'none') {
    if (signalName === 'StoreForward') {
      return 'store 写数据未使用旁路。';
    }

    return `${signalName} 未选择旁路，使用 ID/EX 中锁存的操作数。`;
  }

  const target = signalName === 'ForwardA'
    ? 'ALU A 端'
    : signalName === 'ForwardB'
      ? 'ALU B 端'
      : 'store 写数据';

  return `${target} 从 ${getForwardingSourceLabel(signal)} 的 ${signal.producer?.asmString ?? '生产者指令'} 取得 x${signal.register}。`;
}

function describeConflictEvent(event: PipelineConflictEvent): string {
  if (event.resolution === 'forward') {
    const producerKind = event.producer && (event.producer.instructionWord & 0x7F) === 0x03
      ? '数据存储器读数'
      : '生产者结果';
    return `${event.forwardingSignal}: x${event.register} 从${producerKind}旁路到 ${event.consumer?.asmString ?? '消费者'}。`;
  }

  if (event.resolution === 'stall') {
    return `RAW x${event.register}: 冻结 PC 与 IF/ID，向 ID/EX 插入 bubble。`;
  }

  return `控制冲突: 清空错误路径，PC 重定向到 0x${((event.redirectPC ?? 0) >>> 0).toString(16).padStart(8, '0')}。`;
}

function buildPipelineSignalRows(snapshot: CycleSnapshot): PipelineSignalRow[] {
  const { hazard, forwarding, conflicts } = snapshot.pipeline;

  return [
    {
      label: 'PCWrite',
      group: 'hazard',
      value: hazard.pcWrite,
      active: !hazard.pcWrite,
      meaning: hazard.pcWrite ? 'PC 可以继续取下一条指令。' : 'PC 被冻结，取指阶段停顿。',
    },
    {
      label: 'IF/IDWrite',
      group: 'hazard',
      value: hazard.ifIdWrite,
      active: !hazard.ifIdWrite,
      meaning: hazard.ifIdWrite ? 'IF/ID 正常锁存新取回的指令。' : 'IF/ID 保持原值，译码阶段停顿。',
    },
    {
      label: 'IF/IDFlush',
      group: 'hazard',
      value: hazard.ifIdFlush,
      active: hazard.ifIdFlush,
      meaning: hazard.ifIdFlush ? '清空 IF/ID 中的错误路径指令。' : 'IF/ID 不需要 flush。',
    },
    {
      label: 'ID/EXFlush',
      group: 'hazard',
      value: hazard.idExFlush,
      active: hazard.idExFlush,
      meaning: hazard.insertBubble ? '向 ID/EX 插入 bubble，阻止错误操作进入 EX。' : hazard.idExFlush ? '清空 ID/EX。' : 'ID/EX 正常推进。',
    },
    {
      label: 'Bubble',
      group: 'hazard',
      value: hazard.insertBubble,
      active: hazard.insertBubble,
      meaning: hazard.insertBubble ? hazard.reason : '本周期没有插入气泡。',
    },
    {
      label: 'ForwardA',
      group: 'forward',
      value: formatForwardingSignal(forwarding.ForwardA),
      active: forwarding.ForwardA.source !== 'none',
      meaning: describeForwardingSignal('ForwardA', forwarding.ForwardA),
    },
    {
      label: 'ForwardB',
      group: 'forward',
      value: formatForwardingSignal(forwarding.ForwardB),
      active: forwarding.ForwardB.source !== 'none',
      meaning: describeForwardingSignal('ForwardB', forwarding.ForwardB),
    },
    {
      label: 'StoreForward',
      group: 'forward',
      value: formatForwardingSignal(forwarding.StoreForward),
      active: forwarding.StoreForward.source !== 'none',
      meaning: describeForwardingSignal('StoreForward', forwarding.StoreForward),
    },
    {
      label: 'ConflictEvents',
      group: 'event',
      value: conflicts.length,
      active: conflicts.length > 0,
      meaning: conflicts.length > 0 ? conflicts.map(describeConflictEvent).join(' / ') : '本周期没有 RAW、旁路或控制 flush 事件。',
    },
  ];
}

function getFunct3(context: CanvasSignalContext): number {
  return context.currentInstruction?.funct3 ?? 0;
}

function getSizeSelect(context: CanvasSignalContext): string {
  return (getFunct3(context) & 0x3).toString(2).padStart(2, '0');
}

function getSignExtendSelect(context: CanvasSignalContext): string {
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

const CANVAS_SIGNAL_DEFINITIONS: readonly CanvasSignalDefinition[] = [
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

export const SignalTable = memo(function SignalTable() {
  const { datapathMode, stage, controlSignals, currentInstruction, currentSnapshot } = useCPUStore(
    useShallow((state) => ({
      datapathMode: state.datapathMode,
      stage: state.stage,
      controlSignals: state.controlSignals,
      currentInstruction: state.currentInstruction,
      currentSnapshot: state.currentSnapshot,
    }))
  );

  const rows = useMemo(() => {
    const context = { stage, controlSignals, currentInstruction };

    return CANVAS_SIGNAL_DEFINITIONS.map((definition) => ({
      ...definition,
      value: definition.getValue(context),
      active: definition.isActive(context),
      meaning: definition.describe(context),
    }));
  }, [controlSignals, currentInstruction, stage]);
  const pipelineRows = useMemo(() => buildPipelineSignalRows(currentSnapshot), [currentSnapshot]);

  if (datapathMode === 'pipeline') {
    return (
      <section className="panel-card">
        <div className="panel-header">
          <div>
            <p className="eyebrow">流水线控制信号</p>
            <h2>冲突处理信号</h2>
          </div>
          <span className="editor-pill">周期 {currentSnapshot.cycleNumber}</span>
        </div>

        <div className="signal-intro-card">
          <span className="detail-label">旁路策略</span>
          <strong className="detail-value">
            {currentSnapshot.pipeline.forwarding.enabled ? 'ForwardA / ForwardB / StoreForward 同时生效' : '旁路关闭，RAW 冲突统一停顿'}
          </strong>
        </div>

        <div className="signal-table-shell">
          <table className="signal-table">
            <thead>
              <tr>
                <th>信号</th>
                <th>值</th>
                <th>含义</th>
              </tr>
            </thead>
            <tbody>
              {pipelineRows.map((row) => (
                <tr key={row.label} className={row.active ? 'signal-row signal-row--active' : 'signal-row'}>
                  <td>
                    <div className="signal-name-cell">
                      <strong>{row.label}</strong>
                      <span className={`signal-group-tag signal-group-tag--${row.group}`}>
                        {PIPELINE_GROUP_LABELS[row.group]}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={row.active ? 'value-badge value-badge--active' : 'value-badge'}>
                      {formatSignalValue(row.value)}
                    </span>
                  </td>
                  <td className="signal-meaning">{row.meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  return (
    <section className="panel-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">控制信号</p>
          <h2>画布控制线</h2>
        </div>
        <span className="editor-pill">阶段 {stage}</span>
      </div>
     <br></br>

      <div className="signal-intro-card">
        <span className="detail-label">当前指令</span>
        <strong className="detail-value">{currentInstruction?.asmString ?? '暂无已译码指令'}</strong>
      </div>

      <div className="signal-table-shell">
        <table className="signal-table">
          <thead>
            <tr>
              <th>信号</th>
              <th>值</th>
              <th>含义</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className={row.active ? 'signal-row signal-row--active' : 'signal-row'}>
                <td>
                  <div className="signal-name-cell">
                    <strong>{row.label}</strong>
                    <span className={`signal-group-tag signal-group-tag--${row.group}`}>{GROUP_LABELS[row.group]}</span>
                  </div>
                </td>
                <td>
                  <span className={row.active ? 'value-badge value-badge--active' : 'value-badge'}>
                    {formatSignalValue(row.value)}
                  </span>
                </td>
                <td className="signal-meaning">{row.meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
});
