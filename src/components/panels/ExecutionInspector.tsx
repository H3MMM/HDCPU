import { memo, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useCPUStore } from '../../store/cpu-store';
import {
  Stage,
  type CycleSnapshot,
  type DecodedInstruction,
  type PipelineConflictEvent,
  type PipelineForwardingSignal,
  type PipelineForwardingSignalName,
  type PipelineInstructionSlot,
  type PipelineRegisterStatus,
  type PipelineStageKey,
} from '../../types';

const PIPELINE_STAGE_KEYS: readonly PipelineStageKey[] = ['IF', 'ID', 'EX', 'MEM', 'WB'];
const PIPELINE_REGISTER_LABELS = [
  { key: 'ifId', label: 'IF/ID' },
  { key: 'idEx', label: 'ID/EX' },
  { key: 'exMem', label: 'EX/MEM' },
  { key: 'memWb', label: 'MEM/WB' },
] as const;

function formatWord(value: number): string {
  return `0x${(value >>> 0).toString(16).padStart(8, '0')}`;
}

function formatChangeValue(value: number): string {
  return `${value | 0} / ${formatWord(value)}`;
}

function getMemoryAccessTypeLabel(type: 'none' | 'read' | 'write'): string {
  switch (type) {
    case 'read':
      return '读取';
    case 'write':
      return '写入';
    default:
      return '无';
  }
}

function getPipelineStatusLabel(status: PipelineRegisterStatus): string {
  switch (status) {
    case 'valid':
      return '有效';
    case 'bubble':
      return '气泡';
    case 'flushed':
      return '已清空';
    case 'stalled':
      return '停顿';
    case 'empty':
    default:
      return '空';
  }
}

function getPipelineSlotInstruction(slot: PipelineInstructionSlot): string {
  if (slot.decodedInstruction) {
    return slot.decodedInstruction.asmString;
  }

  return getPipelineStatusLabel(slot.status);
}

function getPipelineSlotMeta(slot: PipelineInstructionSlot): string {
  if (slot.decodedInstruction) {
    return `PC ${formatWord(slot.pc)}`;
  }

  if (slot.status === 'bubble') {
    return '等待数据就绪';
  }

  if (slot.status === 'flushed') {
    return '错误路径被清空';
  }

  if (slot.status === 'stalled') {
    return '保持上一周期';
  }

  return '无指令';
}

function formatPipelineConflictEvent(event: PipelineConflictEvent): string {
  if (event.resolution === 'forward') {
    const producerKind = event.producer && (event.producer.instructionWord & 0x7F) === 0x03
      ? '数据存储器读数'
      : '生产者结果';
    return `${event.forwardingSignal}: x${event.register} 从${producerKind}旁路到 ${event.consumer?.asmString ?? '消费者'}`;
  }

  if (event.resolution === 'stall') {
    if (event.type === 'control') {
      return `控制停等: 暂停取指，等待 ${event.producer?.asmString ?? '分支/跳转'} 在 EX 判定`;
    }

    return `RAW x${event.register}: 停顿 IF/ID，并向 ID/EX 插入 bubble`;
  }

  return `控制 flush: PC -> ${formatWord(event.redirectPC ?? 0)}`;
}

function getPipelineCycleEventSummary(snapshot: CycleSnapshot): string {
  if (snapshot.pipeline.conflicts.length === 0) {
    return '无';
  }

  return snapshot.pipeline.conflicts.map((event) => {
    if (event.resolution === 'forward') {
      return event.forwardingSignal ?? '旁路';
    }

    return event.resolution === 'stall' ? '停顿' : 'flush';
  }).join(' / ');
}

function getForwardingSignalLabel(
  signalName: PipelineForwardingSignalName,
  signal: PipelineForwardingSignal
): string {
  if (signal.source === 'none') {
    return `${signalName}: none`;
  }

  const source = signal.source === 'exMem' && signal.producer && (signal.producer.instructionWord & 0x7F) === 0x03
    ? 'DM 读数'
    : signal.source === 'exMem'
      ? 'EX/MEM'
      : 'MEM/WB';
  return `${signalName}: ${source} -> x${signal.register}`;
}

interface PipelineExecutionInspectorProps {
  currentSnapshot: CycleSnapshot;
  snapshotHistory: readonly CycleSnapshot[];
}

function PipelineExecutionInspector({
  currentSnapshot,
  snapshotHistory,
}: PipelineExecutionInspectorProps) {
  const visibleSnapshots = useMemo(
    () => snapshotHistory.slice(-12),
    [snapshotHistory]
  );
  const forwardingEntries: Array<[PipelineForwardingSignalName, PipelineForwardingSignal]> = [
    ['ForwardA', currentSnapshot.pipeline.forwarding.ForwardA],
    ['ForwardB', currentSnapshot.pipeline.forwarding.ForwardB],
    ['StoreForward', currentSnapshot.pipeline.forwarding.StoreForward],
  ];

  return (
    <section className="panel-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">流水线快照</p>
          <h2>流水线时空表</h2>
        </div>
        <span className="editor-pill">周期 {currentSnapshot.cycleNumber}</span>
      </div>

      <p className="panel-copy">
        每一行是一个周期，每一列是一段流水线。有效指令、气泡和 flush 会一起显示，适合观察冲突处理前后指令如何被停住、旁路或清空。
      </p>

      <div className="pipeline-space-table-shell">
        <table className="pipeline-space-table">
          <thead>
            <tr>
              <th>周期</th>
              {PIPELINE_STAGE_KEYS.map((stageKey) => (
                <th key={stageKey}>{stageKey}</th>
              ))}
              <th>处理</th>
            </tr>
          </thead>
          <tbody>
            {visibleSnapshots.map((snapshot) => (
              <tr
                key={snapshot.cycleNumber}
                className={snapshot.cycleNumber === currentSnapshot.cycleNumber ? 'pipeline-cycle-row pipeline-cycle-row--current' : 'pipeline-cycle-row'}
              >
                <td>
                  <strong className="pipeline-cycle-number">C{snapshot.cycleNumber}</strong>
                </td>
                {PIPELINE_STAGE_KEYS.map((stageKey) => {
                  const slot = snapshot.pipeline.stages[stageKey];
                  const isActive = slot.decodedInstruction !== null;

                  return (
                    <td key={stageKey}>
                      <div
                        className={[
                          'pipeline-stage-cell',
                          `pipeline-stage-cell--${slot.status}`,
                          isActive ? 'pipeline-stage-cell--occupied' : '',
                        ].filter(Boolean).join(' ')}
                      >
                        <strong>{getPipelineSlotInstruction(slot)}</strong>
                        <span>{getPipelineSlotMeta(slot)}</span>
                      </div>
                    </td>
                  );
                })}
                <td className="pipeline-event-cell">{getPipelineCycleEventSummary(snapshot)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pipeline-register-strip">
        {PIPELINE_REGISTER_LABELS.map((entry) => {
          const register = currentSnapshot.pipeline.registers[entry.key];
          return (
            <article key={entry.key} className={`pipeline-register-card pipeline-register-card--${register.status}`}>
              <span className="detail-label">{entry.label}</span>
              <strong>{register.decodedInstruction?.asmString ?? getPipelineStatusLabel(register.status)}</strong>
              <small>PC {formatWord(register.pc)}</small>
            </article>
          );
        })}
      </div>

      <div className="inspector-panel-grid">
        <article className="signal-intro-card">
          <span className="detail-label">本周期冲突事件</span>
          {currentSnapshot.pipeline.conflicts.length > 0 ? (
            <div className="pipeline-conflict-list">
              {currentSnapshot.pipeline.conflicts.map((event) => (
                <div key={event.id} className={`pipeline-conflict-item pipeline-conflict-item--${event.resolution}`}>
                  <strong>{event.resolution}</strong>
                  <span>{formatPipelineConflictEvent(event)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="panel-caption">本周期没有 RAW、旁路或控制 flush 事件。</p>
          )}
        </article>

        <article className="signal-intro-card">
          <span className="detail-label">旁路输出</span>
          <div className="pipeline-signal-grid">
            {forwardingEntries.map(([signalName, signal]) => (
              <div
                key={signalName}
                className={signal.source === 'none' ? 'pipeline-signal-card' : 'pipeline-signal-card pipeline-signal-card--active'}
              >
                <strong>{getForwardingSignalLabel(signalName, signal)}</strong>
                <span>{signal.producer?.asmString ?? '未选择生产者'}</span>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

interface ArithmeticUnitView {
  detail: CycleSnapshot['aluDetail'] | null;
  label: string;
  note?: string;
}

function shouldShowPcRelativeAdder(instruction: DecodedInstruction): boolean {
  return instruction.opcode === 0x17 || instruction.opcode === 0x63 || instruction.opcode === 0x6F;
}

function getArithmeticUnitView(snapshot: CycleSnapshot): ArithmeticUnitView {
  if (snapshot.stage === Stage.IF) {
    return { label: 'PC 自增加法器', detail: snapshot.aluDetail };
  }

  if (snapshot.stage === Stage.ID) {
    if (shouldShowPcRelativeAdder(snapshot.decodedInstruction)) {
      return { label: 'PC 转移加法器', detail: snapshot.aluDetail };
    }

    return {
      label: '译码 / 寄存器读取',
      detail: null,
      note: '当前阶段不执行算术运算；本指令的 ALU 计算会在 EX 阶段显示。',
    };
  }

  return { label: 'ALU 细节', detail: snapshot.aluDetail };
}

export const ExecutionInspector = memo(function ExecutionInspector() {
  const {
    datapathMode,
    currentSnapshot,
    snapshotHistory,
    currentInstruction,
    latestMemoryAccess,
  } = useCPUStore(
    useShallow((state) => ({
      datapathMode: state.datapathMode,
      currentSnapshot: state.currentSnapshot,
      snapshotHistory: state.snapshotHistory,
      currentInstruction: state.currentInstruction,
      latestMemoryAccess: state.latestMemoryAccess,
    }))
  );

  if (datapathMode === 'pipeline') {
    return <PipelineExecutionInspector currentSnapshot={currentSnapshot} snapshotHistory={snapshotHistory} />;
  }

  const pipelineRegisters = [
    { label: 'PC', value: formatWord(currentSnapshot.pc) },
    { label: '下一 PC', value: formatWord(currentSnapshot.nextPC) },
    { label: 'IR', value: formatWord(currentSnapshot.pipelineRegs.IR) },
    { label: 'MDR', value: formatWord(currentSnapshot.pipelineRegs.MDR) },
    { label: 'A', value: formatWord(currentSnapshot.pipelineRegs.A) },
    { label: 'B', value: formatWord(currentSnapshot.pipelineRegs.B) },
    { label: 'ALUOut', value: formatWord(currentSnapshot.pipelineRegs.ALUOut) },
  ];

  const memoryAccessLabel = latestMemoryAccess.type === 'none'
    ? '最近一个周期没有访存操作。'
    : `${getMemoryAccessTypeLabel(latestMemoryAccess.type)} @ ${formatWord(latestMemoryAccess.address)} = ${formatWord(latestMemoryAccess.data)}`;
  const arithmeticUnitView = getArithmeticUnitView(currentSnapshot);

  return (
    <section className="panel-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">执行快照</p>
          <h2>执行检查器</h2>
        </div>
        <span className="editor-pill">周期 {currentSnapshot.cycleNumber}</span>
      </div>

      <p className="panel-copy">
        这里适合用来核对“这一步 CPU 内部到底发生了什么”。如果中央画布已经让你看懂了数据流，再来这里确认关键寄存器、运算单元输入输出和访存结果会更直观。
      </p>

      <div className="metric-grid">
        <article className="metric-card">
          <span className="metric-label">当前指令</span>
          <strong>{currentInstruction?.asmString ?? '程序已结束'}</strong>
        </article>
        <article className="metric-card">
          <span className="metric-label">活跃路径</span>
          <strong>{currentSnapshot.activeDataPaths.length}</strong>
        </article>
        <article className="metric-card">
          <span className="metric-label">状态变化</span>
          <strong>{currentSnapshot.changes.length}</strong>
        </article>
      </div>
      <br></br>
      <div className="inspector-register-grid">
        {pipelineRegisters.map((registerEntry) => (
          <article key={registerEntry.label} className="inspector-register-card">
            <span className="detail-label">{registerEntry.label}</span>
            <strong className="detail-value">{registerEntry.value}</strong>
          </article>
        ))}
      </div>

      <div className="inspector-panel-grid">
        <article className="signal-intro-card">
          <span className="detail-label">{arithmeticUnitView.label}</span>
          {arithmeticUnitView.detail ? (
            <div className="inspector-list">
              <div className="inspector-list-item">
                <span>输入 A</span>
                <strong>{formatWord(arithmeticUnitView.detail.inputA)}</strong>
              </div>
              <div className="inspector-list-item">
                <span>输入 B</span>
                <strong>{formatWord(arithmeticUnitView.detail.inputB)}</strong>
              </div>
              <div className="inspector-list-item">
                <span>运算</span>
                <strong>{arithmeticUnitView.detail.operation}</strong>
              </div>
              <div className="inspector-list-item">
                <span>结果</span>
                <strong>{formatWord(arithmeticUnitView.detail.result)}</strong>
              </div>
              <div className="inspector-list-item">
                <span>零标志</span>
                <strong>{arithmeticUnitView.detail.zero ? '1' : '0'}</strong>
              </div>
            </div>
          ) : (
            <strong className="detail-value inspector-callout">{arithmeticUnitView.note}</strong>
          )}
        </article>

        <article className="signal-intro-card">
          <span className="detail-label">最近访存</span>
          <strong className="detail-value inspector-callout">{memoryAccessLabel}</strong>
          <div className="inspector-list">
            <div className="inspector-list-item">
              <span>访问类型</span>
              <strong>{getMemoryAccessTypeLabel(latestMemoryAccess.type)}</strong>
            </div>
            <div className="inspector-list-item">
              <span>地址</span>
              <strong>{formatWord(latestMemoryAccess.address)}</strong>
            </div>
            <div className="inspector-list-item">
              <span>数据</span>
              <strong>{formatWord(latestMemoryAccess.data)}</strong>
            </div>
          </div>
        </article>
      </div>

      <div className="inspector-panel-grid">
        <article className="signal-intro-card">
          <span className="detail-label">最近状态变化</span>
          {currentSnapshot.changes.length > 0 ? (
            <div className="inspector-list">
              {currentSnapshot.changes.map((change) => (
                <div key={`${change.target}-${change.newValue}`} className="inspector-list-item">
                  <span>{change.target}</span>
                  <strong>
                    {formatChangeValue(change.oldValue)} {'->'} {formatChangeValue(change.newValue)}
                  </strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="panel-caption">最近可见快照没有架构状态变化。</p>
          )}
        </article>

        <article className="signal-intro-card">
          <span className="detail-label">活跃数据路径</span>
          {currentSnapshot.activeDataPaths.length > 0 ? (
            <div className="inspector-list">
              {currentSnapshot.activeDataPaths.map((path, index) => (
                <div
                  key={`${path.from}-${path.to}-${path.portFrom}-${path.portTo}-${index}`}
                  className="inspector-list-item"
                >
                  <span>
                    {path.from}.{path.portFrom} {'->'} {path.to}.{path.portTo}
                  </span>
                  <strong>
                    {formatWord(path.value)} / {path.signalType}
                  </strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="panel-caption">当前没有新的数据通路活动。</p>
          )}
        </article>
      </div>
    </section>
  );
});
