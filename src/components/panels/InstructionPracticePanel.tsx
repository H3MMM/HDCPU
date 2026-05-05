import { memo, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useCPUStore } from '../../store/cpu-store';
import { Stage } from '../../types';
import {
  INSTRUCTION_PRACTICE_IDS_BY_CATEGORY,
  PRACTICE_STAGE_ORDER,
  getInstructionPracticeItem,
  getInstructionPracticeItemsByCategory,
  type InstructionPracticeCategory,
  type InstructionPracticeId,
  type PracticeControlSignalId,
  type PracticeControlSignalOption,
} from '../../teaching/instruction-practice';

const CATEGORY_LABELS: Record<InstructionPracticeCategory, string> = {
  R: 'R 型',
  I: 'I 型',
  S: 'S 型',
  B: 'B 型',
  U: 'U 型',
  J: 'J 型',
};

const PRACTICE_CATEGORIES: readonly InstructionPracticeCategory[] = ['R', 'I', 'S', 'B', 'U', 'J'];
const INTERACTION_MODE_LABELS = {
  'free-drag': '自由拖动',
  practice: '练习模式',
} as const;

function isStageSelected(selectedStages: readonly Stage[], stage: Stage): boolean {
  return selectedStages.includes(stage);
}

function isSignalSelected(
  selectedSignals: readonly PracticeControlSignalId[],
  signalId: PracticeControlSignalId
): boolean {
  return selectedSignals.includes(signalId);
}

function getSignalLabel(
  options: readonly PracticeControlSignalOption[],
  signalId: PracticeControlSignalId
): string {
  return options.find((option) => option.id === signalId)?.label ?? signalId;
}

export const InstructionPracticePanel = memo(function InstructionPracticePanel() {
  const {
    datapathInteractionMode,
    practiceInstructionId,
    practiceAnswer,
    practiceResult,
    setDatapathInteractionMode,
    setPracticeInstruction,
    setPracticeStageSelected,
    setPracticeSignalSelected,
    resetPracticeAnswer,
    checkPracticeAnswer,
  } = useCPUStore(
    useShallow((state) => ({
      datapathInteractionMode: state.datapathInteractionMode,
      practiceInstructionId: state.practiceInstructionId,
      practiceAnswer: state.practiceAnswer,
      practiceResult: state.practiceResult,
      setDatapathInteractionMode: state.setDatapathInteractionMode,
      setPracticeInstruction: state.setPracticeInstruction,
      setPracticeStageSelected: state.setPracticeStageSelected,
      setPracticeSignalSelected: state.setPracticeSignalSelected,
      resetPracticeAnswer: state.resetPracticeAnswer,
      checkPracticeAnswer: state.checkPracticeAnswer,
    }))
  );
  const initialCategory = getInstructionPracticeItem(practiceInstructionId).category;
  const [activeCategory, setActiveCategory] = useState<InstructionPracticeCategory>(initialCategory);
  const practiceItems = useMemo(() => getInstructionPracticeItemsByCategory(activeCategory), [activeCategory]);
  const practiceItem = getInstructionPracticeItem(practiceInstructionId);
  const exQuestion = practiceItem.signalQuestions[Stage.EX];
  const exResult = practiceResult?.signalsByStage[Stage.EX];
  const selectedExSignals = practiceAnswer.selectedSignalsByStage[Stage.EX] ?? [];

  function handleCategoryChange(category: InstructionPracticeCategory) {
    setActiveCategory(category);
    const firstInstructionId = INSTRUCTION_PRACTICE_IDS_BY_CATEGORY[category][0];
    if (firstInstructionId && getInstructionPracticeItem(practiceInstructionId).category !== category) {
      setPracticeInstruction(firstInstructionId);
    }
  }

  return (
    <section className="panel-card panel-card--practice">
      <div className="panel-header">
        <div>
          <p className="eyebrow">教学模式</p>
          <h2>指令拍与控制信号</h2>
        </div>
        <span className={practiceResult?.correct ? 'status-chip status-chip--ready' : 'editor-pill'}>
          {practiceResult ? (practiceResult.correct ? '已通过' : '待修正') : practiceItem.mnemonic}
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

      <div className="practice-category-grid" role="group" aria-label="指令格式">
        {PRACTICE_CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            className={activeCategory === category ? 'practice-category practice-category--active' : 'practice-category'}
            aria-pressed={activeCategory === category}
            onClick={() => handleCategoryChange(category)}
          >
            {CATEGORY_LABELS[category]}
          </button>
        ))}
      </div>

      <label className="practice-field">
        <span className="detail-label">指令</span>
        <select
          className="editor-select"
          value={practiceInstructionId}
          onChange={(event) => setPracticeInstruction(event.target.value as InstructionPracticeId)}
        >
          {practiceItems.map((item) => (
            <option key={item.id} value={item.id}>
              {item.mnemonic} · {item.title}
            </option>
          ))}
        </select>
      </label>

      <div className="practice-question-block">
        <div className="practice-question-head">
          <strong>{practiceItem.stageQuestion.prompt}</strong>
          {practiceResult ? (
            <span className={practiceResult.stages.correct ? 'value-badge value-badge--active' : 'value-badge value-badge--changed'}>
              {practiceResult.stages.correct ? '正确' : '需修改'}
            </span>
          ) : null}
        </div>

        <div className="practice-stage-row">
          {PRACTICE_STAGE_ORDER.map((stage) => (
            <label
              key={stage}
              className={isStageSelected(practiceAnswer.selectedStages, stage) ? 'practice-stage-cell practice-stage-cell--selected' : 'practice-stage-cell'}
            >
              <input
                type="checkbox"
                checked={isStageSelected(practiceAnswer.selectedStages, stage)}
                onChange={(event) => setPracticeStageSelected(stage, event.target.checked)}
              />
              <span>{stage}</span>
            </label>
          ))}
        </div>
      </div>

      {exQuestion ? (
        <div className="practice-question-block">
          <div className="practice-question-head">
            <strong>{exQuestion.prompt}</strong>
            {exResult ? (
              <span className={exResult.correct ? 'value-badge value-badge--active' : 'value-badge value-badge--changed'}>
                {exResult.correct ? '正确' : '需修改'}
              </span>
            ) : null}
          </div>

          <div className="practice-signal-grid">
            {exQuestion.options.map((option) => (
              <label
                key={option.id}
                className={isSignalSelected(selectedExSignals, option.id) ? 'practice-signal-choice practice-signal-choice--selected' : 'practice-signal-choice'}
              >
                <input
                  type="checkbox"
                  checked={isSignalSelected(selectedExSignals, option.id)}
                  onChange={(event) => setPracticeSignalSelected(Stage.EX, option.id, event.target.checked)}
                />
                <span>{option.label}</span>
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

      {practiceResult && exQuestion ? (
        <div className={practiceResult.correct ? 'practice-result practice-result--correct' : 'practice-result'}>
          <strong>{exResult?.message ?? (practiceResult.correct ? '回答正确。' : '还需要调整。')}</strong>
          {!practiceResult.stages.correct ? (
            <div className="practice-result-detail">
              {practiceResult.stages.missing.length > 0 ? (
                <span>漏选拍：{practiceResult.stages.missing.join('、')}</span>
              ) : null}
              {practiceResult.stages.extra.length > 0 ? (
                <span>多选拍：{practiceResult.stages.extra.join('、')}</span>
              ) : null}
            </div>
          ) : null}
          {exResult && !exResult.correct ? (
            <div className="practice-result-detail">
              {exResult.missing.length > 0 ? (
                <span>
                  漏选信号：{exResult.missing.map((signalId) => getSignalLabel(exQuestion.options, signalId)).join('、')}
                </span>
              ) : null}
              {exResult.extra.length > 0 ? (
                <span>
                  多选信号：{exResult.extra.map((signalId) => getSignalLabel(exQuestion.options, signalId)).join('、')}
                </span>
              ) : null}
            </div>
          ) : null}
          <p>{exResult?.explanation}</p>
        </div>
      ) : null}
    </section>
  );
});
