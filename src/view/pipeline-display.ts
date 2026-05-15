import {
  Stage,
  type CycleSnapshot,
  type DecodedInstruction,
  type PipelineInstructionSlot,
  type PipelineSourceRegister,
  type PipelineStageKey,
} from '../types';

const PRODUCER_STAGE_KEYS: readonly PipelineStageKey[] = ['EX', 'MEM', 'WB'];

export interface PipelineRawWaitDisplay {
  register: number;
  source: PipelineSourceRegister;
  consumerAsm: string;
  producerAsm: string;
  producerStage: Stage;
}

interface SourceRegisterRef {
  source: PipelineSourceRegister;
  register: number;
}

interface ProducerSlotRef {
  slot: PipelineInstructionSlot;
  rd: number;
}

export function resolvePipelineRawWait(snapshot: CycleSnapshot): PipelineRawWaitDisplay | null {
  const rawHazard = snapshot.pipeline.hazard.raw;
  if (snapshot.pipeline.hazard.type === 'raw' && rawHazard) {
    return {
      register: rawHazard.register,
      source: rawHazard.source,
      consumerAsm: rawHazard.consumer.asmString,
      producerAsm: rawHazard.producer.asmString,
      producerStage: rawHazard.producer.stage,
    };
  }

  if (snapshot.pipeline.forwarding.enabled) {
    return null;
  }

  const consumerSlot = snapshot.pipeline.stages.ID;
  const consumer = consumerSlot.decodedInstruction;
  if (consumerSlot.status !== 'valid' || !consumer) {
    return null;
  }

  const sources = getReadRegisters(consumer).filter((source) => source.register !== 0);
  if (sources.length === 0) {
    return null;
  }

  const producers = getVisibleProducers(snapshot);
  for (const source of sources) {
    const producer = producers.find((candidate) => candidate.rd === source.register);
    if (producer?.slot.decodedInstruction) {
      return {
        register: source.register,
        source: source.source,
        consumerAsm: consumer.asmString,
        producerAsm: producer.slot.decodedInstruction.asmString,
        producerStage: producer.slot.stage,
      };
    }
  }

  return null;
}

export function isPipelineStageDisplayedAsRawWait(
  snapshot: CycleSnapshot,
  stageKey: PipelineStageKey
): boolean {
  return stageKey === 'ID' && resolvePipelineRawWait(snapshot) !== null;
}

function getVisibleProducers(snapshot: CycleSnapshot): ProducerSlotRef[] {
  const producers: ProducerSlotRef[] = [];

  for (const stageKey of PRODUCER_STAGE_KEYS) {
    const slot = snapshot.pipeline.stages[stageKey];
    const instruction = slot.decodedInstruction;
    if (slot.status === 'valid' && instruction && writesRegister(instruction)) {
      producers.push({
        slot,
        rd: instruction.rd,
      });
    }
  }

  return producers;
}

function getReadRegisters(instruction: DecodedInstruction): SourceRegisterRef[] {
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

function writesRegister(instruction: DecodedInstruction): boolean {
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
