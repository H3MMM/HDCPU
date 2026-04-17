import { useCPUStore } from '../../store/cpu-store';

export function ExecutionControls() {
  const runStatus = useCPUStore((state) => state.runStatus);
  const speed = useCPUStore((state) => state.speed);
  const stage = useCPUStore((state) => state.stage);
  const cycleCount = useCPUStore((state) => state.cycleCount);
  const instructionCount = useCPUStore((state) => state.instructionCount);
  const lastAction = useCPUStore((state) => state.lastAction);
  const run = useCPUStore((state) => state.run);
  const pause = useCPUStore((state) => state.pause);
  const reset = useCPUStore((state) => state.reset);
  const stepCycle = useCPUStore((state) => state.stepCycle);
  const stepInstruction = useCPUStore((state) => state.stepInstruction);
  const setSpeed = useCPUStore((state) => state.setSpeed);

  const isRunning = runStatus === 'running';

  return (
    <section className="panel-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Day 2 / Controls</p>
          <h2>执行控制台</h2>
        </div>
        <span className={isRunning ? 'status-chip status-chip--live' : 'status-chip status-chip--paused'}>
          {isRunning ? 'Live' : 'Manual'}
        </span>
      </div>

      <div className="control-grid">
        <button
          type="button"
          className={isRunning ? 'control-button control-button--secondary' : 'control-button control-button--primary'}
          onClick={isRunning ? pause : run}
        >
          {isRunning ? '暂停' : '运行'}
        </button>

        <button type="button" className="control-button control-button--ghost" onClick={stepCycle}>
          单步（周期）
        </button>

        <button type="button" className="control-button control-button--ghost" onClick={stepInstruction}>
          单步（指令）
        </button>

        <button type="button" className="control-button control-button--danger" onClick={reset}>
          重置
        </button>
      </div>

      <div className="range-row">
        <span className="range-label">执行速度</span>
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
      </div>

      <p className="panel-caption">{lastAction}</p>
    </section>
  );
}
