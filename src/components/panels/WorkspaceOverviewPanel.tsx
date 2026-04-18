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
          <p className="eyebrow">第 13 天 / 体验与性能</p>
          <h2>示例程序、帮助文档和性能优化已经纳入同一套工作流。</h2>
        </div>
        <span className="status-chip status-chip--accent">多周期配置</span>
      </div>

      <p className="panel-copy">
        这轮重点做了两件事：补上示例程序与帮助文档，方便直接上手；同时把高频状态更新下沉到局部面板，避免连续执行时把整页一起拖慢。
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
