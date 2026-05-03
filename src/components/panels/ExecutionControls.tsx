import { memo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useCPUStore } from '../../store/cpu-store';

export const ExecutionControls = memo(function ExecutionControls() {
  const {
    datapathMode,
    runStatus,
    speed,
    stage,
    cycleCount,
    instructionCount,
    currentInstruction,
    currentSnapshot,
    pipelineForwardingEnabled,
    pipelineControlStrategy,
    assembleErrors,
    machineCodeRows,
    lastAction,
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
      currentSnapshot: state.currentSnapshot,
      pipelineForwardingEnabled: state.pipelineForwardingEnabled,
      pipelineControlStrategy: state.pipelineControlStrategy,
      assembleErrors: state.assembleErrors,
      machineCodeRows: state.machineCodeRows,
      lastAction: state.lastAction,
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
  const isPipelineMode = datapathMode === 'pipeline';
  const activePipelineStages = isPipelineMode
    ? Object.values(currentSnapshot.pipeline.stages).filter((slot) => slot.decodedInstruction !== null).length
    : 0;

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
        {isPipelineMode
          ? '流水线模式按周期推进，多条指令会同时占用 IF/ID/EX/MEM/WB。旁路开启时 ALU 结果和数据存储器读数都会旁路，关闭时 RAW 统一用停顿解决。'
          : '常用操作都集中在这里。运行、暂停、单步和重置都不会把你带离中央画布，所以可以一边操作，一边盯住数据通路变化。'}
      </p>

      {isPipelineMode ? (
        <div className="pipeline-policy-stack">
          <label className="pipeline-toggle-card">
            <span>
              <strong>旁路</strong>
              <small>{pipelineForwardingEnabled ? 'ForwardingUnit 已启用' : 'RAW 冲突将插入气泡'}</small>
            </span>
            <input
              type="checkbox"
              checked={pipelineForwardingEnabled}
              disabled={isRunning}
              onChange={(event) => setPipelineForwardingEnabled(event.target.checked)}
            />
          </label>

          <div className="pipeline-toggle-card pipeline-toggle-card--stacked">
            <span>
              <strong>控制策略</strong>
              <small>
                {pipelineControlStrategy === 'predict-not-taken'
                  ? '预测不跳转，EX 判定后必要时 flush'
                  : '分支/跳转进入 ID 后停等到 EX 判定'}
              </small>
            </span>
            <div className="segmented-control segmented-control--compact" role="group" aria-label="控制冲突策略">
              <button
                type="button"
                className={pipelineControlStrategy === 'predict-not-taken' ? 'segment-button segment-button--active' : 'segment-button'}
                disabled={isRunning}
                onClick={() => setPipelineControlStrategy('predict-not-taken')}
              >
                预测
              </button>
              <button
                type="button"
                className={pipelineControlStrategy === 'stall-until-resolved' ? 'segment-button segment-button--active' : 'segment-button'}
                disabled={isRunning}
                onClick={() => setPipelineControlStrategy('stall-until-resolved')}
              >
                停等
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
        {isPipelineMode ? (
          <article className="telemetry-card telemetry-card--stage">
            <span className="telemetry-label">在途</span>
            <strong className="telemetry-value">{activePipelineStages}/5</strong>
          </article>
        ) : (
          <article className="telemetry-card telemetry-card--stage">
            <span className="telemetry-label">阶段</span>
            <strong className="telemetry-value">{stage}</strong>
          </article>
        )}
        <article className="telemetry-card">
          <span className="telemetry-label">周期</span>
          <strong className="telemetry-value">{cycleCount}</strong>
        </article>
        <article className="telemetry-card">
          <span className="telemetry-label">{isPipelineMode ? '已退休' : '指令'}</span>
          <strong className="telemetry-value">{instructionCount}</strong>
        </article>
      </div>

      <p className="panel-caption">{lastAction}</p>
    </section>
  );
});
