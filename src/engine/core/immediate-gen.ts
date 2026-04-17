import { InstructionFormat } from '../../types';

/**
 * 立即数生成器
 * 根据指令格式提取并符号扩展立即数
 */
export class ImmediateGenerator {
  generate(instruction: number, format: InstructionFormat): number {
    switch (format) {
      case 'I':
        return this.signExtend((instruction >>> 20) & 0xFFF, 12);
      case 'S': {
        const immediate = (((instruction >>> 25) & 0x7F) << 5) | ((instruction >>> 7) & 0x1F);
        return this.signExtend(immediate, 12);
      }
      case 'B': {
        const immediate =
          (((instruction >>> 31) & 0x1) << 12) |
          (((instruction >>> 7) & 0x1) << 11) |
          (((instruction >>> 25) & 0x3F) << 5) |
          (((instruction >>> 8) & 0xF) << 1);
        return this.signExtend(immediate, 13);
      }
      case 'U':
        return instruction & 0xFFFFF000;
      case 'J': {
        const immediate =
          (((instruction >>> 31) & 0x1) << 20) |
          (((instruction >>> 12) & 0xFF) << 12) |
          (((instruction >>> 20) & 0x1) << 11) |
          (((instruction >>> 21) & 0x3FF) << 1);
        return this.signExtend(immediate, 21);
      }
      case 'R':
      default:
        return 0;
    }
  }

  private signExtend(value: number, bits: number): number {
    const shift = 32 - bits;
    return (value << shift) >> shift;
  }
}
