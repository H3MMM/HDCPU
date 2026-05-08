import { memo, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useCPUStore } from '../../store/cpu-store';
import {
  PIPELINE_PRACTICE_BOOLEAN_SIGNALS,
  PIPELINE_PRACTICE_FORWARDING_OPTIONS,
  PIPELINE_PRACTICE_FORWARDING_SIGNALS,
  PIPELINE_PRACTICE_TEXTBOOK_SIGNALS,
  createEmptyPipelinePracticeAnswer,
  createPipelinePracticeQuestion,
  getPipelinePracticeSignalValueLabel,
  getPipelinePracticeValueLabel,
  type PipelinePracticeBooleanSignalName,
  type PipelinePracticeCheckResult,
  type PipelinePracticeExpectedValue,
  type PipelinePracticeSelectedValue,
  type PipelinePracticeSignalName,
} from '../../teaching/pipeline-practice';
import type { PipelineTextbookSignalName } from '../../teaching/textbook-signals';
import type {
  PipelineConflictEvent,
  PipelineForwardingSignalName,
  PipelineForwardingSource,
} from '../../types';

const BOOLEAN_OPTIONS: readonly boolean[] = [false, true];

function formatWord(value: number): string {
  return `0x${(value >>> 0).toString(16).padStart(8, '0')}`;
}

function formatPipelineEvent(event: PipelineConflictEvent): string {
  if (event.resolution === 'forward') {
    const source = event.producer && (event.producer.instructionWord & 0x7F) === 0x03
      ? '数据存储器读数'
      : '生产者结果';
    return `${event.forwardingSignal}: x${event.register} 从${source}旁路到 ${event.consumer?.asmString ?? '消费者'}`;
  }

  if (event.resolution === 'stall') {
    if (event.type === 'control') {
      return `控制停等: ${event.producer?.asmString ?? '分支/跳转'} 等待 EX 判定`;
    }

    return `RAW x${event.register}: 冻结 PC 与 IF/ID，并向 ID/EX 插入 bubble`;
  }

  return `控制 flush: PC -> ${formatWord(event.redirectPC ?? 0)}`;
}

function getPipelinePracticeHeadline(events: readonly PipelineConflictEvent[]): string {
  if (events.length === 0) {
    return '控制信号';
  }

  const labels = events.map((event) => {
    if (event.resolution === 'forward') {
      return event.forwardingSignal ?? 'Forward';
    }

    if (event.type === 'control') {
      return event.resolution === 'flush' ? 'Control flush' : 'Control stall';
    }

    return 'RAW stall';
  });

  return Array.from(new Set(labels)).join(' / ');
}

function getInstructionList(
  events: readonly PipelineConflictEvent[],
  key: 'producer' | 'consumer'
): string {
  const instructions = events
    .map((event) => event[key]?.asmString)
    .filter((instruction): instruction is string => Boolean(instruction));

  return Array.from(new Set(instructions)).join(' / ') || '无';
}

function getSignalRowClass(
  signal: PipelinePracticeSignalName,
  result: PipelinePracticeCheckResult | null
): string {
  if (!result) {
    return 'pipeline-practice-signal-row';
  }

  const hasMismatch = result.mismatches.some((mismatch) => mismatch.signal === signal);
  return hasMismatch
    ? 'pipeline-practice-signal-row pipeline-practice-signal-row--error'
    : 'pipeline-practice-signal-row pipeline-practice-signal-row--correct';
}

function getChoiceClass(selected: boolean): string {
  return selected
    ? 'pipeline-practice-choice pipeline-practice-choice--selected'
    : 'pipeline-practice-choice';
}

function getMismatchLabel(
  signal: PipelinePracticeSignalName,
  value: PipelinePracticeSelectedValue | PipelinePracticeExpectedValue
): string {
  return getPipelinePracticeSignalValueLabel(signal, value);
}

export const PipelinePracticePanel = memo(function PipelinePracticePanel() {
  const {
    currentSnapshot,
    pipelinePracticeAnswer,
    pipelinePracticeResult,
    setPipelinePracticeBooleanSignal,
    setPipelinePracticeForwardingSignal,
    setPipelinePracticeTextbookSignal,
    resetPipelinePracticeAnswer,
    checkPipelinePracticeAnswer,
  } = useCPUStore(
    useShallow((state) => ({
      currentSnapshot: state.currentSnapshot,
      pipelinePracticeAnswer: state.pipelinePracticeAnswer,
      pipelinePracticeResult: state.pipelinePracticeResult,
      setPipelinePracticeBooleanSignal: state.setPipelinePracticeBooleanSignal,
      setPipelinePracticeForwardingSignal: state.setPipelinePracticeForwardingSignal,
      setPipelinePracticeTextbookSignal: state.setPipelinePracticeTextbookSignal,
      resetPipelinePracticeAnswer: state.resetPipelinePracticeAnswer,
      checkPipelinePracticeAnswer: state.checkPipelinePracticeAnswer,
    }))
  );

  const question = useMemo(() => createPipelinePracticeQuestion(currentSnapshot), [currentSnapshot]);
  const activeAnswer = pipelinePracticeAnswer.cycleNumber === currentSnapshot.cycleNumber
    ? pipelinePracticeAnswer
    : createEmptyPipelinePracticeAnswer(currentSnapshot);
  const activeResult = pipelinePracticeResult?.cycleNumber === currentSnapshot.cycleNumber
    ? pipelinePracticeResult
    : null;
  const hasConflictQuestion = question.events.length > 0;
  const mismatchesBySignal = useMemo(() => {
    return new Map(activeResult?.mismatches.map((mismatch) => [mismatch.signal, mismatch]) ?? []);
  }, [activeResult]);

  function handleTextbookSelect(signal: PipelineTextbookSignalName, value: string) {
    setPipelinePracticeTextbookSignal(signal, value);
  }

  function handleBooleanSelect(signal: PipelinePracticeBooleanSignalName, value: boolean) {
    setPipelinePracticeBooleanSignal(signal, value);
  }

  function handleForwardingSelect(signal: PipelineForwardingSignalName, value: PipelineForwardingSource) {
    setPipelinePracticeForwardingSignal(signal, value);
  }

  return (
    <section className="panel-card panel-card--practice">
      <div className="panel-header">
        <div>
          <p className="eyebrow">教学模式</p>
          <h2>流水线练习</h2>
        </div>
        <span className={activeResult?.correct ? 'status-chip status-chip--ready' : 'editor-pill'}>
          {activeResult ? (activeResult.correct ? '已通过' : '待修正') : `C${currentSnapshot.cycleNumber}`}
        </span>
      </div>

      <article className="practice-current-card">
        <span className="detail-label">当前周期</span>
        <strong>{getPipelinePracticeHeadline(question.events)}</strong>
        <small>
          生产者 {getInstructionList(question.events, 'producer')} / 消费者{' '}
          {getInstructionList(question.events, 'consumer')}
        </small>
      </article>

      <div className="practice-question-block practice-question-block--active">
        <div className="practice-question-head">
          <strong>{question.textbookPrompt}</strong>
          {activeResult ? (
            <span className={activeResult.correct ? 'value-badge value-badge--active' : 'value-badge value-badge--changed'}>
              {activeResult.correct ? '正确' : '需修改'}
            </span>
          ) : null}
        </div>

        <div className="pipeline-practice-signal-list">
          {PIPELINE_PRACTICE_TEXTBOOK_SIGNALS.map((signal) => {
            const selected = activeAnswer.selectedTextbookSignals[signal.name] ?? null;
            const mismatch = mismatchesBySignal.get(signal.name);

            return (
              <div key={signal.name} className={getSignalRowClass(signal.name, activeResult)}>
                <div className="pipeline-practice-signal-copy">
                  <strong>{signal.label}</strong>
                  <span>{signal.hint}</span>
                </div>
                <div className="pipeline-practice-choice-row" role="group" aria-label={signal.label}>
                  {signal.options.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={getChoiceClass(selected === option.value)}
                      aria-pressed={selected === option.value}
                      onClick={() => handleTextbookSelect(signal.name, option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                {mismatch ? (
                  <p className="pipeline-practice-feedback">
                    你选了 {getMismatchLabel(mismatch.signal, mismatch.selected)}，正确是 {getMismatchLabel(mismatch.signal, mismatch.expected)}。{mismatch.explanation}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {hasConflictQuestion ? (
        <>
          <div className="pipeline-practice-event-list">
            {question.events.map((event) => (
              <article
                key={event.id}
                className={`pipeline-conflict-item pipeline-conflict-item--${event.resolution}`}
              >
                <strong>{event.resolution}</strong>
                <span>{formatPipelineEvent(event)}</span>
              </article>
            ))}
          </div>

          <div className="practice-question-block">
            <div className="practice-question-head">
              <strong>{question.conflictPrompt}</strong>
              {activeResult ? (
                <span className={activeResult.correct ? 'value-badge value-badge--active' : 'value-badge value-badge--changed'}>
                  {activeResult.correct ? '正确' : '需修改'}
                </span>
              ) : null}
            </div>

            <div className="pipeline-practice-signal-list">
              {PIPELINE_PRACTICE_BOOLEAN_SIGNALS.map((signal) => {
                const selected = activeAnswer.selectedBooleans[signal.name] ?? null;
                const mismatch = mismatchesBySignal.get(signal.name);

                return (
                  <div key={signal.name} className={getSignalRowClass(signal.name, activeResult)}>
                    <div className="pipeline-practice-signal-copy">
                      <strong>{signal.label}</strong>
                      <span>{signal.hint}</span>
                    </div>
                    <div className="pipeline-practice-choice-row" role="group" aria-label={signal.label}>
                      {BOOLEAN_OPTIONS.map((value) => (
                        <button
                          key={String(value)}
                          type="button"
                          className={getChoiceClass(selected === value)}
                          aria-pressed={selected === value}
                          onClick={() => handleBooleanSelect(signal.name, value)}
                        >
                          {value ? '1' : '0'}
                        </button>
                      ))}
                    </div>
                    {mismatch ? (
                      <p className="pipeline-practice-feedback">
                        你选了 {getMismatchLabel(mismatch.signal, mismatch.selected)}，正确是 {getMismatchLabel(mismatch.signal, mismatch.expected)}。{mismatch.explanation}
                      </p>
                    ) : null}
                  </div>
                );
              })}

              {PIPELINE_PRACTICE_FORWARDING_SIGNALS.map((signal) => {
                const selected = activeAnswer.selectedForwarding[signal.name] ?? null;
                const mismatch = mismatchesBySignal.get(signal.name);

                return (
                  <div key={signal.name} className={getSignalRowClass(signal.name, activeResult)}>
                    <div className="pipeline-practice-signal-copy">
                      <strong>{signal.label}</strong>
                      <span>{signal.hint}</span>
                    </div>
                    <div className="pipeline-practice-choice-row" role="group" aria-label={signal.label}>
                      {PIPELINE_PRACTICE_FORWARDING_OPTIONS.map((value) => (
                        <button
                          key={value}
                          type="button"
                          className={getChoiceClass(selected === value)}
                          aria-pressed={selected === value}
                          onClick={() => handleForwardingSelect(signal.name, value)}
                        >
                          {getPipelinePracticeValueLabel(value)}
                        </button>
                      ))}
                    </div>
                    {mismatch ? (
                      <p className="pipeline-practice-feedback">
                        你选了 {getMismatchLabel(mismatch.signal, mismatch.selected)}，正确是 {getMismatchLabel(mismatch.signal, mismatch.expected)}。{mismatch.explanation}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <div className="practice-result practice-result--correct">
          <strong>当前周期无冲突。</strong>
          <p>本周期只需要判断控制信号；继续单步到 RAW、旁路、控制停等或 flush 周期后，会追加冲突处理信号。</p>
        </div>
      )}

      <div className="practice-actions">
        <button type="button" className="control-button control-button--primary" onClick={checkPipelinePracticeAnswer}>
          检查
        </button>
        <button type="button" className="control-button control-button--ghost" onClick={resetPipelinePracticeAnswer}>
          清空
        </button>
      </div>

      {activeResult ? (
        <div className={activeResult.correct ? 'practice-result practice-result--correct' : 'practice-result'}>
          <strong>{activeResult.message}</strong>
          {activeResult.mismatches.length > 0 ? (
            <div className="practice-result-detail">
              {activeResult.mismatches.map((mismatch) => (
                <span key={mismatch.signal}>
                  {mismatch.label}: 你选了 {getMismatchLabel(mismatch.signal, mismatch.selected)}，正确是 {getMismatchLabel(mismatch.signal, mismatch.expected)}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
});
