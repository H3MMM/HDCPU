import { create } from 'zustand';
import { getDatapathConfig } from '../config/load-datapath-config';
import { Assembler } from '../engine/assembler/encoder';
import { CPU } from '../engine/core/cpu';
import { Decoder } from '../engine/core/decoder';
import {
  Stage,
  type AssembleError,
  type ControlSignals,
  type CycleSnapshot,
  type DatapathConfig,
  type DecodedInstruction,
} from '../types';

const INITIAL_CONFIG = getDatapathConfig();
const MEMORY_SIZE = 256;
const MEMORY_ROW_BYTES = 16;
const DEFAULT_MEMORY_VIEW_START = 0x40;
const assembler = new Assembler();
const decoder = new Decoder();

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

export interface HistoryEntry {
  id: string;
  cycleNumber: number;
  instructionIndex: number;
  stage: Stage;
  instructionASM: string;
  note: string;
}

interface CompiledProgram {
  program: Uint32Array;
  machineCodeRows: readonly MachineCodeRow[];
  assembleErrors: readonly AssembleError[];
}

interface DerivedStoreFrame {
  currentSnapshot: CycleSnapshot;
  registers: readonly number[];
  memoryBytes: Uint8Array;
  machineCodeRows: readonly MachineCodeRow[];
  assembleErrors: readonly AssembleError[];
  currentInstruction: DecodedInstruction | null;
  currentMachineWord: number | null;
  controlSignals: ControlSignals;
  historyTimeline: readonly HistoryEntry[];
  stage: Stage;
  cycleCount: number;
  instructionCount: number;
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

function hasBlockingAssemblyErrors(errors: readonly AssembleError[]): boolean {
  return errors.some((error) => error.severity === 'error');
}

function compileSource(sourceCode: string): CompiledProgram {
  const assemblyResult = assembler.assemble(sourceCode);
  const machineCodeRows = Array.from(assemblyResult.machineCode, (machineCode, index) => ({
    index,
    address: index * 4,
    machineCode: machineCode >>> 0,
    binary: formatBinaryWord(machineCode),
    assembly: assembler.disassemble(machineCode),
    current: false,
  }));

  return {
    program: hasBlockingAssemblyErrors(assemblyResult.errors) ? new Uint32Array() : assemblyResult.machineCode,
    machineCodeRows,
    assembleErrors: assemblyResult.errors,
  };
}

function clampMemoryViewStart(address: number, memorySize: number = MEMORY_SIZE): number {
  const bounded = Math.min(Math.max(Math.floor(address), 0), Math.max(0, memorySize - MEMORY_ROW_BYTES));
  return bounded - (bounded % MEMORY_ROW_BYTES);
}

function getDisplayedInstructionIndex(snapshot: Pick<CycleSnapshot, 'stage' | 'pc'>, wordCount: number): number | null {
  if (wordCount === 0) {
    return null;
  }

  const rawIndex = snapshot.stage === Stage.IF
    ? snapshot.pc >>> 2
    : Math.max(0, (snapshot.pc >>> 2) - 1);

  if (rawIndex < 0 || rawIndex >= wordCount) {
    return null;
  }

  return rawIndex;
}

function getInstructionPreview(
  snapshot: Pick<CycleSnapshot, 'stage' | 'pc'>,
  machineCodeRows: readonly MachineCodeRow[]
): { currentMachineWord: number | null; currentInstruction: DecodedInstruction | null } {
  const currentIndex = getDisplayedInstructionIndex(snapshot, machineCodeRows.length);
  if (currentIndex === null) {
    return {
      currentMachineWord: null,
      currentInstruction: null,
    };
  }

  const currentMachineWord = machineCodeRows[currentIndex]?.machineCode ?? null;
  return {
    currentMachineWord,
    currentInstruction: currentMachineWord === null ? null : safeDecodeInstruction(currentMachineWord),
  };
}

function markCurrentMachineCodeRow(
  rows: readonly MachineCodeRow[],
  snapshot: Pick<CycleSnapshot, 'stage' | 'pc'>
): readonly MachineCodeRow[] {
  const currentIndex = getDisplayedInstructionIndex(snapshot, rows.length);
  return rows.map((row, index) => ({
    ...row,
    current: currentIndex === index,
  }));
}

function resolveHistoryInstructionASM(
  stage: Stage,
  pc: number,
  machineCodeRows: readonly MachineCodeRow[]
): string {
  const currentIndex = getDisplayedInstructionIndex({ stage, pc }, machineCodeRows.length);
  if (currentIndex === null) {
    return 'No decoded instruction';
  }

  return machineCodeRows[currentIndex]?.assembly ?? 'No decoded instruction';
}

function buildHistoryTimeline(
  engine: CPU,
  machineCodeRows: readonly MachineCodeRow[],
  currentSnapshot: CycleSnapshot,
  initialNote: string
): readonly HistoryEntry[] {
  const history = engine.getHistory();
  const entries: HistoryEntry[] = [
    {
      id: 'cycle-0',
      cycleNumber: 0,
      instructionIndex: 0,
      stage: Stage.IF,
      instructionASM: resolveHistoryInstructionASM(Stage.IF, 0, machineCodeRows),
      note: initialNote,
    },
  ];

  history.forEach((snapshot, index) => {
    const referenceSnapshot = index === history.length - 1 ? currentSnapshot : history[index + 1];

    entries.push({
      id: `cycle-${snapshot.cycleNumber}`,
      cycleNumber: snapshot.cycleNumber,
      instructionIndex: referenceSnapshot.instructionIndex,
      stage: referenceSnapshot.stage,
      instructionASM: resolveHistoryInstructionASM(referenceSnapshot.stage, referenceSnapshot.pc, machineCodeRows),
      note: `Cycle ${snapshot.cycleNumber}: ${snapshot.stage} -> ${referenceSnapshot.stage}`,
    });
  });

  return entries;
}

function deriveStoreFrame(
  engine: CPU,
  compiledProgram: CompiledProgram,
  initialHistoryNote: string
): DerivedStoreFrame {
  const currentSnapshot = engine.getSnapshot();
  const machineCodeRows = markCurrentMachineCodeRow(compiledProgram.machineCodeRows, currentSnapshot);
  const instructionPreview = getInstructionPreview(currentSnapshot, machineCodeRows);

  return {
    currentSnapshot,
    registers: Array.from(currentSnapshot.registers),
    memoryBytes: engine.getDataMemory(),
    machineCodeRows,
    assembleErrors: compiledProgram.assembleErrors,
    currentInstruction: instructionPreview.currentInstruction,
    currentMachineWord: instructionPreview.currentMachineWord,
    controlSignals: currentSnapshot.controlSignals,
    historyTimeline: buildHistoryTimeline(engine, machineCodeRows, currentSnapshot, initialHistoryNote),
    stage: currentSnapshot.stage,
    cycleCount: currentSnapshot.cycleNumber,
    instructionCount: currentSnapshot.instructionIndex,
  };
}

function reloadProgram(engine: CPU, compiledProgram: CompiledProgram): void {
  engine.loadProgram(compiledProgram.program);
}

export interface CPUStoreState {
  datapathConfig: DatapathConfig;
  sourceCode: string;
  currentSnapshot: CycleSnapshot;
  registers: readonly number[];
  memoryBytes: Uint8Array;
  machineCodeRows: readonly MachineCodeRow[];
  assembleErrors: readonly AssembleError[];
  currentInstruction: DecodedInstruction | null;
  currentMachineWord: number | null;
  controlSignals: ControlSignals;
  historyTimeline: readonly HistoryEntry[];
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
  rewindToCycle: (cycleNumber: number) => void;
  run: () => void;
  pause: () => void;
  reset: () => void;
  stepCycle: () => void;
  stepInstruction: () => void;
}

export function createCPUStore() {
  const engine = new CPU(MEMORY_SIZE);
  let compiledProgram = compileSource(DEFAULT_SOURCE_CODE);
  let initialHistoryNote = 'Simulator initialized and connected to the CPU engine.';

  reloadProgram(engine, compiledProgram);
  const initialFrame = deriveStoreFrame(engine, compiledProgram, initialHistoryNote);

  return create<CPUStoreState>()((set) => ({
    datapathConfig: INITIAL_CONFIG,
    sourceCode: DEFAULT_SOURCE_CODE,
    ...initialFrame,
    registerDisplayFormat: 'hex',
    memoryViewStartAddress: DEFAULT_MEMORY_VIEW_START,
    runStatus: 'idle',
    speed: 1,
    selectedComponentId: INITIAL_CONFIG.components[0]?.id ?? null,
    lastAction: 'Day 9 store wiring is now backed by the real CPU engine.',

    setSourceCode: (sourceCode) => {
      compiledProgram = compileSource(sourceCode);
      initialHistoryNote = hasBlockingAssemblyErrors(compiledProgram.assembleErrors)
        ? 'Source updated, but assembly errors are blocking execution.'
        : 'Source updated and the CPU engine was reloaded.';
      reloadProgram(engine, compiledProgram);
      const nextFrame = deriveStoreFrame(engine, compiledProgram, initialHistoryNote);

      set((state) => ({
        sourceCode,
        ...nextFrame,
        registerDisplayFormat: state.registerDisplayFormat,
        memoryViewStartAddress: DEFAULT_MEMORY_VIEW_START,
        runStatus: 'idle',
        selectedComponentId: state.selectedComponentId,
        lastAction: initialHistoryNote,
      }));
    },

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

    rewindToCycle: (cycleNumber) =>
      set((state) => {
        if (cycleNumber === 0) {
          reloadProgram(engine, compiledProgram);
        } else {
          const target = state.historyTimeline.find((entry) => entry.cycleNumber === cycleNumber);
          if (!target) {
            return state;
          }

          engine.rewindTo(cycleNumber);
        }

        const nextFrame = deriveStoreFrame(engine, compiledProgram, initialHistoryNote);
        return {
          ...nextFrame,
          registerDisplayFormat: state.registerDisplayFormat,
          memoryViewStartAddress: state.memoryViewStartAddress,
          runStatus: 'paused',
          selectedComponentId: state.selectedComponentId,
          lastAction: `Rewound to cycle ${cycleNumber}.`,
        };
      }),

    run: () =>
      set((state) => {
        if (hasBlockingAssemblyErrors(compiledProgram.assembleErrors)) {
          return {
            runStatus: 'paused',
            lastAction: 'Execution is blocked until assembly errors are fixed.',
          };
        }

        if (compiledProgram.program.length === 0) {
          return {
            runStatus: 'idle',
            lastAction: 'No executable machine code is loaded.',
          };
        }

        return {
          runStatus: 'running',
          lastAction: 'Engine-backed stepping is ready. Continuous playback can build on this in Day 11.',
        };
      }),

    pause: () =>
      set({
        runStatus: 'paused',
        lastAction: 'Execution paused.',
      }),

    reset: () =>
      set((state) => {
        initialHistoryNote = 'Execution reset and the CPU engine returned to cycle 0.';
        reloadProgram(engine, compiledProgram);
        const nextFrame = deriveStoreFrame(engine, compiledProgram, initialHistoryNote);

        return {
          ...nextFrame,
          registerDisplayFormat: state.registerDisplayFormat,
          memoryViewStartAddress: DEFAULT_MEMORY_VIEW_START,
          runStatus: 'idle',
          selectedComponentId: state.selectedComponentId,
          lastAction: initialHistoryNote,
        };
      }),

    stepCycle: () =>
      set((state) => {
        if (hasBlockingAssemblyErrors(compiledProgram.assembleErrors)) {
          return {
            runStatus: 'paused',
            lastAction: 'Cannot advance while assembly errors remain.',
          };
        }

        if (compiledProgram.program.length === 0) {
          return {
            runStatus: 'idle',
            lastAction: 'No executable machine code is loaded.',
          };
        }

        const previousCycle = engine.getSnapshot().cycleNumber;
        engine.tick();
        const nextFrame = deriveStoreFrame(engine, compiledProgram, initialHistoryNote);

        if (nextFrame.cycleCount === previousCycle) {
          return {
            runStatus: 'paused',
            lastAction: 'Program execution is already complete.',
          };
        }

        return {
          ...nextFrame,
          registerDisplayFormat: state.registerDisplayFormat,
          memoryViewStartAddress: state.memoryViewStartAddress,
          runStatus: 'paused',
          selectedComponentId: state.selectedComponentId,
          lastAction: `Advanced one cycle to ${nextFrame.stage}.`,
        };
      }),

    stepInstruction: () =>
      set((state) => {
        if (hasBlockingAssemblyErrors(compiledProgram.assembleErrors)) {
          return {
            runStatus: 'paused',
            lastAction: 'Cannot advance while assembly errors remain.',
          };
        }

        if (compiledProgram.program.length === 0) {
          return {
            runStatus: 'idle',
            lastAction: 'No executable machine code is loaded.',
          };
        }

        const snapshots = engine.step();
        if (snapshots.length === 0) {
          return {
            runStatus: 'paused',
            lastAction: 'Program execution is already complete.',
          };
        }

        const nextFrame = deriveStoreFrame(engine, compiledProgram, initialHistoryNote);
        return {
          ...nextFrame,
          registerDisplayFormat: state.registerDisplayFormat,
          memoryViewStartAddress: state.memoryViewStartAddress,
          runStatus: 'paused',
          selectedComponentId: state.selectedComponentId,
          lastAction: `Completed ${snapshots.length} cycle${snapshots.length === 1 ? '' : 's'} and returned to ${nextFrame.stage}.`,
        };
      }),
  }));
}

export const useCPUStore = createCPUStore();
