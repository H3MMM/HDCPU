import { describe, expect, it } from 'vitest';
import { Assembler } from '../encoder';

describe('Assembler pseudo instructions', () => {
  const assembler = new Assembler();

  it('should expand common single-instruction pseudos into canonical RV32I instructions', () => {
    const result = assembler.assemble(`
  mv x5, x6
  nop
  j 8
  ret
  call 8
  beqz x5, 8
  bnez x5, 8
  bgt x1, x2, 8
  ble x1, x2, 8
`);

    expect(result.errors).toEqual([]);
    expect(Array.from(result.machineCode).map((word) => assembler.disassemble(word))).toEqual([
      'addi x5, x6, 0',
      'addi x0, x0, 0',
      'jal x0, 8',
      'jalr x0, 0(x1)',
      'jal x1, 8',
      'beq x5, x0, 8',
      'bne x5, x0, 8',
      'blt x2, x1, 8',
      'bge x2, x1, 8',
    ]);
  });

  it('should expand li into one or two instructions depending on the immediate', () => {
    const result = assembler.assemble(`
  li x5, 123
  li x5, 2048
  li x5, 4096
  li x5, 0xFFFFFFFF
`);

    expect(result.errors).toEqual([]);
    expect(Array.from(result.machineCode).map((word) => assembler.disassemble(word))).toEqual([
      'addi x5, x0, 123',
      'lui x5, 1',
      'addi x5, x5, -2048',
      'lui x5, 1',
      'addi x5, x0, -1',
    ]);
  });

  it('should expand la using resolved label addresses', () => {
    const result = assembler.assemble(`
  la x5, target
  nop
target:
  nop
`);

    expect(result.errors).toEqual([]);
    expect(Array.from(result.machineCode).map((word) => assembler.disassemble(word))).toEqual([
      'lui x5, 0',
      'addi x5, x5, 12',
      'addi x0, x0, 0',
      'addi x0, x0, 0',
    ]);
  });
});
