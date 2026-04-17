/**
 * 寄存器堆
 * 32 个 32 位寄存器，x0 恒为 0
 */
export class RegisterFile {
  private registers: Int32Array;

  constructor() {
    this.registers = new Int32Array(32);
  }

  /**
   * 读取寄存器
   * @param index 寄存器编号 (0-31)
   * @returns 寄存器值
   */
  read(index: number): number {
    if (index < 0 || index > 31) {
      throw new Error(`Invalid register index: ${index}`);
    }
    return this.registers[index];
  }

  /**
   * 写入寄存器
   * @param index 寄存器编号 (0-31)
   * @param value 要写入的值
   */
  write(index: number, value: number): void {
    if (index < 0 || index > 31) {
      throw new Error(`Invalid register index: ${index}`);
    }
    // x0 恒为 0，不可写入
    if (index === 0) {
      return;
    }
    this.registers[index] = value | 0; // 确保是 32 位有符号整数
  }

  /**
   * 获取所有寄存器的副本
   */
  getAll(): number[] {
    return Array.from(this.registers);
  }

  /**
   * 重置所有寄存器
   */
  reset(): void {
    this.registers.fill(0);
  }
}
