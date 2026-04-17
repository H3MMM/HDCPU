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

  it('should reset all stored data back to zero', () => {
    const memory = new Memory(16);

    memory.writeWord(0, 0x12345678);
    memory.reset();

    expect(memory.readWord(0)).toBe(0);
  });

  it('should load raw bytes at an offset', () => {
    const memory = new Memory(16);

    memory.load(new Uint8Array([0xAA, 0xBB, 0xCC]), 4);

    expect(memory.readByte(4)).toBe(0xAA);
    expect(memory.readByte(5)).toBe(0xBB);
    expect(memory.readByte(6)).toBe(0xCC);
  });

  it('should reject out-of-bounds load operations', () => {
    const memory = new Memory(8);

    expect(() => memory.load(new Uint8Array([1, 2, 3]), 6)).toThrow('Memory access out of bounds');
  });
});
