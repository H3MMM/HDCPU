import { DecodedInstruction, InstructionFormat, ImmType } from '../../types';

/**
 * 指令解码器
 * 将 32 位机器码解码为结构化指令
 */
export class Decoder {
  /**
   * 解码指令
   * @param instruction 32 位机器码
   * @returns 解码后的指令
   */
  decode(instruction: number): DecodedInstruction {
    // 提取各个字段
    const opcode = instruction & 0x7F;
    const rd = (instruction >> 7) & 0x1F;
    const funct3 = (instruction >> 12) & 0x7;
    const rs1 = (instruction >> 15) & 0x1F;
    const rs2 = (instruction >> 20) & 0x1F;
    const funct7 = (instruction >> 25) & 0x7F;

    // TODO: 根据 opcode 确定指令格式
    const format = this.getInstructionFormat(opcode);

    // TODO: 提取并符号扩展立即数
    const immediate = this.extractImmediate(instruction, format);

    // TODO: 生成汇编字符串
    const asmString = this.generateASM(instruction, format, opcode, rd, rs1, rs2, funct3, funct7, immediate);

    // TODO: 生成描述
    const description = this.generateDescription(asmString);

    return {
      raw: instruction,
      format,
      opcode,
      rd,
      funct3,
      rs1,
      rs2,
      funct7,
      immediate,
      asmString,
      description,
    };
  }

  private getInstructionFormat(opcode: number): InstructionFormat {
    // TODO: 根据 opcode 返回指令格式
    // 参考 RISC-V 指令编码表
    throw new Error('Not implemented');
  }

  private extractImmediate(instruction: number, format: InstructionFormat): number {
    // TODO: 根据格式提取立即数
    switch (format) {
      case 'I':
        // I 型: imm[11:0] = inst[31:20]
        return this.signExtend((instruction >> 20) & 0xFFF, 12);
      case 'S':
        // S 型: imm[11:0] = {inst[31:25], inst[11:7]}
        // TODO
        return 0;
      case 'B':
        // B 型: imm[12:1] = {inst[31], inst[7], inst[30:25], inst[11:8]}
        // TODO
        return 0;
      case 'U':
        // U 型: imm[31:12] = inst[31:12]
        // TODO
        return 0;
      case 'J':
        // J 型: imm[20:1] = {inst[31], inst[19:12], inst[20], inst[30:21]}
        // TODO
        return 0;
      case 'R':
        return 0; // R 型没有立即数
      default:
        return 0;
    }
  }

  private signExtend(value: number, bits: number): number {
    // TODO: 符号扩展
    const sign = (value >> (bits - 1)) & 1;
    if (sign) {
      return value | (~0 << bits);
    }
    return value;
  }

  private generateASM(
    instruction: number,
    format: InstructionFormat,
    opcode: number,
    rd: number,
    rs1: number,
    rs2: number,
    funct3: number,
    funct7: number,
    immediate: number
  ): string {
    // TODO: 根据指令生成汇编字符串
    return 'unknown';
  }

  private generateDescription(asmString: string): string {
    // TODO: 生成人类可读的描述
    return `Execute ${asmString}`;
  }
}
