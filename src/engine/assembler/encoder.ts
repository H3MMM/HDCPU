import { AssembleError, IAssembler } from '../../types';
import { AssemblerSyntaxError, Lexer } from './lexer';
import { Disassembler } from './disassembler';
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
        pc += this.safeGetInstructionWordCount(statement.instruction) * 4;
      }
    }

    const words: number[] = [];
    pc = 0;

    for (const statement of program.statements) {
      if (!statement.instruction) {
        continue;
      }

      const wordCount = this.safeGetInstructionWordCount(statement.instruction);

      try {
        const expandedInstructions = this.expandInstruction(statement.instruction, pc, labels);

        for (const expandedInstruction of expandedInstructions) {
          words.push(this.encodeInstruction(expandedInstruction, pc, labels) >>> 0);
          pc += 4;
        }
      } catch (error) {
        for (let i = 0; i < wordCount; i++) {
          words.push(0);
        }
        errors.push(this.toAssembleError(error, statement.instruction.line, statement.instruction.column));
        pc += wordCount * 4;
      }
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

    throw this.createLineError(`Unsupported instruction: ${mnemonic}`, instruction.line, instruction.column);
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
    const immediate = this.expectUImmediate(immOperand);

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

  private safeGetInstructionWordCount(instruction: InstructionNode): number {
    try {
      return this.getInstructionWordCount(instruction);
    } catch {
      return 1;
    }
  }

  private getInstructionWordCount(instruction: InstructionNode): number {
    if (instruction.mnemonic === 'li') {
      const [, immediateOperand] = this.expectOperandCount(instruction, 2);
      if (this.canEncodeWithSingleImmediateInstruction(immediateOperand)) {
        return 1;
      }

      const normalizedImmediate = this.normalize32BitImmediate(immediateOperand);
      const { lower } = this.splitImmediate(normalizedImmediate);
      return lower === 0 ? 1 : 2;
    }

    if (instruction.mnemonic === 'la') {
      return 2;
    }

    return 1;
  }

  private expandInstruction(
    instruction: InstructionNode,
    pc: number,
    labels: Map<string, number>
  ): InstructionNode[] {
    switch (instruction.mnemonic) {
      case 'li':
        return this.expandLi(instruction);
      case 'la':
        return this.expandLa(instruction, labels);
      case 'mv':
        return this.expandMv(instruction);
      case 'nop':
        return this.expandNop(instruction);
      case 'j':
        return this.expandJumpAlias(instruction);
      case 'ret':
        return this.expandRet(instruction);
      case 'call':
        return this.expandCall(instruction);
      case 'beqz':
        return this.expandZeroBranch(instruction, 'beq');
      case 'bnez':
        return this.expandZeroBranch(instruction, 'bne');
      case 'bgt':
        return this.expandReversedBranch(instruction, 'blt');
      case 'ble':
        return this.expandReversedBranch(instruction, 'bge');
      default:
        return [instruction];
    }
  }

  private expectOperandCount(instruction: InstructionNode, count: number): Operand[] {
    if (instruction.operands.length !== count) {
      throw this.createLineError(
        `Instruction ${instruction.mnemonic} expects ${count} operands`,
        instruction.line,
        instruction.column
      );
    }
    return instruction.operands;
  }

  private expectRegister(operand: Operand, role: string): number {
    if (operand.type !== 'register') {
      throw this.createLineError(`Expected ${role} register`, operand.line, operand.column);
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
      throw this.createLineError('Expected immediate operand', operand.line, operand.column);
    }

    if (signed) {
      this.assertSignedImmediate(operand.value, bits, operand.line, operand.column);
    } else {
      this.assertUnsignedImmediate(operand.value, bits, operand.line, operand.column);
    }

    return operand.value;
  }

  private expectUImmediate(operand: Operand): number {
    if (operand.type !== 'immediate') {
      throw this.createLineError('Expected immediate operand', operand.line, operand.column);
    }

    if (operand.value < -(2 ** 19) || operand.value > 0xFFFFF) {
      throw this.createLineError(`Immediate out of range for 20-bit U-type field: ${operand.value}`, operand.line, operand.column);
    }

    return operand.value;
  }

  private expectMemory(operand: Operand): MemoryOperand {
    if (operand.type !== 'memory') {
      throw this.createLineError('Expected memory operand', operand.line, operand.column);
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

    throw this.createLineError('Expected label or immediate operand', operand.line, operand.column);
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

  private expandLi(instruction: InstructionNode): InstructionNode[] {
    const [rdOperand, immediateOperand] = this.expectOperandCount(instruction, 2);
    const rd = this.expectRegisterOperand(rdOperand, 'rd');
    const normalizedImmediate = this.normalize32BitImmediate(immediateOperand);

    if (normalizedImmediate >= -2048 && normalizedImmediate <= 2047) {
      return [this.createInstruction(instruction, 'addi', [
        rd,
        this.createRegisterOperand('x0', instruction.line, instruction.column),
        this.createImmediateOperand(normalizedImmediate, immediateOperand.line, immediateOperand.column),
      ])];
    }

    const { upper, lower } = this.splitImmediate(normalizedImmediate);
    const expanded = [
      this.createInstruction(instruction, 'lui', [
        rd,
        this.createImmediateOperand(upper, immediateOperand.line, immediateOperand.column),
      ]),
    ];

    if (lower !== 0) {
      expanded.push(this.createInstruction(instruction, 'addi', [
        rd,
        rd,
        this.createImmediateOperand(lower, immediateOperand.line, immediateOperand.column),
      ]));
    }

    return expanded;
  }

  private expandLa(instruction: InstructionNode, labels: Map<string, number>): InstructionNode[] {
    const [rdOperand, labelOperand] = this.expectOperandCount(instruction, 2);
    const rd = this.expectRegisterOperand(rdOperand, 'rd');

    if (labelOperand.type !== 'label') {
      throw this.createLineError('Expected label operand', labelOperand.line, labelOperand.column);
    }

    const address = labels.get(labelOperand.name);
    if (address === undefined) {
      throw this.createLineError(`Undefined label: ${labelOperand.name}`, labelOperand.line, labelOperand.column);
    }

    const normalizedAddress = this.normalize32BitImmediate(
      this.createImmediateOperand(address, labelOperand.line, labelOperand.column)
    );
    const { upper, lower } = this.splitImmediate(normalizedAddress);

    return [
      this.createInstruction(instruction, 'lui', [
        rd,
        this.createImmediateOperand(upper, labelOperand.line, labelOperand.column),
      ]),
      this.createInstruction(instruction, 'addi', [
        rd,
        rd,
        this.createImmediateOperand(lower, labelOperand.line, labelOperand.column),
      ]),
    ];
  }

  private expandMv(instruction: InstructionNode): InstructionNode[] {
    const [rdOperand, rsOperand] = this.expectOperandCount(instruction, 2);
    const rd = this.expectRegisterOperand(rdOperand, 'rd');
    const rs = this.expectRegisterOperand(rsOperand, 'rs');

    return [this.createInstruction(instruction, 'addi', [
      rd,
      rs,
      this.createImmediateOperand(0, instruction.line, instruction.column),
    ])];
  }

  private expandNop(instruction: InstructionNode): InstructionNode[] {
    this.expectOperandCount(instruction, 0);

    return [this.createInstruction(instruction, 'addi', [
      this.createRegisterOperand('x0', instruction.line, instruction.column),
      this.createRegisterOperand('x0', instruction.line, instruction.column),
      this.createImmediateOperand(0, instruction.line, instruction.column),
    ])];
  }

  private expandJumpAlias(instruction: InstructionNode): InstructionNode[] {
    const [targetOperand] = this.expectOperandCount(instruction, 1);

    return [this.createInstruction(instruction, 'jal', [
      this.createRegisterOperand('x0', instruction.line, instruction.column),
      targetOperand,
    ])];
  }

  private expandRet(instruction: InstructionNode): InstructionNode[] {
    this.expectOperandCount(instruction, 0);

    return [this.createInstruction(instruction, 'jalr', [
      this.createRegisterOperand('x0', instruction.line, instruction.column),
      this.createMemoryOperand(0, 'x1', instruction.line, instruction.column),
    ])];
  }

  private expandCall(instruction: InstructionNode): InstructionNode[] {
    const [targetOperand] = this.expectOperandCount(instruction, 1);

    return [this.createInstruction(instruction, 'jal', [
      this.createRegisterOperand('x1', instruction.line, instruction.column),
      targetOperand,
    ])];
  }

  private expandZeroBranch(instruction: InstructionNode, mnemonic: 'beq' | 'bne'): InstructionNode[] {
    const [rsOperand, targetOperand] = this.expectOperandCount(instruction, 2);
    const rs = this.expectRegisterOperand(rsOperand, 'rs');

    return [this.createInstruction(instruction, mnemonic, [
      rs,
      this.createRegisterOperand('x0', instruction.line, instruction.column),
      targetOperand,
    ])];
  }

  private expandReversedBranch(instruction: InstructionNode, mnemonic: 'blt' | 'bge'): InstructionNode[] {
    const [rs1Operand, rs2Operand, targetOperand] = this.expectOperandCount(instruction, 3);
    const rs1 = this.expectRegisterOperand(rs1Operand, 'rs1');
    const rs2 = this.expectRegisterOperand(rs2Operand, 'rs2');

    return [this.createInstruction(instruction, mnemonic, [
      rs2,
      rs1,
      targetOperand,
    ])];
  }

  private expectRegisterOperand(operand: Operand, role: string): Operand {
    this.expectRegister(operand, role);
    return operand;
  }

  private canEncodeWithSingleImmediateInstruction(operand: Operand): boolean {
    if (operand.type !== 'immediate') {
      return true;
    }

    if (!this.isRepresentableAs32Bit(operand.value)) {
      return false;
    }

    const normalizedValue = operand.value | 0;
    return normalizedValue >= -2048 && normalizedValue <= 2047;
  }

  private normalize32BitImmediate(operand: Operand): number {
    if (operand.type !== 'immediate') {
      throw this.createLineError('Expected immediate operand', operand.line, operand.column);
    }

    if (!this.isRepresentableAs32Bit(operand.value)) {
      throw this.createLineError(`Immediate out of range for 32-bit pseudo instruction: ${operand.value}`, operand.line, operand.column);
    }

    return operand.value | 0;
  }

  private isRepresentableAs32Bit(value: number): boolean {
    return Number.isInteger(value) && value >= -0x80000000 && value <= 0xFFFFFFFF;
  }

  private splitImmediate(value: number): { upper: number; lower: number } {
    const upper = (value + 0x800) >> 12;
    const lower = value - (upper << 12);
    return { upper, lower };
  }

  private createInstruction(
    originalInstruction: InstructionNode,
    mnemonic: string,
    operands: Operand[]
  ): InstructionNode {
    return {
      mnemonic,
      operands,
      line: originalInstruction.line,
      column: originalInstruction.column,
    };
  }

  private createRegisterOperand(name: string, line: number, column: number): Operand {
    return {
      type: 'register',
      name,
      line,
      column,
    };
  }

  private createImmediateOperand(value: number, line: number, column: number): Operand {
    return {
      type: 'immediate',
      value,
      line,
      column,
    };
  }

  private createMemoryOperand(offset: number, base: string, line: number, column: number): Operand {
    return {
      type: 'memory',
      offset,
      base,
      line,
      column,
    };
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
  private readonly disassembler = new Disassembler();

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
      return this.disassembler.disassemble(machineCode);
    } catch {
      return 'unknown';
    }
  }
}
