import { ALUOp } from '../../types';

/**
 * ALU 模块
 * 执行算术和逻辑运算
 */
export class ALU {
  /**
   * 执行 ALU 运算
   * @param a 输入 A (32-bit)
   * @param b 输入 B (32-bit)
   * @param op 操作类型
   * @returns { result: 运算结果, zero: 零标志 }
   */
  execute(a: number, b: number, op: ALUOp): { result: number; zero: boolean } {
    let result = 0;

    switch (op) {
      case ALUOp.ADD:
        result = (a + b) | 0;
        break;
      case ALUOp.SUB:
        result = (a - b) | 0;
        break;
      case ALUOp.AND:
        result = a & b;
        break;
      case ALUOp.OR:
        result = a | b;
        break;
      case ALUOp.XOR:
        result = a ^ b;
        break;
      case ALUOp.SLT:
        result = (a | 0) < (b | 0) ? 1 : 0;
        break;
      case ALUOp.SLTU:
        result = (a >>> 0) < (b >>> 0) ? 1 : 0;
        break;
      case ALUOp.SLL:
        result = (a << (b & 0x1F)) | 0;
        break;
      case ALUOp.SRL:
        result = (a >>> (b & 0x1F)) | 0;
        break;
      case ALUOp.SRA:
        result = (a >> (b & 0x1F)) | 0;
        break;
      case ALUOp.PASS_B:
        result = b;
        break;
      default:
        throw new Error(`Unknown ALU operation: ${op}`);
    }

    // 确保结果是 32 位有符号整数
    result = result | 0;

    return {
      result,
      zero: result === 0,
    };
  }
}
