import { describe, expect, it } from 'vitest';
import { Decoder } from '../decoder';

describe('Decoder', () => {
  const decoder = new Decoder();

  it('should decode R-type instructions', () => {
    const decoded = decoder.decode(0x003100B3);

    expect(decoded.format).toBe('R');
    expect(decoded.rd).toBe(1);
    expect(decoded.rs1).toBe(2);
    expect(decoded.rs2).toBe(3);
    expect(decoded.immediate).toBe(0);
    expect(decoded.asmString).toBe('add x1, x2, x3');
  });

  it('should decode I-type load instructions', () => {
    const decoded = decoder.decode(0x00C12083);

    expect(decoded.format).toBe('I');
    expect(decoded.immediate).toBe(12);
    expect(decoded.asmString).toBe('lw x1, 12(x2)');
  });

  it('should decode S-type store instructions', () => {
    const decoded = decoder.decode(0x00112223);

    expect(decoded.format).toBe('S');
    expect(decoded.immediate).toBe(4);
    expect(decoded.asmString).toBe('sw x1, 4(x2)');
  });

  it('should decode B-type branch instructions', () => {
    const decoded = decoder.decode(0xFE208EE3);

    expect(decoded.format).toBe('B');
    expect(decoded.immediate).toBe(-4);
    expect(decoded.asmString).toBe('beq x1, x2, -4');
  });

  it('should decode U-type instructions', () => {
    const decoded = decoder.decode(0x12345137);

    expect(decoded.format).toBe('U');
    expect(decoded.immediate).toBe(0x12345000);
    expect(decoded.asmString).toBe('lui x2, 74565');
  });

  it('should decode J-type instructions', () => {
    const decoded = decoder.decode(0x008000EF);

    expect(decoded.format).toBe('J');
    expect(decoded.immediate).toBe(8);
    expect(decoded.asmString).toBe('jal x1, 8');
  });

  it('should throw for unsupported opcodes', () => {
    expect(() => decoder.decode(0)).toThrow('Unsupported opcode');
  });
});
