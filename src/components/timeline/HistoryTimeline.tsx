import { motion } from 'framer-motion';
import { useCPUStore } from '../../store/cpu-store';

export function HistoryTimeline() {
  const historyTimeline = useCPUStore((state) => state.historyTimeline);
  const cycleCount = useCPUStore((state) => state.cycleCount);
  const rewindToCycle = useCPUStore((state) => state.rewindToCycle);

  return (
    <section className="panel-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Day 8 / History Timeline</p>
          <h2>执行时间线</h2>
        </div>
        <span className="editor-pill">{historyTimeline.length} checkpoints</span>
      </div>

      <p className="panel-copy">
        每次单步周期或单步指令都会在这里留下一个节点。点击任意历史卡片，就能把当前演示状态回退到那个周期。
      </p>

      <div className="history-timeline-shell" role="list" aria-label="执行历史时间线">
        {historyTimeline.map((entry, index) => {
          const isCurrent = entry.cycleNumber === cycleCount;
          const className = isCurrent ? 'history-card history-card--current' : 'history-card';

          return (
            <div key={entry.id} className="history-step">
              <motion.button
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
                <span className="history-card__cycle">Cycle {entry.cycleNumber}</span>
                <strong>{entry.stage}</strong>
                <span className="history-card__instruction">{entry.instructionASM}</span>
                <span className="history-card__note">{entry.note}</span>
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
