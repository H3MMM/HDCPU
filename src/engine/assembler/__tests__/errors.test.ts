import { describe, expect, it } from 'vitest';
import { Assembler } from '../encoder';

describe('Assembler errors', () => {
  const assembler = new Assembler();

  it('should report undefined labels with line and column', () => {
    const result = assembler.assemble('beq x1, x2, missing');

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      line: 1,
      column: 13,
      severity: 'error',
    });
    expect(result.errors[0].message).toContain('Undefined label: missing');
  });

  it('should report invalid registers with line and column', () => {
    const result = assembler.assemble('add x32, x1, x2');

    expect(result.machineCode).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      line: 1,
      column: 5,
      severity: 'error',
    });
    expect(result.errors[0].message).toContain('Invalid register: x32');
  });

  it('should report immediates that are out of range', () => {
    const result = assembler.assemble('addi x1, x2, 4096');

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      line: 1,
      column: 14,
      severity: 'error',
    });
    expect(result.errors[0].message).toContain('Immediate out of range');
  });

  it('should report syntax errors with line and column', () => {
    const result = assembler.assemble('add x1 x2, x3');

    expect(result.machineCode).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      line: 1,
      column: 8,
      severity: 'error',
    });
    expect(result.errors[0].message).toContain('Expected end of line');
  });

  it('should report duplicate labels', () => {
    const result = assembler.assemble(`
loop:
loop:
  addi x1, x0, 1
`);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      line: 3,
      column: 1,
      severity: 'error',
    });
    expect(result.errors[0].message).toContain('Duplicate label: loop');
  });

  it('should report pseudo immediates that do not fit in 32 bits', () => {
    const result = assembler.assemble('li x1, 0x100000000');

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      line: 1,
      column: 8,
      severity: 'error',
    });
    expect(result.errors[0].message).toContain('32-bit pseudo instruction');
  });

  it('should report non-label operands passed to la', () => {
    const result = assembler.assemble('la x1, 1');

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      line: 1,
      column: 8,
      severity: 'error',
    });
    expect(result.errors[0].message).toContain('Expected label operand');
  });
});
