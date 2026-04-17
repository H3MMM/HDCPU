import { DecodedInstruction, InstructionFormat } from '../../types';
import { ImmediateGenerator } from './immediate-gen';

/**
 * 指令解码器
 * 将 32 位机器码解码为结构化指令
 */
export class Decoder {
  private readonly immediateGenerator = new ImmediateGenerator();

  /**
   * 解码指令
   * @param instruction 32 位机器码
   * @returns 解码后的指令
   */
  decode(instruction: number): DecodedInstruction {
    const opcode = instruction & 0x7F;
    const rd = (instruction >> 7) & 0x1F;
    const funct3 = (instruction >> 12) & 0x7;
    const rs1 = (instruction >> 15) & 0x1F;
    const rs2 = (instruction >> 20) & 0x1F;
    const funct7 = (instruction >> 25) & 0x7F;
    const format = this.getInstructionFormat(opcode);
    const immediate = this.extractImmediate(instruction, format);
    const asmString = this.generateASM(instruction, format, opcode, rd, rs1, rs2, funct3, funct7, immediate);
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
    switch (opcode) {
      case 0x33:
        return 'R';
      case 0x03:
      case 0x13:
      case 0x67:
        return 'I';
      case 0x23:
        return 'S';
      case 0x63:
        return 'B';
      case 0x17:
      case 0x37:
        return 'U';
      case 0x6F:
        return 'J';
      default:
        throw new Error(`Unsupported opcode: 0x${opcode.toString(16).padStart(2, '0')}`);
    }
  }

  private extractImmediate(instruction: number, format: InstructionFormat): number {
    return this.immediateGenerator.generate(instruction, format);
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
    switch (opcode) {
      case 0x33:
        return this.generateRTypeASM(rd, rs1, rs2, funct3, funct7);
      case 0x13:
        return this.generateITypeALUASM(rd, rs1, funct3, funct7, immediate);
      case 0x03:
        return this.generateLoadASM(rd, rs1, funct3, immediate);
      case 0x23:
        return this.generateStoreASM(rs1, rs2, funct3, immediate);
      case 0x63:
        return this.generateBranchASM(rs1, rs2, funct3, immediate);
      case 0x37:
        return `lui x${rd}, ${immediate >> 12}`;
      case 0x17:
        return `auipc x${rd}, ${immediate >> 12}`;
      case 0x6F:
        return `jal x${rd}, ${immediate}`;
      case 0x67:
        return funct3 === 0 ? `jalr x${rd}, ${immediate}(x${rs1})` : 'unknown';
      default:
        return `unknown(0x${instruction.toString(16).padStart(8, '0')})`;
    }
  }

  private generateDescription(asmString: string): string {
    return `Execute ${asmString}`;
  }

  private generateRTypeASM(rd: number, rs1: number, rs2: number, funct3: number, funct7: number): string {
    if (funct3 === 0x0 && funct7 === 0x00) {
      return `add x${rd}, x${rs1}, x${rs2}`;
    }
    if (funct3 === 0x0 && funct7 === 0x20) {
      return `sub x${rd}, x${rs1}, x${rs2}`;
    }
    if (funct3 === 0x1 && funct7 === 0x00) {
      return `sll x${rd}, x${rs1}, x${rs2}`;
    }
    if (funct3 === 0x2 && funct7 === 0x00) {
      return `slt x${rd}, x${rs1}, x${rs2}`;
    }
    if (funct3 === 0x3 && funct7 === 0x00) {
      return `sltu x${rd}, x${rs1}, x${rs2}`;
    }
    if (funct3 === 0x4 && funct7 === 0x00) {
      return `xor x${rd}, x${rs1}, x${rs2}`;
    }
    if (funct3 === 0x5 && funct7 === 0x00) {
      return `srl x${rd}, x${rs1}, x${rs2}`;
    }
    if (funct3 === 0x5 && funct7 === 0x20) {
      return `sra x${rd}, x${rs1}, x${rs2}`;
    }
    if (funct3 === 0x6 && funct7 === 0x00) {
      return `or x${rd}, x${rs1}, x${rs2}`;
    }
    if (funct3 === 0x7 && funct7 === 0x00) {
      return `and x${rd}, x${rs1}, x${rs2}`;
    }
    return 'unknown';
  }

  private generateITypeALUASM(
    rd: number,
    rs1: number,
    funct3: number,
    funct7: number,
    immediate: number
  ): string {
    if (funct3 === 0x0) {
      return `addi x${rd}, x${rs1}, ${immediate}`;
    }
    if (funct3 === 0x2) {
      return `slti x${rd}, x${rs1}, ${immediate}`;
    }
    if (funct3 === 0x3) {
      return `sltiu x${rd}, x${rs1}, ${immediate}`;
    }
    if (funct3 === 0x4) {
      return `xori x${rd}, x${rs1}, ${immediate}`;
    }
    if (funct3 === 0x6) {
      return `ori x${rd}, x${rs1}, ${immediate}`;
    }
    if (funct3 === 0x7) {
      return `andi x${rd}, x${rs1}, ${immediate}`;
    }
    if (funct3 === 0x1 && funct7 === 0x00) {
      return `slli x${rd}, x${rs1}, ${immediate & 0x1F}`;
    }
    if (funct3 === 0x5 && funct7 === 0x00) {
      return `srli x${rd}, x${rs1}, ${immediate & 0x1F}`;
    }
    if (funct3 === 0x5 && funct7 === 0x20) {
      return `srai x${rd}, x${rs1}, ${immediate & 0x1F}`;
    }
    return 'unknown';
  }

  private generateLoadASM(rd: number, rs1: number, funct3: number, immediate: number): string {
    const mnemonic =
      funct3 === 0x0 ? 'lb'
      : funct3 === 0x1 ? 'lh'
      : funct3 === 0x2 ? 'lw'
      : funct3 === 0x4 ? 'lbu'
      : funct3 === 0x5 ? 'lhu'
      : null;

    return mnemonic ? `${mnemonic} x${rd}, ${immediate}(x${rs1})` : 'unknown';
  }

  private generateStoreASM(rs1: number, rs2: number, funct3: number, immediate: number): string {
    const mnemonic =
      funct3 === 0x0 ? 'sb'
      : funct3 === 0x1 ? 'sh'
      : funct3 === 0x2 ? 'sw'
      : null;

    return mnemonic ? `${mnemonic} x${rs2}, ${immediate}(x${rs1})` : 'unknown';
  }

  private generateBranchASM(rs1: number, rs2: number, funct3: number, immediate: number): string {
    const mnemonic =
      funct3 === 0x0 ? 'beq'
      : funct3 === 0x1 ? 'bne'
      : funct3 === 0x4 ? 'blt'
      : funct3 === 0x5 ? 'bge'
      : funct3 === 0x6 ? 'bltu'
      : funct3 === 0x7 ? 'bgeu'
      : null;

    return mnemonic ? `${mnemonic} x${rs1}, x${rs2}, ${immediate}` : 'unknown';
  }
}
