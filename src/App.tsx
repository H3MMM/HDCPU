import { memo, useCallback, useState, useTransition, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Header } from './components/layout/Header';
import { DatapathCanvas } from './components/datapath/DatapathCanvas';
import { MainLayout } from './components/layout/MainLayout';
import { CodeEditor } from './components/panels/CodeEditor';
import { HelpPanel } from './components/panels/HelpPanel';
import { InstructionPracticePanel } from './components/panels/InstructionPracticePanel';
import { PipelinePracticePanel } from './components/panels/PipelinePracticePanel';
import { MemoryView } from './components/panels/MemoryView';
import { MachineCodeView } from './components/panels/MachineCodeView';
import { RegisterView } from './components/panels/RegisterView';
import { SignalTable } from './components/panels/SignalTable';
import { WorkspaceOverviewPanel } from './components/panels/WorkspaceOverviewPanel';
import { ExecutionInspector } from './components/panels/ExecutionInspector';
import { RuntimeBindings } from './components/runtime/RuntimeBindings';
import { HistoryTimeline } from './components/timeline/HistoryTimeline';
import { FloatPanel } from './components/panels/FloatPanel';
import { useCPUStore } from './store/cpu-store';

type RightDockTab = 'overview' | 'execution' | 'practice' | 'registers' | 'memory' | 'signals' | 'machine';

interface DockTab<T extends string> {
  id: T;
  label: string;
}

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
  className?: string;
  onChange: (tab: T) => void;
  tabs: readonly DockTab<T>[];
}

function DockTabStrip<T extends string>({ activeTab, className, onChange, tabs }: DockTabStripProps<T>) {
  return (
    <div className={className ? `workspace-tablist ${className}` : 'workspace-tablist'} role="tablist">
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

function PracticePanelRouter() {
  const datapathMode = useCPUStore((state) => state.datapathMode);
  return datapathMode === 'pipeline' ? <PipelinePracticePanel /> : <InstructionPracticePanel />;
}

function renderRightDockContent(activeTab: RightDockTab): ReactNode {
  switch (activeTab) {
    case 'execution':
      return <ExecutionInspector />;
    case 'practice':
      return <PracticePanelRouter />;
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

/* ------------------------------------------------------------------ */
/*  RunToolbar — 运行/重置/单步周期/单步指令 + 状态 + 速度 + 流水线设置  */
/* ------------------------------------------------------------------ */
const RunToolbar = memo(function RunToolbar() {
  const [activeStepButton, setActiveStepButton] = useState<'cycle' | 'instruction' | null>(null);
  const {
    datapathMode,
    runStatus,
    speed,
    stage,
    cycleCount,
    instructionCount,
    currentInstruction,
    pipelineForwardingEnabled,
    pipelineControlStrategy,
    assembleErrors,
    machineCodeRows,
    run,
    pause,
    reset,
    stepCycle,
    stepInstruction,
    setSpeed,
    setPipelineForwardingEnabled,
    setPipelineControlStrategy,
  } = useCPUStore(
    useShallow((state) => ({
      datapathMode: state.datapathMode,
      runStatus: state.runStatus,
      speed: state.speed,
      stage: state.stage,
      cycleCount: state.cycleCount,
      instructionCount: state.instructionCount,
      currentInstruction: state.currentInstruction,
      pipelineForwardingEnabled: state.pipelineForwardingEnabled,
      pipelineControlStrategy: state.pipelineControlStrategy,
      assembleErrors: state.assembleErrors,
      machineCodeRows: state.machineCodeRows,
      run: state.run,
      pause: state.pause,
      reset: state.reset,
      stepCycle: state.stepCycle,
      stepInstruction: state.stepInstruction,
      setSpeed: state.setSpeed,
      setPipelineForwardingEnabled: state.setPipelineForwardingEnabled,
      setPipelineControlStrategy: state.setPipelineControlStrategy,
    }))
  );

  const isRunning = runStatus === 'running';
  const hasAssemblyErrors = assembleErrors.length > 0;
  const isProgramComplete =
    machineCodeRows.length > 0 &&
    currentInstruction === null &&
    instructionCount >= machineCodeRows.length;
  const controlsDisabled = hasAssemblyErrors || isProgramComplete;
  const stepControlsDisabled = controlsDisabled || isRunning;
  const isPipelineMode = datapathMode === 'pipeline';

  const statusChipClassName = hasAssemblyErrors
    ? 'toolbar-chip toolbar-chip--paused'
    : isRunning
      ? 'toolbar-chip toolbar-chip--live'
      : isProgramComplete
        ? 'toolbar-chip toolbar-chip--ready'
        : 'toolbar-chip toolbar-chip--accent';

  const statusLabel = hasAssemblyErrors
    ? '已阻塞'
    : isRunning
      ? '运行中'
      : isProgramComplete
        ? '已完成'
        : '就绪';

  const stepCycleButtonClassName = activeStepButton === 'cycle'
    ? 'toolbar-btn toolbar-btn--step-active toolbar-btn--step-active-cycle'
    : 'toolbar-btn toolbar-btn--ghost';
  const stepInstructionButtonClassName = activeStepButton === 'instruction'
    ? 'toolbar-btn toolbar-btn--step-active toolbar-btn--step-active-instruction'
    : 'toolbar-btn toolbar-btn--ghost';

  function handleRunClick() {
    setActiveStepButton(null);
    if (isRunning) pause();
    else run();
  }

  function handleResetClick() {
    setActiveStepButton(null);
    reset();
  }

  function handleStepCycleClick() {
    setActiveStepButton('cycle');
    stepCycle();
  }

  function handleStepInstructionClick() {
    setActiveStepButton('instruction');
    stepInstruction();
  }

  return (
    <div className="run-toolbar">
      {/* Row 1: 主按钮 + 状态 + 速度 */}
      <div className="run-toolbar__primary">
        <div className="run-toolbar__actions">
          <button
            type="button"
            className={isRunning ? 'toolbar-btn toolbar-btn--secondary' : 'toolbar-btn toolbar-btn--ghost'}
            onClick={handleRunClick}
            disabled={!isRunning && controlsDisabled}
          >
            {isRunning ? '暂停' : '运行'}
          </button>

          <button
            type="button"
            className="toolbar-btn toolbar-btn--ghost"
            onClick={handleResetClick}
          >
            重置
          </button>

          <button
            type="button"
            className={stepCycleButtonClassName}
            onClick={handleStepCycleClick}
            disabled={stepControlsDisabled}
          >
            单步周期
          </button>

          <button
            type="button"
            className={stepInstructionButtonClassName}
            onClick={handleStepInstructionClick}
            disabled={stepControlsDisabled}
          >
            单步指令
          </button>
        </div>

        <div className="run-toolbar__meta">
          <span className={statusChipClassName}>{statusLabel}</span>

          {!isPipelineMode ? (
            <span className="toolbar-telemetry">
              <span className="toolbar-telemetry__item">{stage}</span>
              <span className="toolbar-telemetry__sep">·</span>
              <span className="toolbar-telemetry__item">{cycleCount} 周期</span>
              <span className="toolbar-telemetry__sep">·</span>
              <span className="toolbar-telemetry__item">{instructionCount} 指令</span>
            </span>
          ) : null}

          <span className="toolbar-speed">
            <span className="toolbar-speed__label">速度</span>
            <input
              className="toolbar-speed__slider"
              type="range"
              min="0.25"
              max="3"
              step="0.25"
              value={speed}
              onChange={(event) => setSpeed(Number(event.target.value))}
            />
            <span className="toolbar-speed__value">{speed.toFixed(2)}x</span>
          </span>
        </div>
      </div>

      {/* Row 2: 流水线设置（仅流水线模式） */}
      {isPipelineMode ? (
        <div className="run-toolbar__secondary">
          <div className="run-toolbar__pipeline-settings">
            <label className="toolbar-toggle">
              <input
                type="checkbox"
                checked={pipelineForwardingEnabled}
                disabled={isRunning}
                onChange={(event) => setPipelineForwardingEnabled(event.target.checked)}
              />
              <span>旁路</span>
              <small>{pipelineForwardingEnabled ? '已启用' : '已关闭'}</small>
            </label>

            <div className="toolbar-segmented" role="group" aria-label="控制冲突策略">
              <span className="toolbar-segmented__label">控制策略</span>
              <div className="toolbar-segmented__group">
                <button
                  type="button"
                  className={pipelineControlStrategy === 'predict-not-taken' ? 'toolbar-seg-btn toolbar-seg-btn--active' : 'toolbar-seg-btn'}
                  disabled={isRunning}
                  onClick={() => setPipelineControlStrategy('predict-not-taken')}
                >
                  预测
                </button>
                <button
                  type="button"
                  className={pipelineControlStrategy === 'stall-until-resolved' ? 'toolbar-seg-btn toolbar-seg-btn--active' : 'toolbar-seg-btn'}
                  disabled={isRunning}
                  onClick={() => setPipelineControlStrategy('stall-until-resolved')}
                >
                  停等
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
});

/* ---------------------------------------------------------------- */
/*  Modal 弹窗包装                                                    */
/* ---------------------------------------------------------------- */
interface ModalProps {
  children: ReactNode;
  onClose: () => void;
  title: string;
  wide?: boolean;
}

const Modal = memo(function Modal({ children, onClose, title, wide }: ModalProps) {
  const handleBackdropClick = useCallback(
    (event: React.MouseEvent) => {
      if (event.target === event.currentTarget) onClose();
    },
    [onClose]
  );

  return (
    <div className="modal-overlay" onClick={handleBackdropClick} role="dialog" aria-modal="true" aria-label={title}>
      <div className={wide ? 'modal-card modal-card--wide' : 'modal-card'}>
        <div className="modal-card__head">
          <h3>{title}</h3>
          <button type="button" className="modal-card__close" onClick={onClose} aria-label="关闭">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M4 4L14 14M14 4L4 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="modal-card__body">{children}</div>
      </div>
    </div>
  );
});

/* ---------------------------------------------------------------- */
/*  App 根组件                                                        */
/* ---------------------------------------------------------------- */
export default function App() {
  const [rightDockTab, setRightDockTab] = useState<RightDockTab>('overview');
  const [, startTabTransition] = useTransition();
  const [showProgramModal, setShowProgramModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showFloatModal, setShowFloatModal] = useState(false);

  const handleRightDockTabChange = useCallback((tab: RightDockTab) => {
    startTabTransition(() => setRightDockTab(tab));
  }, [startTabTransition]);

  return (
    <div className="app-frame app-frame--workspace">
      <RuntimeBindings />

      <Header
        onOpenProgram={() => setShowProgramModal(true)}
        onOpenHelp={() => setShowHelpModal(true)}
        onOpenFloat={() => setShowFloatModal(true)}
      />

      <RunToolbar />

      <MainLayout
        leftSidebar={
          <div className="workspace-rail workspace-rail--timeline">
            <div className="workspace-rail__head">
              <h2>执行时间线</h2>
            </div>

            <div className="workspace-rail__body workspace-rail__body--timeline">
              <HistoryTimeline />
            </div>
          </div>
        }
        center={
          <div className="workspace-stage-shell">
            <div className="workspace-stage__canvas">
              <DatapathCanvas />
            </div>
            <div className="workspace-stage__details">
              <div className="workspace-rail workspace-rail--details">
                <div className="workspace-rail__head">
                  <h2>状态面板</h2>
                </div>

                <DockTabStrip
                  activeTab={rightDockTab}
                  className="workspace-tablist--right"
                  onChange={handleRightDockTabChange}
                  tabs={RIGHT_DOCK_TABS}
                />

                <div className="workspace-rail__body">
                  {renderRightDockContent(rightDockTab)}
                </div>
              </div>
            </div>
          </div>
        }
      />

      {showProgramModal ? (
        <Modal title="程序输入" onClose={() => setShowProgramModal(false)} wide>
          <CodeEditor />
        </Modal>
      ) : null}

      {showHelpModal ? (
        <Modal title="使用帮助" onClose={() => setShowHelpModal(false)}>
          <HelpPanel />
        </Modal>
      ) : null}

      {showFloatModal ? (
        <Modal title="浮点数机器数演示" onClose={() => setShowFloatModal(false)} wide>
          <FloatPanel />
        </Modal>
      ) : null}
    </div>
  );
}
