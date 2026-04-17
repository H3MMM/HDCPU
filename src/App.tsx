import { useMemo } from 'react';
import { Header } from './components/layout/Header';
import { DatapathCanvas } from './components/datapath/DatapathCanvas';
import { MainLayout } from './components/layout/MainLayout';
import { CodeEditor } from './components/panels/CodeEditor';
import { DatapathConfigPanel } from './components/panels/DatapathConfigPanel';
import { ExecutionControls } from './components/panels/ExecutionControls';
import { ExecutionInspector } from './components/panels/ExecutionInspector';
import { MemoryView } from './components/panels/MemoryView';
import { MachineCodeView } from './components/panels/MachineCodeView';
import { RegisterView } from './components/panels/RegisterView';
import { SignalTable } from './components/panels/SignalTable';
import { HistoryTimeline } from './components/timeline/HistoryTimeline';
import { StageIndicator } from './components/timeline/StageIndicator';
import { summarizeDatapathConfig } from './config/load-datapath-config';
import { useExecutionLoop } from './hooks/useExecutionLoop';
import { useExecutionShortcuts } from './hooks/useExecutionShortcuts';
import { useCPUStore } from './store/cpu-store';

export default function App() {
  useExecutionShortcuts();
  useExecutionLoop();

  const config = useCPUStore((state) => state.datapathConfig);
  const stage = useCPUStore((state) => state.stage);
  const runStatus = useCPUStore((state) => state.runStatus);
  const cycleCount = useCPUStore((state) => state.cycleCount);
  const instructionCount = useCPUStore((state) => state.instructionCount);
  const selectedComponentId = useCPUStore((state) => state.selectedComponentId);
  const currentInstruction = useCPUStore((state) => state.currentInstruction);
  const currentSnapshot = useCPUStore((state) => state.currentSnapshot);
  const lastAction = useCPUStore((state) => state.lastAction);

  const summary = useMemo(() => summarizeDatapathConfig(config), [config]);

  return (
    <div className="app-frame">
      <div className="ambient-orb ambient-orb--one" aria-hidden="true" />
      <div className="ambient-orb ambient-orb--two" aria-hidden="true" />

      <Header
        title={config.metadata.name}
        version={config.metadata.version}
        stage={stage}
        runStatus={runStatus}
        componentCount={summary.componentCount}
        wireCount={summary.wireCount}
        cycleCount={cycleCount}
        instructionCount={instructionCount}
      />

      <MainLayout
        leftColumn={
          <>
            <section className="panel-card panel-card--accent">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">第 12 天 / 中文界面与收口</p>
                  <h2>执行、回退和观察面板现在都落在同一套中文工作区里。</h2>
                </div>
                <span className="status-chip status-chip--accent">多周期配置</span>
              </div>

              <p className="panel-copy">
                这轮把主要界面统一成中文，同时收紧了卡片、表格和状态标签的布局。连续播放、时间线回退、数据通路高亮、寄存器和内存窗口现在会以一致的方式展示真实 CPU 状态。
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
                  <strong>{selectedComponentId ?? config.components[0]?.id ?? '无'}</strong>
                </article>
                <article className="metric-card">
                  <span className="metric-label">已加载类型</span>
                  <strong>{Object.keys(summary.componentTypeCounts).length}</strong>
                </article>
              </div>

              <p className="panel-caption">{lastAction}</p>
            </section>

            <ExecutionControls />
            <StageIndicator />
            <RegisterView />
            <CodeEditor />
          </>
        }
        rightColumn={
          <>
            <DatapathCanvas />
            <HistoryTimeline />
            <ExecutionInspector />
            <div className="observability-grid">
              <MemoryView />
              <SignalTable />
            </div>
            <MachineCodeView />
            <DatapathConfigPanel config={config} />

            <section className="panel-card panel-card--compact">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">第 12 天 / 交付检查点</p>
                  <h2>这轮界面收口已经覆盖到常用操作链路。</h2>
                </div>
              </div>

              <div className="milestone-list">
                <div className="milestone-item">
                  <span>中文界面</span>
                  <strong>顶部摘要、控制面板、时间线、机器码、信号表和配置面板都已经统一成中文文案。</strong>
                </div>
                <div className="milestone-item">
                  <span>布局收口</span>
                  <strong>卡片标题、按钮、表格单元格和长状态文本现在都支持自动换行，不会再轻易挤出容器。</strong>
                </div>
                <div className="milestone-item">
                  <span>连续执行</span>
                  <strong>运行、暂停和速度控制继续驱动真实 CPU，播放过程中各视图保持同步刷新。</strong>
                </div>
                <div className="milestone-item">
                  <span>时间线回退</span>
                  <strong>点击任意检查点可以回到对应周期，时间线会自动跟随当前周期位置。</strong>
                </div>
                <div className="milestone-item">
                  <span>视图联动</span>
                  <strong>最近一次寄存器写回、访存事件和活跃数据路径都会同步体现在观察面板里。</strong>
                </div>
              </div>
            </section>
          </>
        }
      />
    </div>
  );
}
