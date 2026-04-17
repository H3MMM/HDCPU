import { create } from 'zustand';
import { getDatapathConfig } from '../config/load-datapath-config';
import { Stage, type DatapathConfig } from '../types';

const STAGE_SEQUENCE: Stage[] = [Stage.IF, Stage.ID, Stage.EX, Stage.MEM, Stage.WB];
const INITIAL_CONFIG = getDatapathConfig();
const MEMORY_SIZE = 256;
const MEMORY_ROW_BYTES = 16;
const DEFAULT_MEMORY_VIEW_START = 0x40;

const DEFAULT_SOURCE_CODE = `# RISC-V multicycle sketchpad
addi x1, x0, 5
addi x2, x0, 9
add  x3, x1, x2
sw   x3, 64(x0)
lw   x4, 64(x0)`;

export type RunStatus = 'idle' | 'running' | 'paused';
export type RegisterDisplayFormat = 'hex' | 'dec';

function writeWordToMemory(memory: Uint8Array, address: number, value: number): void {
  memory[address] = value & 0xff;
  memory[address + 1] = (value >>> 8) & 0xff;
  memory[address + 2] = (value >>> 16) & 0xff;
  memory[address + 3] = (value >>> 24) & 0xff;
}

function clampMemoryViewStart(address: number, memorySize: number = MEMORY_SIZE): number {
  const bounded = Math.min(Math.max(Math.floor(address), 0), Math.max(0, memorySize - MEMORY_ROW_BYTES));
  return bounded - (bounded % MEMORY_ROW_BYTES);
}

function createDemoRegisters(instructionCount: number): readonly number[] {
  const registers = Array.from({ length: 32 }, () => 0);

  if (instructionCount >= 1) {
    registers[1] = 5;
  }

  if (instructionCount >= 2) {
    registers[2] = 9;
  }

  if (instructionCount >= 3) {
    registers[3] = 14;
  }

  if (instructionCount >= 4) {
    registers[5] = DEFAULT_MEMORY_VIEW_START;
  }

  if (instructionCount >= 5) {
    registers[4] = 14;
  }

  registers[8] = 0x00000100;
  registers[10] = DEFAULT_MEMORY_VIEW_START;

  return registers;
}

function createDemoMemory(instructionCount: number): Uint8Array {
  const memory = new Uint8Array(MEMORY_SIZE);

  for (let index = 0x80; index < MEMORY_SIZE; index++) {
    memory[index] = (index * 17 + 11) & 0xff;
  }

  const label = 'HDCPU';
  for (let index = 0; index < label.length; index++) {
    memory[0x20 + index] = label.charCodeAt(index);
  }

  if (instructionCount >= 4) {
    writeWordToMemory(memory, DEFAULT_MEMORY_VIEW_START, 14);
  }

  if (instructionCount >= 5) {
    writeWordToMemory(memory, DEFAULT_MEMORY_VIEW_START + 4, 14);
  }

  return memory;
}

export interface CPUStoreState {
  datapathConfig: DatapathConfig;
  sourceCode: string;
  registers: readonly number[];
  memoryBytes: Uint8Array;
  registerDisplayFormat: RegisterDisplayFormat;
  memoryViewStartAddress: number;
  runStatus: RunStatus;
  speed: number;
  stage: Stage;
  cycleCount: number;
  instructionCount: number;
  selectedComponentId: string | null;
  lastAction: string;
  setSourceCode: (sourceCode: string) => void;
  setRegisterDisplayFormat: (format: RegisterDisplayFormat) => void;
  setSpeed: (speed: number) => void;
  setDatapathConfig: (config: DatapathConfig) => void;
  selectComponent: (componentId: string | null) => void;
  jumpToMemoryAddress: (address: number) => void;
  run: () => void;
  pause: () => void;
  reset: () => void;
  stepCycle: () => void;
  stepInstruction: () => void;
}

function getNextStage(stage: Stage): Stage {
  const stageIndex = STAGE_SEQUENCE.indexOf(stage);
  const nextIndex = (stageIndex + 1) % STAGE_SEQUENCE.length;
  return STAGE_SEQUENCE[nextIndex];
}

function getRemainingCyclesInInstruction(stage: Stage): number {
  const stageIndex = STAGE_SEQUENCE.indexOf(stage);
  return STAGE_SEQUENCE.length - stageIndex;
}

export function createCPUStore() {
  return create<CPUStoreState>()((set) => ({
    datapathConfig: INITIAL_CONFIG,
    sourceCode: DEFAULT_SOURCE_CODE,
    registers: createDemoRegisters(0),
    memoryBytes: createDemoMemory(0),
    registerDisplayFormat: 'hex',
    memoryViewStartAddress: DEFAULT_MEMORY_VIEW_START,
    runStatus: 'idle',
    speed: 1,
    stage: Stage.IF,
    cycleCount: 0,
    instructionCount: 0,
    selectedComponentId: INITIAL_CONFIG.components[0]?.id ?? null,
    lastAction: 'Day 3 panels are live. Register and memory views are ready for engine integration.',

    setSourceCode: (sourceCode) => set({ sourceCode }),

    setRegisterDisplayFormat: (registerDisplayFormat) => set({ registerDisplayFormat }),

    setSpeed: (speed) => set({ speed }),

    setDatapathConfig: (datapathConfig) =>
      set({
        datapathConfig,
        selectedComponentId: datapathConfig.components[0]?.id ?? null,
      }),

    selectComponent: (selectedComponentId) => set({ selectedComponentId }),

    jumpToMemoryAddress: (address) =>
      set({
        memoryViewStartAddress: clampMemoryViewStart(address),
      }),

    run: () =>
      set({
        runStatus: 'running',
        lastAction: 'Execution marked as running. Day 9/10 can replace this with real engine orchestration.',
      }),

    pause: () =>
      set({
        runStatus: 'paused',
        lastAction: 'Execution paused. UI contract is ready for future engine hooks.',
      }),

    reset: () =>
      set((state) => ({
        registers: createDemoRegisters(0),
        memoryBytes: createDemoMemory(0),
        registerDisplayFormat: state.registerDisplayFormat,
        memoryViewStartAddress: DEFAULT_MEMORY_VIEW_START,
        runStatus: 'idle',
        stage: Stage.IF,
        cycleCount: 0,
        instructionCount: 0,
        lastAction: `Execution reset. Focus remains on ${state.selectedComponentId ?? 'the datapath overview'}.`,
      })),

    stepCycle: () =>
      set((state) => {
        const nextStage = getNextStage(state.stage);
        const completedInstruction = nextStage === Stage.IF ? 1 : 0;
        const nextInstructionCount = state.instructionCount + completedInstruction;

        return {
          registers: createDemoRegisters(nextInstructionCount),
          memoryBytes: createDemoMemory(nextInstructionCount),
          runStatus: 'paused',
          stage: nextStage,
          cycleCount: state.cycleCount + 1,
          instructionCount: nextInstructionCount,
          lastAction: `Advanced one cycle: ${state.stage} → ${nextStage}.`,
        };
      }),

    stepInstruction: () =>
      set((state) => {
        const cyclesToAdvance = getRemainingCyclesInInstruction(state.stage);
        const nextInstructionCount = state.instructionCount + 1;

        return {
          registers: createDemoRegisters(nextInstructionCount),
          memoryBytes: createDemoMemory(nextInstructionCount),
          runStatus: 'paused',
          stage: Stage.IF,
          cycleCount: state.cycleCount + cyclesToAdvance,
          instructionCount: nextInstructionCount,
          lastAction: `Advanced one instruction across ${cyclesToAdvance} cycles and returned to IF.`,
        };
      }),
  }));
}

export const useCPUStore = createCPUStore();
