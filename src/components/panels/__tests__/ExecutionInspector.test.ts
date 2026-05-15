import { describe, expect, it } from 'vitest';
import { Stage } from '../../../types';
import { Assembler } from '../../../engine/assembler/encoder';
import { PipelineCPU } from '../../../engine/core/pipeline-cpu';
import { getPipelineCycleEventSummary, getPipelineTimelineStageCell } from '../ExecutionInspector';
import { buildPipelineTextbookTimeline, type PipelineTextbookTimeline } from '../../../view/pipeline-display';

describe('ExecutionInspector pipeline timeline display', () => {
  const assembler = new Assembler();

  const assemble = (source: string): Uint32Array => {
    const result = assembler.assemble(source);
    expect(result.errors).toEqual([]);
    return result.machineCode;
  };

  const runCycles = (cpu: PipelineCPU, count: number) => {
    const history = [cpu.getSnapshot()];
    for (let index = 0; index < count; index++) {
      history.push(cpu.tick());
    }

    return history;
  };

  const getRowLabels = (timeline: PipelineTextbookTimeline, asmString: string): string[] => {
    const row = timeline.rows.find((candidate) => candidate.asmString === asmString);
    expect(row).toBeDefined();
    return row?.cells.filter((cell) => cell.label !== '').map((cell) => cell.label) ?? [];
  };

  const getCellLabel = (
    timeline: PipelineTextbookTimeline,
    asmString: string,
    cycleNumber: number
  ): string => {
    const row = timeline.rows.find((candidate) => candidate.asmString === asmString);
    expect(row).toBeDefined();
    return row?.cells.find((cell) => cell.cycleNumber === cycleNumber)?.label ?? '';
  };

  it('renders a no-forwarding RAW overlap as a stall instead of normal ID', () => {
    const cpu = new PipelineCPU(4096, { forwardingEnabled: false });
    const program = assemble(`
      add x1, x2, x3
      sub x4, x1, x5
      and x6, x1, x7
      or  x8, x1, x9
      xor x10, x1, x11
    `);

    cpu.loadProgram(program);
    cpu.tick();
    const overlap = cpu.tick();

    expect(overlap.pipeline.hazard.type).toBe('none');
    expect(overlap.pipeline.stages.EX.decodedInstruction?.asmString).toBe('add x1, x2, x3');
    expect(overlap.pipeline.stages.ID.decodedInstruction?.asmString).toBe('sub x4, x1, x5');

    const idCell = getPipelineTimelineStageCell(overlap, 'ID');
    expect(idCell.status).toBe('stalled');
    expect(idCell.instruction).toBe('停顿');
    expect(idCell.meta).toContain('sub x4, x1, x5');
    expect(idCell.meta).toContain('x1');
    expect(getPipelineCycleEventSummary(overlap)).toBe('停顿');

    const exCell = getPipelineTimelineStageCell(overlap, 'EX');
    expect(exCell.status).toBe('valid');
    expect(exCell.instruction).toBe('add x1, x2, x3');
  });

  it('shows the consumer ID in the cycle after producer WB is visible, then EX on the next cycle', () => {
    const cpu = new PipelineCPU(4096, { forwardingEnabled: false });
    const program = assemble(`
      add x1, x2, x3
      sub x4, x1, x5
    `);

    cpu.loadProgram(program);
    cpu.tick();
    cpu.tick();
    cpu.tick();
    cpu.tick();
    const released = cpu.tick();

    expect(released.pipeline.hazard.raw?.producer.stage).toBe(Stage.WB);
    expect(getPipelineTimelineStageCell(released, 'ID')).toEqual(
      expect.objectContaining({
        status: 'valid',
        instruction: 'sub x4, x1, x5',
      })
    );
    expect(getPipelineCycleEventSummary(released)).toBe('无');

    const execute = cpu.tick();
    expect(execute.pipeline.hazard.type).toBe('none');
    expect(getPipelineTimelineStageCell(execute, 'EX')).toEqual(
      expect.objectContaining({
        status: 'valid',
        instruction: 'sub x4, x1, x5',
      })
    );
  });

  it('keeps adjacent dependent instructions displayed normally when forwarding is enabled', () => {
    const cpu = new PipelineCPU(4096, { forwardingEnabled: true });
    const program = assemble(`
      add x1, x2, x3
      sub x4, x1, x5
    `);

    cpu.loadProgram(program);
    cpu.tick();
    const overlap = cpu.tick();

    expect(overlap.pipeline.hazard.type).toBe('none');
    expect(getPipelineTimelineStageCell(overlap, 'ID')).toEqual(
      expect.objectContaining({
        status: 'valid',
        instruction: 'sub x4, x1, x5',
      })
    );
    expect(getPipelineCycleEventSummary(overlap)).not.toBe('停顿');
  });

  it('builds the textbook no-forwarding table for the add/sub/and/or/xor RAW example', () => {
    const cpu = new PipelineCPU(4096, { forwardingEnabled: false });
    const program = assemble(`
      add x1, x2, x3
      sub x4, x1, x5
      and x6, x1, x7
      or  x8, x1, x9
      xor x10, x1, x11
    `);

    cpu.loadProgram(program);
    const timeline = buildPipelineTextbookTimeline(runCycles(cpu, 12));

    expect(getRowLabels(timeline, 'add x1, x2, x3')).toEqual(['IF', 'ID', 'EX', '空', 'WB']);
    expect(getRowLabels(timeline, 'sub x4, x1, x5')).toEqual([
      'IF',
      '停顿',
      '停顿',
      '停顿',
      'ID',
      'EX',
      '空',
      'WB',
    ]);
    expect(getRowLabels(timeline, 'and x6, x1, x7')).toEqual([
      'IF',
      '停顿',
      '停顿',
      '停顿',
      'ID',
      'EX',
      '空',
      'WB',
    ]);
    expect(getRowLabels(timeline, 'or x8, x1, x9')).toEqual([
      'IF',
      '停顿',
      '停顿',
      '停顿',
      'ID',
      'EX',
      '空',
      'WB',
    ]);
    expect(getRowLabels(timeline, 'xor x10, x1, x11')).toEqual([
      'IF',
      '停顿',
      '停顿',
      '停顿',
      'ID',
      'EX',
      '空',
      'WB',
    ]);

    expect(getCellLabel(timeline, 'sub x4, x1, x5', 5)).toBe('ID');
    expect(getCellLabel(timeline, 'sub x4, x1, x5', 6)).toBe('EX');
  });
});
