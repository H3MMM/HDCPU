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
import { useExecutionShortcuts } from './hooks/useExecutionShortcuts';
import { useCPUStore } from './store/cpu-store';

export default function App() {
  useExecutionShortcuts();

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
                  <p className="eyebrow">Day 10 / Engine + UI</p>
                  <h2>Live integration is now visible across the whole workspace.</h2>
                </div>
                <span className="status-chip status-chip--accent">{config.metadata.type}</span>
              </div>

              <p className="panel-copy">
                We are no longer looking at disconnected demo panels. The canvas, history strip, register file, memory
                view, machine code table, and inspector are all reading from the same engine-backed snapshot pipeline.
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
                  <h2>Day 10 delivery checkpoints</h2>
                </div>
              </div>

              <div className="milestone-list">
                <div className="milestone-item">
                  <span>Store</span>
                  <strong>Source edits, stepping, reset, and rewind all feed a single engine-backed snapshot model.</strong>
                </div>
                <div className="milestone-item">
                  <span>Canvas</span>
                  <strong>Datapath nodes and wires now highlight from the mapped live snapshot instead of local demo state.</strong>
                </div>
                <div className="milestone-item">
                  <span>Inspector</span>
                  <strong>Pipeline registers, ALU details, memory access, state changes, and active paths are visible in one place.</strong>
                </div>
                <div className="milestone-item">
                  <span>Panels</span>
                  <strong>Register and memory views now surface real write-back and memory transaction feedback.</strong>
                </div>
                <div className="milestone-item">
                  <span>Controls</span>
                  <strong>Run/step readiness now reflects source errors and completion state before Day 11 playback lands.</strong>
                </div>
              </div>
            </section>
          </>
        }
      />
    </div>
  );
}
