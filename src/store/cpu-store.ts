import { create } from 'zustand';
import { getDatapathConfig, normalizeDatapathConfig, type DatapathMode } from '../config/load-datapath-config';
import { DEFAULT_EXAMPLE_PROGRAM } from '../content/example-programs';
import { Assembler } from '../engine/assembler/encoder';
import { CPU } from '../engine/core/cpu';
import { Decoder } from '../engine/core/decoder';
import { PipelineCPU } from '../engine/core/pipeline-cpu';
import {
  Stage,
  type AssembleError,
  type ControlSignals,
  type CycleSnapshot,
  type DatapathConfig,
  type DecodedInstruction,
  type ICPUEngine,
  type PipelineControlHazardStrategy,
} from '../types';

const INITIAL_CONFIG = getDatapathConfig();
const INITIAL_DATAPATH_MODE: DatapathMode = 'multicycle';
export const MEMORY_STORAGE_HEX_DIGITS = 4;
export const MEMORY_ADDRESS_HEX_DIGITS = 8;
export const MEMORY_SIZE = 16 ** MEMORY_STORAGE_HEX_DIGITS;
export const MEMORY_ROW_BYTES = 16;
const DEFAULT_MEMORY_VIEW_START = 0x00000040;
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
  snapshotHistory: readonly CycleSnapshot[];
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

type InstructionDisplaySnapshot = Pick<CycleSnapshot, 'stage' | 'pc'> &
  Partial<Pick<CycleSnapshot, 'instructionAddress'>>;

export interface CPUStoreState {
  datapathMode: DatapathMode;
  datapathConfig: DatapathConfig;
  sourceCode: string;
  currentSnapshot: CycleSnapshot;
  snapshotHistory: readonly CycleSnapshot[];
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
  pipelineForwardingEnabled: boolean;
  pipelineControlStrategy: PipelineControlHazardStrategy;
  stage: Stage;
  cycleCount: number;
  instructionCount: number;
  lastAction: string;
  setSourceCode: (sourceCode: string) => void;
  setRegisterDisplayFormat: (format: RegisterDisplayFormat) => void;
  setSpeed: (speed: number) => void;
  setPipelineForwardingEnabled: (enabled: boolean) => void;
  setPipelineControlStrategy: (strategy: PipelineControlHazardStrategy) => void;
  setDatapathMode: (mode: DatapathMode) => void;
  setDatapathConfig: (config: DatapathConfig) => void;
  jumpToMemoryAddress: (address: number) => void;
  setRegisterInitialValues: (indices: readonly number[], value: number) => void;
  setMemoryInitialBytes: (addresses: readonly number[], value: number) => void;
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

export function mapMemoryAddressToStorage(address: number, memorySize: number = MEMORY_SIZE): number {
  return (address >>> 0) % memorySize;
}

function clampMemoryViewStart(address: number, memorySize: number = MEMORY_SIZE): number {
  const logicalAddress = address >>> 0;
  const storageAddress = mapMemoryAddressToStorage(logicalAddress, memorySize);
  const logicalBase = (logicalAddress - storageAddress) >>> 0;
  const bounded = Math.min(Math.max(Math.floor(storageAddress), 0), Math.max(0, memorySize - MEMORY_ROW_BYTES));
  const aligned = bounded - (bounded % MEMORY_ROW_BYTES);
  return (logicalBase + aligned) >>> 0;
}

function getDisplayedInstructionAddress(snapshot: InstructionDisplaySnapshot): number {
  if (snapshot.stage === Stage.IF) {
    return snapshot.pc >>> 0;
  }

  return (snapshot.instructionAddress ?? Math.max(0, snapshot.pc - 4)) >>> 0;
}

function getDisplayedInstructionIndex(snapshot: InstructionDisplaySnapshot, wordCount: number): number | null {
  if (wordCount === 0) {
    return null;
  }

  const rawIndex = getDisplayedInstructionAddress(snapshot) >>> 2;

  if (rawIndex < 0 || rawIndex >= wordCount) {
    return null;
  }

  return rawIndex;
}

function getInstructionPreview(
  snapshot: InstructionDisplaySnapshot,
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
  snapshot: InstructionDisplaySnapshot
): readonly MachineCodeRow[] {
  const currentIndex = getDisplayedInstructionIndex(snapshot, rows.length);
  return rows.map((row, index) => {
    const current = currentIndex === index;
    return row.current === current ? row : { ...row, current };
  });
}

function resolveHistoryInstructionASM(
  stage: Stage,
  pc: number,
  machineCodeRows: readonly MachineCodeRow[],
  instructionAddress?: number
): string {
  const currentIndex = getDisplayedInstructionIndex({ stage, pc, instructionAddress }, machineCodeRows.length);
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
      instructionASM: resolveHistoryInstructionASM(
        referenceSnapshot.stage,
        referenceSnapshot.pc,
        machineCodeRows,
        referenceSnapshot.instructionAddress
      ),
      note: `周期 ${snapshot.cycleNumber}: ${snapshot.stage} -> ${referenceSnapshot.stage}`,
    };
  });
}

function resolveLatestMemoryAccess(
  engine: ICPUEngine,
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

function resolveSnapshotHistory(
  engine: ICPUEngine,
  currentSnapshot: CycleSnapshot,
  initialSnapshot: CycleSnapshot | null
): readonly CycleSnapshot[] {
  const history = engine.getHistory();
  const seed = initialSnapshot ?? currentSnapshot;
  if (history.length === 0) {
    return [seed.cycleNumber === currentSnapshot.cycleNumber ? currentSnapshot : seed];
  }

  const historyWithInitial = history[0]?.cycleNumber === seed.cycleNumber
    ? history
    : [seed, ...history];
  const latestHistorySnapshot = history[history.length - 1];
  if (latestHistorySnapshot?.cycleNumber === currentSnapshot.cycleNumber) {
    return historyWithInitial;
  }

  return [...historyWithInitial, currentSnapshot];
}

function deriveStoreFrame(
  engine: ICPUEngine,
  compiledProgram: CompiledProgram,
  initialSnapshot: CycleSnapshot | null
): DerivedStoreFrame {
  const currentSnapshot = engine.getSnapshot();
  const machineCodeRows = markCurrentMachineCodeRow(compiledProgram.machineCodeRows, currentSnapshot);
  const instructionPreview = getInstructionPreview(currentSnapshot, machineCodeRows);

  return {
    currentSnapshot,
    snapshotHistory: resolveSnapshotHistory(engine, currentSnapshot, initialSnapshot),
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

function applyInitialValues(
  engine: ICPUEngine,
  initialRegisterValues: ReadonlyMap<number, number>,
  initialMemoryValues: ReadonlyMap<number, number>
): void {
  initialRegisterValues.forEach((value, index) => {
    engine.setRegisterValue(index, value);
  });
  initialMemoryValues.forEach((value, address) => {
    engine.setDataMemoryByte(address, value);
  });
}

function reloadProgram(
  engine: ICPUEngine,
  compiledProgram: CompiledProgram,
  initialRegisterValues: ReadonlyMap<number, number>,
  initialMemoryValues: ReadonlyMap<number, number>
): void {
  engine.loadProgram(compiledProgram.program);
  applyInitialValues(engine, initialRegisterValues, initialMemoryValues);
}

export function createCPUStore() {
  const multicycleEngine = new CPU(MEMORY_SIZE);
  let pipelineForwardingEnabled = false;
  let pipelineControlStrategy: PipelineControlHazardStrategy = 'predict-not-taken';
  const pipelineEngine = new PipelineCPU(MEMORY_SIZE, {
    forwardingEnabled: pipelineForwardingEnabled,
    controlHazardStrategy: pipelineControlStrategy,
  });
  let activeEngine: ICPUEngine = multicycleEngine;
  const initialRegisterValues = new Map<number, number>();
  const initialMemoryValues = new Map<number, number>();
  let compiledProgram = compileSource(DEFAULT_SOURCE_CODE);
  let initialHistoryNote = '模拟器已初始化，并连接到真实 CPU 引擎。';
  let snapshotHistorySeed: CycleSnapshot | null = null;

  reloadProgram(activeEngine, compiledProgram, initialRegisterValues, initialMemoryValues);
  snapshotHistorySeed = activeEngine.getSnapshot();
  const initialFrame = deriveStoreFrame(activeEngine, compiledProgram, snapshotHistorySeed);
  const initialHistoryTimeline = createInitialHistoryTimeline(compiledProgram.machineCodeRows, initialHistoryNote);

  return create<CPUStoreState>()((set) => ({
    datapathMode: INITIAL_DATAPATH_MODE,
    datapathConfig: INITIAL_CONFIG,
    sourceCode: DEFAULT_SOURCE_CODE,
    ...initialFrame,
    historyTimeline: initialHistoryTimeline,
    registerDisplayFormat: 'hex',
    memoryViewStartAddress: DEFAULT_MEMORY_VIEW_START,
    runStatus: 'idle',
    speed: 1,
    pipelineForwardingEnabled,
    pipelineControlStrategy,
    lastAction: '状态仓库已经接到真实 CPU 引擎。',

    setSourceCode: (sourceCode) => {
      compiledProgram = compileSource(sourceCode);
      initialHistoryNote = hasBlockingAssemblyErrors(compiledProgram.assembleErrors)
        ? '源码已更新，但汇编错误正在阻塞执行。'
        : '源码已更新，并重新装载到 CPU 引擎。';
      reloadProgram(activeEngine, compiledProgram, initialRegisterValues, initialMemoryValues);
      snapshotHistorySeed = activeEngine.getSnapshot();
      const nextFrame = deriveStoreFrame(activeEngine, compiledProgram, snapshotHistorySeed);
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

    setPipelineForwardingEnabled: (enabled) =>
      set((state) => {
        pipelineForwardingEnabled = enabled;
        pipelineEngine.setForwardingEnabled(enabled);

        const note = enabled
          ? '流水线旁路已开启，RAW 数据冲突将优先用 ForwardA/ForwardB/StoreForward 解决。'
          : '流水线旁路已关闭，RAW 数据冲突将通过停顿和气泡解决。';

        if (state.datapathMode !== 'pipeline') {
          return {
            pipelineForwardingEnabled: enabled,
            lastAction: note,
          };
        }

        const nextFrame = deriveStoreFrame(activeEngine, compiledProgram, snapshotHistorySeed);
        return {
          ...nextFrame,
          pipelineForwardingEnabled: enabled,
          historyTimeline: state.historyTimeline,
          registerDisplayFormat: state.registerDisplayFormat,
          memoryViewStartAddress: state.memoryViewStartAddress,
          runStatus: state.runStatus,
          lastAction: note,
        };
      }),

    setPipelineControlStrategy: (strategy) =>
      set((state) => {
        pipelineControlStrategy = strategy;
        pipelineEngine.setControlHazardStrategy(strategy);

        const note = strategy === 'predict-not-taken'
          ? '控制策略已切换为预测不跳转，分支跳转在 EX 判定后冲刷流水线。'
          : '控制策略已切换为停等到分支判定，分支跳转进入 ID 后会暂停取指。';

        if (state.datapathMode !== 'pipeline') {
          return {
            pipelineControlStrategy: strategy,
            lastAction: note,
          };
        }

        const nextFrame = deriveStoreFrame(activeEngine, compiledProgram, snapshotHistorySeed);
        return {
          ...nextFrame,
          pipelineForwardingEnabled,
          pipelineControlStrategy: strategy,
          historyTimeline: state.historyTimeline,
          registerDisplayFormat: state.registerDisplayFormat,
          memoryViewStartAddress: state.memoryViewStartAddress,
          runStatus: state.runStatus,
          lastAction: note,
        };
      }),

    setDatapathMode: (datapathMode) =>
      set((state) => {
        activeEngine = datapathMode === 'pipeline' ? pipelineEngine : multicycleEngine;
        const note = datapathMode === 'pipeline'
          ? '已切换到五级流水线执行模型。'
          : '已切换到多周期执行模型。';

        initialHistoryNote = note;
        reloadProgram(activeEngine, compiledProgram, initialRegisterValues, initialMemoryValues);
        snapshotHistorySeed = activeEngine.getSnapshot();
        const nextFrame = deriveStoreFrame(activeEngine, compiledProgram, snapshotHistorySeed);

        return {
          datapathMode,
          datapathConfig: getDatapathConfig(datapathMode),
          ...nextFrame,
          historyTimeline: createInitialHistoryTimeline(compiledProgram.machineCodeRows, note),
          registerDisplayFormat: state.registerDisplayFormat,
          memoryViewStartAddress: DEFAULT_MEMORY_VIEW_START,
          runStatus: 'idle',
          lastAction: note,
        };
      }),

    setDatapathConfig: (datapathConfig) => {
      const normalizedConfig = normalizeDatapathConfig(datapathConfig);
      activeEngine = normalizedConfig.metadata.type === 'pipeline' ? pipelineEngine : multicycleEngine;
      reloadProgram(activeEngine, compiledProgram, initialRegisterValues, initialMemoryValues);
      snapshotHistorySeed = activeEngine.getSnapshot();
      const nextFrame = deriveStoreFrame(activeEngine, compiledProgram, snapshotHistorySeed);
      const note = normalizedConfig.metadata.type === 'pipeline'
        ? '已载入流水线数据通路配置，并切换到五级流水线执行模型。'
        : '已载入多周期数据通路配置，并切换到多周期执行模型。';
      initialHistoryNote = note;

      set({
        datapathMode: normalizedConfig.metadata.type,
        datapathConfig: normalizedConfig,
        ...nextFrame,
        historyTimeline: createInitialHistoryTimeline(compiledProgram.machineCodeRows, note),
        runStatus: 'idle',
        lastAction: note,
      });
    },

    jumpToMemoryAddress: (address) =>
      set({
        memoryViewStartAddress: clampMemoryViewStart(address),
      }),

    setRegisterInitialValues: (indices, value) =>
      set((state) => {
        const writableIndices = Array.from(new Set(
          indices.filter((index) => Number.isInteger(index) && index > 0 && index < 32)
        ));

        if (writableIndices.length === 0) {
          return {
            lastAction: '没有可写寄存器被选中，x0 会保持为 0。',
          };
        }

        const normalizedValue = value | 0;
        writableIndices.forEach((index) => {
          initialRegisterValues.set(index, normalizedValue);
        });

        const note = `已为 ${writableIndices.length} 个寄存器置入初值 ${normalizedValue}。`;
        initialHistoryNote = note;
        reloadProgram(activeEngine, compiledProgram, initialRegisterValues, initialMemoryValues);
        snapshotHistorySeed = activeEngine.getSnapshot();
        const nextFrame = deriveStoreFrame(activeEngine, compiledProgram, snapshotHistorySeed);

        return {
          ...nextFrame,
          historyTimeline: createInitialHistoryTimeline(compiledProgram.machineCodeRows, note),
          registerDisplayFormat: state.registerDisplayFormat,
          memoryViewStartAddress: state.memoryViewStartAddress,
          runStatus: 'idle',
          lastAction: note,
        };
      }),

    setMemoryInitialBytes: (addresses, value) =>
      set((state) => {
        const storageAddresses = Array.from(new Set(
          addresses
            .filter((address) => Number.isFinite(address))
            .map((address) => mapMemoryAddressToStorage(address))
        ));

        if (storageAddresses.length === 0) {
          return {
            lastAction: '没有选中任何内存地址。',
          };
        }

        const normalizedValue = value & 0xFF;
        storageAddresses.forEach((address) => {
          initialMemoryValues.set(address, normalizedValue);
        });

        const note = `已为 ${storageAddresses.length} 个内存地址置入字节初值 0x${normalizedValue.toString(16).padStart(2, '0').toUpperCase()}。`;
        initialHistoryNote = note;
        reloadProgram(activeEngine, compiledProgram, initialRegisterValues, initialMemoryValues);
        snapshotHistorySeed = activeEngine.getSnapshot();
        const nextFrame = deriveStoreFrame(activeEngine, compiledProgram, snapshotHistorySeed);

        return {
          ...nextFrame,
          historyTimeline: createInitialHistoryTimeline(compiledProgram.machineCodeRows, note),
          registerDisplayFormat: state.registerDisplayFormat,
          memoryViewStartAddress: state.memoryViewStartAddress,
          runStatus: 'idle',
          lastAction: note,
        };
      }),

    rewindToCycle: (cycleNumber) =>
      set((state) => {
        if (cycleNumber === 0) {
          reloadProgram(activeEngine, compiledProgram, initialRegisterValues, initialMemoryValues);
          snapshotHistorySeed = activeEngine.getSnapshot();
        } else {
          const target = state.historyTimeline.find((entry) => entry.cycleNumber === cycleNumber);
          if (!target) {
            return state;
          }

          activeEngine.rewindTo(cycleNumber);
        }

        const nextFrame = deriveStoreFrame(activeEngine, compiledProgram, snapshotHistorySeed);
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
        reloadProgram(activeEngine, compiledProgram, initialRegisterValues, initialMemoryValues);
        snapshotHistorySeed = activeEngine.getSnapshot();
        const nextFrame = deriveStoreFrame(activeEngine, compiledProgram, snapshotHistorySeed);
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

        const executedSnapshot = activeEngine.tick();
        const nextFrame = deriveStoreFrame(activeEngine, compiledProgram, snapshotHistorySeed);
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
            : state.datapathMode === 'pipeline'
              ? state.runStatus === 'running'
                ? `连续执行已推进到周期 ${nextFrame.cycleCount}。`
                : `已单步推进到周期 ${nextFrame.cycleCount}。`
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

        const snapshots = activeEngine.step();
        if (snapshots.length === 0) {
          return {
            runStatus: 'paused',
            lastAction: '程序已经执行结束。',
          };
        }

        const nextFrame = deriveStoreFrame(activeEngine, compiledProgram, snapshotHistorySeed);
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
          lastAction: state.datapathMode === 'pipeline'
            ? `本次推进 ${snapshots.length} 个周期，已退休 ${nextFrame.instructionCount} 条指令。`
            : `本次完成 ${snapshots.length} 个周期，并回到 ${nextFrame.stage}。`,
        };
      }),
  }));
}

export const useCPUStore = createCPUStore();
