import { create } from 'zustand';
import { getDatapathConfig } from '../config/load-datapath-config';
import { DEFAULT_EXAMPLE_PROGRAM } from '../content/example-programs';
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
const DEFAULT_SOURCE_CODE = DEFAULT_EXAMPLE_PROGRAM.source;

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
  latestMemoryAccess: CycleSnapshot['memoryAccess'];
  machineCodeRows: readonly MachineCodeRow[];
  assembleErrors: readonly AssembleError[];
  currentInstruction: DecodedInstruction | null;
  currentMachineWord: number | null;
  controlSignals: ControlSignals;
  stage: Stage;
  cycleCount: number;
  instructionCount: number;
}

export interface CPUStoreState {
  datapathConfig: DatapathConfig;
  sourceCode: string;
  currentSnapshot: CycleSnapshot;
  registers: readonly number[];
  memoryBytes: Uint8Array;
  latestMemoryAccess: CycleSnapshot['memoryAccess'];
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
  lastAction: string;
  setSourceCode: (sourceCode: string) => void;
  setRegisterDisplayFormat: (format: RegisterDisplayFormat) => void;
  setSpeed: (speed: number) => void;
  setDatapathConfig: (config: DatapathConfig) => void;
  jumpToMemoryAddress: (address: number) => void;
  rewindToCycle: (cycleNumber: number) => void;
  run: () => void;
  pause: () => void;
  reset: () => void;
  stepCycle: () => void;
  stepInstruction: () => void;
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
    return '暂无已译码指令';
  }

  return machineCodeRows[currentIndex]?.assembly ?? '暂无已译码指令';
}

function createInitialHistoryTimeline(
  machineCodeRows: readonly MachineCodeRow[],
  note: string
): readonly HistoryEntry[] {
  return [
    {
      id: 'cycle-0',
      cycleNumber: 0,
      instructionIndex: 0,
      stage: Stage.IF,
      instructionASM: resolveHistoryInstructionASM(Stage.IF, 0, machineCodeRows),
      note,
    },
  ];
}

function buildHistoryEntriesForSnapshots(
  executedSnapshots: readonly CycleSnapshot[],
  currentSnapshot: CycleSnapshot,
  machineCodeRows: readonly MachineCodeRow[]
): readonly HistoryEntry[] {
  return executedSnapshots.map((snapshot, index) => {
    const referenceSnapshot = index === executedSnapshots.length - 1 ? currentSnapshot : executedSnapshots[index + 1];

    return {
      id: `cycle-${snapshot.cycleNumber}`,
      cycleNumber: snapshot.cycleNumber,
      instructionIndex: referenceSnapshot.instructionIndex,
      stage: referenceSnapshot.stage,
      instructionASM: resolveHistoryInstructionASM(referenceSnapshot.stage, referenceSnapshot.pc, machineCodeRows),
      note: `周期 ${snapshot.cycleNumber}: ${snapshot.stage} -> ${referenceSnapshot.stage}`,
    };
  });
}

function resolveLatestMemoryAccess(
  engine: CPU,
  currentSnapshot: CycleSnapshot
): CycleSnapshot['memoryAccess'] {
  if (currentSnapshot.memoryAccess.type !== 'none') {
    return currentSnapshot.memoryAccess;
  }

  const history = engine.getHistory();
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const snapshot = history[index];
    if (snapshot.memoryAccess.type !== 'none') {
      return snapshot.memoryAccess;
    }
  }

  return currentSnapshot.memoryAccess;
}

function resolveMemoryViewStartAddress(
  latestMemoryAccess: CycleSnapshot['memoryAccess'],
  currentMemoryViewStartAddress: number
): number {
  if (latestMemoryAccess.type === 'none') {
    return currentMemoryViewStartAddress;
  }

  return clampMemoryViewStart(latestMemoryAccess.address);
}

function deriveStoreFrame(
  engine: CPU,
  compiledProgram: CompiledProgram
): DerivedStoreFrame {
  const currentSnapshot = engine.getSnapshot();
  const machineCodeRows = markCurrentMachineCodeRow(compiledProgram.machineCodeRows, currentSnapshot);
  const instructionPreview = getInstructionPreview(currentSnapshot, machineCodeRows);

  return {
    currentSnapshot,
    registers: Array.from(currentSnapshot.registers),
    memoryBytes: engine.getDataMemory(),
    latestMemoryAccess: resolveLatestMemoryAccess(engine, currentSnapshot),
    machineCodeRows,
    assembleErrors: compiledProgram.assembleErrors,
    currentInstruction: instructionPreview.currentInstruction,
    currentMachineWord: instructionPreview.currentMachineWord,
    controlSignals: currentSnapshot.controlSignals,
    stage: currentSnapshot.stage,
    cycleCount: currentSnapshot.cycleNumber,
    instructionCount: currentSnapshot.instructionIndex,
  };
}

function reloadProgram(engine: CPU, compiledProgram: CompiledProgram): void {
  engine.loadProgram(compiledProgram.program);
}

export function createCPUStore() {
  const engine = new CPU(MEMORY_SIZE);
  let compiledProgram = compileSource(DEFAULT_SOURCE_CODE);
  let initialHistoryNote = '模拟器已初始化，并连接到真实 CPU 引擎。';

  reloadProgram(engine, compiledProgram);
  const initialFrame = deriveStoreFrame(engine, compiledProgram);
  const initialHistoryTimeline = createInitialHistoryTimeline(compiledProgram.machineCodeRows, initialHistoryNote);

  return create<CPUStoreState>()((set) => ({
    datapathConfig: INITIAL_CONFIG,
    sourceCode: DEFAULT_SOURCE_CODE,
    ...initialFrame,
    historyTimeline: initialHistoryTimeline,
    registerDisplayFormat: 'hex',
    memoryViewStartAddress: DEFAULT_MEMORY_VIEW_START,
    runStatus: 'idle',
    speed: 1,
    lastAction: '状态仓库已经接到真实 CPU 引擎。',

    setSourceCode: (sourceCode) => {
      compiledProgram = compileSource(sourceCode);
      initialHistoryNote = hasBlockingAssemblyErrors(compiledProgram.assembleErrors)
        ? '源码已更新，但汇编错误正在阻塞执行。'
        : '源码已更新，并重新装载到 CPU 引擎。';
      reloadProgram(engine, compiledProgram);
      const nextFrame = deriveStoreFrame(engine, compiledProgram);
      const nextHistoryTimeline = createInitialHistoryTimeline(compiledProgram.machineCodeRows, initialHistoryNote);

      set((state) => ({
        sourceCode,
        ...nextFrame,
        historyTimeline: nextHistoryTimeline,
        registerDisplayFormat: state.registerDisplayFormat,
        memoryViewStartAddress: DEFAULT_MEMORY_VIEW_START,
        runStatus: 'idle',
        lastAction: initialHistoryNote,
      }));
    },

    setRegisterDisplayFormat: (registerDisplayFormat) => set({ registerDisplayFormat }),

    setSpeed: (speed) => set({ speed }),

    setDatapathConfig: (datapathConfig) => set({ datapathConfig }),

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

        const nextFrame = deriveStoreFrame(engine, compiledProgram);
        const nextHistoryTimeline = cycleNumber === 0
          ? createInitialHistoryTimeline(compiledProgram.machineCodeRows, initialHistoryNote)
          : state.historyTimeline.filter((entry) => entry.cycleNumber <= cycleNumber);

        return {
          ...nextFrame,
          historyTimeline: nextHistoryTimeline,
          registerDisplayFormat: state.registerDisplayFormat,
          memoryViewStartAddress: resolveMemoryViewStartAddress(
            nextFrame.latestMemoryAccess,
            state.memoryViewStartAddress
          ),
          runStatus: 'paused',
          lastAction: `已回退到周期 ${cycleNumber}。`,
        };
      }),

    run: () =>
      set((state) => {
        if (hasBlockingAssemblyErrors(compiledProgram.assembleErrors)) {
          return {
            runStatus: 'paused',
            lastAction: '存在汇编错误，修复后才能继续执行。',
          };
        }

        if (compiledProgram.program.length === 0) {
          return {
            runStatus: 'idle',
            lastAction: '当前没有可执行的机器码。',
          };
        }

        if (state.currentInstruction === null && state.instructionCount >= compiledProgram.program.length) {
          return {
            runStatus: 'paused',
            lastAction: '程序已经执行结束，如需重放请先重置。',
          };
        }

        return {
          runStatus: 'running',
          lastAction: '已开始连续执行。',
        };
      }),

    pause: () =>
      set({
        runStatus: 'paused',
        lastAction: '执行已暂停。',
      }),

    reset: () =>
      set((state) => {
        initialHistoryNote = '执行已重置，CPU 引擎回到周期 0。';
        reloadProgram(engine, compiledProgram);
        const nextFrame = deriveStoreFrame(engine, compiledProgram);
        const nextHistoryTimeline = createInitialHistoryTimeline(compiledProgram.machineCodeRows, initialHistoryNote);

        return {
          ...nextFrame,
          historyTimeline: nextHistoryTimeline,
          registerDisplayFormat: state.registerDisplayFormat,
          memoryViewStartAddress: DEFAULT_MEMORY_VIEW_START,
          runStatus: 'idle',
          lastAction: initialHistoryNote,
        };
      }),

    stepCycle: () =>
      set((state) => {
        if (hasBlockingAssemblyErrors(compiledProgram.assembleErrors)) {
          return {
            runStatus: 'paused',
            lastAction: '仍有汇编错误，暂时不能继续推进。',
          };
        }

        if (compiledProgram.program.length === 0) {
          return {
            runStatus: 'idle',
            lastAction: '当前没有可执行的机器码。',
          };
        }

        const executedSnapshot = engine.tick();
        const nextFrame = deriveStoreFrame(engine, compiledProgram);
        const completedProgram =
          nextFrame.currentInstruction === null &&
          compiledProgram.program.length > 0 &&
          nextFrame.instructionCount >= compiledProgram.program.length;

        if (nextFrame.cycleCount === state.cycleCount) {
          return {
            runStatus: 'paused',
            lastAction: '程序已经执行结束。',
          };
        }

        const appendedEntries = buildHistoryEntriesForSnapshots(
          [executedSnapshot],
          nextFrame.currentSnapshot,
          compiledProgram.machineCodeRows
        );

        return {
          ...nextFrame,
          historyTimeline: [...state.historyTimeline, ...appendedEntries],
          registerDisplayFormat: state.registerDisplayFormat,
          memoryViewStartAddress: resolveMemoryViewStartAddress(
            nextFrame.latestMemoryAccess,
            state.memoryViewStartAddress
          ),
          runStatus: completedProgram ? 'paused' : state.runStatus === 'running' ? 'running' : 'paused',
          lastAction: completedProgram
            ? '程序执行完成。'
            : state.runStatus === 'running'
              ? `连续执行已推进到 ${nextFrame.stage}。`
              : `已单步推进到 ${nextFrame.stage}。`,
        };
      }),

    stepInstruction: () =>
      set((state) => {
        if (hasBlockingAssemblyErrors(compiledProgram.assembleErrors)) {
          return {
            runStatus: 'paused',
            lastAction: '仍有汇编错误，暂时不能继续推进。',
          };
        }

        if (compiledProgram.program.length === 0) {
          return {
            runStatus: 'idle',
            lastAction: '当前没有可执行的机器码。',
          };
        }

        const snapshots = engine.step();
        if (snapshots.length === 0) {
          return {
            runStatus: 'paused',
            lastAction: '程序已经执行结束。',
          };
        }

        const nextFrame = deriveStoreFrame(engine, compiledProgram);
        const appendedEntries = buildHistoryEntriesForSnapshots(
          snapshots,
          nextFrame.currentSnapshot,
          compiledProgram.machineCodeRows
        );

        return {
          ...nextFrame,
          historyTimeline: [...state.historyTimeline, ...appendedEntries],
          registerDisplayFormat: state.registerDisplayFormat,
          memoryViewStartAddress: resolveMemoryViewStartAddress(
            nextFrame.latestMemoryAccess,
            state.memoryViewStartAddress
          ),
          runStatus: 'paused',
          lastAction: `本次完成 ${snapshots.length} 个周期，并回到 ${nextFrame.stage}。`,
        };
      }),
  }));
}

export const useCPUStore = createCPUStore();
