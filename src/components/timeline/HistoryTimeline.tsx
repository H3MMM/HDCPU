import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useCPUStore } from '../../store/cpu-store';

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
          <p className="eyebrow">Day 11 / History Timeline</p>
          <h2>Execution Timeline</h2>
        </div>
        <span className="editor-pill">{historyTimeline.length} checkpoints</span>
      </div>

      <p className="panel-copy">
        Every executed cycle leaves a checkpoint here. During playback the strip auto-follows the live cycle, and
        clicking any card rewinds the engine so the rest of the workspace can repaint from that checkpoint.
      </p>

      <div className="history-timeline-shell" role="list" aria-label="Execution history timeline">
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
                <span className="history-card__cycle">Cycle {entry.cycleNumber}</span>
                <strong>{entry.stage}</strong>
                <span className="history-card__instruction">{entry.instructionASM}</span>
                <span className="history-card__note">{entry.note}</span>
                <span className="history-card__status">
                  {isCurrent ? (runStatus === 'running' ? 'Live Cursor' : 'Current View') : 'Click to rewind'}
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
