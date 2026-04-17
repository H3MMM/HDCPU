import { describe, it, expect } from 'vitest';
import { ALU } from '../alu';
import { ALUOp } from '../../../types';

describe('ALU', () => {
  const alu = new ALU();

  describe('ADD operation', () => {
    it('should add two positive numbers', () => {
      const result = alu.execute(5, 3, ALUOp.ADD);
      expect(result.result).toBe(8);
      expect(result.zero).toBe(false);
    });

    it('should handle zero result', () => {
      const result = alu.execute(5, -5, ALUOp.ADD);
      expect(result.result).toBe(0);
      expect(result.zero).toBe(true);
    });

    // TODO: 添加更多测试用例
  });

  describe('SUB operation', () => {
    it('should subtract two numbers', () => {
      const result = alu.execute(10, 3, ALUOp.SUB);
      expect(result.result).toBe(7);
      expect(result.zero).toBe(false);
    });

    // TODO: 添加更多测试用例
  });

  describe('AND operation', () => {
    it('should perform bitwise AND', () => {
      const result = alu.execute(0b1100, 0b1010, ALUOp.AND);
      expect(result.result).toBe(0b1000);
      expect(result.zero).toBe(false);
    });

    it('should return zero when no bits match', () => {
      const result = alu.execute(0b1100, 0b0011, ALUOp.AND);
      expect(result.result).toBe(0);
      expect(result.zero).toBe(true);
    });
  });

  describe('OR operation', () => {
    it('should perform bitwise OR', () => {
      const result = alu.execute(0b1100, 0b1010, ALUOp.OR);
      expect(result.result).toBe(0b1110);
      expect(result.zero).toBe(false);
    });
  });

  describe('XOR operation', () => {
    it('should perform bitwise XOR', () => {
      const result = alu.execute(0b1100, 0b1010, ALUOp.XOR);
      expect(result.result).toBe(0b0110);
      expect(result.zero).toBe(false);
    });

    it('should return zero for identical inputs', () => {
      const result = alu.execute(42, 42, ALUOp.XOR);
      expect(result.result).toBe(0);
      expect(result.zero).toBe(true);
    });
  });

  describe('SLT operation', () => {
    it('should return 1 when a < b (signed)', () => {
      const result = alu.execute(-5, 3, ALUOp.SLT);
      expect(result.result).toBe(1);
    });

    it('should return 0 when a >= b (signed)', () => {
      const result = alu.execute(5, 3, ALUOp.SLT);
      expect(result.result).toBe(0);
    });

    it('should handle negative numbers correctly', () => {
      const result = alu.execute(-10, -5, ALUOp.SLT);
      expect(result.result).toBe(1);
    });
  });

  describe('SLTU operation', () => {
    it('should return 1 when a < b (unsigned)', () => {
      const result = alu.execute(5, 10, ALUOp.SLTU);
      expect(result.result).toBe(1);
    });

    it('should treat negative as large unsigned', () => {
      const result = alu.execute(-1, 1, ALUOp.SLTU);
      expect(result.result).toBe(0);
    });
  });

  describe('SLL operation', () => {
    it('should shift left logically', () => {
      const result = alu.execute(0b0001, 2, ALUOp.SLL);
      expect(result.result).toBe(0b0100);
    });

    it('should use only lower 5 bits of shift amount', () => {
      const result = alu.execute(1, 33, ALUOp.SLL);
      expect(result.result).toBe(2);
    });
  });

  describe('SRL operation', () => {
    it('should shift right logically', () => {
      const result = alu.execute(0b1000, 2, ALUOp.SRL);
      expect(result.result).toBe(0b0010);
    });

    it('should fill with zeros', () => {
      const result = alu.execute(-8, 1, ALUOp.SRL);
      expect(result.result).toBe(0x7FFFFFFC);
    });
  });

  describe('SRA operation', () => {
    it('should shift right arithmetically', () => {
      const result = alu.execute(0b1000, 2, ALUOp.SRA);
      expect(result.result).toBe(0b0010);
    });

    it('should preserve sign bit', () => {
      const result = alu.execute(-8, 1, ALUOp.SRA);
      expect(result.result).toBe(-4);
    });
  });

  describe('PASS_B operation', () => {
    it('should pass through B value', () => {
      const result = alu.execute(100, 42, ALUOp.PASS_B);
      expect(result.result).toBe(42);
    });
  });
});
