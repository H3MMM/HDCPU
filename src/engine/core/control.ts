import { ALUOp, ControlSignals, DecodedInstruction, ImmType, Stage } from '../../types';

type InstructionClass = 'R' | 'I' | 'LOAD' | 'STORE' | 'BRANCH' | 'JAL' | 'JALR' | 'LUI' | 'AUIPC';

/**
 * 多周期控制单元
 * 根据当前阶段和指令类型给出控制信号与下一阶段
 */
export class ControlUnit {
  private currentStage: Stage = Stage.IF;

  reset(): void {
    this.currentStage = Stage.IF;
  }

  getCurrentStage(): Stage {
    return this.currentStage;
  }

  setCurrentStage(stage: Stage): void {
    this.currentStage = stage;
  }

  getCurrentSignals(instruction: DecodedInstruction | null = null): ControlSignals {
    return this.getControlSignals(this.currentStage, instruction);
  }

  advance(instruction: DecodedInstruction | null = null): Stage {
    this.currentStage = this.getNextStage(this.currentStage, instruction);
    return this.currentStage;
  }

  getControlSignals(stage: Stage, instruction: DecodedInstruction | null = null): ControlSignals {
    const signals = this.createDefaultSignals();

    switch (stage) {
      case Stage.IF:
        signals.PCWrite = true;
        signals.MemRead = true;
        signals.IRWrite = true;
        signals.ALUSrcB = 1;
        signals.ALUOp = ALUOp.ADD;
        return signals;
      case Stage.ID:
        signals.ALUSrcB = 2;
        signals.ALUOp = ALUOp.ADD;
        signals.ImmSrc = instruction ? this.getImmediateType(instruction) : ImmType.NONE;
        return signals;
      case Stage.EX:
        return this.getExecuteSignals(this.requireInstruction(stage, instruction), signals);
      case Stage.MEM:
        return this.getMemorySignals(this.requireInstruction(stage, instruction), signals);
      case Stage.WB:
        return this.getWriteBackSignals(this.requireInstruction(stage, instruction), signals);
      default:
        return signals;
    }
  }

  getNextStage(stage: Stage, instruction: DecodedInstruction | null = null): Stage {
    switch (stage) {
      case Stage.IF:
        if (!instruction) {
          return Stage.ID;
        }
        switch (this.getInstructionClass(instruction)) {
          case 'LUI':
          case 'AUIPC':
          case 'JAL':
            return Stage.EX;
          default:
            return Stage.ID;
        }
      case Stage.ID:
        return Stage.EX;
      case Stage.EX: {
        const instructionClass = this.getInstructionClass(this.requireInstruction(stage, instruction));
        if (instructionClass === 'LOAD' || instructionClass === 'STORE' || instructionClass === 'BRANCH') {
          return Stage.MEM;
        }
        if (instructionClass === 'R' || instructionClass === 'I' || instructionClass === 'JALR') {
          return Stage.WB;
        }
        return Stage.IF;
      }
      case Stage.MEM:
        return this.getInstructionClass(this.requireInstruction(stage, instruction)) === 'LOAD'
          ? Stage.WB
          : Stage.IF;
      case Stage.WB:
      default:
        return Stage.IF;
    }
  }

  private getExecuteSignals(instruction: DecodedInstruction, signals: ControlSignals): ControlSignals {
    const instructionClass = this.getInstructionClass(instruction);
    signals.ImmSrc = this.getImmediateType(instruction);

    switch (instructionClass) {
      case 'R':
        signals.ALUSrcA = 1;
        signals.ALUSrcB = 0;
        signals.ALUOp = this.getALUOp(instruction);
        return signals;
      case 'I':
        signals.ALUSrcA = 1;
        signals.ALUSrcB = 2;
        signals.ALUOp = this.getALUOp(instruction);
        return signals;
      case 'LOAD':
      case 'STORE':
        signals.ALUSrcA = 1;
        signals.ALUSrcB = 2;
        signals.ALUOp = ALUOp.ADD;
        return signals;
      case 'BRANCH':
        signals.ALUSrcA = 1;
        signals.ALUSrcB = 0;
        signals.ALUOp = ALUOp.SUB;
        signals.Branch = true;
        return signals;
      case 'JAL':
        signals.PCWrite = true;
        signals.PCSource = 2;
        signals.RegWrite = true;
        signals.MemToReg = 2;
        signals.ALUSrcA = 0;
        signals.ALUSrcB = 1;
        signals.ALUOp = ALUOp.ADD;
        return signals;
      case 'JALR':
        signals.ALUSrcA = 1;
        signals.ALUSrcB = 2;
        signals.ALUOp = ALUOp.ADD;
        return signals;
      case 'LUI':
        signals.RegWrite = true;
        signals.MemToReg = 3;
        return signals;
      case 'AUIPC':
        signals.RegWrite = true;
        signals.MemToReg = 4;
        signals.ALUSrcA = 0;
        signals.ALUSrcB = 2;
        signals.ALUOp = ALUOp.ADD;
        return signals;
    }
  }

  private getMemorySignals(instruction: DecodedInstruction, signals: ControlSignals): ControlSignals {
    const instructionClass = this.getInstructionClass(instruction);

    if (instructionClass === 'LOAD') {
      signals.IorD = true;
      signals.MemRead = true;
    } else if (instructionClass === 'STORE') {
      signals.IorD = true;
      signals.MemWrite = true;
    } else if (instructionClass === 'BRANCH') {
      signals.PCWriteCond = true;
      signals.PCSource = 1;
      signals.Branch = true;
    }

    signals.ImmSrc = this.getImmediateType(instruction);
    return signals;
  }

  private getWriteBackSignals(instruction: DecodedInstruction, signals: ControlSignals): ControlSignals {
    const instructionClass = this.getInstructionClass(instruction);

    signals.RegWrite = true;
    if (instructionClass === 'LOAD') {
      signals.MemToReg = 1;
    } else if (instructionClass === 'JALR') {
      signals.MemToReg = 2;
      signals.PCWrite = true;
      signals.PCSource = 1;
    } else {
      signals.MemToReg = 0;
    }
    signals.ImmSrc = this.getImmediateType(instruction);
    return signals;
  }

  private createDefaultSignals(): ControlSignals {
    return {
      PCWrite: false,
      PCWriteCond: false,
      IorD: false,
      MemRead: false,
      MemWrite: false,
      MemToReg: 0,
      IRWrite: false,
      RegWrite: false,
      ALUSrcA: 0,
      ALUSrcB: 0,
      ALUOp: ALUOp.ADD,
      PCSource: 0,
      Branch: false,
      ImmSrc: ImmType.NONE,
    };
  }

  private requireInstruction(stage: Stage, instruction: DecodedInstruction | null): DecodedInstruction {
    if (!instruction) {
      throw new Error(`Instruction is required for ${stage} stage`);
    }
    return instruction;
  }

  private getInstructionClass(instruction: DecodedInstruction): InstructionClass {
    switch (instruction.opcode) {
      case 0x33:
        return 'R';
      case 0x13:
        return 'I';
      case 0x03:
        return 'LOAD';
      case 0x23:
        return 'STORE';
      case 0x63:
        return 'BRANCH';
      case 0x67:
        return 'JALR';
      case 0x6F:
        return 'JAL';
      case 0x17:
        return 'AUIPC';
      case 0x37:
        return 'LUI';
      default:
        throw new Error(`Unsupported opcode for control unit: 0x${instruction.opcode.toString(16)}`);
    }
  }

  private getImmediateType(instruction: DecodedInstruction): ImmType {
    switch (instruction.opcode) {
      case 0x03:
      case 0x13:
      case 0x67:
        return ImmType.I;
      case 0x23:
        return ImmType.S;
      case 0x63:
        return ImmType.B;
      case 0x17:
      case 0x37:
        return ImmType.U;
      case 0x6F:
        return ImmType.J;
      default:
        return ImmType.NONE;
    }
  }

  private getALUOp(instruction: DecodedInstruction): ALUOp {
    if (instruction.opcode === 0x33) {
      if (instruction.funct3 === 0x0 && instruction.funct7 === 0x20) {
        return ALUOp.SUB;
      }
      if (instruction.funct3 === 0x0) {
        return ALUOp.ADD;
      }
      if (instruction.funct3 === 0x1) {
        return ALUOp.SLL;
      }
      if (instruction.funct3 === 0x2) {
        return ALUOp.SLT;
      }
      if (instruction.funct3 === 0x3) {
        return ALUOp.SLTU;
      }
      if (instruction.funct3 === 0x4) {
        return ALUOp.XOR;
      }
      if (instruction.funct3 === 0x5 && instruction.funct7 === 0x20) {
        return ALUOp.SRA;
      }
      if (instruction.funct3 === 0x5) {
        return ALUOp.SRL;
      }
      if (instruction.funct3 === 0x6) {
        return ALUOp.OR;
      }
      if (instruction.funct3 === 0x7) {
        return ALUOp.AND;
      }
    }

    if (instruction.opcode === 0x13) {
      if (instruction.funct3 === 0x0) {
        return ALUOp.ADD;
      }
      if (instruction.funct3 === 0x1) {
        return ALUOp.SLL;
      }
      if (instruction.funct3 === 0x2) {
        return ALUOp.SLT;
      }
      if (instruction.funct3 === 0x3) {
        return ALUOp.SLTU;
      }
      if (instruction.funct3 === 0x4) {
        return ALUOp.XOR;
      }
      if (instruction.funct3 === 0x5 && instruction.funct7 === 0x20) {
        return ALUOp.SRA;
      }
      if (instruction.funct3 === 0x5) {
        return ALUOp.SRL;
      }
      if (instruction.funct3 === 0x6) {
        return ALUOp.OR;
      }
      if (instruction.funct3 === 0x7) {
        return ALUOp.AND;
      }
    }

    return ALUOp.ADD;
  }
}
