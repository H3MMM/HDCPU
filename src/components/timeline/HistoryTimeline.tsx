import { memo, useEffect, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Stage } from '../../types';
import { useCPUStore } from '../../store/cpu-store';

const STAGE_LABELS = {
  [Stage.IF]: '取指',
  [Stage.ID]: '译码',
  [Stage.EX]: '执行',
  [Stage.MEM]: '访存',
  [Stage.WB]: '回写',
} as const;

const MAX_VISIBLE_HISTORY = 72;
const HISTORY_LOOKBACK = 48;

function getTimelineStatusLabel(isCurrent: boolean, isRunning: boolean): string {
  if (!isCurrent) {
    return '点击回退';
  }

  return isRunning ? '实时游标' : '当前视图';
}

function getVisibleHistoryWindow<T extends { cycleNumber: number }>(entries: readonly T[], cycleNumber: number) {
  if (entries.length <= MAX_VISIBLE_HISTORY) {
    return {
      visibleEntries: entries,
      omittedBefore: 0,
      omittedAfter: 0,
    };
  }

  const currentIndex = entries.findIndex((entry) => entry.cycleNumber === cycleNumber);
  const safeCurrentIndex = currentIndex === -1 ? entries.length - 1 : currentIndex;
  let start = Math.max(0, safeCurrentIndex - HISTORY_LOOKBACK);
  const end = Math.min(entries.length, start + MAX_VISIBLE_HISTORY);

  if (end - start < MAX_VISIBLE_HISTORY) {
    start = Math.max(0, end - MAX_VISIBLE_HISTORY);
  }

  return {
    visibleEntries: entries.slice(start, end),
    omittedBefore: start,
    omittedAfter: entries.length - end,
  };
}

export const HistoryTimeline = memo(function HistoryTimeline() {
  const { historyTimeline, cycleCount, runStatus, rewindToCycle } = useCPUStore(
    useShallow((state) => ({
      historyTimeline: state.historyTimeline,
      cycleCount: state.cycleCount,
      runStatus: state.runStatus,
      rewindToCycle: state.rewindToCycle,
    }))
  );
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef(new Map<number, HTMLButtonElement>());
  const isRunning = runStatus === 'running';

  const { visibleEntries, omittedBefore, omittedAfter } = useMemo(
    () => getVisibleHistoryWindow(historyTimeline, cycleCount),
    [historyTimeline, cycleCount]
  );

  useEffect(() => {
    const container = timelineRef.current;
    const currentCard = cardRefs.current.get(cycleCount);
    if (!container || !currentCard) {
      return;
    }

    const targetLeft =
      currentCard.offsetLeft - Math.max(0, (container.clientWidth - currentCard.clientWidth) / 2);

    container.scrollTo({
      left: Math.max(0, targetLeft),
      behavior: isRunning ? 'auto' : 'smooth',
    });
  }, [cycleCount, isRunning, visibleEntries]);

  return (
    <section className="panel-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">执行历史</p>
          <h2>执行时间线</h2>
        </div>
        <span className="editor-pill">{historyTimeline.length} 个检查点</span>
      </div>

      <p className="panel-copy">
        时间线会为每个周期保留回退点。为了避免长时间连续运行后卡顿，界面只渲染当前周期附近的一段窗口，但完整历史仍然保存在引擎里，可以随时继续回退。
      </p>

      <div className="history-window-meta" aria-live="polite">
        {omittedBefore > 0 ? (
          <button
            type="button"
            className="history-summary-chip"
            onClick={() => rewindToCycle(historyTimeline[0]?.cycleNumber ?? 0)}
          >
            已折叠前 {omittedBefore} 个检查点，点击回到起点
          </button>
        ) : (
          <span className="history-summary-chip history-summary-chip--muted">已显示起点</span>
        )}

        {omittedAfter > 0 ? (
          <span className="history-summary-chip history-summary-chip--muted">后方还有 {omittedAfter} 个检查点</span>
        ) : (
          <span className="history-summary-chip history-summary-chip--muted">当前窗口已覆盖最新周期</span>
        )}
      </div>

      <div ref={timelineRef} className="history-timeline-shell" role="list" aria-label="执行历史时间线">
        {visibleEntries.map((entry, index) => {
          const isCurrent = entry.cycleNumber === cycleCount;
          const className = isCurrent ? 'history-card history-card--current' : 'history-card';

          return (
            <div key={entry.id} className="history-step">
              <button
                ref={(element) => {
                  if (!element) {
                    cardRefs.current.delete(entry.cycleNumber);
                    return;
                  }

                  cardRefs.current.set(entry.cycleNumber, element);
                }}
                type="button"
                className={className}
                onClick={() => rewindToCycle(entry.cycleNumber)}
              >
                <span className="history-card__cycle">周期 {entry.cycleNumber}</span>
                <strong>
                  {entry.stage} / {STAGE_LABELS[entry.stage]}
                </strong>
                <span className="history-card__instruction">{entry.instructionASM}</span>
                <span className="history-card__note">{entry.note}</span>
                <span className="history-card__status">
                  {getTimelineStatusLabel(isCurrent, isRunning)}
                </span>
              </button>

              {index < visibleEntries.length - 1 ? (
                <div
                  className={isCurrent ? 'history-connector history-connector--active' : 'history-connector'}
                  aria-hidden="true"
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
});
