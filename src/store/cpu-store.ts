import { create } from 'zustand';
import { getDatapathConfig } from '../config/load-datapath-config';
import { Stage, type DatapathConfig } from '../types';

const STAGE_SEQUENCE: Stage[] = [Stage.IF, Stage.ID, Stage.EX, Stage.MEM, Stage.WB];
const INITIAL_CONFIG = getDatapathConfig();

const DEFAULT_SOURCE_CODE = `# RISC-V multicycle sketchpad
addi x1, x0, 5
addi x2, x0, 9
add  x3, x1, x2
sw   x3, 0(x0)
lw   x4, 0(x0)`;

export type RunStatus = 'idle' | 'running' | 'paused';

export interface CPUStoreState {
  datapathConfig: DatapathConfig;
  sourceCode: string;
  runStatus: RunStatus;
  speed: number;
  stage: Stage;
  cycleCount: number;
  instructionCount: number;
  selectedComponentId: string | null;
  lastAction: string;
  setSourceCode: (sourceCode: string) => void;
  setSpeed: (speed: number) => void;
  setDatapathConfig: (config: DatapathConfig) => void;
  selectComponent: (componentId: string | null) => void;
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
    runStatus: 'idle',
    speed: 1,
    stage: Stage.IF,
    cycleCount: 0,
    instructionCount: 0,
    selectedComponentId: INITIAL_CONFIG.components[0]?.id ?? null,
    lastAction: 'Day 1 / Day 2 scaffold ready. Waiting for engine integration.',

    setSourceCode: (sourceCode) => set({ sourceCode }),

    setSpeed: (speed) => set({ speed }),

    setDatapathConfig: (datapathConfig) =>
      set({
        datapathConfig,
        selectedComponentId: datapathConfig.components[0]?.id ?? null,
      }),

    selectComponent: (selectedComponentId) => set({ selectedComponentId }),

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

        return {
          runStatus: 'paused',
          stage: nextStage,
          cycleCount: state.cycleCount + 1,
          instructionCount: state.instructionCount + completedInstruction,
          lastAction: `Advanced one cycle: ${state.stage} → ${nextStage}.`,
        };
      }),

    stepInstruction: () =>
      set((state) => {
        const cyclesToAdvance = getRemainingCyclesInInstruction(state.stage);

        return {
          runStatus: 'paused',
          stage: Stage.IF,
          cycleCount: state.cycleCount + cyclesToAdvance,
          instructionCount: state.instructionCount + 1,
          lastAction: `Advanced one instruction across ${cyclesToAdvance} cycles and returned to IF.`,
        };
      }),
  }));
}

export const useCPUStore = createCPUStore();
