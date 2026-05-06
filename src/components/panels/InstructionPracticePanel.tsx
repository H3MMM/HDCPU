import { memo, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useCPUStore } from '../../store/cpu-store';
import { Stage } from '../../types';
import {
  PRACTICE_STAGE_ORDER,
  getInstructionPracticeItem,
  getPracticeControlValueLabel,
  resolveInstructionPracticeId,
  type PracticeControlDefinition,
  type PracticeControlName,
  type PracticeControlValue,
} from '../../teaching/instruction-practice';

function isStageSelected(selectedStages: readonly Stage[], stage: Stage): boolean {
  return selectedStages.includes(stage);
}

function getControlRowClass(
  controlName: PracticeControlName,
  resultMismatchControls: ReadonlySet<PracticeControlName> | null,
  hasResult: boolean
): string {
  if (!hasResult) {
    return 'practice-control-row';
  }

  return resultMismatchControls?.has(controlName)
    ? 'practice-control-row practice-control-row--error'
    : 'practice-control-row practice-control-row--correct';
}

export const InstructionPracticePanel = memo(function InstructionPracticePanel() {
  const {
    datapathInteractionMode,
    currentInstruction,
    stage,
    practiceInstructionId,
    practiceAnswer,
    practiceResult,
    setPracticeInstruction,
    setPracticeStageSelected,
    setPracticeControlValue,
    resetPracticeAnswer,
    checkPracticeAnswer,
  } = useCPUStore(
    useShallow((state) => ({
      datapathInteractionMode: state.datapathInteractionMode,
      currentInstruction: state.currentInstruction,
      stage: state.stage,
      practiceInstructionId: state.practiceInstructionId,
      practiceAnswer: state.practiceAnswer,
      practiceResult: state.practiceResult,
      setPracticeInstruction: state.setPracticeInstruction,
      setPracticeStageSelected: state.setPracticeStageSelected,
      setPracticeControlValue: state.setPracticeControlValue,
      resetPracticeAnswer: state.resetPracticeAnswer,
      checkPracticeAnswer: state.checkPracticeAnswer,
    }))
  );

  const currentPracticeId = resolveInstructionPracticeId(currentInstruction);
  const practiceItem = currentPracticeId ? getInstructionPracticeItem(currentPracticeId) : null;
  const isAnswerSynced = practiceItem !== null && practiceAnswer.instructionId === practiceItem.id;
  const activeAnswer = isAnswerSynced ? practiceAnswer : null;
  const controlQuestions = practiceItem
    ? PRACTICE_STAGE_ORDER.flatMap((stageOption) => {
        const question = practiceItem.controlQuestions[stageOption];
        return question ? [question] : [];
      })
    : [];
  const activeResult = practiceResult?.instructionId === practiceItem?.id ? practiceResult : null;

  useEffect(() => {
    if (currentPracticeId && practiceInstructionId !== currentPracticeId) {
      setPracticeInstruction(currentPracticeId);
    }
  }, [currentPracticeId, practiceInstructionId, setPracticeInstruction]);

  function handleControlChange(stageOption: Stage, control: PracticeControlDefinition, rawValue: string) {
    setPracticeControlValue(
      stageOption,
      control.name,
      rawValue === '' ? null : rawValue as PracticeControlValue
    );
  }

  return (
    <section className="panel-card panel-card--practice">
      <div className="panel-header">
        <div>
          <p className="eyebrow">教学模式</p>
          <h2>当前指令练习</h2>
        </div>
        <span className={activeResult?.correct ? 'status-chip status-chip--ready' : 'editor-pill'}>
          {activeResult ? (activeResult.correct ? '已通过' : '待修正') : practiceItem?.mnemonic ?? '暂无指令'}
        </span>
      </div>

      <div className="practice-mode-note">
        当前画布交互：{datapathInteractionMode === 'practice' ? '练习模式' : '自由拖动'}
      </div>

      <article className="practice-current-card">
        <span className="detail-label">当前运行指令</span>
        <strong>{currentInstruction?.asmString ?? '暂无当前指令'}</strong>
        <small>{practiceItem ? `${practiceItem.category} 型 · 阶段 ${stage}` : '程序结束或当前指令暂不支持练习'}</small>
      </article>

      {practiceItem && activeAnswer ? (
        <>
          <div className="practice-question-block">
            <div className="practice-question-head">
              <strong>{practiceItem.stageQuestion.prompt}</strong>
              {activeResult ? (
                <span className={activeResult.stages.correct ? 'value-badge value-badge--active' : 'value-badge value-badge--changed'}>
                  {activeResult.stages.correct ? '正确' : '需修改'}
                </span>
              ) : null}
            </div>

            <div className="practice-stage-row">
              {PRACTICE_STAGE_ORDER.map((stageOption) => (
                <label
                  key={stageOption}
                  className={isStageSelected(activeAnswer.selectedStages, stageOption) ? 'practice-stage-cell practice-stage-cell--selected' : 'practice-stage-cell'}
                >
                  <input
                    type="checkbox"
                    checked={isStageSelected(activeAnswer.selectedStages, stageOption)}
                    onChange={(event) => setPracticeStageSelected(stageOption, event.target.checked)}
                  />
                  <span>{stageOption}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="practice-control-stage-list">
            {controlQuestions.map((controlQuestion) => {
              const controlResult = activeResult?.controlsByStage[controlQuestion.stage];
              const selectedControls = activeAnswer.selectedControlsByStage[controlQuestion.stage] ?? {};
              const resultMismatchControls = controlResult
                ? new Set(controlResult.mismatches.map((mismatch) => mismatch.control))
                : null;

              return (
                <div
                  key={controlQuestion.stage}
                  className={
                    controlQuestion.stage === stage
                      ? 'practice-question-block practice-question-block--active'
                      : 'practice-question-block'
                  }
                >
                  <div className="practice-control-stage-head">
                    <div className="practice-control-stage-title">
                      <span
                        className={
                          controlQuestion.stage === stage
                            ? 'practice-stage-chip practice-stage-chip--current'
                            : 'practice-stage-chip'
                        }
                      >
                        {controlQuestion.stage}
                      </span>
                      <strong>{controlQuestion.prompt}</strong>
                    </div>
                    {controlResult ? (
                      <span className={controlResult.correct ? 'value-badge value-badge--active' : 'value-badge value-badge--changed'}>
                        {controlResult.correct ? '正确' : '需修改'}
                      </span>
                    ) : null}
                  </div>

                  <div className="practice-control-grid">
                    {controlQuestion.controls.map((control) => (
                      <label
                        key={control.name}
                        className={getControlRowClass(
                          control.name,
                          resultMismatchControls,
                          controlResult !== undefined
                        )}
                      >
                        <span>{control.label}</span>
                        <select
                          className="editor-select practice-control-select"
                          value={selectedControls[control.name] ?? ''}
                          onChange={(event) => handleControlChange(controlQuestion.stage, control, event.target.value)}
                        >
                          <option value="">请选择</option>
                          {control.options.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>

                  {controlResult ? (
                    <div className={controlResult.correct ? 'practice-result practice-result--correct practice-result--inline' : 'practice-result practice-result--inline'}>
                      <strong>{controlResult.message}</strong>
                      {!controlResult.correct ? (
                        <div className="practice-result-detail">
                          {controlResult.mismatches.map((mismatch) => (
                            <span key={mismatch.control}>
                              {mismatch.control}：你选了 {getPracticeControlValueLabel(mismatch.control, mismatch.selected)}，正确是 {getPracticeControlValueLabel(mismatch.control, mismatch.expected)}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <p>{controlResult.explanation}</p>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="practice-actions">
            <button type="button" className="control-button control-button--primary" onClick={checkPracticeAnswer}>
              检查
            </button>
            <button type="button" className="control-button control-button--ghost" onClick={resetPracticeAnswer}>
              清空
            </button>
          </div>
        </>
      ) : (
        <div className="practice-result">
          <strong>当前没有可练习的指令。</strong>
          <p>请先运行或单步到一条已支持的 RV32I 指令，练习面板会自动跟随当前指令更新。</p>
        </div>
      )}

      {activeResult ? (
        <div className={activeResult.correct ? 'practice-result practice-result--correct' : 'practice-result'}>
          <strong>{activeResult.correct ? '回答正确。' : '还需要调整。'}</strong>
          {!activeResult.stages.correct ? (
            <div className="practice-result-detail">
              {activeResult.stages.missing.length > 0 ? (
                <span>漏选拍：{activeResult.stages.missing.join('、')}</span>
              ) : null}
              {activeResult.stages.extra.length > 0 ? (
                <span>多选拍：{activeResult.stages.extra.join('、')}</span>
              ) : null}
            </div>
          ) : null}
          <p>{activeResult.correct ? '所有阶段和控制信号都匹配当前指令。' : '请查看上方标记为“需修改”的阶段。'}</p>
        </div>
      ) : null}
    </section>
  );
});
