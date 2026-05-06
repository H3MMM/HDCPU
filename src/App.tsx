import { useCallback, useState, useTransition, type ReactNode } from 'react';
import { Header } from './components/layout/Header';
import { DatapathCanvas } from './components/datapath/DatapathCanvas';
import { MainLayout } from './components/layout/MainLayout';
import { CodeEditor } from './components/panels/CodeEditor';
import { ExecutionControls } from './components/panels/ExecutionControls';
import { ExecutionInspector } from './components/panels/ExecutionInspector';
import { HelpPanel } from './components/panels/HelpPanel';
import { InstructionPracticePanel } from './components/panels/InstructionPracticePanel';
import { MemoryView } from './components/panels/MemoryView';
import { MachineCodeView } from './components/panels/MachineCodeView';
import { RegisterView } from './components/panels/RegisterView';
import { SignalTable } from './components/panels/SignalTable';
import { WorkspaceOverviewPanel } from './components/panels/WorkspaceOverviewPanel';
import { RuntimeBindings } from './components/runtime/RuntimeBindings';
import { HistoryTimeline } from './components/timeline/HistoryTimeline';

type LeftDockTab = 'controls' | 'program' | 'guide';
type RightDockTab = 'overview' | 'execution' | 'practice' | 'registers' | 'memory' | 'signals' | 'machine';

interface DockTab<T extends string> {
  id: T;
  label: string;
}

const LEFT_DOCK_TABS: readonly DockTab<LeftDockTab>[] = [
  { id: 'controls', label: '运行控制' },
  { id: 'program', label: '程序输入' },
  { id: 'guide', label: '使用帮助' },
];

const RIGHT_DOCK_TABS: readonly DockTab<RightDockTab>[] = [
  { id: 'overview', label: '总览' },
  { id: 'execution', label: '执行检查' },
  { id: 'practice', label: '练习' },
  { id: 'registers', label: '寄存器' },
  { id: 'memory', label: '内存' },
  { id: 'signals', label: '控制信号' },
  { id: 'machine', label: '机器码' },
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
      return <ExecutionControls />;
  }
}

function renderRightDockContent(activeTab: RightDockTab): ReactNode {
  switch (activeTab) {
    case 'execution':
      return <ExecutionInspector />;
    case 'practice':
      return <InstructionPracticePanel />;
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
  const [, startTabTransition] = useTransition();

  const handleLeftDockTabChange = useCallback((tab: LeftDockTab) => {
    startTabTransition(() => setLeftDockTab(tab));
  }, [startTabTransition]);

  const handleRightDockTabChange = useCallback((tab: RightDockTab) => {
    startTabTransition(() => setRightDockTab(tab));
  }, [startTabTransition]);

  const handlePracticeModeSelected = useCallback(() => {
    startTabTransition(() => setRightDockTab('practice'));
  }, [startTabTransition]);

  return (
    <div className="app-frame app-frame--workspace">
      <RuntimeBindings />

      <Header />

      <MainLayout
        leftSidebar={
          <div className="workspace-rail">
            <div className="workspace-rail__head">
              <h2>操作与程序</h2>
            </div>

            <DockTabStrip activeTab={leftDockTab} onChange={handleLeftDockTabChange} tabs={LEFT_DOCK_TABS} />

            <div className={leftDockTab === 'controls' ? 'workspace-rail__body workspace-rail__body--stack' : 'workspace-rail__body'}>
              {renderLeftDockContent(leftDockTab)}
            </div>
          </div>
        }
        center={
          <div className="workspace-stage-shell">
            <div className="workspace-stage__canvas">
              <DatapathCanvas onPracticeModeSelected={handlePracticeModeSelected} />
            </div>
            <div className="workspace-stage__details">
              <div className="workspace-rail workspace-rail--details">
                <div className="workspace-rail__head">
                  <h2>状态面板</h2>
                </div>

                <DockTabStrip activeTab={rightDockTab} onChange={handleRightDockTabChange} tabs={RIGHT_DOCK_TABS} />

                <div className="workspace-rail__body">
                  {renderRightDockContent(rightDockTab)}
                </div>
              </div>
            </div>
          </div>
        }
        rightSidebar={
          <div className="workspace-rail workspace-rail--timeline">
            <div className="workspace-rail__head">
              <h2>执行时间线</h2>
            </div>

            <div className="workspace-rail__body workspace-rail__body--timeline">
              <HistoryTimeline />
            </div>
          </div>
        }
      />
    </div>
  );
}
