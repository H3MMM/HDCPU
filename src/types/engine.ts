import { CycleSnapshot } from './snapshot';

// CPU engine interface
export interface ICPUEngine {
  // Load a machine-code program into instruction memory.
  loadProgram(instructions: Uint32Array): void;

  // Advance the CPU by exactly one cycle.
  tick(): CycleSnapshot;

  // Advance until the current instruction completes.
  step(): CycleSnapshot[];

  // Reset architectural state.
  reset(): void;

  // Read the current snapshot without advancing the clock.
  getSnapshot(): CycleSnapshot;

  // Read a copy of data memory for UI visualizations.
  getDataMemory(): Uint8Array;

  // Retrieve the execution history for time-travel UI.
  getHistory(): CycleSnapshot[];

  // Restore CPU state to the requested cycle.
  rewindTo(cycleNumber: number): CycleSnapshot;
}

export interface AssembleError {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
}

export interface IAssembler {
  assemble(source: string): {
    machineCode: Uint32Array;
    errors: AssembleError[];
  };

  disassemble(machineCode: number): string;
}
