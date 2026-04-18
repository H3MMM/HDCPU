import { memo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useCPUStore } from '../../store/cpu-store';

export const ExecutionControls = memo(function ExecutionControls() {
  const {
    runStatus,
    speed,
    stage,
    cycleCount,
    instructionCount,
    currentInstruction,
    assembleErrors,
    machineCodeRows,
    lastAction,
    run,
    pause,
    reset,
    stepCycle,
    stepInstruction,
    setSpeed,
  } = useCPUStore(
    useShallow((state) => ({
      runStatus: state.runStatus,
      speed: state.speed,
      stage: state.stage,
      cycleCount: state.cycleCount,
      instructionCount: state.instructionCount,
      currentInstruction: state.currentInstruction,
      assembleErrors: state.assembleErrors,
      machineCodeRows: state.machineCodeRows,
      lastAction: state.lastAction,
      run: state.run,
      pause: state.pause,
      reset: state.reset,
      stepCycle: state.stepCycle,
      stepInstruction: state.stepInstruction,
      setSpeed: state.setSpeed,
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

  const statusChipClassName = hasAssemblyErrors
    ? 'status-chip status-chip--paused'
    : isRunning
      ? 'status-chip status-chip--live'
      : isProgramComplete
        ? 'status-chip status-chip--ready'
        : 'status-chip status-chip--accent';

  const statusLabel = hasAssemblyErrors
    ? '已阻塞'
    : isRunning
      ? '运行中'
      : isProgramComplete
        ? '已完成'
        : '就绪';

  return (
    <section className="panel-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">运行控制</p>
          <h2>控制台</h2>
        </div>
        <span className={statusChipClassName}>{statusLabel}</span>
      </div>

      <p className="panel-copy">
        常用操作都集中在这里。运行、暂停、单步和重置都不会把你带离中央画布，所以可以一边操作，一边盯住数据通路变化。
      </p>

      <div className="control-grid">
        <button
          type="button"
          className={isRunning ? 'control-button control-button--secondary' : 'control-button control-button--primary'}
          onClick={isRunning ? pause : run}
          disabled={!isRunning && controlsDisabled}
        >
          {isRunning ? '暂停' : '运行'}
        </button>

        <button
          type="button"
          className="control-button control-button--ghost"
          onClick={stepCycle}
          disabled={stepControlsDisabled}
        >
          单步周期
        </button>

        <button
          type="button"
          className="control-button control-button--ghost"
          onClick={stepInstruction}
          disabled={stepControlsDisabled}
        >
          单步指令
        </button>

        <button type="button" className="control-button control-button--danger" onClick={reset}>
          重置
        </button>
      </div>

      <div className="range-row">
        <span className="range-label">播放速度</span>
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
          <span className="telemetry-label">阶段</span>
          <strong className="telemetry-value">{stage}</strong>
        </article>
        <article className="telemetry-card">
          <span className="telemetry-label">周期</span>
          <strong className="telemetry-value">{cycleCount}</strong>
        </article>
        <article className="telemetry-card">
          <span className="telemetry-label">指令</span>
          <strong className="telemetry-value">{instructionCount}</strong>
        </article>
      </div>

      <p className="panel-caption">{lastAction}</p>
    </section>
  );
});
