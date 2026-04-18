import { memo, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { summarizeDatapathConfig } from '../../config/load-datapath-config';
import { useCPUStore } from '../../store/cpu-store';

export const WorkspaceOverviewPanel = memo(function WorkspaceOverviewPanel() {
  const {
    datapathConfig,
    currentInstruction,
    currentSnapshot,
    selectedComponentId,
    lastAction,
  } = useCPUStore(
    useShallow((state) => ({
      datapathConfig: state.datapathConfig,
      currentInstruction: state.currentInstruction,
      currentSnapshot: state.currentSnapshot,
      selectedComponentId: state.selectedComponentId,
      lastAction: state.lastAction,
    }))
  );

  const summary = useMemo(() => summarizeDatapathConfig(datapathConfig), [datapathConfig]);

  return (
    <section className="panel-card panel-card--accent">
      <div className="panel-header">
        <div>
          <p className="eyebrow">当前总览</p>
          <h2>工作台快照</h2>
        </div>
        <span className="status-chip status-chip--accent">实时状态</span>
      </div>

      <p className="panel-copy">
        当你不确定先看哪里时，先看这一栏。它会把当前指令、活跃路径、焦点部件和最近动作压缩成一屏摘要，帮助你决定下一步去看执行细节、寄存器还是内存。
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

      <div className="metric-grid metric-grid--dense">
        <article className="metric-card">
          <span className="metric-label">画布尺寸</span>
          <strong>
            {summary.canvasSize.width} x {summary.canvasSize.height}
          </strong>
        </article>
        <article className="metric-card">
          <span className="metric-label">当前焦点</span>
          <strong>{selectedComponentId ?? datapathConfig.components[0]?.id ?? '无'}</strong>
        </article>
        <article className="metric-card">
          <span className="metric-label">已加载类型</span>
          <strong>{Object.keys(summary.componentTypeCounts).length}</strong>
        </article>
      </div>

      <p className="panel-caption">{lastAction}</p>
    </section>
  );
});
