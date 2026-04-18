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
  const {
    datapathConfig,
    stage,
    runStatus,
    cycleCount,
    instructionCount,
    currentInstruction,
  } = useCPUStore(
    useShallow((state) => ({
      datapathConfig: state.datapathConfig,
      stage: state.stage,
      runStatus: state.runStatus,
      cycleCount: state.cycleCount,
      instructionCount: state.instructionCount,
      currentInstruction: state.currentInstruction,
    }))
  );

  const summary = useMemo(() => summarizeDatapathConfig(datapathConfig), [datapathConfig]);

  return (
    <header className="app-header app-header--console">
      <section className="app-header__brand">
        <p className="eyebrow">HDCPU 工作台</p>
        <h1>CPU 数据通路工作区</h1>
        <p className="app-header__hint">
          {currentInstruction?.asmString ?? '从左侧切到“程序输入”加载示例或编写汇编，然后直接在中央画布观察数据如何流动。'}
        </p>
      </section>

      <section className="app-header__meta" aria-label="运行状态">
        <span className={getRunStatusClass(runStatus)}>{getRunStatusLabel(runStatus)}</span>
        <span className="status-chip status-chip--accent">阶段 {stage}</span>
        <span className="status-chip status-chip--accent">版本 v{datapathConfig.metadata.version}</span>
        <span className="status-chip status-chip--accent">部件 {summary.componentCount}</span>
        <span className="status-chip status-chip--accent">连线 {summary.wireCount}</span>
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
