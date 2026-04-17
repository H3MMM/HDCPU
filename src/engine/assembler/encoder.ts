import { AssembleError, IAssembler } from '../../types';
import { Decoder } from '../core/decoder';
import { AssemblerSyntaxError, Lexer } from './lexer';
import { InstructionNode, LabelOperand, MemoryOperand, Operand, Parser, ProgramNode } from './parser';

interface EncodingResult {
  machineCode: Uint32Array;
  errors: AssembleError[];
}

interface RTypeEncoding {
  funct3: number;
  funct7: number;
}

interface ITypeEncoding {
  funct3: number;
}

/**
 * 汇编编码器
 */
export class Encoder {
  private static readonly R_TYPE: Record<string, RTypeEncoding> = {
    add: { funct3: 0x0, funct7: 0x00 },
    sub: { funct3: 0x0, funct7: 0x20 },
    sll: { funct3: 0x1, funct7: 0x00 },
    slt: { funct3: 0x2, funct7: 0x00 },
    sltu: { funct3: 0x3, funct7: 0x00 },
    xor: { funct3: 0x4, funct7: 0x00 },
    srl: { funct3: 0x5, funct7: 0x00 },
    sra: { funct3: 0x5, funct7: 0x20 },
    or: { funct3: 0x6, funct7: 0x00 },
    and: { funct3: 0x7, funct7: 0x00 },
  };

  private static readonly I_TYPE_ALU: Record<string, ITypeEncoding> = {
    addi: { funct3: 0x0 },
    slti: { funct3: 0x2 },
    sltiu: { funct3: 0x3 },
    xori: { funct3: 0x4 },
    ori: { funct3: 0x6 },
    andi: { funct3: 0x7 },
  };

  private static readonly LOADS: Record<string, ITypeEncoding> = {
    lb: { funct3: 0x0 },
    lh: { funct3: 0x1 },
    lw: { funct3: 0x2 },
    lbu: { funct3: 0x4 },
    lhu: { funct3: 0x5 },
  };

  private static readonly STORES: Record<string, ITypeEncoding> = {
    sb: { funct3: 0x0 },
    sh: { funct3: 0x1 },
    sw: { funct3: 0x2 },
  };

  private static readonly BRANCHES: Record<string, ITypeEncoding> = {
    beq: { funct3: 0x0 },
    bne: { funct3: 0x1 },
    blt: { funct3: 0x4 },
    bge: { funct3: 0x5 },
    bltu: { funct3: 0x6 },
    bgeu: { funct3: 0x7 },
  };

  encode(program: ProgramNode): EncodingResult {
    const errors: AssembleError[] = [];
    const labels = new Map<string, number>();
    let pc = 0;

    for (const statement of program.statements) {
      for (const label of statement.labels) {
        if (labels.has(label.name)) {
          errors.push({
            line: label.line,
            column: label.column,
            message: `Duplicate label: ${label.name}`,
            severity: 'error',
          });
          continue;
        }
        labels.set(label.name, pc);
      }

      if (statement.instruction) {
        pc += 4;
      }
    }

    const words: number[] = [];
    pc = 0;

    for (const statement of program.statements) {
      if (!statement.instruction) {
        continue;
      }

      try {
        words.push(this.encodeInstruction(statement.instruction, pc, labels) >>> 0);
      } catch (error) {
        words.push(0);
        errors.push(this.toAssembleError(error, statement.instruction.line, statement.instruction.column));
      }

      pc += 4;
    }

    return {
      machineCode: new Uint32Array(words),
      errors,
    };
  }

  private encodeInstruction(
    instruction: InstructionNode,
    pc: number,
    labels: Map<string, number>
  ): number {
    const { mnemonic } = instruction;

    if (mnemonic in Encoder.R_TYPE) {
      return this.encodeRType(instruction, Encoder.R_TYPE[mnemonic]);
    }

    if (mnemonic in Encoder.I_TYPE_ALU) {
      return this.encodeITypeALU(instruction, Encoder.I_TYPE_ALU[mnemonic]);
    }

    if (mnemonic === 'slli' || mnemonic === 'srli' || mnemonic === 'srai') {
      return this.encodeShiftImmediate(instruction, mnemonic);
    }

    if (mnemonic in Encoder.LOADS) {
      return this.encodeLoad(instruction, Encoder.LOADS[mnemonic]);
    }

    if (mnemonic === 'jalr') {
      return this.encodeJalr(instruction);
    }

    if (mnemonic in Encoder.STORES) {
      return this.encodeStore(instruction, Encoder.STORES[mnemonic]);
    }

    if (mnemonic in Encoder.BRANCHES) {
      return this.encodeBranch(instruction, pc, labels, Encoder.BRANCHES[mnemonic]);
    }

    if (mnemonic === 'lui' || mnemonic === 'auipc') {
      return this.encodeUType(instruction, mnemonic === 'lui' ? 0x37 : 0x17);
    }

    if (mnemonic === 'jal') {
      return this.encodeJal(instruction, pc, labels);
    }

    throw new Error(`Unsupported instruction: ${mnemonic}`);
  }

  private encodeRType(instruction: InstructionNode, encoding: RTypeEncoding): number {
    const [rdOperand, rs1Operand, rs2Operand] = this.expectOperandCount(instruction, 3);
    const rd = this.expectRegister(rdOperand, 'rd');
    const rs1 = this.expectRegister(rs1Operand, 'rs1');
    const rs2 = this.expectRegister(rs2Operand, 'rs2');

    return (
      (encoding.funct7 << 25) |
      (rs2 << 20) |
      (rs1 << 15) |
      (encoding.funct3 << 12) |
      (rd << 7) |
      0x33
    ) | 0;
  }

  private encodeITypeALU(instruction: InstructionNode, encoding: ITypeEncoding): number {
    const [rdOperand, rs1Operand, immOperand] = this.expectOperandCount(instruction, 3);
    const rd = this.expectRegister(rdOperand, 'rd');
    const rs1 = this.expectRegister(rs1Operand, 'rs1');
    const immediate = this.expectImmediate(immOperand, 12);

    return this.encodeIImmediate(immediate, rs1, encoding.funct3, rd, 0x13);
  }

  private encodeShiftImmediate(instruction: InstructionNode, mnemonic: string): number {
    const [rdOperand, rs1Operand, shamtOperand] = this.expectOperandCount(instruction, 3);
    const rd = this.expectRegister(rdOperand, 'rd');
    const rs1 = this.expectRegister(rs1Operand, 'rs1');
    const shamt = this.expectImmediate(shamtOperand, 5, false);

    const funct7 = mnemonic === 'srai' ? 0x20 : 0x00;
    const funct3 = mnemonic === 'slli' ? 0x1 : 0x5;
    const immediate = (funct7 << 5) | shamt;

    return this.encodeIImmediate(immediate, rs1, funct3, rd, 0x13);
  }

  private encodeLoad(instruction: InstructionNode, encoding: ITypeEncoding): number {
    const [rdOperand, memoryOperand] = this.expectOperandCount(instruction, 2);
    const rd = this.expectRegister(rdOperand, 'rd');
    const memory = this.expectMemory(memoryOperand);
    const rs1 = this.parseRegister(memory.base, memory.line, memory.column);
    this.assertSignedImmediate(memory.offset, 12, memory.line, memory.column);

    return this.encodeIImmediate(memory.offset, rs1, encoding.funct3, rd, 0x03);
  }

  private encodeJalr(instruction: InstructionNode): number {
    const [rdOperand, memoryOperand] = this.expectOperandCount(instruction, 2);
    const rd = this.expectRegister(rdOperand, 'rd');
    const memory = this.expectMemory(memoryOperand);
    const rs1 = this.parseRegister(memory.base, memory.line, memory.column);
    this.assertSignedImmediate(memory.offset, 12, memory.line, memory.column);

    return this.encodeIImmediate(memory.offset, rs1, 0x0, rd, 0x67);
  }

  private encodeStore(instruction: InstructionNode, encoding: ITypeEncoding): number {
    const [rs2Operand, memoryOperand] = this.expectOperandCount(instruction, 2);
    const rs2 = this.expectRegister(rs2Operand, 'rs2');
    const memory = this.expectMemory(memoryOperand);
    const rs1 = this.parseRegister(memory.base, memory.line, memory.column);
    this.assertSignedImmediate(memory.offset, 12, memory.line, memory.column);
    const immediate = memory.offset & 0xFFF;

    return (
      (((immediate >>> 5) & 0x7F) << 25) |
      (rs2 << 20) |
      (rs1 << 15) |
      (encoding.funct3 << 12) |
      ((immediate & 0x1F) << 7) |
      0x23
    ) | 0;
  }

  private encodeBranch(
    instruction: InstructionNode,
    pc: number,
    labels: Map<string, number>,
    encoding: ITypeEncoding
  ): number {
    const [rs1Operand, rs2Operand, targetOperand] = this.expectOperandCount(instruction, 3);
    const rs1 = this.expectRegister(rs1Operand, 'rs1');
    const rs2 = this.expectRegister(rs2Operand, 'rs2');
    const offset = this.resolveBranchOffset(targetOperand, pc, labels);
    const immediate = offset & 0x1FFF;

    return (
      (((immediate >>> 12) & 0x1) << 31) |
      (((immediate >>> 5) & 0x3F) << 25) |
      (rs2 << 20) |
      (rs1 << 15) |
      (encoding.funct3 << 12) |
      (((immediate >>> 1) & 0xF) << 8) |
      (((immediate >>> 11) & 0x1) << 7) |
      0x63
    ) | 0;
  }

  private encodeUType(instruction: InstructionNode, opcode: number): number {
    const [rdOperand, immOperand] = this.expectOperandCount(instruction, 2);
    const rd = this.expectRegister(rdOperand, 'rd');
    const immediate = this.expectImmediate(immOperand, 20);

    return (((immediate & 0xFFFFF) << 12) | (rd << 7) | opcode) | 0;
  }

  private encodeJal(
    instruction: InstructionNode,
    pc: number,
    labels: Map<string, number>
  ): number {
    const [rdOperand, targetOperand] = this.expectOperandCount(instruction, 2);
    const rd = this.expectRegister(rdOperand, 'rd');
    const offset = this.resolveJumpOffset(targetOperand, pc, labels);
    const immediate = offset & 0x1FFFFF;

    return (
      (((immediate >>> 20) & 0x1) << 31) |
      (((immediate >>> 1) & 0x3FF) << 21) |
      (((immediate >>> 11) & 0x1) << 20) |
      (((immediate >>> 12) & 0xFF) << 12) |
      (rd << 7) |
      0x6F
    ) | 0;
  }

  private encodeIImmediate(immediate: number, rs1: number, funct3: number, rd: number, opcode: number): number {
    return (((immediate & 0xFFF) << 20) | (rs1 << 15) | (funct3 << 12) | (rd << 7) | opcode) | 0;
  }

  private expectOperandCount(instruction: InstructionNode, count: number): Operand[] {
    if (instruction.operands.length !== count) {
      throw new Error(`Instruction ${instruction.mnemonic} expects ${count} operands`);
    }
    return instruction.operands;
  }

  private expectRegister(operand: Operand, role: string): number {
    if (operand.type !== 'register') {
      throw new Error(`Expected ${role} register`);
    }
    return this.parseRegister(operand.name, operand.line, operand.column);
  }

  private parseRegister(name: string, line: number, column: number): number {
    const match = /^x(\d{1,2})$/i.exec(name);
    const index = match ? Number(match[1]) : Number.NaN;

    if (!match || index < 0 || index > 31) {
      throw this.createLineError(`Invalid register: ${name}`, line, column);
    }

    return index;
  }

  private expectImmediate(operand: Operand, bits: number, signed: boolean = true): number {
    if (operand.type !== 'immediate') {
      throw new Error('Expected immediate operand');
    }

    if (signed) {
      this.assertSignedImmediate(operand.value, bits, operand.line, operand.column);
    } else {
      this.assertUnsignedImmediate(operand.value, bits, operand.line, operand.column);
    }

    return operand.value;
  }

  private expectMemory(operand: Operand): MemoryOperand {
    if (operand.type !== 'memory') {
      throw new Error('Expected memory operand');
    }
    return operand;
  }

  private resolveBranchOffset(operand: Operand, pc: number, labels: Map<string, number>): number {
    const value = this.resolveOffset(operand, pc, labels);
    if (value % 2 !== 0) {
      throw this.createLineError('Branch target must be 2-byte aligned', operand.line, operand.column);
    }
    this.assertSignedImmediate(value, 13, operand.line, operand.column);
    return value;
  }

  private resolveJumpOffset(operand: Operand, pc: number, labels: Map<string, number>): number {
    const value = this.resolveOffset(operand, pc, labels);
    if (value % 2 !== 0) {
      throw this.createLineError('Jump target must be 2-byte aligned', operand.line, operand.column);
    }
    this.assertSignedImmediate(value, 21, operand.line, operand.column);
    return value;
  }

  private resolveOffset(operand: Operand, pc: number, labels: Map<string, number>): number {
    if (operand.type === 'immediate') {
      return operand.value;
    }

    if (operand.type === 'label') {
      return this.resolveLabel(operand, pc, labels);
    }

    throw new Error('Expected label or immediate operand');
  }

  private resolveLabel(operand: LabelOperand, pc: number, labels: Map<string, number>): number {
    const target = labels.get(operand.name);
    if (target === undefined) {
      throw this.createLineError(`Undefined label: ${operand.name}`, operand.line, operand.column);
    }
    return target - pc;
  }

  private assertSignedImmediate(value: number, bits: number, line: number, column: number): void {
    const min = -(2 ** (bits - 1));
    const max = (2 ** (bits - 1)) - 1;

    if (value < min || value > max) {
      throw this.createLineError(`Immediate out of range for ${bits}-bit signed field: ${value}`, line, column);
    }
  }

  private assertUnsignedImmediate(value: number, bits: number, line: number, column: number): void {
    const max = (2 ** bits) - 1;
    if (value < 0 || value > max) {
      throw this.createLineError(`Immediate out of range for ${bits}-bit unsigned field: ${value}`, line, column);
    }
  }

  private createLineError(message: string, line: number, column: number): Error {
    return Object.assign(new Error(message), { line, column });
  }

  private toAssembleError(error: unknown, line: number, column: number): AssembleError {
    if (error && typeof error === 'object' && 'message' in error) {
      const maybeLine = 'line' in error && typeof error.line === 'number' ? error.line : line;
      const maybeColumn = 'column' in error && typeof error.column === 'number' ? error.column : column;
      return {
        line: maybeLine,
        column: maybeColumn,
        message: String(error.message),
        severity: 'error',
      };
    }

    return {
      line,
      column,
      message: 'Unknown assembly error',
      severity: 'error',
    };
  }
}

/**
 * 汇编器门面
 */
export class Assembler implements IAssembler {
  private readonly lexer = new Lexer();
  private readonly parser = new Parser();
  private readonly encoder = new Encoder();
  private readonly decoder = new Decoder();

  assemble(source: string): EncodingResult {
    try {
      const tokens = this.lexer.tokenize(source);
      const program = this.parser.parse(tokens);
      return this.encoder.encode(program);
    } catch (error) {
      if (error instanceof AssemblerSyntaxError) {
        return {
          machineCode: new Uint32Array(),
          errors: [{
            line: error.line,
            column: error.column,
            message: error.message,
            severity: 'error',
          }],
        };
      }

      return {
        machineCode: new Uint32Array(),
        errors: [{
          line: 1,
          column: 1,
          message: error instanceof Error ? error.message : 'Unknown assembly error',
          severity: 'error',
        }],
      };
    }
  }

  disassemble(machineCode: number): string {
    try {
      return this.decoder.decode(machineCode).asmString;
    } catch {
      return 'unknown';
    }
  }
}
