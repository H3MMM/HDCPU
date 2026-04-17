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

    // TODO: 实现各种 ALU 操作
    switch (op) {
      case ALUOp.ADD:
        // TODO: 实现加法
        break;
      case ALUOp.SUB:
        // TODO: 实现减法
        break;
      case ALUOp.AND:
        // TODO: 实现按位与
        break;
      case ALUOp.OR:
        // TODO: 实现按位或
        break;
      case ALUOp.XOR:
        // TODO: 实现按位异或
        break;
      case ALUOp.SLT:
        // TODO: 实现有符号比较
        break;
      case ALUOp.SLTU:
        // TODO: 实现无符号比较
        break;
      case ALUOp.SLL:
        // TODO: 实现逻辑左移
        break;
      case ALUOp.SRL:
        // TODO: 实现逻辑右移
        break;
      case ALUOp.SRA:
        // TODO: 实现算术右移
        break;
      case ALUOp.PASS_B:
        // TODO: 直通 B
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
