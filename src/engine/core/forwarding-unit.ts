import {
  Stage,
  type DecodedInstruction,
  type EXMEMPipelineRegister,
  type IDEXPipelineRegister,
  type MEMWBPipelineRegister,
  type PipelineForwardingSignal,
  type PipelineForwardingSnapshot,
  type PipelineForwardingSource,
  type PipelineInstructionRef,
} from '../../types';
import { createNoPipelineForwarding } from './pipeline-state';

interface ForwardingEvaluationInput {
  enabled: boolean;
  idEx: IDEXPipelineRegister;
  exMem: EXMEMPipelineRegister;
  memWb: MEMWBPipelineRegister;
}

interface ProducerMatch {
  source: Exclude<PipelineForwardingSource, 'none'>;
  register: number;
  producer: PipelineInstructionRef;
}

export class ForwardingUnit {
  evaluate(input: ForwardingEvaluationInput): PipelineForwardingSnapshot {
    if (!input.enabled || !this.isValid(input.idEx) || !input.idEx.decodedInstruction) {
      return createNoPipelineForwarding(input.enabled);
    }

    const instruction = input.idEx.decodedInstruction;
    return {
      enabled: true,
      ForwardA: this.readsRs1(instruction)
        ? this.resolveSource(input.idEx.rs1, input.exMem, input.memWb)
        : this.createNoSignal(),
      ForwardB: this.usesRs2AsAluInput(instruction)
        ? this.resolveSource(input.idEx.rs2, input.exMem, input.memWb)
        : this.createNoSignal(),
      StoreForward: this.isStore(instruction)
        ? this.resolveSource(input.idEx.rs2, input.exMem, input.memWb)
        : this.createNoSignal(),
    };
  }

  private resolveSource(
    register: number,
    exMem: EXMEMPipelineRegister,
    memWb: MEMWBPipelineRegister
  ): PipelineForwardingSignal {
    if (register === 0) {
      return this.createNoSignal();
    }

    const exMemProducer = this.matchEXMEM(register, exMem);
    if (exMemProducer) {
      return exMemProducer;
    }

    const memWbProducer = this.matchMEMWB(register, memWb);
    if (memWbProducer) {
      return memWbProducer;
    }

    return this.createNoSignal();
  }

  private matchEXMEM(register: number, exMem: EXMEMPipelineRegister): ProducerMatch | null {
    if (!this.isValid(exMem) || !exMem.decodedInstruction || !this.writesRegister(exMem.decodedInstruction)) {
      return null;
    }

    if (exMem.rd !== register) {
      return null;
    }

    return {
      source: 'exMem',
      register,
      producer: this.createInstructionRef(Stage.MEM, exMem.pc, exMem.instructionWord, exMem.decodedInstruction),
    };
  }

  private matchMEMWB(register: number, memWb: MEMWBPipelineRegister): ProducerMatch | null {
    if (!this.isValid(memWb) || !memWb.decodedInstruction || !this.writesRegister(memWb.decodedInstruction)) {
      return null;
    }

    if (memWb.rd !== register) {
      return null;
    }

    return {
      source: 'memWb',
      register,
      producer: this.createInstructionRef(Stage.WB, memWb.pc, memWb.instructionWord, memWb.decodedInstruction),
    };
  }

  private readsRs1(instruction: DecodedInstruction): boolean {
    return (
      instruction.opcode === 0x03 ||
      instruction.opcode === 0x13 ||
      instruction.opcode === 0x23 ||
      instruction.opcode === 0x33 ||
      instruction.opcode === 0x63 ||
      instruction.opcode === 0x67
    );
  }

  private usesRs2AsAluInput(instruction: DecodedInstruction): boolean {
    return instruction.opcode === 0x33 || instruction.opcode === 0x63;
  }

  private isStore(instruction: DecodedInstruction): boolean {
    return instruction.opcode === 0x23;
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

  private createNoSignal(): PipelineForwardingSignal {
    return {
      source: 'none',
      register: 0,
      producer: null,
    };
  }

  private isValid(register: IDEXPipelineRegister | EXMEMPipelineRegister | MEMWBPipelineRegister): boolean {
    return register.status === 'valid' && register.decodedInstruction !== null;
  }
}
