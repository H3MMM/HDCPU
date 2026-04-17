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

  // TODO: 为其他操作添加测试
  describe('AND operation', () => {
    // TODO
  });

  describe('OR operation', () => {
    // TODO
  });

  describe('XOR operation', () => {
    // TODO
  });

  describe('SLT operation', () => {
    // TODO
  });

  describe('SLTU operation', () => {
    // TODO
  });

  describe('SLL operation', () => {
    // TODO
  });

  describe('SRL operation', () => {
    // TODO
  });

  describe('SRA operation', () => {
    // TODO
  });
});
