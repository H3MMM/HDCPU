import { motion } from 'framer-motion';
import { Stage } from '../../types';
import { useCPUStore } from '../../store/cpu-store';

const STAGE_DETAILS = [
  { stage: Stage.IF, title: '取指', hint: '从指令存储器读取下一条指令，并准备更新 PC。' },
  { stage: Stage.ID, title: '译码', hint: '完成译码、读取寄存器，并准备立即数与控制信号。' },
  { stage: Stage.EX, title: '执行', hint: '执行 ALU 运算，或者完成分支与跳转判断。' },
  { stage: Stage.MEM, title: '访存', hint: '按照当前指令需求进行数据内存读写。' },
  { stage: Stage.WB, title: '回写', hint: '把结果写回目标寄存器，完成本条指令。' },
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

function getRunStatusLabel(runStatus: 'idle' | 'running' | 'paused'): string {
  if (runStatus === 'running') {
    return '运行中';
  }

  if (runStatus === 'paused') {
    return '已暂停';
  }

  return '就绪';
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
          <p className="eyebrow">第 8 天 / 阶段指示</p>
          <h2>执行阶段</h2>
        </div>
        <span className="editor-pill">{getRunStatusLabel(runStatus)}</span>
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
          <span className="telemetry-label">当前阶段</span>
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
    </section>
  );
}
