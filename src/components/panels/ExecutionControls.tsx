import { useCPUStore } from '../../store/cpu-store';

export function ExecutionControls() {
  const runStatus = useCPUStore((state) => state.runStatus);
  const speed = useCPUStore((state) => state.speed);
  const stage = useCPUStore((state) => state.stage);
  const cycleCount = useCPUStore((state) => state.cycleCount);
  const instructionCount = useCPUStore((state) => state.instructionCount);
  const currentInstruction = useCPUStore((state) => state.currentInstruction);
  const currentSnapshot = useCPUStore((state) => state.currentSnapshot);
  const assembleErrors = useCPUStore((state) => state.assembleErrors);
  const machineCodeRows = useCPUStore((state) => state.machineCodeRows);
  const lastAction = useCPUStore((state) => state.lastAction);
  const run = useCPUStore((state) => state.run);
  const pause = useCPUStore((state) => state.pause);
  const reset = useCPUStore((state) => state.reset);
  const stepCycle = useCPUStore((state) => state.stepCycle);
  const stepInstruction = useCPUStore((state) => state.stepInstruction);
  const setSpeed = useCPUStore((state) => state.setSpeed);

  const isRunning = runStatus === 'running';
  const hasAssemblyErrors = assembleErrors.length > 0;
  const isProgramComplete =
    machineCodeRows.length > 0 &&
    currentInstruction === null &&
    instructionCount >= machineCodeRows.length;
  const controlsDisabled = hasAssemblyErrors || isProgramComplete;

  const statusChipClassName = hasAssemblyErrors
    ? 'status-chip status-chip--paused'
    : isRunning
      ? 'status-chip status-chip--live'
      : isProgramComplete
        ? 'status-chip status-chip--ready'
        : 'status-chip status-chip--accent';

  const statusLabel = hasAssemblyErrors
    ? 'Blocked'
    : isRunning
      ? 'Running'
      : isProgramComplete
        ? 'Complete'
        : 'Ready';

  return (
    <section className="panel-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Day 10 / Controls</p>
          <h2>Execution Controls</h2>
        </div>
        <span className={statusChipClassName}>{statusLabel}</span>
      </div>

      <p className="panel-copy">
        The control rail now reads directly from live engine state, so button readiness, stage telemetry, and the
        action log stay aligned with the CPU snapshot driving the rest of the workspace.
      </p>

      <div className="control-grid">
        <button
          type="button"
          className={isRunning ? 'control-button control-button--secondary' : 'control-button control-button--primary'}
          onClick={isRunning ? pause : run}
          disabled={!isRunning && controlsDisabled}
        >
          {isRunning ? 'Pause' : 'Run'}
        </button>

        <button
          type="button"
          className="control-button control-button--ghost"
          onClick={stepCycle}
          disabled={controlsDisabled}
        >
          Step Cycle
        </button>

        <button
          type="button"
          className="control-button control-button--ghost"
          onClick={stepInstruction}
          disabled={controlsDisabled}
        >
          Step Instruction
        </button>

        <button type="button" className="control-button control-button--danger" onClick={reset}>
          Reset
        </button>
      </div>

      <div className="range-row">
        <span className="range-label">Playback Speed</span>
        <input
          className="range-input"
          type="range"
          min="0.25"
          max="3"
          step="0.25"
          value={speed}
          onChange={(event) => setSpeed(Number(event.target.value))}
        />
        <strong>{speed.toFixed(2)}x</strong>
      </div>

      <div className="telemetry-grid">
        <article className="telemetry-card">
          <span className="telemetry-label">Stage</span>
          <strong className="telemetry-value">{stage}</strong>
        </article>
        <article className="telemetry-card">
          <span className="telemetry-label">Cycle</span>
          <strong className="telemetry-value">{cycleCount}</strong>
        </article>
        <article className="telemetry-card">
          <span className="telemetry-label">Instruction</span>
          <strong className="telemetry-value">{instructionCount}</strong>
        </article>
        <article className="telemetry-card">
          <span className="telemetry-label">Active Paths</span>
          <strong className="telemetry-value">{currentSnapshot.activeDataPaths.length}</strong>
        </article>
        <article className="telemetry-card">
          <span className="telemetry-label">State Changes</span>
          <strong className="telemetry-value">{currentSnapshot.changes.length}</strong>
        </article>
        <article className="telemetry-card">
          <span className="telemetry-label">Next Action</span>
          <strong className="telemetry-value">
            {hasAssemblyErrors ? 'Fix Source' : isProgramComplete ? 'Reset Program' : 'Keep Stepping'}
          </strong>
        </article>
      </div>

      <p className="panel-caption">{lastAction}</p>
    </section>
  );
}
