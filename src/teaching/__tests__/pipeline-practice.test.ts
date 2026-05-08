import { describe, expect, it } from 'vitest';
import { Assembler } from '../../engine/assembler/encoder';
import { PipelineCPU } from '../../engine/core/pipeline-cpu';
import type { CycleSnapshot } from '../../types';
import {
  PIPELINE_PRACTICE_BOOLEAN_SIGNALS,
  PIPELINE_PRACTICE_FORWARDING_SIGNALS,
  createEmptyPipelinePracticeAnswer,
  createPipelinePracticeQuestion,
  evaluatePipelinePracticeAnswer,
  setPipelinePracticeBooleanSignal,
  setPipelinePracticeForwardingSignal,
} from '../pipeline-practice';

describe('pipeline practice', () => {
  const assembler = new Assembler();

  const assemble = (source: string): Uint32Array => {
    const result = assembler.assemble(source);
    expect(result.errors).toEqual([]);
    return result.machineCode;
  };

  const createCorrectAnswer = (snapshot: CycleSnapshot) => {
    const question = createPipelinePracticeQuestion(snapshot);
    expect(question).not.toBeNull();
    if (!question) {
      throw new Error('Expected a pipeline practice question');
    }

    let answer = createEmptyPipelinePracticeAnswer(snapshot);
    for (const signal of PIPELINE_PRACTICE_BOOLEAN_SIGNALS) {
      answer = setPipelinePracticeBooleanSignal(answer, signal.name, question.expected.booleans[signal.name]);
    }

    for (const signal of PIPELINE_PRACTICE_FORWARDING_SIGNALS) {
      answer = setPipelinePracticeForwardingSignal(answer, signal.name, question.expected.forwarding[signal.name]);
    }

    return answer;
  };

  it('derives RAW stall signals when forwarding is disabled', () => {
    const cpu = new PipelineCPU();
    cpu.loadProgram(assemble(`
      addi x1, x0, 5
      add  x2, x1, x1
    `));

    cpu.tick();
    cpu.tick();
    const snapshot = cpu.tick();
    const question = createPipelinePracticeQuestion(snapshot);

    expect(question?.expected.booleans).toMatchObject({
      PCWrite: false,
      'IF/IDWrite': false,
      'IF/IDFlush': false,
      'ID/EXFlush': true,
      InsertBubble: true,
    });
    expect(question?.expected.forwarding).toEqual({
      ForwardA: 'none',
      ForwardB: 'none',
      StoreForward: 'none',
    });
    expect(evaluatePipelinePracticeAnswer(createCorrectAnswer(snapshot), snapshot)?.correct).toBe(true);
  });

  it('derives ForwardA and ForwardB for ALU RAW forwarding', () => {
    const cpu = new PipelineCPU(4096, { forwardingEnabled: true });
    cpu.loadProgram(assemble(`
      addi x1, x0, 5
      add  x2, x1, x1
    `));

    cpu.tick();
    cpu.tick();
    cpu.tick();
    const snapshot = cpu.tick();
    const question = createPipelinePracticeQuestion(snapshot);

    expect(question?.expected.booleans).toMatchObject({
      PCWrite: true,
      'IF/IDWrite': true,
      'IF/IDFlush': false,
      'ID/EXFlush': false,
      InsertBubble: false,
    });
    expect(question?.expected.forwarding).toEqual({
      ForwardA: 'exMem',
      ForwardB: 'exMem',
      StoreForward: 'none',
    });
  });

  it('derives StoreForward for store write-data dependencies', () => {
    const cpu = new PipelineCPU(4096, { forwardingEnabled: true });
    cpu.loadProgram(assemble(`
      addi x1, x0, 99
      sw   x1, 64(x0)
    `));

    cpu.tick();
    cpu.tick();
    cpu.tick();
    const snapshot = cpu.tick();
    const question = createPipelinePracticeQuestion(snapshot);

    expect(question?.expected.forwarding).toEqual({
      ForwardA: 'none',
      ForwardB: 'none',
      StoreForward: 'exMem',
    });
    expect(question?.expected.booleans.InsertBubble).toBe(false);
  });

  it('derives control flush signals when a taken branch resolves', () => {
    const cpu = new PipelineCPU();
    cpu.loadProgram(assemble(`
      beq  x0, x0, target
      addi x1, x0, 1
      target:
      addi x2, x0, 2
    `));

    cpu.tick();
    cpu.tick();
    const snapshot = cpu.tick();
    const question = createPipelinePracticeQuestion(snapshot);

    expect(question?.expected.booleans).toMatchObject({
      PCWrite: true,
      'IF/IDWrite': true,
      'IF/IDFlush': true,
      'ID/EXFlush': true,
      InsertBubble: false,
    });
    expect(question?.expected.forwarding).toEqual({
      ForwardA: 'none',
      ForwardB: 'none',
      StoreForward: 'none',
    });
  });

  it('does not create a question on cycles without pipeline conflicts', () => {
    const cpu = new PipelineCPU();
    cpu.loadProgram(assemble('addi x1, x0, 5'));

    const snapshot = cpu.tick();

    expect(createPipelinePracticeQuestion(snapshot)).toBeNull();
    expect(evaluatePipelinePracticeAnswer(createEmptyPipelinePracticeAnswer(snapshot), snapshot)).toBeNull();
  });
});
