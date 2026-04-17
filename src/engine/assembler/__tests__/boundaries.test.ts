import { describe, expect, it } from 'vitest';
import { Assembler } from '../encoder';

describe('Assembler boundary cases', () => {
  const assembler = new Assembler();

  it('should accept the full unsigned U-type immediate field', () => {
    const result = assembler.assemble('lui x5, 0xFFFFF');

    expect(result.errors).toEqual([]);
    expect(Array.from(result.machineCode)).toEqual([0xFFFFF2B7]);
    expect(assembler.disassemble(result.machineCode[0])).toBe('lui x5, -1');
  });

  it('should load the smallest signed 32-bit constant through li', () => {
    const result = assembler.assemble('li x5, -2147483648');

    expect(result.errors).toEqual([]);
    expect(Array.from(result.machineCode).map((word) => assembler.disassemble(word))).toEqual([
      'lui x5, -524288',
    ]);
  });

  it('should keep label addresses correct when earlier li expands to one instruction', () => {
    const result = assembler.assemble(`
  li x5, 4096
  j target
target:
  nop
`);

    expect(result.errors).toEqual([]);
    expect(Array.from(result.machineCode).map((word) => assembler.disassemble(word))).toEqual([
      'lui x5, 1',
      'jal x0, 4',
      'addi x0, x0, 0',
    ]);
  });
});
