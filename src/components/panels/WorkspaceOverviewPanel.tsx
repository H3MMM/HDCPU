import { memo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useCPUStore } from '../../store/cpu-store';
import { Stage } from '../../types';

function getStageLearningHint(stage: Stage): string {
  switch (stage) {
    case Stage.ID:
      return '先看寄存器读数和控制信号是否匹配当前指令。';
    case Stage.EX:
      return '重点观察 ALU 输入、结果，以及是否发生分支判断。';
    case Stage.MEM:
      return '重点查看数据存储器、地址和最近一次访存。';
    case Stage.WB:
      return '看目标寄存器是否写回了预期结果。';
    case Stage.IF:
    default:
      return '先看 PC、指令存储器和 IR，确认取指是否正确。';
  }
}

function formatMemoryAccess(type: 'none' | 'read' | 'write', address: number): string {
  if (type === 'none') {
    return '本阶段没有访存';
  }

  return `${type === 'read' ? '最近一次读取' : '最近一次写入'} @ 0x${(address >>> 0).toString(16).padStart(8, '0')}`;
}

export const WorkspaceOverviewPanel = memo(function WorkspaceOverviewPanel() {
  const {
    currentInstruction,
    currentSnapshot,
    stage,
    latestMemoryAccess,
    lastAction,
  } = useCPUStore(
    useShallow((state) => ({
      currentInstruction: state.currentInstruction,
      currentSnapshot: state.currentSnapshot,
      stage: state.stage,
      latestMemoryAccess: state.latestMemoryAccess,
      lastAction: state.lastAction,
    }))
  );

  return (
    <section className="panel-card panel-card--accent">
      <div className="panel-header">
        <div>
          <p className="eyebrow">当前总览</p>
          <h2>学习快照</h2>
        </div>
        <span className="status-chip status-chip--accent">实时状态</span>
      </div>

      <p className="panel-copy">
        当你不确定先看哪里时，先看这一栏。它会告诉你当前跑到哪一个阶段、这一阶段最值得观察什么，以及最近有没有发生访存或状态变化。
      </p>

      <div className="metric-grid">
        <article className="metric-card">
          <span className="metric-label">当前指令</span>
          <strong>{currentInstruction?.asmString ?? '程序已结束'}</strong>
        </article>
        <article className="metric-card">
          <span className="metric-label">当前阶段</span>
          <strong>{stage}</strong>
        </article>
        <article className="metric-card">
          <span className="metric-label">这一阶段先看什么</span>
          <strong>{getStageLearningHint(stage)}</strong>
        </article>
      </div>

      <div className="metric-grid metric-grid--dense">
        <article className="metric-card">
          <span className="metric-label">活跃路径</span>
          <strong>{currentSnapshot.activeDataPaths.length}</strong>
        </article>
        <article className="metric-card">
          <span className="metric-label">状态变化</span>
          <strong>{currentSnapshot.changes.length}</strong>
        </article>
        <article className="metric-card">
          <span className="metric-label">最近访存</span>
          <strong>{formatMemoryAccess(latestMemoryAccess.type, latestMemoryAccess.address)}</strong>
        </article>
      </div>

      <p className="panel-caption">{lastAction}</p>
    </section>
  );
});
