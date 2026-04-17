import { describe, expect, it } from 'vitest';
import { Decoder } from '../decoder';

describe('Decoder', () => {
  const decoder = new Decoder();

  it('should decode supported RV32I instructions to canonical assembly', () => {
    const cases = [
      [0x003100B3, 'R', 0, 'add x1, x2, x3'],
      [0x403100B3, 'R', 0, 'sub x1, x2, x3'],
      [0x003170B3, 'R', 0, 'and x1, x2, x3'],
      [0x00411093, 'I', 4, 'slli x1, x2, 4'],
      [0x40415093, 'I', 1028, 'srai x1, x2, 4'],
      [0x00412083, 'I', 4, 'lw x1, 4(x2)'],
      [0x00414083, 'I', 4, 'lbu x1, 4(x2)'],
      [0x004100E7, 'I', 4, 'jalr x1, 4(x2)'],
      [0x00112223, 'S', 4, 'sw x1, 4(x2)'],
      [0x0020F463, 'B', 8, 'bgeu x1, x2, 8'],
      [0x12345137, 'U', 0x12345000, 'lui x2, 74565'],
      [0x12345097, 'U', 0x12345000, 'auipc x1, 74565'],
      [0x008000EF, 'J', 8, 'jal x1, 8'],
    ] as const;

    for (const [machineCode, format, immediate, asmString] of cases) {
      const decoded = decoder.decode(machineCode);

      expect(decoded.format).toBe(format);
      expect(decoded.immediate).toBe(immediate);
      expect(decoded.asmString).toBe(asmString);
    }
  });

  it('should preserve decoded register fields for R-type instructions', () => {
    const decoded = decoder.decode(0x003100B3);

    expect(decoded.rd).toBe(1);
    expect(decoded.rs1).toBe(2);
    expect(decoded.rs2).toBe(3);
  });

  it('should decode negative branch immediates', () => {
    const decoded = decoder.decode(0xFE208EE3);

    expect(decoded.format).toBe('B');
    expect(decoded.immediate).toBe(-4);
    expect(decoded.asmString).toBe('beq x1, x2, -4');
  });

  it('should throw for unsupported opcodes', () => {
    expect(() => decoder.decode(0)).toThrow('Unsupported opcode');
  });
});
