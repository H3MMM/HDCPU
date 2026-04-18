import { memo, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { summarizeDatapathConfig } from '../../config/load-datapath-config';
import { useCPUStore } from '../../store/cpu-store';

function getRunStatusLabel(runStatus: 'idle' | 'running' | 'paused'): string {
  if (runStatus === 'running') {
    return '运行中';
  }

  if (runStatus === 'paused') {
    return '已暂停';
  }

  return '就绪';
}

function getRunStatusClass(runStatus: 'idle' | 'running' | 'paused'): string {
  if (runStatus === 'running') {
    return 'status-chip status-chip--live';
  }

  if (runStatus === 'paused') {
    return 'status-chip status-chip--paused';
  }

  return 'status-chip status-chip--ready';
}

export const Header = memo(function Header() {
  const { datapathConfig, stage, runStatus, cycleCount, instructionCount } = useCPUStore(
    useShallow((state) => ({
      datapathConfig: state.datapathConfig,
      stage: state.stage,
      runStatus: state.runStatus,
      cycleCount: state.cycleCount,
      instructionCount: state.instructionCount,
    }))
  );

  const summary = useMemo(() => summarizeDatapathConfig(datapathConfig), [datapathConfig]);
  const displayTitle = datapathConfig.metadata.name === 'RISC-V Multicycle CPU'
    ? 'RISC-V 多周期 CPU'
    : datapathConfig.metadata.name;

  return (
    <header className="app-header">
      <section className="app-header__hero">
        <p className="eyebrow">HDCPU 多周期实验台</p>
        <h1>{displayTitle}</h1>
        <p className="hero-copy">
          现在这套前端已经把编辑器、执行控制、时间线回退和动态数据通路串到同一套真实 CPU 状态上，既可以逐周期观察，也可以连续播放验证执行路径。
        </p>

        <div className="hero-badges">
          <span className={getRunStatusClass(runStatus)}>{getRunStatusLabel(runStatus)}</span>
          <span className="status-chip status-chip--accent">阶段 {stage}</span>
          <span className="status-chip status-chip--accent">版本 v{datapathConfig.metadata.version}</span>
        </div>
      </section>

      <section className="app-header__stats" aria-label="项目概览">
        <article className="hero-stat">
          <span className="hero-stat__label">部件</span>
          <strong>{summary.componentCount}</strong>
        </article>
        <article className="hero-stat">
          <span className="hero-stat__label">连线</span>
          <strong>{summary.wireCount}</strong>
        </article>
        <article className="hero-stat">
          <span className="hero-stat__label">周期</span>
          <strong>{cycleCount}</strong>
        </article>
        <article className="hero-stat">
          <span className="hero-stat__label">指令</span>
          <strong>{instructionCount}</strong>
        </article>
      </section>
    </header>
  );
});
