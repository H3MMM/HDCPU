import { describe, expect, it } from 'vitest';
import { Memory } from '../memory';

describe('Memory', () => {
  it('should read and write bytes', () => {
    const memory = new Memory(16);

    memory.writeByte(1, 0xAB);

    expect(memory.readByte(1)).toBe(0xAB);
  });

  it('should read and write halfwords in little-endian order', () => {
    const memory = new Memory(16);

    memory.writeHalfWord(2, 0x1234);

    expect(memory.readByte(2)).toBe(0x34);
    expect(memory.readByte(3)).toBe(0x12);
    expect(memory.readHalfWord(2)).toBe(0x1234);
  });

  it('should read and write words in little-endian order', () => {
    const memory = new Memory(16);

    memory.writeWord(4, 0x12345678);

    expect(memory.readByte(4)).toBe(0x78);
    expect(memory.readByte(5)).toBe(0x56);
    expect(memory.readByte(6)).toBe(0x34);
    expect(memory.readByte(7)).toBe(0x12);
    expect(memory.readWord(4)).toBe(0x12345678);
  });

  it('should reject unaligned halfword access', () => {
    const memory = new Memory(16);

    expect(() => memory.readHalfWord(1)).toThrow('Unaligned halfword address');
    expect(() => memory.writeHalfWord(3, 0x1234)).toThrow('Unaligned halfword address');
  });

  it('should reject unaligned word access', () => {
    const memory = new Memory(16);

    expect(() => memory.readWord(2)).toThrow('Unaligned word address');
    expect(() => memory.writeWord(6, 0x12345678)).toThrow('Unaligned word address');
  });

  it('should reject out-of-bounds multi-byte access', () => {
    const memory = new Memory(8);

    expect(() => memory.readWord(6)).toThrow('Memory access out of bounds');
    expect(() => memory.writeHalfWord(7, 0x1234)).toThrow('Memory access out of bounds');
  });
});
