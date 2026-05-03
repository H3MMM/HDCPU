import {
  Stage,
  type DecodedInstruction,
  type EXMEMPipelineRegister,
  type IDEXPipelineRegister,
  type IFIDPipelineRegister,
  type PipelineHazardSnapshot,
  type PipelineInstructionRef,
  type PipelineSourceRegister,
} from '../../types';
import { createNoPipelineHazard } from './pipeline-state';

interface HazardEvaluationInput {
  ifId: IFIDPipelineRegister;
  idEx: IDEXPipelineRegister;
  exMem: EXMEMPipelineRegister;
  redirectPC: number | null;
}

interface SourceRegisterRef {
  source: PipelineSourceRegister;
  register: number;
}

interface ProducerRef {
  stage: Stage;
  pc: number;
  instructionWord: number;
  decodedInstruction: DecodedInstruction;
  rd: number;
}

export class HazardUnit {
  evaluate(input: HazardEvaluationInput): PipelineHazardSnapshot {
    if (input.redirectPC !== null && this.isValid(input.idEx)) {
      return this.createControlFlush(input.idEx, input.redirectPC);
    }

    const rawHazard = this.findRAWHazard(input.ifId, input.idEx, input.exMem);
    if (rawHazard) {
      return rawHazard;
    }

    return createNoPipelineHazard();
  }

  private findRAWHazard(
    ifId: IFIDPipelineRegister,
    idEx: IDEXPipelineRegister,
    exMem: EXMEMPipelineRegister
  ): PipelineHazardSnapshot | null {
    if (!this.isValid(ifId)) {
      return null;
    }

    const consumer = ifId.decodedInstruction;
    if (!consumer) {
      return null;
    }

    const sources = this.getReadRegisters(consumer).filter((source) => source.register !== 0);
    if (sources.length === 0) {
      return null;
    }

    const producers = this.getProducers(idEx, exMem);
    for (const source of sources) {
      const producer = producers.find((candidate) => candidate.rd === source.register);
      if (producer) {
        return this.createRAWStall(ifId, consumer, source, producer);
      }
    }

    return null;
  }

  private getReadRegisters(instruction: DecodedInstruction): SourceRegisterRef[] {
    switch (instruction.opcode) {
      case 0x33:
      case 0x23:
      case 0x63:
        return [
          { source: 'rs1', register: instruction.rs1 },
          { source: 'rs2', register: instruction.rs2 },
        ];
      case 0x03:
      case 0x13:
      case 0x67:
        return [{ source: 'rs1', register: instruction.rs1 }];
      default:
        return [];
    }
  }

  private getProducers(idEx: IDEXPipelineRegister, exMem: EXMEMPipelineRegister): ProducerRef[] {
    const producers: ProducerRef[] = [];

    if (this.isValid(idEx) && idEx.decodedInstruction && this.writesRegister(idEx.decodedInstruction)) {
      producers.push({
        stage: Stage.EX,
        pc: idEx.pc,
        instructionWord: idEx.instructionWord,
        decodedInstruction: idEx.decodedInstruction,
        rd: idEx.rd,
      });
    }

    if (this.isValid(exMem) && exMem.decodedInstruction && this.writesRegister(exMem.decodedInstruction)) {
      producers.push({
        stage: Stage.MEM,
        pc: exMem.pc,
        instructionWord: exMem.instructionWord,
        decodedInstruction: exMem.decodedInstruction,
        rd: exMem.rd,
      });
    }

    return producers;
  }

  private createRAWStall(
    ifId: IFIDPipelineRegister,
    consumer: DecodedInstruction,
    source: SourceRegisterRef,
    producer: ProducerRef
  ): PipelineHazardSnapshot {
    return {
      type: 'raw',
      action: 'stall',
      pcWrite: false,
      ifIdWrite: false,
      ifIdFlush: false,
      idExFlush: true,
      stallFetch: true,
      stallDecode: true,
      insertBubble: true,
      reason: `RAW dependency on x${source.register}; waiting for producer to reach write-back.`,
      raw: {
        register: source.register,
        source: source.source,
        consumer: this.createInstructionRef(Stage.ID, ifId.pc, ifId.instructionWord, consumer),
        producer: this.createInstructionRef(
          producer.stage,
          producer.pc,
          producer.instructionWord,
          producer.decodedInstruction
        ),
      },
      control: null,
    };
  }

  private createControlFlush(register: IDEXPipelineRegister, redirectPC: number): PipelineHazardSnapshot {
    const instruction = register.decodedInstruction;
    return {
      type: 'control',
      action: 'flush',
      pcWrite: true,
      ifIdWrite: true,
      ifIdFlush: true,
      idExFlush: true,
      stallFetch: false,
      stallDecode: false,
      insertBubble: false,
      reason: `Control transfer resolved in EX; redirecting PC to ${redirectPC}.`,
      raw: null,
      control: instruction
        ? {
            redirectPC,
            producer: this.createInstructionRef(Stage.EX, register.pc, register.instructionWord, instruction),
          }
        : null,
    };
  }

  private createInstructionRef(
    stage: Stage,
    pc: number,
    instructionWord: number,
    instruction: DecodedInstruction
  ): PipelineInstructionRef {
    return {
      stage,
      pc,
      instructionWord,
      asmString: instruction.asmString,
    };
  }

  private writesRegister(instruction: DecodedInstruction): boolean {
    return instruction.rd !== 0 && (
      instruction.opcode === 0x03 ||
      instruction.opcode === 0x13 ||
      instruction.opcode === 0x17 ||
      instruction.opcode === 0x33 ||
      instruction.opcode === 0x37 ||
      instruction.opcode === 0x67 ||
      instruction.opcode === 0x6F
    );
  }

  private isValid(
    register: IFIDPipelineRegister | IDEXPipelineRegister | EXMEMPipelineRegister
  ): boolean {
    return register.status === 'valid' && register.decodedInstruction !== null;
  }
}
