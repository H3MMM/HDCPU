import { useMemo } from 'react';
import { Header } from './components/layout/Header';
import { DatapathCanvas } from './components/datapath/DatapathCanvas';
import { MainLayout } from './components/layout/MainLayout';
import { CodeEditor } from './components/panels/CodeEditor';
import { DatapathConfigPanel } from './components/panels/DatapathConfigPanel';
import { ExecutionControls } from './components/panels/ExecutionControls';
import { MemoryView } from './components/panels/MemoryView';
import { MachineCodeView } from './components/panels/MachineCodeView';
import { RegisterView } from './components/panels/RegisterView';
import { SignalTable } from './components/panels/SignalTable';
import { summarizeDatapathConfig } from './config/load-datapath-config';
import { useCPUStore } from './store/cpu-store';

export default function App() {
  const config = useCPUStore((state) => state.datapathConfig);
  const stage = useCPUStore((state) => state.stage);
  const runStatus = useCPUStore((state) => state.runStatus);
  const cycleCount = useCPUStore((state) => state.cycleCount);
  const instructionCount = useCPUStore((state) => state.instructionCount);
  const selectedComponentId = useCPUStore((state) => state.selectedComponentId);
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
                  <p className="eyebrow">Checkpoint 4 In Progress</p>
                  <h2>Day 7 的动画画布已经开始接通</h2>
                </div>
                <span className="status-chip status-chip--accent">{config.metadata.type}</span>
              </div>

              <p className="panel-copy">
                现在这套界面已经不只是静态 SVG 展示了。我们把 Day6 的最小画布和连线能力补上，并在其上接入了 Day7 的部件高亮和连线流动动画。
              </p>

              <div className="metric-grid">
                <article className="metric-card">
                  <span className="metric-label">Canvas</span>
                  <strong>
                    {summary.canvasSize.width} × {summary.canvasSize.height}
                  </strong>
                </article>
                <article className="metric-card">
                  <span className="metric-label">Loaded Types</span>
                  <strong>{Object.keys(summary.componentTypeCounts).length}</strong>
                </article>
                <article className="metric-card">
                  <span className="metric-label">Focused Node</span>
                  <strong>{selectedComponentId ?? config.components[0]?.id ?? 'none'}</strong>
                </article>
              </div>

              <p className="panel-caption">{lastAction}</p>
            </section>

            <ExecutionControls />
            <RegisterView />
            <CodeEditor />
          </>
        }
        rightColumn={
          <>
            <DatapathCanvas />
            <DatapathConfigPanel config={config} />
            <div className="observability-grid">
              <MemoryView />
              <SignalTable />
            </div>

            <MachineCodeView />

            <section className="panel-card panel-card--compact">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Delivery Notes</p>
                  <h2>当前阶段的接口约定</h2>
                </div>
              </div>

              <div className="milestone-list">
                <div className="milestone-item">
                  <span>布局</span>
                  <strong>30 / 70 左右分栏，移动端自动折叠</strong>
                </div>
                <div className="milestone-item">
                  <span>Store</span>
                  <strong>新增汇编结果、当前指令、控制信号和机器码行模型</strong>
                </div>
                <div className="milestone-item">
                  <span>寄存器</span>
                  <strong>32 项表格视图，支持 Hex / Dec 切换</strong>
                </div>
                <div className="milestone-item">
                  <span>内存</span>
                  <strong>16 字节一行的十六进制窗口，支持地址跳转和预设锚点</strong>
                </div>
                <div className="milestone-item">
                  <span>Day 4</span>
                  <strong>控制信号表和机器码视图都已经改为真实派生数据</strong>
                </div>
                <div className="milestone-item">
                  <span>Day 5</span>
                  <strong>五类 SVG 基础部件和静态渲染画布已经就位</strong>
                </div>
                <div className="milestone-item">
                  <span>Day 7</span>
                  <strong>动态画布、活跃部件动画和流动连线效果已经接入</strong>
                </div>
              </div>
            </section>
          </>
        }
      />
    </div>
  );
}
