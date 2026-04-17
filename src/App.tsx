import { useMemo } from 'react';
import { Header } from './components/layout/Header';
import { MainLayout } from './components/layout/MainLayout';
import { CodeEditor } from './components/panels/CodeEditor';
import { DatapathConfigPanel } from './components/panels/DatapathConfigPanel';
import { ExecutionControls } from './components/panels/ExecutionControls';
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
                  <p className="eyebrow">Checkpoint 1</p>
                  <h2>Day 1 / Day 2 工作台已接通</h2>
                </div>
                <span className="status-chip status-chip--accent">{config.metadata.type}</span>
              </div>

              <p className="panel-copy">
                基础布局、Zustand store、配置 JSON 加载、CodeMirror 编辑器和执行控制面板已经连成同一个前端骨架。
                后续只需要把引擎接入，就可以继续往可视化和联动动画推进。
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
            <CodeEditor />
          </>
        }
        rightColumn={
          <>
            <DatapathConfigPanel config={config} />

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
                  <strong>保留执行状态、速度、选中部件和编辑器内容</strong>
                </div>
                <div className="milestone-item">
                  <span>配置</span>
                  <strong>JSON 已经在页面中验证位置、尺寸、端口和连线摘要</strong>
                </div>
                <div className="milestone-item">
                  <span>编辑器</span>
                  <strong>CodeMirror v6，带行号和基础高亮</strong>
                </div>
              </div>
            </section>
          </>
        }
      />
    </div>
  );
}
