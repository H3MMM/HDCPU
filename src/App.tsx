import { useState, type ReactNode } from 'react';
import { Header } from './components/layout/Header';
import { DatapathCanvas } from './components/datapath/DatapathCanvas';
import { MainLayout } from './components/layout/MainLayout';
import { CodeEditor } from './components/panels/CodeEditor';
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

type LeftDockTab = 'controls' | 'program' | 'guide';
type RightDockTab = 'overview' | 'execution' | 'registers' | 'memory' | 'signals' | 'machine';

interface DockTab<T extends string> {
  id: T;
  label: string;
  hint: string;
}

const LEFT_DOCK_TABS: readonly DockTab<LeftDockTab>[] = [
  { id: 'controls', label: '运行控制', hint: '在不离开中央画布的情况下完成运行、暂停、单步和阶段观察。' },
  { id: 'program', label: '程序输入', hint: '从示例程序开始，或者直接在这里输入和修改汇编代码。' },
  { id: 'guide', label: '使用帮助', hint: '当你不知道先看哪里时，用这里的提示快速熟悉工作台。' },
];

const RIGHT_DOCK_TABS: readonly DockTab<RightDockTab>[] = [
  { id: 'overview', label: '总览', hint: '先看当前指令、当前阶段和最近访存，快速把握这一拍发生了什么。' },
  { id: 'execution', label: '执行检查', hint: '查看流水寄存器、ALU 细节、访存元数据和最近变化。' },
  { id: 'registers', label: '寄存器', hint: '核对写回结果是否落到了预期寄存器。' },
  { id: 'memory', label: '内存', hint: '查看最近访存位置、内存窗口和字节内容。' },
  { id: 'signals', label: '控制信号', hint: '观察当前阶段控制器发出的关键信号。' },
  { id: 'machine', label: '机器码', hint: '对照源码、机器码、二进制和当前高亮指令。' },
];

interface DockTabStripProps<T extends string> {
  activeTab: T;
  onChange: (tab: T) => void;
  tabs: readonly DockTab<T>[];
}

function DockTabStrip<T extends string>({ activeTab, onChange, tabs }: DockTabStripProps<T>) {
  return (
    <div className="workspace-tablist" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          className={activeTab === tab.id ? 'workspace-tab workspace-tab--active' : 'workspace-tab'}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function renderLeftDockContent(activeTab: LeftDockTab): ReactNode {
  switch (activeTab) {
    case 'program':
      return <CodeEditor />;
    case 'guide':
      return <HelpPanel />;
    case 'controls':
    default:
      return (
        <div className="workspace-panel-stack">
          <ExecutionControls />
          <StageIndicator />
        </div>
      );
  }
}

function renderRightDockContent(activeTab: RightDockTab): ReactNode {
  switch (activeTab) {
    case 'execution':
      return <ExecutionInspector />;
    case 'registers':
      return <RegisterView />;
    case 'memory':
      return <MemoryView />;
    case 'signals':
      return <SignalTable />;
    case 'machine':
      return <MachineCodeView />;
    case 'overview':
    default:
      return <WorkspaceOverviewPanel />;
  }
}

export default function App() {
  const [leftDockTab, setLeftDockTab] = useState<LeftDockTab>('controls');
  const [rightDockTab, setRightDockTab] = useState<RightDockTab>('overview');

  const currentLeftTab = LEFT_DOCK_TABS.find((tab) => tab.id === leftDockTab) ?? LEFT_DOCK_TABS[0];
  const currentRightTab = RIGHT_DOCK_TABS.find((tab) => tab.id === rightDockTab) ?? RIGHT_DOCK_TABS[0];

  return (
    <div className="app-frame app-frame--workspace">
      <RuntimeBindings />
      <div className="ambient-orb ambient-orb--one" aria-hidden="true" />
      <div className="ambient-orb ambient-orb--two" aria-hidden="true" />

      <Header />

      <MainLayout
        leftSidebar={
          <div className="workspace-rail">
            <div className="workspace-rail__head">
              <div>
                <p className="eyebrow">左侧边栏</p>
                <h2>操作与程序</h2>
              </div>
              <span className="editor-pill">切换入口而不离开主画布</span>
            </div>

            <DockTabStrip activeTab={leftDockTab} onChange={setLeftDockTab} tabs={LEFT_DOCK_TABS} />
            <p className="workspace-rail__hint">{currentLeftTab.hint}</p>

            <div className={leftDockTab === 'controls' ? 'workspace-rail__body workspace-rail__body--stack' : 'workspace-rail__body'}>
              {renderLeftDockContent(leftDockTab)}
            </div>
          </div>
        }
        center={
          <div className="workspace-stage-shell">
            <div className="workspace-stage__canvas">
              <DatapathCanvas />
            </div>
            <div className="workspace-stage__timeline">
              <HistoryTimeline />
            </div>
          </div>
        }
        rightSidebar={
          <div className="workspace-rail workspace-rail--inspector">
            <div className="workspace-rail__head">
              <div>
                <p className="eyebrow">右侧边栏</p>
                <h2>状态面板</h2>
              </div>
              <span className="editor-pill">细节按需查看</span>
            </div>

            <DockTabStrip activeTab={rightDockTab} onChange={setRightDockTab} tabs={RIGHT_DOCK_TABS} />
            <p className="workspace-rail__hint">{currentRightTab.hint}</p>

            <div className="workspace-rail__body">
              {renderRightDockContent(rightDockTab)}
            </div>
          </div>
        }
      />
    </div>
  );
}
