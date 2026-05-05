import { describe, expect, it } from 'vitest';
import { Stage } from '../../types';
import {
  INSTRUCTION_PRACTICE_IDS_BY_CATEGORY,
  PRACTICE_STAGE_ORDER,
  createEmptyPracticeAnswer,
  evaluateInstructionPracticeAnswer,
  getInstructionPracticeItem,
  type InstructionPracticeId,
  setPracticeSignalSelected,
  setPracticeStageSelected,
} from '../instruction-practice';

function createCorrectAnswer(instructionId: InstructionPracticeId) {
  const item = getInstructionPracticeItem(instructionId);
  let answer = createEmptyPracticeAnswer(instructionId);

  for (const stage of item.stageQuestion.correctStages) {
    answer = setPracticeStageSelected(answer, stage, true);
  }

  for (const question of Object.values(item.signalQuestions)) {
    if (!question) {
      continue;
    }

    for (const signalId of question.correctSignalIds) {
      answer = setPracticeSignalSelected(answer, question.stage, signalId, true);
    }
  }

  return answer;
}

function getAllPracticeInstructionIds(): readonly InstructionPracticeId[] {
  return Object.values(INSTRUCTION_PRACTICE_IDS_BY_CATEGORY).flat();
}

describe('instruction practice', () => {
  it('groups the supported practice instructions by instruction format', () => {
    expect(INSTRUCTION_PRACTICE_IDS_BY_CATEGORY.R).toEqual([
      'add',
      'sub',
      'and',
      'or',
      'xor',
      'sll',
      'srl',
      'sra',
      'slt',
      'sltu',
    ]);
    expect(INSTRUCTION_PRACTICE_IDS_BY_CATEGORY.I).toEqual([
      'addi',
      'andi',
      'ori',
      'xori',
      'slti',
      'sltiu',
      'slli',
      'srli',
      'srai',
      'lb',
      'lh',
      'lw',
      'lbu',
      'lhu',
      'jalr',
    ]);
    expect(INSTRUCTION_PRACTICE_IDS_BY_CATEGORY.S).toEqual(['sb', 'sh', 'sw']);
    expect(INSTRUCTION_PRACTICE_IDS_BY_CATEGORY.B).toEqual([
      'beq',
      'bne',
      'blt',
      'bge',
      'bltu',
      'bgeu',
    ]);
    expect(INSTRUCTION_PRACTICE_IDS_BY_CATEGORY.U).toEqual(['lui', 'auipc']);
    expect(INSTRUCTION_PRACTICE_IDS_BY_CATEGORY.J).toEqual(['jal']);
  });

  it('checks canonical answers for every supported practice item', () => {
    for (const instructionId of getAllPracticeInstructionIds()) {
      const result = evaluateInstructionPracticeAnswer(createCorrectAnswer(instructionId));

      expect(result.correct, instructionId).toBe(true);
      expect(result.signalsByStage[Stage.EX]?.correct, instructionId).toBe(true);
    }
  });

  it('uses the expected EX controls for representative R-type and I-type instructions', () => {
    expect(getInstructionPracticeItem('sub').stageQuestion.correctStages).toEqual([
      Stage.IF,
      Stage.ID,
      Stage.EX,
      Stage.WB,
    ]);
    expect(getInstructionPracticeItem('sub').signalQuestions[Stage.EX]?.correctSignalIds).toEqual([
      'alu-src-reg',
      'alu-op-sub',
    ]);
    expect(getInstructionPracticeItem('srai').signalQuestions[Stage.EX]?.correctSignalIds).toEqual([
      'alu-src-imm',
      'alu-op-sra',
    ]);
    expect(getInstructionPracticeItem('lw').stageQuestion.correctStages).toEqual(PRACTICE_STAGE_ORDER);
    expect(getInstructionPracticeItem('jalr').stageQuestion.correctStages).toEqual([
      Stage.IF,
      Stage.ID,
      Stage.EX,
      Stage.WB,
    ]);
  });

  it('uses the expected EX controls for S-type and B-type instructions', () => {
    expect(getInstructionPracticeItem('sw').stageQuestion.correctStages).toEqual([
      Stage.IF,
      Stage.ID,
      Stage.EX,
      Stage.MEM,
    ]);
    expect(getInstructionPracticeItem('sw').signalQuestions[Stage.EX]?.correctSignalIds).toEqual([
      'alu-src-imm',
      'alu-op-add',
    ]);
    expect(getInstructionPracticeItem('beq').stageQuestion.correctStages).toEqual([
      Stage.IF,
      Stage.ID,
      Stage.EX,
    ]);
    expect(getInstructionPracticeItem('beq').signalQuestions[Stage.EX]?.correctSignalIds).toEqual([
      'alu-src-reg',
      'alu-op-sub',
      'pc-src-branch',
    ]);
  });

  it('uses the expected EX controls for U-type and J-type instructions', () => {
    expect(getInstructionPracticeItem('lui').stageQuestion.correctStages).toEqual([
      Stage.IF,
      Stage.EX,
    ]);
    expect(getInstructionPracticeItem('lui').signalQuestions[Stage.EX]?.correctSignalIds).toEqual([
      'reg-write',
      'wb-src-imm',
    ]);
    expect(getInstructionPracticeItem('auipc').signalQuestions[Stage.EX]?.correctSignalIds).toEqual([
      'alu-src-pc',
      'alu-src-imm',
      'alu-op-add',
    ]);
    expect(getInstructionPracticeItem('jal').stageQuestion.correctStages).toEqual([
      Stage.IF,
      Stage.EX,
    ]);
    expect(getInstructionPracticeItem('jal').signalQuestions[Stage.EX]?.correctSignalIds).toEqual([
      'alu-src-pc',
      'alu-src-4',
      'alu-op-add',
      'pc-write',
      'pc-src-jump',
      'reg-write',
      'wb-src-pc-plus-4',
    ]);
  });

  it('checks the canonical lw practice answer', () => {
    let answer = createEmptyPracticeAnswer('lw');

    for (const stage of PRACTICE_STAGE_ORDER) {
      answer = setPracticeStageSelected(answer, stage, true);
    }
    answer = setPracticeSignalSelected(answer, Stage.EX, 'alu-src-imm', true);
    answer = setPracticeSignalSelected(answer, Stage.EX, 'alu-op-add', true);

    const result = evaluateInstructionPracticeAnswer(answer);

    expect(result.correct).toBe(true);
    expect(result.stages.correct).toBe(true);
    expect(result.stages.missing).toEqual([]);
    expect(result.stages.extra).toEqual([]);
    expect(result.signalsByStage[Stage.EX]?.correct).toBe(true);
    expect(result.signalsByStage[Stage.EX]?.message).toBe('EX 阶段正确。');
    expect(result.signalsByStage[Stage.EX]?.explanation).toContain('Reg[rs1] + imm');
  });

  it('reports missing and extra choices for lw', () => {
    let answer = createEmptyPracticeAnswer('lw');

    answer = setPracticeStageSelected(answer, Stage.IF, true);
    answer = setPracticeStageSelected(answer, Stage.ID, true);
    answer = setPracticeStageSelected(answer, Stage.EX, true);
    answer = setPracticeSignalSelected(answer, Stage.EX, 'alu-op-add', true);
    answer = setPracticeSignalSelected(answer, Stage.EX, 'reg-write', true);

    const result = evaluateInstructionPracticeAnswer(answer);

    expect(result.correct).toBe(false);
    expect(result.stages.missing).toEqual([Stage.MEM, Stage.WB]);
    expect(result.stages.extra).toEqual([]);
    expect(result.signalsByStage[Stage.EX]?.missing).toEqual(['alu-src-imm']);
    expect(result.signalsByStage[Stage.EX]?.extra).toEqual(['reg-write']);
    expect(result.signalsByStage[Stage.EX]?.message).toBe('EX 阶段还不对。');
  });

  it('keeps selections in teaching order while toggling', () => {
    let answer = createEmptyPracticeAnswer('lw');

    answer = setPracticeStageSelected(answer, Stage.WB, true);
    answer = setPracticeStageSelected(answer, Stage.IF, true);
    answer = setPracticeStageSelected(answer, Stage.WB, false);
    answer = setPracticeSignalSelected(answer, Stage.EX, 'reg-write', true);
    answer = setPracticeSignalSelected(answer, Stage.EX, 'alu-src-imm', true);

    expect(answer.selectedStages).toEqual([Stage.IF]);
    expect(answer.selectedSignalsByStage[Stage.EX]).toEqual(['alu-src-imm', 'reg-write']);
  });
});
