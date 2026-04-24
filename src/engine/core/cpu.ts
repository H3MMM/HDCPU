import {
  ALUOp,
  CycleSnapshot,
  DataPathActivity,
  DecodedInstruction,
  ICPUEngine,
  Stage,
  StateChange,
} from '../../types';
import { ALU } from './alu';
import { ControlUnit } from './control';
import { Decoder } from './decoder';
import { Memory } from './memory';
import { RegisterFile } from './register-file';

interface ObservableCPUState {
  pc: number;
  IR: number;
  MDR: number;
  A: number;
  B: number;
  ALUOut: number;
  registers: number[];
}

interface CPUHistoryState {
  pc: number;
  instructionPC: number;
  IR: number;
  MDR: number;
  A: number;
  B: number;
  ALUOut: number;
  cycleCount: number;
  instructionCount: number;
  halted: boolean;
  currentStage: Stage;
  decodedInstruction: DecodedInstruction;
  instructionMemory: Uint32Array;
  dataMemory: Uint8Array;
  registers: number[];
  lastALUDetail: CycleSnapshot['aluDetail'];
  lastMemoryAccess: CycleSnapshot['memoryAccess'];
  lastActiveDataPaths: readonly DataPathActivity[];
  lastChanges: readonly StateChange[];
}

/**
 * CPU 主类
 * 组合核心模块并驱动多周期状态机
 */
export class CPU implements ICPUEngine {
  private readonly alu = new ALU();
  private readonly decoder = new Decoder();
  private readonly controlUnit = new ControlUnit();
  private readonly registerFile = new RegisterFile();
  private readonly dataMemorySize: number;
  private readonly dataMemory: Memory;

  private instructionMemory = new Uint32Array();
  private pc = 0;
  private instructionPC = 0;
  private IR = 0;
  private MDR = 0;
  private A = 0;
  private B = 0;
  private ALUOut = 0;
  private cycleCount = 0;
  private instructionCount = 0;
  private halted = false;
  private decodedInstruction = this.createUnknownDecodedInstruction(0, 'No instruction loaded');
  private lastALUDetail: CycleSnapshot['aluDetail'] = this.createDefaultALUDetail();
  private lastMemoryAccess: CycleSnapshot['memoryAccess'] = this.createMemoryAccess();
  private lastActiveDataPaths: readonly DataPathActivity[] = [];
  private lastChanges: readonly StateChange[] = [];
  private history: CycleSnapshot[] = [];
  private stateHistory: CPUHistoryState[] = [];

  constructor(dataMemorySize: number = 4096) {
    this.dataMemorySize = dataMemorySize;
    this.dataMemory = new Memory(dataMemorySize);
  }

  loadProgram(instructions: Uint32Array): void {
    this.reset();
    this.instructionMemory = instructions.slice();
    this.halted = instructions.length === 0;
  }

  tick(): CycleSnapshot {
    if (this.halted) {
      return this.getSnapshot();
    }

    const stage = this.controlUnit.getCurrentStage();
    const instruction = stage === Stage.IF ? null : this.decodedInstruction;
    const controlSignals = this.controlUnit.getCurrentSignals(instruction);
    const beforeState = this.captureObservableState();
    let aluDetail = this.createDefaultALUDetail(controlSignals.ALUOp);
    let memoryAccess = this.createMemoryAccess();
    let activeDataPaths: readonly DataPathActivity[] = [];

    switch (stage) {
      case Stage.IF: {
        const fetchedInstruction = this.fetchInstruction(this.pc);
        if (fetchedInstruction === null) {
          this.halted = true;
          this.lastChanges = [];
          this.lastActiveDataPaths = [];
          this.lastMemoryAccess = memoryAccess;
          this.lastALUDetail = aluDetail;
          return this.getSnapshot();
        }

        this.instructionPC = this.pc;
        aluDetail = this.executeALU(this.instructionPC, 4, ALUOp.ADD);
        this.IR = fetchedInstruction;
        this.pc = aluDetail.result;
        this.decodedInstruction = this.safeDecode(fetchedInstruction);
        activeDataPaths = this.createIFPaths(fetchedInstruction, aluDetail.result);
        this.controlUnit.advance();
        break;
      }
      case Stage.ID: {
        this.decodedInstruction = this.safeDecode(this.IR);
        this.A = this.registerFile.read(this.decodedInstruction.rs1);
        this.B = this.registerFile.read(this.decodedInstruction.rs2);
        aluDetail = this.executeALU(this.instructionPC, this.decodedInstruction.immediate, ALUOp.ADD);
        this.ALUOut = aluDetail.result;
        activeDataPaths = this.createIDPaths();
        this.controlUnit.advance(this.decodedInstruction);
        break;
      }
      case Stage.EX: {
        const executeResult = this.executeStage(this.decodedInstruction, controlSignals);
        aluDetail = executeResult.aluDetail;
        memoryAccess = executeResult.memoryAccess;
        activeDataPaths = executeResult.activeDataPaths;
        this.controlUnit.advance(this.decodedInstruction);
        break;
      }
      case Stage.MEM: {
        const memoryResult = this.executeMemoryStage(this.decodedInstruction);
        memoryAccess = memoryResult.memoryAccess;
        activeDataPaths = memoryResult.activeDataPaths;
        this.controlUnit.advance(this.decodedInstruction);
        break;
      }
      case Stage.WB: {
        activeDataPaths = this.executeWriteBackStage(this.decodedInstruction);
        this.controlUnit.advance(this.decodedInstruction);
        break;
      }
    }

    this.cycleCount += 1;
    if (this.didCompleteInstruction(stage, this.decodedInstruction)) {
      this.instructionCount += 1;
    }

    const changes = this.buildChanges(beforeState, this.captureObservableState());
    this.lastALUDetail = aluDetail;
    this.lastMemoryAccess = memoryAccess;
    this.lastActiveDataPaths = activeDataPaths;
    this.lastChanges = changes;

    const snapshot = this.createSnapshot(stage, controlSignals, aluDetail, memoryAccess, activeDataPaths, changes);
    this.history.push(snapshot);
    this.stateHistory.push(this.captureHistoryState());
    return snapshot;
  }

  step(): CycleSnapshot[] {
    if (this.halted) {
      return [];
    }

    const snapshots: CycleSnapshot[] = [];
    const startingInstructionCount = this.instructionCount;

    do {
      snapshots.push(this.tick());
    } while (!this.halted && this.instructionCount === startingInstructionCount);

    return snapshots;
  }

  reset(): void {
    this.pc = 0;
    this.instructionPC = 0;
    this.IR = 0;
    this.MDR = 0;
    this.A = 0;
    this.B = 0;
    this.ALUOut = 0;
    this.cycleCount = 0;
    this.instructionCount = 0;
    this.halted = false;
    this.decodedInstruction = this.createUnknownDecodedInstruction(0, 'No instruction loaded');
    this.lastALUDetail = this.createDefaultALUDetail();
    this.lastMemoryAccess = this.createMemoryAccess();
    this.lastActiveDataPaths = [];
    this.lastChanges = [];
    this.history = [];
    this.stateHistory = [];
    this.controlUnit.reset();
    this.registerFile.reset();
    this.dataMemory.reset();
  }

  getSnapshot(): CycleSnapshot {
    const currentStage = this.controlUnit.getCurrentStage();
    const instruction = currentStage === Stage.IF ? null : this.decodedInstruction;
    const controlSignals = this.controlUnit.getCurrentSignals(instruction);

    return this.createSnapshot(
      currentStage,
      controlSignals,
      this.createPreviewALUDetail(currentStage, controlSignals),
      this.lastMemoryAccess,
      this.createPreviewActiveDataPaths(currentStage, controlSignals),
      this.lastChanges
    );
  }

  getDataMemory(): Uint8Array {
    return this.dumpDataMemory();
  }

  setRegisterValue(index: number, value: number): void {
    this.registerFile.write(index, value);
  }

  setDataMemoryByte(address: number, value: number): void {
    this.dataMemory.writeByte(this.mapDataAddress(address), value);
  }

  getHistory(): CycleSnapshot[] {
    return this.history.slice();
  }

  private createPreviewActiveDataPaths(
    stage: Stage,
    controlSignals: CycleSnapshot['controlSignals']
  ): readonly DataPathActivity[] {
    if (this.halted) {
      return [];
    }

    switch (stage) {
      case Stage.IF: {
        const fetchedInstruction = this.fetchInstruction(this.pc);
        if (fetchedInstruction === null) {
          return [];
        }

        const nextPC = this.executeALU(this.pc, 4, ALUOp.ADD).result;
        return this.createIFPaths(fetchedInstruction, nextPC);
      }
      case Stage.ID:
        return this.createIDPaths(
          this.registerFile.read(this.decodedInstruction.rs1),
          this.registerFile.read(this.decodedInstruction.rs2)
        );
      case Stage.EX:
        return this.previewExecuteStage(this.decodedInstruction, controlSignals);
      case Stage.MEM:
        return this.previewMemoryStage(this.decodedInstruction);
      case Stage.WB:
        return this.createWriteBackPaths(this.decodedInstruction);
      default:
        return [];
    }
  }

  private createPreviewALUDetail(
    stage: Stage,
    controlSignals: CycleSnapshot['controlSignals']
  ): CycleSnapshot['aluDetail'] {
    if (this.halted) {
      return this.lastALUDetail;
    }

    switch (stage) {
      case Stage.IF:
        return this.fetchInstruction(this.pc) === null
          ? this.lastALUDetail
          : this.executeALU(this.pc, 4, ALUOp.ADD);
      case Stage.ID:
        return this.shouldPreviewPcRelativeAdder(this.decodedInstruction)
          ? this.executeALU(this.instructionPC, this.decodedInstruction.immediate, ALUOp.ADD)
          : this.createDefaultALUDetail(controlSignals.ALUOp);
      case Stage.EX:
        return this.previewExecuteALUDetail(this.decodedInstruction, controlSignals);
      default:
        return this.lastALUDetail;
    }
  }

  private shouldPreviewPcRelativeAdder(instruction: DecodedInstruction): boolean {
    return instruction.opcode === 0x17 || instruction.opcode === 0x63 || instruction.opcode === 0x6F;
  }

  rewindTo(cycleNumber: number): CycleSnapshot {
    const index = this.history.findIndex((snapshot) => snapshot.cycleNumber === cycleNumber);
    if (index === -1) {
      throw new Error(`Cycle ${cycleNumber} not found in history`);
    }

    this.restoreHistoryState(this.stateHistory[index]);
    this.history = this.history.slice(0, index + 1);
    this.stateHistory = this.stateHistory.slice(0, index + 1);
    return this.history[index];
  }

  private fetchInstruction(address: number): number | null {
    if (address % 4 !== 0) {
      throw new Error(`Instruction address must be word-aligned: ${address}`);
    }

    const index = address >>> 2;
    if (index < 0 || index >= this.instructionMemory.length) {
      return null;
    }

    return this.instructionMemory[index] >>> 0;
  }

  private executeStage(
    instruction: DecodedInstruction,
    controlSignals: CycleSnapshot['controlSignals']
  ): {
    aluDetail: CycleSnapshot['aluDetail'];
    memoryAccess: CycleSnapshot['memoryAccess'];
    activeDataPaths: readonly DataPathActivity[];
  } {
    if (instruction.opcode === 0x33) {
      const aluDetail = this.executeALU(this.A, this.B, controlSignals.ALUOp);
      this.ALUOut = aluDetail.result;
      return {
        aluDetail,
        memoryAccess: this.createMemoryAccess(),
        activeDataPaths: this.createALUPaths(this.A, this.B, aluDetail.result, 'reg-a', 'reg-b'),
      };
    }

    if (instruction.opcode === 0x13) {
      const aluDetail = this.executeALU(this.A, instruction.immediate, controlSignals.ALUOp);
      this.ALUOut = aluDetail.result;
      return {
        aluDetail,
        memoryAccess: this.createMemoryAccess(),
        activeDataPaths: this.createALUPaths(this.A, instruction.immediate, aluDetail.result, 'reg-a', 'id-decoder'),
      };
    }

    if (instruction.opcode === 0x03 || instruction.opcode === 0x23) {
      const aluDetail = this.executeALU(this.A, instruction.immediate, ALUOp.ADD);
      this.ALUOut = aluDetail.result;
      return {
        aluDetail,
        memoryAccess: this.createMemoryAccess(),
        activeDataPaths: this.createALUPaths(this.A, instruction.immediate, aluDetail.result, 'reg-a', 'id-decoder'),
      };
    }

    if (instruction.opcode === 0x63) {
      const aluDetail = this.executeALU(this.A, this.B, ALUOp.SUB);
      const branchTarget = (this.instructionPC + instruction.immediate) | 0;
      const branchTaken = this.isBranchTaken(instruction);
      this.ALUOut = branchTarget;
      if (branchTaken) {
        this.pc = branchTarget;
      }
      return {
        aluDetail,
        memoryAccess: this.createMemoryAccess(),
        activeDataPaths: this.createBranchPaths(aluDetail.result, aluDetail.zero, branchTarget, branchTaken),
      };
    }

    if (instruction.opcode === 0x6F) {
      const linkValue = (this.instructionPC + 4) | 0;
      const aluDetail = this.executeALU(this.instructionPC, 4, ALUOp.ADD);
      this.pc = (this.instructionPC + instruction.immediate) | 0;
      this.registerFile.write(instruction.rd, linkValue);
      this.ALUOut = linkValue;
      return {
        aluDetail,
        memoryAccess: this.createMemoryAccess(),
        activeDataPaths: this.createJumpPaths(linkValue, this.pc, 'pc0'),
      };
    }

    if (instruction.opcode === 0x67) {
      const linkValue = (this.instructionPC + 4) | 0;
      const target = ((this.A + instruction.immediate) & ~1) | 0;
      const aluDetail = this.executeALU(this.instructionPC, 4, ALUOp.ADD);
      this.pc = target;
      this.registerFile.write(instruction.rd, linkValue);
      this.ALUOut = linkValue;
      return {
        aluDetail,
        memoryAccess: this.createMemoryAccess(),
        activeDataPaths: this.createJumpPaths(linkValue, target, 'reg-a'),
      };
    }

    if (instruction.opcode === 0x37) {
      const aluDetail = {
        inputA: 0,
        inputB: instruction.immediate,
        operation: ALUOp.PASS_B,
        result: instruction.immediate | 0,
        zero: instruction.immediate === 0,
      } satisfies CycleSnapshot['aluDetail'];
      this.ALUOut = aluDetail.result;
      return {
        aluDetail,
        memoryAccess: this.createMemoryAccess(),
        activeDataPaths: this.createALUPaths(0, instruction.immediate, aluDetail.result, 'pc0', 'id-decoder'),
      };
    }

    const aluDetail = this.executeALU(this.instructionPC, instruction.immediate, ALUOp.ADD);
    this.ALUOut = aluDetail.result;
    return {
      aluDetail,
      memoryAccess: this.createMemoryAccess(),
      activeDataPaths: this.createALUPaths(this.instructionPC, instruction.immediate, aluDetail.result, 'pc0', 'id-decoder'),
    };
  }

  private previewExecuteStage(
    instruction: DecodedInstruction,
    controlSignals: CycleSnapshot['controlSignals']
  ): readonly DataPathActivity[] {
    if (instruction.opcode === 0x33) {
      const aluDetail = this.executeALU(this.A, this.B, controlSignals.ALUOp);
      return this.createALUPaths(this.A, this.B, aluDetail.result, 'reg-a', 'reg-b');
    }

    if (instruction.opcode === 0x13) {
      const aluDetail = this.executeALU(this.A, instruction.immediate, controlSignals.ALUOp);
      return this.createALUPaths(this.A, instruction.immediate, aluDetail.result, 'reg-a', 'id-decoder');
    }

    if (instruction.opcode === 0x03 || instruction.opcode === 0x23) {
      const aluDetail = this.executeALU(this.A, instruction.immediate, ALUOp.ADD);
      return this.createALUPaths(this.A, instruction.immediate, aluDetail.result, 'reg-a', 'id-decoder');
    }

    if (instruction.opcode === 0x63) {
      const aluDetail = this.executeALU(this.A, this.B, ALUOp.SUB);
      const branchTarget = (this.instructionPC + instruction.immediate) | 0;
      const branchTaken = this.isBranchTaken(instruction);
      return this.createBranchPaths(aluDetail.result, aluDetail.zero, branchTarget, branchTaken);
    }

    if (instruction.opcode === 0x6F) {
      const linkValue = (this.instructionPC + 4) | 0;
      const target = (this.instructionPC + instruction.immediate) | 0;
      return this.createJumpPaths(linkValue, target, 'pc0');
    }

    if (instruction.opcode === 0x67) {
      const linkValue = (this.instructionPC + 4) | 0;
      const target = ((this.A + instruction.immediate) & ~1) | 0;
      return this.createJumpPaths(linkValue, target, 'reg-a');
    }

    if (instruction.opcode === 0x37) {
      return this.createALUPaths(0, instruction.immediate, instruction.immediate | 0, 'pc0', 'id-decoder');
    }

    const aluDetail = this.executeALU(this.instructionPC, instruction.immediate, ALUOp.ADD);
    return this.createALUPaths(this.instructionPC, instruction.immediate, aluDetail.result, 'pc0', 'id-decoder');
  }

  private previewExecuteALUDetail(
    instruction: DecodedInstruction,
    controlSignals: CycleSnapshot['controlSignals']
  ): CycleSnapshot['aluDetail'] {
    if (instruction.opcode === 0x33) {
      return this.executeALU(this.A, this.B, controlSignals.ALUOp);
    }

    if (instruction.opcode === 0x13) {
      return this.executeALU(this.A, instruction.immediate, controlSignals.ALUOp);
    }

    if (instruction.opcode === 0x03 || instruction.opcode === 0x23) {
      return this.executeALU(this.A, instruction.immediate, ALUOp.ADD);
    }

    if (instruction.opcode === 0x63) {
      return this.executeALU(this.A, this.B, ALUOp.SUB);
    }

    if (instruction.opcode === 0x6F || instruction.opcode === 0x67) {
      return this.executeALU(this.instructionPC, 4, ALUOp.ADD);
    }

    if (instruction.opcode === 0x37) {
      return {
        inputA: 0,
        inputB: instruction.immediate,
        operation: ALUOp.PASS_B,
        result: instruction.immediate | 0,
        zero: instruction.immediate === 0,
      };
    }

    return this.executeALU(this.instructionPC, instruction.immediate, ALUOp.ADD);
  }

  private executeMemoryStage(instruction: DecodedInstruction): {
    memoryAccess: CycleSnapshot['memoryAccess'];
    activeDataPaths: readonly DataPathActivity[];
  } {
    if (instruction.opcode === 0x03) {
      const value = this.readLoadValue(instruction, this.ALUOut);
      this.MDR = value;
      return {
        memoryAccess: this.createMemoryAccess('read', this.ALUOut, value),
        activeDataPaths: this.createMemoryPaths('read', this.ALUOut, value),
      };
    }

    this.writeStoreValue(instruction, this.ALUOut, this.B);
    return {
      memoryAccess: this.createMemoryAccess('write', this.ALUOut, this.B),
      activeDataPaths: this.createMemoryPaths('write', this.ALUOut, this.B),
    };
  }

  private previewMemoryStage(instruction: DecodedInstruction): readonly DataPathActivity[] {
    if (instruction.opcode === 0x03) {
      return this.createMemoryPaths('read', this.ALUOut, this.readLoadValue(instruction, this.ALUOut));
    }

    if (instruction.opcode === 0x23) {
      return this.createMemoryPaths('write', this.ALUOut, this.B);
    }

    return [];
  }

  private executeWriteBackStage(instruction: DecodedInstruction): readonly DataPathActivity[] {
    const value = instruction.opcode === 0x03 ? this.MDR : this.ALUOut;
    this.registerFile.write(instruction.rd, value);

    return this.createWriteBackPaths(instruction);
  }

  private createWriteBackPaths(instruction: DecodedInstruction): readonly DataPathActivity[] {
    const value = instruction.opcode === 0x03 ? this.MDR : this.ALUOut;
    const sourceComponent = instruction.opcode === 0x03 ? 'mdr' : 'alu-out';

    return [
      this.createPath(sourceComponent, 'mux-wb', 'out', instruction.opcode === 0x03 ? 'in1' : 'in0', value, 32, 'data'),
      this.createPath('mux-wb', 'reg-file', 'out', 'write_data', value, 32, 'data'),
    ];
  }

  private readLoadValue(instruction: DecodedInstruction, address: number): number {
    const mappedAddress = this.mapDataAddress(address);

    switch (instruction.funct3) {
      case 0x0:
        return this.signExtend(this.dataMemory.readByte(mappedAddress), 8);
      case 0x1:
        return this.signExtend(this.dataMemory.readHalfWord(mappedAddress), 16);
      case 0x2:
        return this.dataMemory.readWord(mappedAddress);
      case 0x4:
        return this.dataMemory.readByte(mappedAddress);
      case 0x5:
        return this.dataMemory.readHalfWord(mappedAddress);
      default:
        throw new Error(`Unsupported load funct3: ${instruction.funct3}`);
    }
  }

  private writeStoreValue(instruction: DecodedInstruction, address: number, value: number): void {
    const mappedAddress = this.mapDataAddress(address);

    switch (instruction.funct3) {
      case 0x0:
        this.dataMemory.writeByte(mappedAddress, value);
        return;
      case 0x1:
        this.dataMemory.writeHalfWord(mappedAddress, value);
        return;
      case 0x2:
        this.dataMemory.writeWord(mappedAddress, value);
        return;
      default:
        throw new Error(`Unsupported store funct3: ${instruction.funct3}`);
    }
  }

  private mapDataAddress(address: number): number {
    return (address >>> 0) % this.dataMemorySize;
  }

  private isBranchTaken(instruction: DecodedInstruction): boolean {
    switch (instruction.funct3) {
      case 0x0:
        return this.A === this.B;
      case 0x1:
        return this.A !== this.B;
      case 0x4:
        return (this.A | 0) < (this.B | 0);
      case 0x5:
        return (this.A | 0) >= (this.B | 0);
      case 0x6:
        return (this.A >>> 0) < (this.B >>> 0);
      case 0x7:
        return (this.A >>> 0) >= (this.B >>> 0);
      default:
        throw new Error(`Unsupported branch funct3: ${instruction.funct3}`);
    }
  }

  private didCompleteInstruction(stage: Stage, instruction: DecodedInstruction): boolean {
    if (stage === Stage.WB) {
      return true;
    }

    if (stage === Stage.MEM && instruction.opcode === 0x23) {
      return true;
    }

    if (stage === Stage.EX && (instruction.opcode === 0x63 || instruction.opcode === 0x67 || instruction.opcode === 0x6F)) {
      return true;
    }

    return false;
  }

  private captureObservableState(): ObservableCPUState {
    return {
      pc: this.pc,
      IR: this.IR,
      MDR: this.MDR,
      A: this.A,
      B: this.B,
      ALUOut: this.ALUOut,
      registers: this.registerFile.getAll(),
    };
  }

  private buildChanges(before: ObservableCPUState, after: ObservableCPUState): StateChange[] {
    const changes: StateChange[] = [];
    const scalarKeys: Array<keyof Omit<ObservableCPUState, 'registers'>> = ['pc', 'IR', 'MDR', 'A', 'B', 'ALUOut'];

    for (const key of scalarKeys) {
      if (before[key] !== after[key]) {
        changes.push({
          target: key,
          oldValue: before[key],
          newValue: after[key],
        });
      }
    }

    for (let index = 0; index < before.registers.length; index++) {
      if (before.registers[index] !== after.registers[index]) {
        changes.push({
          target: `registers[${index}]`,
          oldValue: before.registers[index],
          newValue: after.registers[index],
        });
      }
    }

    return changes;
  }

  private createSnapshot(
    stage: Stage,
    controlSignals: CycleSnapshot['controlSignals'],
    aluDetail: CycleSnapshot['aluDetail'],
    memoryAccess: CycleSnapshot['memoryAccess'],
    activeDataPaths: readonly DataPathActivity[],
    changes: readonly StateChange[]
  ): CycleSnapshot {
    return {
      cycleNumber: this.cycleCount,
      stage,
      instructionIndex: this.instructionCount,
      decodedInstruction: this.decodedInstruction,
      pc: this.pc,
      nextPC: this.pc,
      registers: this.registerFile.getAll(),
      pipelineRegs: {
        IR: this.IR,
        MDR: this.MDR,
        A: this.A,
        B: this.B,
        ALUOut: this.ALUOut,
      },
      controlSignals,
      aluDetail,
      activeDataPaths,
      memoryAccess,
      changes,
    };
  }

  private captureHistoryState(): CPUHistoryState {
    return {
      pc: this.pc,
      instructionPC: this.instructionPC,
      IR: this.IR,
      MDR: this.MDR,
      A: this.A,
      B: this.B,
      ALUOut: this.ALUOut,
      cycleCount: this.cycleCount,
      instructionCount: this.instructionCount,
      halted: this.halted,
      currentStage: this.controlUnit.getCurrentStage(),
      decodedInstruction: { ...this.decodedInstruction },
      instructionMemory: this.instructionMemory.slice(),
      dataMemory: this.dumpDataMemory(),
      registers: this.registerFile.getAll(),
      lastALUDetail: { ...this.lastALUDetail },
      lastMemoryAccess: { ...this.lastMemoryAccess },
      lastActiveDataPaths: this.lastActiveDataPaths.map((path) => ({ ...path })),
      lastChanges: this.lastChanges.map((change) => ({ ...change })),
    };
  }

  private restoreHistoryState(state: CPUHistoryState): void {
    this.pc = state.pc;
    this.instructionPC = state.instructionPC;
    this.IR = state.IR;
    this.MDR = state.MDR;
    this.A = state.A;
    this.B = state.B;
    this.ALUOut = state.ALUOut;
    this.cycleCount = state.cycleCount;
    this.instructionCount = state.instructionCount;
    this.halted = state.halted;
    this.decodedInstruction = { ...state.decodedInstruction };
    this.instructionMemory = state.instructionMemory.slice();
    this.controlUnit.setCurrentStage(state.currentStage);
    this.registerFile.reset();
    state.registers.forEach((value, index) => this.registerFile.write(index, value));
    this.dataMemory.reset();
    this.dataMemory.load(state.dataMemory);
    this.lastALUDetail = { ...state.lastALUDetail };
    this.lastMemoryAccess = { ...state.lastMemoryAccess };
    this.lastActiveDataPaths = state.lastActiveDataPaths.map((path) => ({ ...path }));
    this.lastChanges = state.lastChanges.map((change) => ({ ...change }));
  }

  private dumpDataMemory(): Uint8Array {
    const dump = new Uint8Array(this.dataMemorySize);
    for (let index = 0; index < this.dataMemorySize; index++) {
      dump[index] = this.dataMemory.readByte(index);
    }
    return dump;
  }

  private executeALU(inputA: number, inputB: number, operation: ALUOp): CycleSnapshot['aluDetail'] {
    const result = this.alu.execute(inputA, inputB, operation);
    return {
      inputA,
      inputB,
      operation,
      result: result.result,
      zero: result.zero,
    };
  }

  private createUnknownDecodedInstruction(raw: number, description: string): DecodedInstruction {
    return {
      raw,
      format: 'R',
      opcode: raw & 0x7F,
      rd: (raw >>> 7) & 0x1F,
      funct3: (raw >>> 12) & 0x7,
      rs1: (raw >>> 15) & 0x1F,
      rs2: (raw >>> 20) & 0x1F,
      funct7: (raw >>> 25) & 0x7F,
      immediate: 0,
      asmString: 'unknown',
      description,
    };
  }

  private safeDecode(raw: number): DecodedInstruction {
    try {
      return this.decoder.decode(raw);
    } catch {
      return this.createUnknownDecodedInstruction(raw, `Unable to decode 0x${raw.toString(16).padStart(8, '0')}`);
    }
  }

  private signExtend(value: number, bits: number): number {
    const shift = 32 - bits;
    return (value << shift) >> shift;
  }

  private createDefaultALUDetail(operation: ALUOp = ALUOp.ADD): CycleSnapshot['aluDetail'] {
    return {
      inputA: 0,
      inputB: 0,
      operation,
      result: 0,
      zero: true,
    };
  }

  private createMemoryAccess(
    type: 'none' | 'read' | 'write' = 'none',
    address: number = 0,
    data: number = 0
  ): CycleSnapshot['memoryAccess'] {
    return { type, address, data };
  }

  private createIFPaths(fetchedInstruction: number, nextPC: number): readonly DataPathActivity[] {
    return [
      this.createPath('pc', 'instr-mem', 'out', 'addr', this.instructionPC, 32, 'address'),
      this.createPath('instr-mem', 'ir', 'data_out', 'in', fetchedInstruction, 32, 'data'),
      this.createPath('pc', 'pc0', 'out', 'in', this.instructionPC, 32, 'address'),
      this.createPath('pc', 'pc-plus4', 'out', 'a', this.instructionPC, 32, 'address'),
      this.createPath('const-4', 'pc-plus4', 'out', 'b', 4, 32, 'data'),
      this.createPath('pc-plus4', 'alu-src-a', 'out', 'in0', nextPC, 32, 'address'),
      this.createPath('alu-src-a', 'pc', 'out', 'in', nextPC, 32, 'address'),
    ];
  }

  private createIDPaths(rs1Value: number = this.A, rs2Value: number = this.B): readonly DataPathActivity[] {
    return [
      this.createPath('ir', 'id-decoder', 'out', 'instruction', this.IR, 32, 'data'),
      this.createPath('id-decoder', 'control-unit', 'opcode', 'opcode', this.decodedInstruction.opcode, 7, 'data'),
      this.createPath('id-decoder', 'control-unit', 'funct7', 'funct7', this.decodedInstruction.funct7, 7, 'data'),
      this.createPath('id-decoder', 'control-unit', 'funct3', 'funct3', this.decodedInstruction.funct3, 3, 'data'),
      this.createPath('id-decoder', 'reg-file', 'rs1', 'rs1_addr', this.decodedInstruction.rs1, 5, 'data'),
      this.createPath('id-decoder', 'reg-file', 'rs2', 'rs2_addr', this.decodedInstruction.rs2, 5, 'data'),
      this.createPath('id-decoder', 'reg-file', 'rd', 'rd_addr', this.decodedInstruction.rd, 5, 'data'),
      this.createPath('reg-file', 'reg-a', 'rs1_data', 'in', rs1Value, 32, 'data'),
      this.createPath('reg-file', 'reg-b', 'rs2_data', 'in', rs2Value, 32, 'data'),
    ];
  }

  private createALUPaths(
    inputA: number,
    inputB: number,
    result: number,
    inputASource: 'reg-a' | 'pc0',
    inputBSource: 'reg-b' | 'id-decoder'
  ): readonly DataPathActivity[] {
    const paths: DataPathActivity[] = [];

    if (inputASource === 'pc0') {
      paths.push(this.createPath('pc0', 'alu', 'out', 'a', inputA, 32, 'address'));
    } else {
      paths.push(this.createPath('reg-a', 'alu', 'out', 'a', inputA, 32, 'data'));
    }

    if (inputBSource === 'id-decoder') {
      paths.push(this.createPath('id-decoder', 'alu-src-b', 'imm32', 'in1', inputB, 32, 'data'));
      paths.push(this.createPath('alu-src-b', 'alu', 'out', 'b', inputB, 32, 'data'));
    } else {
      paths.push(this.createPath('reg-b', 'alu-src-b', 'out', 'in0', inputB, 32, 'data'));
      paths.push(this.createPath('alu-src-b', 'alu', 'out', 'b', inputB, 32, 'data'));
    }

    paths.push(this.createPath('alu', 'alu-out', 'result', 'in', result, 32, 'data'));
    return paths;
  }

  private createBranchPaths(
    compareResult: number,
    zeroFlag: boolean,
    target: number,
    branchTaken: boolean
  ): readonly DataPathActivity[] {
    const paths = [
      ...this.createALUPaths(this.A, this.B, compareResult, 'reg-a', 'reg-b'),
      this.createPath('alu', 'branch-logic', 'result', 'in', zeroFlag ? 1 : 0, 1, 'control'),
      this.createPath('branch-logic', 'flag-reg', 'out', 'in', zeroFlag ? 1 : 0, 1, 'control'),
      this.createPath('pc0', 'jump-target', 'out', 'a', this.instructionPC, 32, 'address'),
      this.createPath('id-decoder', 'jump-target', 'imm32', 'b', this.decodedInstruction.immediate, 32, 'data'),
    ];

    if (branchTaken) {
      paths.push(this.createPath('jump-target', 'alu-src-a', 'out', 'in2', target, 32, 'address'));
      paths.push(this.createPath('alu-src-a', 'pc', 'out', 'in', target, 32, 'address'));
    }

    return paths;
  }

  private createJumpPaths(linkValue: number, target: number, baseSource: 'pc0' | 'reg-a'): readonly DataPathActivity[] {
    return [
      this.createPath(baseSource, 'jump-target', 'out', 'a', baseSource === 'pc0' ? this.instructionPC : this.A, 32, 'address'),
      this.createPath('id-decoder', 'jump-target', 'imm32', 'b', this.decodedInstruction.immediate, 32, 'data'),
      this.createPath('jump-target', 'alu-src-a', 'out', 'in2', target, 32, 'address'),
      this.createPath('alu-src-a', 'pc', 'out', 'in', target, 32, 'address'),
      this.createPath('pc', 'pc-plus4', 'out', 'a', this.instructionPC, 32, 'address'),
      this.createPath('const-4', 'pc-plus4', 'out', 'b', 4, 32, 'data'),
      this.createPath('pc-plus4', 'mux-wb', 'out', 'in2', linkValue, 32, 'data'),
      this.createPath('mux-wb', 'reg-file', 'out', 'write_data', linkValue, 32, 'data'),
    ];
  }

  private createMemoryPaths(
    type: 'read' | 'write',
    address: number,
    value: number
  ): readonly DataPathActivity[] {
    const paths = [
      this.createPath('alu-out', 'data-mem', 'out', 'addr', address, 32, 'address'),
    ];

    if (type === 'read') {
      paths.push(this.createPath('data-mem', 'mdr', 'data_out', 'in', value, 32, 'data'));
    } else {
      paths.push(this.createPath('reg-b', 'data-mem', 'out', 'write_data', value, 32, 'data'));
    }

    return paths;
  }

  private createPath(
    from: string,
    to: string,
    portFrom: string,
    portTo: string,
    value: number,
    busWidth: number,
    signalType: 'data' | 'control' | 'address'
  ): DataPathActivity {
    return { from, to, portFrom, portTo, value, busWidth, signalType };
  }
}
