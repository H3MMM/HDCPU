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

const INTERACTION_MODE_LABELS = {
  'free-drag': '自由拖动',
  practice: '练习模式',
} as const;

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
    setDatapathInteractionMode,
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
      setDatapathInteractionMode: state.setDatapathInteractionMode,
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
  const exQuestion = practiceItem?.controlQuestions[Stage.EX];
  const activeResult = practiceResult?.instructionId === practiceItem?.id ? practiceResult : null;
  const exResult = activeResult?.controlsByStage[Stage.EX];
  const selectedExControls = activeAnswer?.selectedControlsByStage[Stage.EX] ?? {};
  const resultMismatchControls = exResult
    ? new Set(exResult.mismatches.map((mismatch) => mismatch.control))
    : null;

  useEffect(() => {
    if (currentPracticeId && practiceInstructionId !== currentPracticeId) {
      setPracticeInstruction(currentPracticeId);
    }
  }, [currentPracticeId, practiceInstructionId, setPracticeInstruction]);

  function handleControlChange(control: PracticeControlDefinition, rawValue: string) {
    setPracticeControlValue(
      Stage.EX,
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

      <div className="practice-mode-row" role="group" aria-label="数据通路交互模式">
        {Object.entries(INTERACTION_MODE_LABELS).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            className={datapathInteractionMode === mode ? 'mode-switch-button mode-switch-button--active' : 'mode-switch-button'}
            aria-pressed={datapathInteractionMode === mode}
            onClick={() => setDatapathInteractionMode(mode as typeof datapathInteractionMode)}
          >
            {label}
          </button>
        ))}
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

          {exQuestion ? (
            <div className="practice-question-block">
              <div className="practice-question-head">
                <strong>EX 阶段需要哪些控制信号？</strong>
                {exResult ? (
                  <span className={exResult.correct ? 'value-badge value-badge--active' : 'value-badge value-badge--changed'}>
                    {exResult.correct ? '正确' : '需修改'}
                  </span>
                ) : null}
              </div>

              <div className="practice-control-grid">
                {exQuestion.controls.map((control) => (
                  <label
                    key={control.name}
                    className={getControlRowClass(control.name, resultMismatchControls, exResult !== undefined)}
                  >
                    <span>{control.label}</span>
                    <select
                      className="editor-select practice-control-select"
                      value={selectedExControls[control.name] ?? ''}
                      onChange={(event) => handleControlChange(control, event.target.value)}
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
            </div>
          ) : null}

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

      {activeResult && exQuestion ? (
        <div className={activeResult.correct ? 'practice-result practice-result--correct' : 'practice-result'}>
          <strong>{exResult?.message ?? (activeResult.correct ? '回答正确。' : '还需要调整。')}</strong>
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
          {exResult && !exResult.correct ? (
            <div className="practice-result-detail">
              {exResult.mismatches.map((mismatch) => (
                <span key={mismatch.control}>
                  {mismatch.control}：你选了 {getPracticeControlValueLabel(mismatch.control, mismatch.selected)}，正确是 {getPracticeControlValueLabel(mismatch.control, mismatch.expected)}
                </span>
              ))}
            </div>
          ) : null}
          <p>{exResult?.explanation}</p>
        </div>
      ) : null}
    </section>
  );
});
