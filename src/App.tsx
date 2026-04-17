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
                  <p className="eyebrow">Day 11 / Playback + Rewind</p>
                  <h2>Continuous execution and timeline rewind now share one live state loop.</h2>
                </div>
                <span className="status-chip status-chip--accent">{config.metadata.type}</span>
              </div>

              <p className="panel-copy">
                The simulator can now play forward with requestAnimationFrame, pause cleanly, and rewind from the
                timeline while keeping the datapath, register file, machine code, and memory window aligned.
              </p>

              <div className="metric-grid">
                <article className="metric-card">
                  <span className="metric-label">Current Instruction</span>
                  <strong>{currentInstruction?.asmString ?? 'Program complete'}</strong>
                </article>
                <article className="metric-card">
                  <span className="metric-label">Active Paths</span>
                  <strong>{currentSnapshot.activeDataPaths.length}</strong>
                </article>
                <article className="metric-card">
                  <span className="metric-label">State Changes</span>
                  <strong>{currentSnapshot.changes.length}</strong>
                </article>
              </div>

              <div className="metric-grid metric-grid--dense">
                <article className="metric-card">
                  <span className="metric-label">Canvas</span>
                  <strong>
                    {summary.canvasSize.width} x {summary.canvasSize.height}
                  </strong>
                </article>
                <article className="metric-card">
                  <span className="metric-label">Focused Node</span>
                  <strong>{selectedComponentId ?? config.components[0]?.id ?? 'none'}</strong>
                </article>
                <article className="metric-card">
                  <span className="metric-label">Loaded Types</span>
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
                  <p className="eyebrow">Integration Notes</p>
                  <h2>Day 11 delivery checkpoints</h2>
                </div>
              </div>

              <div className="milestone-list">
                <div className="milestone-item">
                  <span>Playback</span>
                  <strong>Run mode is now driven by a requestAnimationFrame loop that advances the real CPU cycle by cycle.</strong>
                </div>
                <div className="milestone-item">
                  <span>Speed</span>
                  <strong>The existing speed slider now changes the execution cadence instead of being a passive control.</strong>
                </div>
                <div className="milestone-item">
                  <span>Pause</span>
                  <strong>Program completion, manual pause, and source errors all stop playback cleanly without desyncing the UI.</strong>
                </div>
                <div className="milestone-item">
                  <span>Timeline</span>
                  <strong>Timeline clicks rewind the engine and the current card auto-scrolls back into view during playback.</strong>
                </div>
                <div className="milestone-item">
                  <span>Views</span>
                  <strong>Memory focus now follows the latest accessed address when execution or rewind lands on a memory event.</strong>
                </div>
              </div>
            </section>
          </>
        }
      />
    </div>
  );
}
