import { memo } from 'react';
import { useShallow } from 'zustand/react/shallow';
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
  const {
    stage,
    runStatus,
    cycleCount,
    instructionCount,
    currentInstruction,
  } = useCPUStore(
    useShallow((state) => ({
      stage: state.stage,
      runStatus: state.runStatus,
      cycleCount: state.cycleCount,
      instructionCount: state.instructionCount,
      currentInstruction: state.currentInstruction,
    }))
  );

  return (
    <header className="app-header app-header--console">
      <section className="app-header__brand">
        <p className="eyebrow">HDCPU 工作台</p>
        <h1>CPU 数据通路</h1>
        <p className="app-header__hint">
          {currentInstruction?.asmString ?? '把更多注意力放在中央画布。左侧负责输入程序和操作，右侧负责按需查看寄存器、内存和执行细节。'}
        </p>
      </section>

      <section className="app-header__meta" aria-label="运行状态">
        <span className={getRunStatusClass(runStatus)}>{getRunStatusLabel(runStatus)}</span>
        <span className="status-chip status-chip--accent">阶段 {stage}</span>
      </section>

      <section className="app-header__statsbar" aria-label="当前执行概览">
        <article className="app-kpi">
          <span>周期</span>
          <strong>{cycleCount}</strong>
        </article>
        <article className="app-kpi">
          <span>指令</span>
          <strong>{instructionCount}</strong>
        </article>
        <article className="app-kpi app-kpi--wide">
          <span>当前关注</span>
          <strong>{currentInstruction?.asmString ?? '等待装载程序'}</strong>
        </article>
      </section>
    </header>
  );
});
