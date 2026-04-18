import { describe, expect, it } from 'vitest';
import { Assembler } from '../../engine/assembler/encoder';
import {
  DEFAULT_EXAMPLE_PROGRAM,
  EXAMPLE_PROGRAMS,
  getExampleProgramById,
  normalizeExampleSource,
} from '../example-programs';

describe('example programs', () => {
  const assembler = new Assembler();

  it('assembles every bundled example without blocking errors', () => {
    EXAMPLE_PROGRAMS.forEach((program) => {
      const result = assembler.assemble(program.source);
      expect(result.errors, program.id).toEqual([]);
      expect(result.machineCode.length, program.id).toBeGreaterThan(0);
    });
  });

  it('exposes a stable default example and lookup helper', () => {
    expect(DEFAULT_EXAMPLE_PROGRAM.id).toBe(EXAMPLE_PROGRAMS[0]?.id);
    expect(getExampleProgramById(DEFAULT_EXAMPLE_PROGRAM.id)?.title).toBe(DEFAULT_EXAMPLE_PROGRAM.title);
  });

  it('normalizes line endings when matching editor content', () => {
    const source = 'addi x1, x0, 1\r\naddi x2, x0, 2\r\n';
    expect(normalizeExampleSource(source)).toBe('addi x1, x0, 1\naddi x2, x0, 2');
  });
});
