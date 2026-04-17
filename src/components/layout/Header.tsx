import type { Stage } from '../../types';
import type { RunStatus } from '../../store/cpu-store';

interface HeaderProps {
  title: string;
  version: string;
  stage: Stage;
  runStatus: RunStatus;
  componentCount: number;
  wireCount: number;
  cycleCount: number;
  instructionCount: number;
}

function getRunStatusLabel(runStatus: RunStatus): string {
  if (runStatus === 'running') {
    return '运行中';
  }

  if (runStatus === 'paused') {
    return '已暂停';
  }

  return '就绪';
}

function getRunStatusClass(runStatus: RunStatus): string {
  if (runStatus === 'running') {
    return 'status-chip status-chip--live';
  }

  if (runStatus === 'paused') {
    return 'status-chip status-chip--paused';
  }

  return 'status-chip status-chip--ready';
}

export function Header({
  title,
  version,
  stage,
  runStatus,
  componentCount,
  wireCount,
  cycleCount,
  instructionCount,
}: HeaderProps) {
  const displayTitle = title === 'RISC-V Multicycle CPU' ? 'RISC-V 多周期 CPU' : title;

  return (
    <header className="app-header">
      <section className="app-header__hero">
        <p className="eyebrow">HDCPU 多周期实验台</p>
        <h1>{displayTitle}</h1>
        <p className="hero-copy">
          面向多周期 RISC-V 的可视化实验台。现在已经串起代码编辑、真实 CPU 引擎、时间线回退和动态数据通路，适合一边执行一边观察各阶段状态。
        </p>

        <div className="hero-badges">
          <span className={getRunStatusClass(runStatus)}>{getRunStatusLabel(runStatus)}</span>
          <span className="status-chip status-chip--accent">阶段 {stage}</span>
          <span className="status-chip status-chip--accent">版本 v{version}</span>
        </div>
      </section>

      <section className="app-header__stats" aria-label="项目概览">
        <article className="hero-stat">
          <span className="hero-stat__label">部件</span>
          <strong>{componentCount}</strong>
        </article>
        <article className="hero-stat">
          <span className="hero-stat__label">连线</span>
          <strong>{wireCount}</strong>
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
}
