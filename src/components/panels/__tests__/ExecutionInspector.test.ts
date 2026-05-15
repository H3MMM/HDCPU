import { describe, expect, it } from 'vitest';
import { Stage } from '../../../types';
import { Assembler } from '../../../engine/assembler/encoder';
import { PipelineCPU } from '../../../engine/core/pipeline-cpu';
import { getPipelineCycleEventSummary, getPipelineTimelineStageCell } from '../ExecutionInspector';

describe('ExecutionInspector pipeline timeline display', () => {
  const assembler = new Assembler();

  const assemble = (source: string): Uint32Array => {
    const result = assembler.assemble(source);
    expect(result.errors).toEqual([]);
    return result.machineCode;
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

  it('keeps showing the held consumer as stalled through the producer WB cycle', () => {
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
    const wbWait = cpu.tick();

    expect(wbWait.pipeline.hazard.raw?.producer.stage).toBe(Stage.WB);
    expect(getPipelineTimelineStageCell(wbWait, 'ID')).toEqual(
      expect.objectContaining({
        status: 'stalled',
        instruction: '停顿',
      })
    );

    const released = cpu.tick();
    expect(released.pipeline.hazard.type).toBe('none');
    expect(getPipelineTimelineStageCell(released, 'EX')).toEqual(
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
});
