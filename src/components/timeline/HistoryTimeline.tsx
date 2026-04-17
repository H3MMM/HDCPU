import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Stage } from '../../types';
import { useCPUStore } from '../../store/cpu-store';

const STAGE_LABELS = {
  [Stage.IF]: '取指',
  [Stage.ID]: '译码',
  [Stage.EX]: '执行',
  [Stage.MEM]: '访存',
  [Stage.WB]: '回写',
} as const;

function getTimelineStatusLabel(isCurrent: boolean, isRunning: boolean): string {
  if (!isCurrent) {
    return '点击回退';
  }

  return isRunning ? '实时游标' : '当前视图';
}

export function HistoryTimeline() {
  const historyTimeline = useCPUStore((state) => state.historyTimeline);
  const cycleCount = useCPUStore((state) => state.cycleCount);
  const runStatus = useCPUStore((state) => state.runStatus);
  const rewindToCycle = useCPUStore((state) => state.rewindToCycle);
  const cardRefs = useRef(new Map<number, HTMLButtonElement>());

  useEffect(() => {
    const currentCard = cardRefs.current.get(cycleCount);
    currentCard?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, [cycleCount]);

  return (
    <section className="panel-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">第 11 天 / 执行历史</p>
          <h2>执行时间线</h2>
        </div>
        <span className="editor-pill">{historyTimeline.length} 个检查点</span>
      </div>

      <p className="panel-copy">
        每执行一个周期，这里都会留下一个检查点。播放时时间线会自动跟随当前周期，点击任意卡片则会让引擎回退到对应状态，并驱动其他视图一起重绘。
      </p>

      <div className="history-timeline-shell" role="list" aria-label="执行历史时间线">
        {historyTimeline.map((entry, index) => {
          const isCurrent = entry.cycleNumber === cycleCount;
          const className = isCurrent ? 'history-card history-card--current' : 'history-card';

          return (
            <div key={entry.id} className="history-step">
              <motion.button
                ref={(element) => {
                  if (!element) {
                    cardRefs.current.delete(entry.cycleNumber);
                    return;
                  }

                  cardRefs.current.set(entry.cycleNumber, element);
                }}
                type="button"
                className={className}
                initial={false}
                whileHover={{ y: -2, scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                animate={{
                  opacity: isCurrent ? 1 : 0.84,
                  scale: isCurrent ? 1.02 : 1,
                }}
                transition={{ duration: 0.24 }}
                onClick={() => rewindToCycle(entry.cycleNumber)}
              >
                <span className="history-card__cycle">周期 {entry.cycleNumber}</span>
                <strong>{entry.stage} / {STAGE_LABELS[entry.stage]}</strong>
                <span className="history-card__instruction">{entry.instructionASM}</span>
                <span className="history-card__note">{entry.note}</span>
                <span className="history-card__status">
                  {getTimelineStatusLabel(isCurrent, runStatus === 'running')}
                </span>
              </motion.button>

              {index < historyTimeline.length - 1 ? (
                <div className={isCurrent ? 'history-connector history-connector--active' : 'history-connector'} aria-hidden="true" />
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
