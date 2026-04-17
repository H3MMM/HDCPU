import { describe, expect, it } from 'vitest';
import { Assembler } from '../encoder';

describe('Assembler', () => {
  const assembler = new Assembler();

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

  it('should encode all supported RV32I instruction forms', () => {
    const cases = [
      ['add x1, x2, x3', 0x003100B3, 'add x1, x2, x3'],
      ['sub x1, x2, x3', 0x403100B3, 'sub x1, x2, x3'],
      ['and x1, x2, x3', 0x003170B3, 'and x1, x2, x3'],
      ['or x1, x2, x3', 0x003160B3, 'or x1, x2, x3'],
      ['xor x1, x2, x3', 0x003140B3, 'xor x1, x2, x3'],
      ['sll x1, x2, x3', 0x003110B3, 'sll x1, x2, x3'],
      ['srl x1, x2, x3', 0x003150B3, 'srl x1, x2, x3'],
      ['sra x1, x2, x3', 0x403150B3, 'sra x1, x2, x3'],
      ['slt x1, x2, x3', 0x003120B3, 'slt x1, x2, x3'],
      ['sltu x1, x2, x3', 0x003130B3, 'sltu x1, x2, x3'],
      ['addi x1, x2, 10', 0x00A10093, 'addi x1, x2, 10'],
      ['andi x1, x2, -1', 0xFFF17093, 'andi x1, x2, -1'],
      ['ori x1, x2, 15', 0x00F16093, 'ori x1, x2, 15'],
      ['xori x1, x2, 15', 0x00F14093, 'xori x1, x2, 15'],
      ['slti x1, x2, -8', 0xFF812093, 'slti x1, x2, -8'],
      ['sltiu x1, x2, 7', 0x00713093, 'sltiu x1, x2, 7'],
      ['slli x1, x2, 4', 0x00411093, 'slli x1, x2, 4'],
      ['srli x1, x2, 4', 0x00415093, 'srli x1, x2, 4'],
      ['srai x1, x2, 4', 0x40415093, 'srai x1, x2, 4'],
      ['lb x1, 4(x2)', 0x00410083, 'lb x1, 4(x2)'],
      ['lh x1, 4(x2)', 0x00411083, 'lh x1, 4(x2)'],
      ['lw x1, 4(x2)', 0x00412083, 'lw x1, 4(x2)'],
      ['lbu x1, 4(x2)', 0x00414083, 'lbu x1, 4(x2)'],
      ['lhu x1, 4(x2)', 0x00415083, 'lhu x1, 4(x2)'],
      ['jalr x1, 4(x2)', 0x004100E7, 'jalr x1, 4(x2)'],
      ['sb x1, 4(x2)', 0x00110223, 'sb x1, 4(x2)'],
      ['sh x1, 4(x2)', 0x00111223, 'sh x1, 4(x2)'],
      ['sw x1, 4(x2)', 0x00112223, 'sw x1, 4(x2)'],
      ['beq x1, x2, 8', 0x00208463, 'beq x1, x2, 8'],
      ['bne x1, x2, 8', 0x00209463, 'bne x1, x2, 8'],
      ['blt x1, x2, 8', 0x0020C463, 'blt x1, x2, 8'],
      ['bge x1, x2, 8', 0x0020D463, 'bge x1, x2, 8'],
      ['bltu x1, x2, 8', 0x0020E463, 'bltu x1, x2, 8'],
      ['bgeu x1, x2, 8', 0x0020F463, 'bgeu x1, x2, 8'],
      ['lui x1, 0x12345', 0x123450B7, 'lui x1, 74565'],
      ['auipc x1, 0x12345', 0x12345097, 'auipc x1, 74565'],
      ['jal x1, 8', 0x008000EF, 'jal x1, 8'],
    ] as const;

    for (const [source, expectedMachineCode, expectedASM] of cases) {
      const result = assembler.assemble(source);

      expect(result.errors, source).toEqual([]);
      expect(Array.from(result.machineCode), source).toEqual([expectedMachineCode]);
      expect(assembler.disassemble(expectedMachineCode), source).toBe(expectedASM);
    }
  });
});
