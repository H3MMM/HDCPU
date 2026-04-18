import { memo } from 'react';
import { Header } from './components/layout/Header';
import { DatapathCanvas } from './components/datapath/DatapathCanvas';
import { MainLayout } from './components/layout/MainLayout';
import { CodeEditor } from './components/panels/CodeEditor';
import { DatapathConfigPanel } from './components/panels/DatapathConfigPanel';
import { ExecutionControls } from './components/panels/ExecutionControls';
import { ExecutionInspector } from './components/panels/ExecutionInspector';
import { HelpPanel } from './components/panels/HelpPanel';
import { MemoryView } from './components/panels/MemoryView';
import { MachineCodeView } from './components/panels/MachineCodeView';
import { RegisterView } from './components/panels/RegisterView';
import { SignalTable } from './components/panels/SignalTable';
import { WorkspaceOverviewPanel } from './components/panels/WorkspaceOverviewPanel';
import { RuntimeBindings } from './components/runtime/RuntimeBindings';
import { HistoryTimeline } from './components/timeline/HistoryTimeline';
import { StageIndicator } from './components/timeline/StageIndicator';

const DeliveryPanel = memo(function DeliveryPanel() {
  return (
    <section className="panel-card panel-card--compact">
      <div className="panel-header">
        <div>
          <p className="eyebrow">第 13 天 / 交付检查点</p>
          <h2>这轮重点把体验补齐，同时把卡顿链路压下去了。</h2>
        </div>
      </div>

      <div className="milestone-list">
        <div className="milestone-item">
          <span>示例程序</span>
          <strong>编辑器里已经内置常见演示程序，可以快速切到算术、分支、跳转和立即数场景。</strong>
        </div>
        <div className="milestone-item">
          <span>帮助文档</span>
          <strong>新增了上手说明、快捷键和面板阅读指南，第一次进入也能快速找到路径。</strong>
        </div>
        <div className="milestone-item">
          <span>渲染隔离</span>
          <strong>App 已改成静态外壳，高频状态改为局部订阅，连续执行时不会再把整页一起拖着重渲。</strong>
        </div>
        <div className="milestone-item">
          <span>动画降载</span>
          <strong>时间线和连线动画做了轻量化处理，运行态优先保证流畅度，暂停态继续保留观察信息。</strong>
        </div>
        <div className="milestone-item">
          <span>后续验收</span>
          <strong>这版已经适合继续做 Day14 的最终测试和部署准备。</strong>
        </div>
      </div>
    </section>
  );
});

export default function App() {
  return (
    <div className="app-frame">
      <RuntimeBindings />
      <div className="ambient-orb ambient-orb--one" aria-hidden="true" />
      <div className="ambient-orb ambient-orb--two" aria-hidden="true" />

      <Header />

      <MainLayout
        leftColumn={
          <>
            <WorkspaceOverviewPanel />
            <ExecutionControls />
            <StageIndicator />
            <HelpPanel />
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
            <DatapathConfigPanel />
            <DeliveryPanel />
          </>
        }
      />
    </div>
  );
}
