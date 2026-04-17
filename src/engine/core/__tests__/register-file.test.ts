import { describe, it, expect, beforeEach } from 'vitest';
import { RegisterFile } from '../register-file';

describe('RegisterFile', () => {
  let rf: RegisterFile;

  beforeEach(() => {
    rf = new RegisterFile();
  });

  describe('x0 register', () => {
    it('should always read 0', () => {
      expect(rf.read(0)).toBe(0);
    });

    it('should not allow writing to x0', () => {
      rf.write(0, 42);
      expect(rf.read(0)).toBe(0);
    });
  });

  describe('read operation', () => {
    it('should read initial value as 0', () => {
      expect(rf.read(1)).toBe(0);
      expect(rf.read(31)).toBe(0);
    });

    it('should throw error for invalid index', () => {
      expect(() => rf.read(-1)).toThrow('Invalid register index');
      expect(() => rf.read(32)).toThrow('Invalid register index');
    });
  });

  describe('write operation', () => {
    it('should write and read back value', () => {
      rf.write(1, 42);
      expect(rf.read(1)).toBe(42);
    });

    it('should write negative values', () => {
      rf.write(2, -100);
      expect(rf.read(2)).toBe(-100);
    });

    it('should handle 32-bit signed integers', () => {
      rf.write(3, 0x7FFFFFFF);
      expect(rf.read(3)).toBe(0x7FFFFFFF);

      rf.write(4, -2147483648);
      expect(rf.read(4)).toBe(-2147483648);
    });

    it('should throw error for invalid index', () => {
      expect(() => rf.write(-1, 42)).toThrow('Invalid register index');
      expect(() => rf.write(32, 42)).toThrow('Invalid register index');
    });

    it('should overwrite previous value', () => {
      rf.write(5, 100);
      rf.write(5, 200);
      expect(rf.read(5)).toBe(200);
    });
  });

  describe('getAll operation', () => {
    it('should return all 32 registers', () => {
      const all = rf.getAll();
      expect(all.length).toBe(32);
    });

    it('should return a copy, not reference', () => {
      const all1 = rf.getAll();
      rf.write(1, 42);
      expect(all1[1]).toBe(0);

      const all2 = rf.getAll();
      expect(all2[1]).toBe(42);
    });

    it('should reflect written values', () => {
      rf.write(10, 123);
      rf.write(20, 456);
      const all = rf.getAll();
      expect(all[10]).toBe(123);
      expect(all[20]).toBe(456);
    });
  });

  describe('reset operation', () => {
    it('should reset all registers to 0', () => {
      rf.write(1, 100);
      rf.write(2, 200);
      rf.write(31, 300);

      rf.reset();

      expect(rf.read(1)).toBe(0);
      expect(rf.read(2)).toBe(0);
      expect(rf.read(31)).toBe(0);
    });

    it('should keep x0 as 0', () => {
      rf.reset();
      expect(rf.read(0)).toBe(0);
    });
  });

  describe('boundary cases', () => {
    it('should handle all register indices', () => {
      for (let i = 1; i < 32; i++) {
        rf.write(i, i * 10);
        expect(rf.read(i)).toBe(i * 10);
      }
    });

    it('should handle maximum positive value', () => {
      rf.write(15, 2147483647);
      expect(rf.read(15)).toBe(2147483647);
    });

    it('should handle maximum negative value', () => {
      rf.write(16, -2147483648);
      expect(rf.read(16)).toBe(-2147483648);
    });
  });
});
