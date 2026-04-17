import { describe, expect, it } from 'vitest';
import { Assembler } from '../encoder';

describe('Assembler integration', () => {
  const assembler = new Assembler();

  it('should assemble the Day3-4 acceptance example', () => {
    const result = assembler.assemble(`
  addi x1, x0, 10
  addi x2, x0, 20
  add x3, x1, x2
`);

    expect(result.errors).toEqual([]);
    expect(Array.from(result.machineCode)).toEqual([
      0x00A00093,
      0x01400113,
      0x002081B3,
    ]);
  });

  it('should keep labels and comments working together in a small program', () => {
    const result = assembler.assemble(`
start: // initialize
  addi x1, x0, 3
  addi x2, x0, 1 # decrement
loop:
  sub x1, x1, x2
  bne x1, x0, loop
  jal x0, start
`);

    expect(result.errors).toEqual([]);
    expect(Array.from(result.machineCode)).toEqual([
      0x00300093,
      0x00100113,
      0x402080B3,
      0xFE009EE3,
      0xFF1FF06F,
    ]);
  });
});
