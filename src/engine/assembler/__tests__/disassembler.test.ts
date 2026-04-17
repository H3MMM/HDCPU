import { describe, expect, it } from 'vitest';
import { Disassembler } from '../disassembler';

describe('Disassembler', () => {
  const disassembler = new Disassembler();

  it('should disassemble representative instruction words', () => {
    const cases = [
      [0x003100B3, 'add x1, x2, x3'],
      [0x40415093, 'srai x1, x2, 4'],
      [0x00414083, 'lbu x1, 4(x2)'],
      [0x00111223, 'sh x1, 4(x2)'],
      [0x0020F463, 'bgeu x1, x2, 8'],
      [0x12345097, 'auipc x1, 74565'],
      [0x004100E7, 'jalr x1, 4(x2)'],
    ] as const;

    for (const [machineCode, expected] of cases) {
      expect(disassembler.disassemble(machineCode)).toBe(expected);
    }
  });
});
