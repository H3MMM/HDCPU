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
    return 'Running';
  }

  if (runStatus === 'paused') {
    return 'Paused';
  }

  return 'Ready';
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
  return (
    <header className="app-header">
      <section className="app-header__hero">
        <p className="eyebrow">HDCPU Workbench</p>
        <h1>{title}</h1>
        <p className="hero-copy">
          面向多周期 RISC-V 的前端实验台。现在已经具备项目骨架、配置加载、编辑器和控制面板，可以直接承接后续的
          数据通路渲染与引擎联动。
        </p>

        <div className="hero-badges">
          <span className={getRunStatusClass(runStatus)}>{getRunStatusLabel(runStatus)}</span>
          <span className="status-chip status-chip--accent">Stage {stage}</span>
          <span className="status-chip status-chip--accent">v{version}</span>
        </div>
      </section>

      <section className="app-header__stats" aria-label="项目状态">
        <article className="hero-stat">
          <span className="hero-stat__label">Components</span>
          <strong>{componentCount}</strong>
        </article>
        <article className="hero-stat">
          <span className="hero-stat__label">Wires</span>
          <strong>{wireCount}</strong>
        </article>
        <article className="hero-stat">
          <span className="hero-stat__label">Cycles</span>
          <strong>{cycleCount}</strong>
        </article>
        <article className="hero-stat">
          <span className="hero-stat__label">Instructions</span>
          <strong>{instructionCount}</strong>
        </article>
      </section>
    </header>
  );
}
