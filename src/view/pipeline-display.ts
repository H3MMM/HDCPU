import {
  Stage,
  type CycleSnapshot,
  type DecodedInstruction,
  type PipelineInstructionSlot,
  type PipelineRegisterStatus,
  type PipelineSourceRegister,
  type PipelineStageKey,
} from '../types';

const PRODUCER_STAGE_KEYS: readonly PipelineStageKey[] = ['EX', 'MEM', 'WB'];
const INSTRUCTION_STAGE_KEYS: readonly PipelineStageKey[] = ['IF', 'ID', 'EX', 'MEM', 'WB'];

export interface PipelineRawWaitDisplay {
  register: number;
  source: PipelineSourceRegister;
  consumerAsm: string;
  producerAsm: string;
  producerStage: Stage;
}

export interface PipelineTextbookCell {
  cycleNumber: number;
  label: '' | 'IF' | 'ID' | 'EX' | 'MEM' | 'WB' | '停顿' | '空';
  status: PipelineRegisterStatus;
}

export interface PipelineTextbookRow {
  id: string;
  pc: number;
  instructionWord: number;
  asmString: string;
  cells: readonly PipelineTextbookCell[];
}

export interface PipelineTextbookTimeline {
  cycleNumbers: readonly number[];
  rows: readonly PipelineTextbookRow[];
}

interface SourceRegisterRef {
  source: PipelineSourceRegister;
  register: number;
}

interface ProducerSlotRef {
  slot: PipelineInstructionSlot;
  rd: number;
}

interface TimelineInstruction {
  id: string;
  pc: number;
  instructionWord: number;
  decodedInstruction: DecodedInstruction;
  order: number;
}

interface ScheduledInstruction extends TimelineInstruction {
  ifCycle: number;
  idCycle: number;
  exCycle: number;
  memCycle: number;
  wbCycle: number | null;
}

export function resolvePipelineRawWait(snapshot: CycleSnapshot): PipelineRawWaitDisplay | null {
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

export function buildPipelineTextbookTimeline(
  snapshotHistory: readonly CycleSnapshot[],
  visibleCycleCount?: number
): PipelineTextbookTimeline {
  const cycleNumbers = getVisibleCycleNumbers(snapshotHistory, visibleCycleCount);
  const instructions = collectTimelineInstructions(snapshotHistory);
  if (cycleNumbers.length === 0 || instructions.length === 0) {
    return {
      cycleNumbers,
      rows: [],
    };
  }

  const forwardingEnabled = snapshotHistory[snapshotHistory.length - 1]?.pipeline.forwarding.enabled ?? false;
  const baseCycle = instructions[0].order;
  const scheduled = scheduleInstructions(instructions, baseCycle, forwardingEnabled);
  const rows = scheduled
    .map((instruction) => ({
      id: instruction.id,
      pc: instruction.pc,
      instructionWord: instruction.instructionWord,
      asmString: instruction.decodedInstruction.asmString,
      cells: cycleNumbers.map((cycleNumber) => createTextbookCell(instruction, cycleNumber)),
    }))
    .filter((row) => row.cells.some((cell) => cell.label !== ''));

  return {
    cycleNumbers,
    rows,
  };
}

export function isPipelineStageDisplayedAsRawWait(
  snapshot: CycleSnapshot,
  stageKey: PipelineStageKey
): boolean {
  return stageKey === 'ID' && resolvePipelineRawWait(snapshot) !== null;
}

function getVisibleCycleNumbers(
  snapshotHistory: readonly CycleSnapshot[],
  visibleCycleCount: number | undefined
): number[] {
  const cycleNumbers = snapshotHistory.map((snapshot) => snapshot.cycleNumber);
  return visibleCycleCount === undefined ? cycleNumbers : cycleNumbers.slice(-visibleCycleCount);
}

function collectTimelineInstructions(snapshotHistory: readonly CycleSnapshot[]): TimelineInstruction[] {
  const instructions = new Map<string, TimelineInstruction>();

  for (const snapshot of snapshotHistory) {
    for (const stageKey of INSTRUCTION_STAGE_KEYS) {
      const slot = snapshot.pipeline.stages[stageKey];
      const instruction = slot.decodedInstruction;
      if (!instruction) {
        continue;
      }

      const id = `${slot.pc}:${slot.instructionWord}`;
      if (!instructions.has(id)) {
        instructions.set(id, {
          id,
          pc: slot.pc,
          instructionWord: slot.instructionWord,
          decodedInstruction: instruction,
          order: instructions.size,
        });
      }
    }
  }

  return Array.from(instructions.values()).sort((left, right) => left.order - right.order);
}

function scheduleInstructions(
  instructions: readonly TimelineInstruction[],
  baseCycle: number,
  forwardingEnabled: boolean
): ScheduledInstruction[] {
  const scheduled: ScheduledInstruction[] = [];

  for (let index = 0; index < instructions.length; index++) {
    const instruction = instructions[index];
    const ifCycle = baseCycle + index;
    let idCycle = ifCycle + 1;
    const previousInstruction = scheduled[scheduled.length - 1];

    if (previousInstruction) {
      idCycle = Math.max(idCycle, previousInstruction.idCycle + 1);
    }

    if (!forwardingEnabled) {
      const sources = getReadRegisters(instruction.decodedInstruction).filter((source) => source.register !== 0);
      for (const source of sources) {
        const producer = findLatestProducer(scheduled, source.register);
        if (producer && producer.wbCycle !== null) {
          idCycle = Math.max(idCycle, producer.wbCycle + 1);
        }
      }
    }

    const exCycle = idCycle + 1;
    const memCycle = exCycle + 1;
    const wbCycle = writesRegister(instruction.decodedInstruction) ? memCycle + 1 : null;

    scheduled.push({
      ...instruction,
      ifCycle,
      idCycle,
      exCycle,
      memCycle,
      wbCycle,
    });
  }

  return scheduled;
}

function findLatestProducer(
  scheduled: readonly ScheduledInstruction[],
  register: number
): ScheduledInstruction | null {
  for (let index = scheduled.length - 1; index >= 0; index--) {
    const candidate = scheduled[index];
    if (
      candidate.wbCycle !== null &&
      writesRegister(candidate.decodedInstruction) &&
      candidate.decodedInstruction.rd === register
    ) {
      return candidate;
    }
  }

  return null;
}

function createTextbookCell(instruction: ScheduledInstruction, cycleNumber: number): PipelineTextbookCell {
  if (cycleNumber === instruction.ifCycle) {
    return createStageCell(cycleNumber, 'IF');
  }

  if (cycleNumber > instruction.ifCycle && cycleNumber < instruction.idCycle) {
    return {
      cycleNumber,
      label: '停顿',
      status: 'stalled',
    };
  }

  if (cycleNumber === instruction.idCycle) {
    return createStageCell(cycleNumber, 'ID');
  }

  if (cycleNumber === instruction.exCycle) {
    return createStageCell(cycleNumber, 'EX');
  }

  if (cycleNumber === instruction.memCycle) {
    if (!accessesMemory(instruction.decodedInstruction)) {
      return {
        cycleNumber,
        label: '空',
        status: 'empty',
      };
    }

    return createStageCell(cycleNumber, 'MEM');
  }

  if (instruction.wbCycle !== null && cycleNumber === instruction.wbCycle) {
    return createStageCell(cycleNumber, 'WB');
  }

  return {
    cycleNumber,
    label: '',
    status: 'empty',
  };
}

function createStageCell(
  cycleNumber: number,
  label: Exclude<PipelineTextbookCell['label'], '' | '停顿'>
): PipelineTextbookCell {
  return {
    cycleNumber,
    label,
    status: 'valid',
  };
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

function accessesMemory(instruction: DecodedInstruction): boolean {
  return instruction.opcode === 0x03 || instruction.opcode === 0x23;
}
