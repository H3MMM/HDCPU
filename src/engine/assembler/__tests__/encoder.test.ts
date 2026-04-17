import { describe, expect, it } from 'vitest';
import { Assembler } from '../encoder';

describe('Assembler', () => {
  const assembler = new Assembler();

  it('should assemble an R-type instruction', () => {
    const result = assembler.assemble('add x1, x2, x3');

    expect(result.errors).toEqual([]);
    expect(Array.from(result.machineCode)).toEqual([0x003100B3]);
  });

  it('should assemble representative RV32I instructions and labels', () => {
    const result = assembler.assemble(`
loop:
  addi x1, x0, 1
  beq x1, x0, loop
  sw x1, 4(x2)
  lui x2, 0x12345
  jal x0, 8
`);

    expect(result.errors).toEqual([]);
    expect(Array.from(result.machineCode)).toEqual([
      0x00100093,
      0xFE008EE3,
      0x00112223,
      0x12345137,
      0x0080006F,
    ]);
  });

  it('should disassemble machine code through the decoder', () => {
    expect(assembler.disassemble(0x003100B3)).toBe('add x1, x2, x3');
  });

  it('should report invalid registers', () => {
    const result = assembler.assemble('add x32, x1, x2');

    expect(result.machineCode).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('Invalid register');
  });
});
