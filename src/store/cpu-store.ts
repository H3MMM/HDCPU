import { create } from 'zustand';
import { Assembler } from '../engine/assembler/encoder';
import { ControlUnit } from '../engine/core/control';
import { Decoder } from '../engine/core/decoder';
import { getDatapathConfig } from '../config/load-datapath-config';
import {
  ALUOp,
  ImmType,
  Stage,
  type AssembleError,
  type ControlSignals,
  type DatapathConfig,
  type DecodedInstruction,
} from '../types';

const STAGE_SEQUENCE: Stage[] = [Stage.IF, Stage.ID, Stage.EX, Stage.MEM, Stage.WB];
const INITIAL_CONFIG = getDatapathConfig();
const MEMORY_SIZE = 256;
const MEMORY_ROW_BYTES = 16;
const DEFAULT_MEMORY_VIEW_START = 0x40;
const assembler = new Assembler();
const decoder = new Decoder();
const controlUnit = new ControlUnit();

const DEFAULT_SOURCE_CODE = `# RISC-V multicycle sketchpad
addi x1, x0, 5
addi x2, x0, 9
add  x3, x1, x2
sw   x3, 64(x0)
lw   x4, 64(x0)`;

export type RunStatus = 'idle' | 'running' | 'paused';
export type RegisterDisplayFormat = 'hex' | 'dec';

export interface MachineCodeRow {
  index: number;
  address: number;
  machineCode: number;
  binary: string;
  assembly: string;
  current: boolean;
}

interface DerivedExecutionState {
  machineCodeRows: readonly MachineCodeRow[];
  assembleErrors: readonly AssembleError[];
  currentInstruction: DecodedInstruction | null;
  currentMachineWord: number | null;
  controlSignals: ControlSignals;
}

function createDefaultControlSignals(): ControlSignals {
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

function formatBinaryWord(value: number): string {
  const binary = (value >>> 0).toString(2).padStart(32, '0');
  return binary.match(/.{1,4}/g)?.join(' ') ?? binary;
}

function safeDecodeInstruction(word: number): DecodedInstruction | null {
  try {
    return decoder.decode(word >>> 0);
  } catch {
    return null;
  }
}

function deriveExecutionState(sourceCode: string, stage: Stage, instructionCount: number): DerivedExecutionState {
  const assemblyResult = assembler.assemble(sourceCode);
  const wordCount = assemblyResult.machineCode.length;
  const currentWordIndex = wordCount === 0 ? null : Math.min(instructionCount, wordCount - 1);

  const machineCodeRows = Array.from(assemblyResult.machineCode, (machineCode, index) => ({
    index,
    address: index * 4,
    machineCode: machineCode >>> 0,
    binary: formatBinaryWord(machineCode),
    assembly: assembler.disassemble(machineCode),
    current: currentWordIndex === index,
  }));

  const currentMachineWord = currentWordIndex === null ? null : assemblyResult.machineCode[currentWordIndex] >>> 0;
  const currentInstruction = currentMachineWord === null ? null : safeDecodeInstruction(currentMachineWord);

  let controlSignals = createDefaultControlSignals();
  try {
    controlSignals = controlUnit.getControlSignals(stage, currentInstruction);
  } catch {
    controlSignals = stage === Stage.IF
      ? controlUnit.getControlSignals(Stage.IF, null)
      : createDefaultControlSignals();
  }

  return {
    machineCodeRows,
    assembleErrors: assemblyResult.errors,
    currentInstruction,
    currentMachineWord,
    controlSignals,
  };
}

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
  machineCodeRows: readonly MachineCodeRow[];
  assembleErrors: readonly AssembleError[];
  currentInstruction: DecodedInstruction | null;
  currentMachineWord: number | null;
  controlSignals: ControlSignals;
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
  const initialExecutionState = deriveExecutionState(DEFAULT_SOURCE_CODE, Stage.IF, 0);

  return create<CPUStoreState>()((set) => ({
    datapathConfig: INITIAL_CONFIG,
    sourceCode: DEFAULT_SOURCE_CODE,
    registers: createDemoRegisters(0),
    memoryBytes: createDemoMemory(0),
    machineCodeRows: initialExecutionState.machineCodeRows,
    assembleErrors: initialExecutionState.assembleErrors,
    currentInstruction: initialExecutionState.currentInstruction,
    currentMachineWord: initialExecutionState.currentMachineWord,
    controlSignals: initialExecutionState.controlSignals,
    registerDisplayFormat: 'hex',
    memoryViewStartAddress: DEFAULT_MEMORY_VIEW_START,
    runStatus: 'idle',
    speed: 1,
    stage: Stage.IF,
    cycleCount: 0,
    instructionCount: 0,
    selectedComponentId: INITIAL_CONFIG.components[0]?.id ?? null,
    lastAction: 'Day 3 panels are live. Register and memory views are ready for engine integration.',

    setSourceCode: (sourceCode) =>
      set((state) => ({
        sourceCode,
        ...deriveExecutionState(sourceCode, state.stage, state.instructionCount),
      })),

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
      set((state) => {
        const nextStage = Stage.IF;
        const nextInstructionCount = 0;

        return {
          registers: createDemoRegisters(nextInstructionCount),
          memoryBytes: createDemoMemory(nextInstructionCount),
          registerDisplayFormat: state.registerDisplayFormat,
          memoryViewStartAddress: DEFAULT_MEMORY_VIEW_START,
          runStatus: 'idle',
          stage: nextStage,
          cycleCount: 0,
          instructionCount: nextInstructionCount,
          ...deriveExecutionState(state.sourceCode, nextStage, nextInstructionCount),
          lastAction: `Execution reset. Focus remains on ${state.selectedComponentId ?? 'the datapath overview'}.`,
        };
      }),

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
          ...deriveExecutionState(state.sourceCode, nextStage, nextInstructionCount),
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
          ...deriveExecutionState(state.sourceCode, Stage.IF, nextInstructionCount),
          lastAction: `Advanced one instruction across ${cyclesToAdvance} cycles and returned to IF.`,
        };
      }),
  }));
}

export const useCPUStore = createCPUStore();
