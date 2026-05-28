import { describe, expect, it } from 'vitest';
import { Decoder } from '../../engine/core/decoder';
import { Stage } from '../../types';
import {
  INSTRUCTION_PRACTICE_IDS_BY_CATEGORY,
  PRACTICE_STAGE_ORDER,
  createEmptyPracticeAnswer,
  evaluateInstructionPracticeAnswer,
  getInstructionPracticeItem,
  getPracticeControlValueLabel,
  resolveInstructionPracticeId,
  setPracticeControlValue,
  type InstructionPracticeId,
  setPracticeStageSelected,
} from '../instruction-practice';

function createCorrectAnswer(instructionId: InstructionPracticeId) {
  const item = getInstructionPracticeItem(instructionId);
  let answer = createEmptyPracticeAnswer(instructionId);

  for (const stage of item.stageQuestion.correctStages) {
    answer = setPracticeStageSelected(answer, stage, true);
  }

  for (const question of Object.values(item.controlQuestions)) {
    if (!question) {
      continue;
    }

    for (const control of question.controls) {
      answer = setPracticeControlValue(
        answer,
        question.stage,
        control.name,
        question.correctControls[control.name]
      );
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
      const item = getInstructionPracticeItem(instructionId);
      const result = evaluateInstructionPracticeAnswer(createCorrectAnswer(instructionId));

      expect(result.correct, instructionId).toBe(true);
      for (const question of Object.values(item.controlQuestions)) {
        expect(result.controlsByStage[question.stage]?.correct, `${instructionId} ${question.stage}`).toBe(true);
      }
    }
  });

  it('resolves practice items from decoded instructions', () => {
    const decoder = new Decoder();

    expect(resolveInstructionPracticeId(decoder.decode(0x403100B3))).toBe('sub');
    expect(resolveInstructionPracticeId(decoder.decode(0x40415093))).toBe('srai');
    expect(resolveInstructionPracticeId(decoder.decode(0x00412083))).toBe('lw');
    expect(resolveInstructionPracticeId(decoder.decode(0x00112223))).toBe('sw');
    expect(resolveInstructionPracticeId(decoder.decode(0x00208463))).toBe('beq');
    expect(resolveInstructionPracticeId(decoder.decode(0x123450B7))).toBe('lui');
    expect(resolveInstructionPracticeId(decoder.decode(0x008000EF))).toBe('jal');
  });

  it('uses the expected controls for representative R-type and I-type instructions', () => {
    expect(getInstructionPracticeItem('sub').stageQuestion.correctStages).toEqual([
      Stage.IF,
      Stage.ID,
      Stage.EX,
      Stage.WB,
    ]);
    expect(getInstructionPracticeItem('sub').controlQuestions[Stage.EX]?.correctControls).toMatchObject({
      rs2_imm_s: '0',
      ALU_OP: '0001(SUB)',
      Reg_Write: '0',
    });
    expect(getInstructionPracticeItem('sub').controlQuestions[Stage.WB]?.correctControls).toMatchObject({
      Reg_Write: '1',
      w_data_s: '0',
    });
    expect(getInstructionPracticeItem('srai').controlQuestions[Stage.EX]?.correctControls).toMatchObject({
      rs2_imm_s: '1',
      ALU_OP: '1001(SRA)',
    });
    expect(getInstructionPracticeItem('lw').stageQuestion.correctStages).toEqual(PRACTICE_STAGE_ORDER);
    expect(getInstructionPracticeItem('lw').controlQuestions[Stage.IF]?.correctControls).toMatchObject({
      PC_s: '0',
      PC_Write: '1',
      PC0_Write: '1',
      IR_Write: '1',
      ALU_OP: '0000(ADD)',
    });
    expect(getInstructionPracticeItem('lw').controlQuestions[Stage.MEM]?.correctControls).toMatchObject({
      Mem_Write: '0',
      Size_s: '10',
      SE_s: '0',
    });
    expect(getInstructionPracticeItem('lw').controlQuestions[Stage.WB]?.correctControls).toMatchObject({
      Reg_Write: '1',
      w_data_s: '1',
    });
    expect(getInstructionPracticeItem('jalr').stageQuestion.correctStages).toEqual([
      Stage.IF,
      Stage.ID,
      Stage.EX,
      Stage.WB,
    ]);
    expect(getInstructionPracticeItem('jalr').controlQuestions[Stage.WB]?.correctControls).toMatchObject({
      Reg_Write: '1',
      PC_Write: '1',
      PC_s: '1',
      w_data_s: '2',
    });
    expect(getInstructionPracticeItem('lw').controlQuestions[Stage.IF]?.controls.map((control) => control.name)).toEqual([
      'PC_s',
      'PC_Write',
      'PC0_Write',
      'IR_Write',
      'ALU_OP',
    ]);
    expect(getPracticeControlValueLabel('Size_s', '00')).toBe('00(按字节访问)');
  });

  it('uses the expected controls for S-type and B-type instructions', () => {
    expect(getInstructionPracticeItem('sw').stageQuestion.correctStages).toEqual([
      Stage.IF,
      Stage.ID,
      Stage.EX,
      Stage.MEM,
    ]);
    expect(getInstructionPracticeItem('sw').controlQuestions[Stage.EX]?.correctControls).toMatchObject({
      rs2_imm_s: '1',
      ALU_OP: '0000(ADD)',
      Mem_Write: '0',
    });
    expect(getInstructionPracticeItem('sw').controlQuestions[Stage.MEM]?.correctControls).toMatchObject({
      Mem_Write: '1',
    });
    expect(getInstructionPracticeItem('beq').stageQuestion.correctStages).toEqual([
      Stage.IF,
      Stage.ID,
      Stage.EX,
      Stage.WB,
    ]);
    expect(getInstructionPracticeItem('beq').controlQuestions[Stage.EX]?.correctControls).toMatchObject({
      rs2_imm_s: '0',
      ALU_OP: '0001(SUB)',
    });
    expect(getInstructionPracticeItem('beq').controlQuestions[Stage.WB]?.correctControls).toMatchObject({
      PC_s: '2',
    });
  });

  it('uses the expected controls for U-type and J-type instructions', () => {
    expect(getInstructionPracticeItem('lui').stageQuestion.correctStages).toEqual([
      Stage.IF,
      Stage.EX,
    ]);
    expect(getInstructionPracticeItem('lui').controlQuestions[Stage.EX]?.correctControls).toMatchObject({
      Reg_Write: '1',
      w_data_s: '3',
    });
    expect(getInstructionPracticeItem('auipc').stageQuestion.correctStages).toEqual([
      Stage.IF,
      Stage.EX,
    ]);
    expect(getInstructionPracticeItem('auipc').controlQuestions[Stage.EX]?.correctControls).toMatchObject({
      Reg_Write: '1',
      w_data_s: '4',
    });
    expect(getInstructionPracticeItem('jal').stageQuestion.correctStages).toEqual([
      Stage.IF,
      Stage.EX,
    ]);
    expect(getInstructionPracticeItem('jal').controlQuestions[Stage.EX]?.correctControls).toMatchObject({
      PC_Write: '1',
      PC_s: '2',
      rs2_imm_s: '0',
      ALU_OP: '0000(ADD)',
      Reg_Write: '1',
      w_data_s: '2',
    });
  });

  it('checks the canonical lw practice answer', () => {
    const result = evaluateInstructionPracticeAnswer(createCorrectAnswer('lw'));

    expect(result.correct).toBe(true);
    expect(result.stages.correct).toBe(true);
    expect(result.stages.missing).toEqual([]);
    expect(result.stages.extra).toEqual([]);
    expect(result.controlsByStage[Stage.EX]?.correct).toBe(true);
    expect(result.controlsByStage[Stage.EX]?.message).toBe('EX 阶段控制信号正确。');
    expect(result.controlsByStage[Stage.EX]?.explanation).toContain('EX 阶段');
  });

  it('reports wrong dropdown values for lw', () => {
    let answer = createCorrectAnswer('lw');

    answer = setPracticeControlValue(answer, Stage.EX, 'rs2_imm_s', '0');
    answer = setPracticeControlValue(answer, Stage.EX, 'ALU_OP', '0001(SUB)');

    const result = evaluateInstructionPracticeAnswer(answer);

    expect(result.correct).toBe(false);
    expect(result.stages.correct).toBe(true);
    expect(result.stages.missing).toEqual([]);
    expect(result.controlsByStage[Stage.IF]?.correct).toBe(true);
    expect(result.controlsByStage[Stage.EX]?.mismatches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ control: 'rs2_imm_s', selected: '0', expected: '1' }),
        expect.objectContaining({ control: 'ALU_OP', selected: '0001(SUB)', expected: '0000(ADD)' }),
      ])
    );
    expect(result.controlsByStage[Stage.EX]?.message).toBe('EX 阶段还有控制信号需要调整。');
    expect(
      result.controlsByStage[Stage.EX]?.mismatches.find((mismatch) => mismatch.control === 'rs2_imm_s')?.explanation
    ).toContain('立即数');
  });

  it('keeps stage selections in teaching order while toggling', () => {
    let answer = createEmptyPracticeAnswer('lw');

    answer = setPracticeStageSelected(answer, Stage.WB, true);
    answer = setPracticeStageSelected(answer, Stage.IF, true);
    answer = setPracticeStageSelected(answer, Stage.WB, false);
    answer = setPracticeControlValue(answer, Stage.EX, 'rs2_imm_s', '1');
    answer = setPracticeControlValue(answer, Stage.IF, 'Size_s', '10');

    expect(answer.selectedStages).toEqual([Stage.IF]);
    expect(answer.selectedControlsByStage[Stage.EX]).toEqual({ rs2_imm_s: '1' });
    expect(answer.selectedControlsByStage[Stage.IF]).toEqual({});
  });
});
