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
          <p className="eyebrow">第 11 天 / 执行控制</p>
          <h2>执行控制台</h2>
        </div>
        <span className={statusChipClassName}>{statusLabel}</span>
      </div>

      <p className="panel-copy">
        连续播放现在通过 requestAnimationFrame 驱动真实 CPU 周期推进，按钮、速度、时间线和观察面板都共享同一份运行状态，所以暂停、恢复和回退不会彼此脱节。
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
        <article className="telemetry-card">
          <span className="telemetry-label">活跃路径</span>
          <strong className="telemetry-value">{currentSnapshot.activeDataPaths.length}</strong>
        </article>
        <article className="telemetry-card">
          <span className="telemetry-label">状态变化</span>
          <strong className="telemetry-value">{currentSnapshot.changes.length}</strong>
        </article>
        <article className="telemetry-card">
          <span className="telemetry-label">下一步建议</span>
          <strong className="telemetry-value">
            {hasAssemblyErrors ? '先修复源码' : isProgramComplete ? '先重置程序' : '可以继续推进'}
          </strong>
        </article>
      </div>

      <p className="panel-caption">{lastAction}</p>
    </section>
  );
}
