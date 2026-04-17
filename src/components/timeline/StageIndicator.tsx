import { motion } from 'framer-motion';
import { Stage } from '../../types';
import { useCPUStore } from '../../store/cpu-store';

const STAGE_DETAILS = [
  { stage: Stage.IF, title: 'Instruction Fetch', hint: '从指令存储器取出下一条指令' },
  { stage: Stage.ID, title: 'Decode', hint: '译码、读寄存器并准备立即数' },
  { stage: Stage.EX, title: 'Execute', hint: '执行 ALU 计算或分支判断' },
  { stage: Stage.MEM, title: 'Memory', hint: '进行数据存储器读写' },
  { stage: Stage.WB, title: 'Write Back', hint: '把结果写回寄存器堆' },
] as const;

function getStageState(currentStage: Stage, stage: Stage): 'past' | 'current' | 'future' {
  const currentIndex = STAGE_DETAILS.findIndex((item) => item.stage === currentStage);
  const index = STAGE_DETAILS.findIndex((item) => item.stage === stage);

  if (index < currentIndex) {
    return 'past';
  }

  if (index === currentIndex) {
    return 'current';
  }

  return 'future';
}

export function StageIndicator() {
  const stage = useCPUStore((state) => state.stage);
  const cycleCount = useCPUStore((state) => state.cycleCount);
  const instructionCount = useCPUStore((state) => state.instructionCount);
  const runStatus = useCPUStore((state) => state.runStatus);

  return (
    <section className="panel-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Day 8 / Stage Indicator</p>
          <h2>阶段指示器</h2>
        </div>
        <span className="editor-pill">{runStatus.toUpperCase()}</span>
      </div>

      <div className="stage-indicator">
        {STAGE_DETAILS.map((item, index) => {
          const state = getStageState(stage, item.stage);
          const isCurrent = state === 'current';
          const className = `stage-node stage-node--${state}`;

          return (
            <div key={item.stage} className="stage-slot">
              <motion.article
                className={className}
                initial={false}
                animate={{
                  y: isCurrent ? -4 : 0,
                  scale: isCurrent ? 1.02 : 1,
                  opacity: state === 'future' ? 0.72 : 1,
                }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                <span className="stage-node__label">{item.stage}</span>
                <strong>{item.title}</strong>
                <span className="stage-node__hint">{item.hint}</span>
              </motion.article>

              {index < STAGE_DETAILS.length - 1 ? (
                <div className={state === 'future' ? 'stage-link' : 'stage-link stage-link--active'} aria-hidden="true" />
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="telemetry-grid">
        <article className="telemetry-card">
          <span className="telemetry-label">Current Stage</span>
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
    </section>
  );
}
