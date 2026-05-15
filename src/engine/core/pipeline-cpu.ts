import {
  ALUOp,
  Stage,
  type ControlSignals,
  type CycleSnapshot,
  type DataPathActivity,
  type DecodedInstruction,
  type EXMEMPipelineRegister,
  type ICPUEngine,
  type IDEXPipelineRegister,
  type IFIDPipelineRegister,
  type MEMWBPipelineRegister,
  type PipelineConflictEvent,
  type PipelineControlHazardStrategy,
  type PipelineForwardingSnapshot,
  type PipelineForwardingSignal,
  type PipelineForwardingSignalName,
  type PipelineForwardingSource,
  type PipelineHazardSnapshot,
  type PipelineInstructionRef,
  type PipelineInstructionSlot,
  type PipelineSnapshot,
  type StateChange,
} from '../../types';
import { ALU } from './alu';
import { ControlUnit } from './control';
import { Decoder } from './decoder';
import { ForwardingUnit } from './forwarding-unit';
import { HazardUnit } from './hazard-unit';
import { Memory } from './memory';
import {
  createEmptyEXMEMPipelineRegister,
  createEmptyIDEXPipelineRegister,
  createEmptyIFIDPipelineRegister,
  createEmptyMEMWBPipelineRegister,
  createEmptyPipelineInstructionSlot,
  createNoPipelineForwarding,
  createNoPipelineHazard,
  createPipelineDefaultControlSignals,
} from './pipeline-state';
import { RegisterFile } from './register-file';

interface ObservablePipelineCPUState {
  pc: number;
  registers: number[];
}

interface PipelineCPUHistoryState {
  pc: number;
  cycleCount: number;
  instructionCount: number;
  halted: boolean;
  fetchStopped: boolean;
  instructionMemory: Uint32Array;
  dataMemory: Uint8Array;
  registers: number[];
  ifId: IFIDPipelineRegister;
  idEx: IDEXPipelineRegister;
  exMem: EXMEMPipelineRegister;
  memWb: MEMWBPipelineRegister;
  lastHazard: PipelineHazardSnapshot;
  lastForwarding: PipelineForwardingSnapshot;
  controlHazardStrategy: PipelineControlHazardStrategy;
  lastConflicts: readonly PipelineConflictEvent[];
  lastALUDetail: CycleSnapshot['aluDetail'];
  lastMemoryAccess: CycleSnapshot['memoryAccess'];
  lastActiveDataPaths: readonly DataPathActivity[];
  lastChanges: readonly StateChange[];
}

interface ExecuteResult {
  register: EXMEMPipelineRegister;
  aluDetail: CycleSnapshot['aluDetail'];
  redirectPC: number | null;
}

interface MemoryResult {
  register: MEMWBPipelineRegister;
  memoryAccess: CycleSnapshot['memoryAccess'];
}

export interface PipelineCPUOptions {
  forwardingEnabled?: boolean;
  controlHazardStrategy?: PipelineControlHazardStrategy;
}

export class PipelineCPU implements ICPUEngine {
  private readonly alu = new ALU();
  private readonly decoder = new Decoder();
  private readonly controlUnit = new ControlUnit();
  private readonly registerFile = new RegisterFile();
  private readonly hazardUnit = new HazardUnit();
  private readonly forwardingUnit = new ForwardingUnit();
  private readonly dataMemorySize: number;
  private readonly dataMemory: Memory;
  private forwardingEnabled: boolean;
  private controlHazardStrategy: PipelineControlHazardStrategy;

  private instructionMemory = new Uint32Array();
  private pc = 0;
  private cycleCount = 0;
  private instructionCount = 0;
  private halted = false;
  private fetchStopped = false;
  private ifId = createEmptyIFIDPipelineRegister();
  private idEx = createEmptyIDEXPipelineRegister();
  private exMem = createEmptyEXMEMPipelineRegister();
  private memWb = createEmptyMEMWBPipelineRegister();
  private lastHazard: PipelineHazardSnapshot = createNoPipelineHazard();
  private lastForwarding: PipelineForwardingSnapshot = createNoPipelineForwarding();
  private lastConflicts: readonly PipelineConflictEvent[] = [];
  private lastALUDetail: CycleSnapshot['aluDetail'] = this.createDefaultALUDetail();
  private lastMemoryAccess: CycleSnapshot['memoryAccess'] = this.createMemoryAccess();
  private lastActiveDataPaths: readonly DataPathActivity[] = [];
  private lastChanges: readonly StateChange[] = [];
  private history: CycleSnapshot[] = [];
  private stateHistory: PipelineCPUHistoryState[] = [];

  constructor(dataMemorySize: number = 4096, options: PipelineCPUOptions = {}) {
    this.dataMemorySize = dataMemorySize;
    this.dataMemory = new Memory(dataMemorySize);
    this.forwardingEnabled = options.forwardingEnabled ?? false;
    this.controlHazardStrategy = options.controlHazardStrategy ?? 'predict-not-taken';
  }

  setForwardingEnabled(enabled: boolean): void {
    this.forwardingEnabled = enabled;
    this.lastForwarding = createNoPipelineForwarding(enabled);
    this.lastConflicts = [];
  }

  isForwardingEnabled(): boolean {
    return this.forwardingEnabled;
  }

  setControlHazardStrategy(strategy: PipelineControlHazardStrategy): void {
    this.controlHazardStrategy = strategy;
    this.lastHazard = createNoPipelineHazard();
    this.lastConflicts = [];
  }

  getControlHazardStrategy(): PipelineControlHazardStrategy {
    return this.controlHazardStrategy;
  }

  loadProgram(instructions: Uint32Array): void {
    this.reset();
    this.instructionMemory = instructions.slice();
    this.fetchStopped = instructions.length === 0;
    this.halted = instructions.length === 0;
  }

  tick(): CycleSnapshot {
    if (this.halted) {
      return this.getSnapshot();
    }

    const beforeState = this.captureObservableState();

    this.executeWriteBackStage(this.memWb);
    if (this.isValid(this.memWb)) {
      this.instructionCount += 1;
    }

    const memoryResult = this.executeMemoryStage(this.exMem);
    const forwarding = this.forwardingUnit.evaluate({
      enabled: this.forwardingEnabled,
      idEx: this.idEx,
      exMem: this.exMem,
      memWb: this.memWb,
    });
    const executeResult = this.executeExecuteStage(this.idEx, forwarding, memoryResult.register);
    const hazard = this.hazardUnit.evaluate({
      ifId: this.ifId,
      idEx: this.idEx,
      exMem: this.exMem,
      memWb: this.memWb,
      redirectPC: executeResult.redirectPC,
      forwardingEnabled: this.forwardingEnabled,
      controlStrategy: this.controlHazardStrategy,
    });
    const conflicts = this.createConflictEvents(hazard, forwarding, this.idEx, this.cycleCount + 1);

    let nextIdEx = createEmptyIDEXPipelineRegister();
    let nextIfId = createEmptyIFIDPipelineRegister();

    if (hazard.action === 'flush' && hazard.control && hazard.control.redirectPC !== null) {
      this.pc = hazard.control.redirectPC;
      this.fetchStopped = false;
      nextIdEx = this.createFlushedIDEXRegister();
      nextIfId = this.createFlushedIFIDRegister();
    } else if (hazard.type === 'raw') {
      nextIdEx = this.createBubbleIDEXRegister();
      nextIfId = this.cloneIFIDRegister(this.ifId);
    } else if (hazard.type === 'control' && hazard.action === 'stall') {
      nextIdEx = this.executeDecodeStage(this.ifId);
      nextIfId = this.createStalledIFIDRegister();
    } else {
      nextIdEx = this.executeDecodeStage(this.ifId);
      nextIfId = this.executeFetchStage();
    }

    this.memWb = memoryResult.register;
    this.exMem = executeResult.register;
    this.idEx = nextIdEx;
    this.ifId = nextIfId;
    this.cycleCount += 1;

    if (this.fetchStopped && !this.hasLivePipelineWork()) {
      this.halted = true;
    }

    this.lastHazard = this.cloneHazard(hazard);
    this.lastForwarding = this.cloneForwarding(forwarding);
    this.lastConflicts = this.cloneConflictEvents(conflicts);
    this.lastALUDetail = executeResult.aluDetail;
    this.lastMemoryAccess = memoryResult.memoryAccess;
    this.lastActiveDataPaths = [];
    this.lastChanges = this.buildChanges(beforeState, this.captureObservableState());

    const snapshot = this.createSnapshot();
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
    this.cycleCount = 0;
    this.instructionCount = 0;
    this.halted = false;
    this.fetchStopped = false;
    this.ifId = createEmptyIFIDPipelineRegister();
    this.idEx = createEmptyIDEXPipelineRegister();
    this.exMem = createEmptyEXMEMPipelineRegister();
    this.memWb = createEmptyMEMWBPipelineRegister();
    this.lastHazard = createNoPipelineHazard();
    this.lastForwarding = createNoPipelineForwarding(this.forwardingEnabled);
    this.lastConflicts = [];
    this.lastALUDetail = this.createDefaultALUDetail();
    this.lastMemoryAccess = this.createMemoryAccess();
    this.lastActiveDataPaths = [];
    this.lastChanges = [];
    this.history = [];
    this.stateHistory = [];
    this.registerFile.reset();
    this.dataMemory.reset();
  }

  getSnapshot(): CycleSnapshot {
    return this.createSnapshot();
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

  private executeFetchStage(): IFIDPipelineRegister {
    if (this.fetchStopped) {
      return createEmptyIFIDPipelineRegister();
    }

    const instructionWord = this.fetchInstruction(this.pc);
    if (instructionWord === null) {
      this.fetchStopped = true;
      return createEmptyIFIDPipelineRegister();
    }

    const pc = this.pc;
    this.pc = (this.pc + 4) | 0;

    return {
      status: 'valid',
      pc,
      pcPlus4: this.pc,
      instructionWord,
      decodedInstruction: this.safeDecode(instructionWord),
    };
  }

  private executeDecodeStage(register: IFIDPipelineRegister): IDEXPipelineRegister {
    if (!this.isValid(register) || !register.decodedInstruction) {
      return createEmptyIDEXPipelineRegister();
    }

    const instruction = register.decodedInstruction;
    return {
      status: 'valid',
      pc: register.pc,
      pcPlus4: register.pcPlus4,
      instructionWord: register.instructionWord,
      decodedInstruction: this.cloneDecodedInstruction(instruction),
      rs1: instruction.rs1,
      rs2: instruction.rs2,
      rd: instruction.rd,
      rs1Value: this.registerFile.read(instruction.rs1),
      rs2Value: this.registerFile.read(instruction.rs2),
      immediate: instruction.immediate,
      controlSignals: this.getPipelineControlSignals(Stage.EX, instruction),
    };
  }

  private executeExecuteStage(
    register: IDEXPipelineRegister,
    forwarding: PipelineForwardingSnapshot,
    exMemForwardRegister: MEMWBPipelineRegister
  ): ExecuteResult {
    if (!this.isValid(register) || !register.decodedInstruction) {
      return {
        register: createEmptyEXMEMPipelineRegister(),
        aluDetail: this.createDefaultALUDetail(),
        redirectPC: null,
      };
    }

    const instruction = register.decodedInstruction;
    const executeSignals = this.getPipelineControlSignals(Stage.EX, instruction);
    let rs1Value = register.rs1Value;
    let rs2Value = register.rs2Value;
    let storeWriteData = register.rs2Value;
    let operation = executeSignals.ALUOp;
    let aluResult = 0;
    let zero = false;
    let branchTarget = 0;
    let branchTaken = false;
    let redirectPC: number | null = null;

    if (forwarding.ForwardA.source !== 'none') {
      rs1Value = this.resolveForwardedValue(forwarding.ForwardA.source, exMemForwardRegister, this.memWb);
    }

    if (forwarding.ForwardB.source !== 'none') {
      rs2Value = this.resolveForwardedValue(forwarding.ForwardB.source, exMemForwardRegister, this.memWb);
    }

    if (forwarding.StoreForward.source !== 'none') {
      storeWriteData = this.resolveForwardedValue(forwarding.StoreForward.source, exMemForwardRegister, this.memWb);
    }

    let inputA = rs1Value;
    let inputB = rs2Value;

    switch (instruction.opcode) {
      case 0x33:
        break;
      case 0x13:
      case 0x03:
      case 0x23:
      case 0x67:
        inputB = register.immediate;
        operation = instruction.opcode === 0x13 ? executeSignals.ALUOp : ALUOp.ADD;
        break;
      case 0x63:
        operation = ALUOp.SUB;
        branchTarget = (register.pc + register.immediate) | 0;
        branchTaken = this.isBranchTaken(instruction, rs1Value, rs2Value);
        if (branchTaken) {
          redirectPC = branchTarget;
        }
        break;
      case 0x6F:
        inputA = register.pc;
        inputB = 4;
        operation = ALUOp.ADD;
        branchTarget = (register.pc + register.immediate) | 0;
        branchTaken = true;
        redirectPC = branchTarget;
        break;
      case 0x17:
        inputA = register.pc;
        inputB = register.immediate;
        operation = ALUOp.ADD;
        break;
      case 0x37:
        aluResult = register.immediate | 0;
        zero = aluResult === 0;
        break;
      default:
        inputA = register.pc;
        inputB = register.immediate;
        operation = ALUOp.ADD;
        break;
    }

    if (instruction.opcode !== 0x37) {
      const result = this.alu.execute(inputA, inputB, operation);
      aluResult = result.result;
      zero = result.zero;
    }

    if (instruction.opcode === 0x63) {
      zero = rs1Value === rs2Value;
    }

    if (instruction.opcode === 0x67) {
      branchTarget = aluResult & ~1;
      branchTaken = true;
      redirectPC = branchTarget;
      aluResult = register.pcPlus4;
    } else if (instruction.opcode === 0x6F) {
      aluResult = register.pcPlus4;
    }

    return {
      register: {
        status: 'valid',
        pc: register.pc,
        pcPlus4: register.pcPlus4,
        instructionWord: register.instructionWord,
        decodedInstruction: this.cloneDecodedInstruction(instruction),
        rd: register.rd,
        aluResult,
        writeData: storeWriteData,
        branchTarget,
        branchTaken,
        zero,
        controlSignals: this.getPipelineControlSignals(Stage.MEM, instruction),
      },
      aluDetail: {
        inputA,
        inputB,
        operation,
        result: aluResult,
        zero,
      },
      redirectPC,
    };
  }

  private executeMemoryStage(register: EXMEMPipelineRegister): MemoryResult {
    if (!this.isValid(register) || !register.decodedInstruction) {
      return {
        register: createEmptyMEMWBPipelineRegister(),
        memoryAccess: this.createMemoryAccess(),
      };
    }

    const instruction = register.decodedInstruction;
    let readData = 0;
    let writeData = register.aluResult;
    let memoryAccess = this.createMemoryAccess();

    if (instruction.opcode === 0x03) {
      readData = this.readLoadValue(instruction, register.aluResult);
      writeData = readData;
      memoryAccess = this.createMemoryAccess('read', register.aluResult, readData);
    } else if (instruction.opcode === 0x23) {
      this.writeStoreValue(instruction, register.aluResult, register.writeData);
      writeData = register.writeData;
      memoryAccess = this.createMemoryAccess('write', register.aluResult, register.writeData);
    }

    return {
      register: {
        status: 'valid',
        pc: register.pc,
        pcPlus4: register.pcPlus4,
        instructionWord: register.instructionWord,
        decodedInstruction: this.cloneDecodedInstruction(instruction),
        rd: register.rd,
        aluResult: register.aluResult,
        readData,
        immediate: instruction.immediate,
        writeData,
        controlSignals: this.getPipelineControlSignals(Stage.WB, instruction),
      },
      memoryAccess,
    };
  }

  private executeWriteBackStage(register: MEMWBPipelineRegister): void {
    if (!this.isValid(register) || !register.decodedInstruction) {
      return;
    }

    if (this.writesRegister(register.decodedInstruction)) {
      this.registerFile.write(register.rd, register.writeData);
    }
  }

  private createSnapshot(): CycleSnapshot {
    const pipeline = this.createPipelineSnapshot();
    const displaySlot = this.resolveDisplaySlot(pipeline);
    const decodedInstruction =
      displaySlot.decodedInstruction ??
      this.createUnknownDecodedInstruction(displaySlot.instructionWord, 'No instruction loaded');

    return {
      cycleNumber: this.cycleCount,
      stage: displaySlot.stage,
      instructionIndex: this.instructionCount,
      instructionAddress: displaySlot.pc,
      decodedInstruction,
      pc: this.pc,
      nextPC: this.pc,
      registers: this.registerFile.getAll(),
      pipelineRegs: {
        IR: this.ifId.instructionWord,
        MDR: this.memWb.readData,
        A: this.idEx.rs1Value,
        B: this.idEx.rs2Value,
        ALUOut: this.exMem.aluResult,
      },
      pipeline,
      controlSignals: this.halted || !displaySlot.decodedInstruction
        ? createPipelineDefaultControlSignals()
        : this.getPipelineControlSignals(displaySlot.stage, displaySlot.decodedInstruction),
      aluDetail: this.lastALUDetail,
      activeDataPaths: this.lastActiveDataPaths,
      memoryAccess: this.lastMemoryAccess,
      changes: this.lastChanges,
    };
  }

  private createPipelineSnapshot(): PipelineSnapshot {
    const hazard = this.cloneHazard(this.lastHazard);
    const forwarding = this.cloneForwarding(this.lastForwarding);

    return {
      cycleNumber: this.cycleCount,
      stages: {
        IF: this.createFetchSlot(),
        ID: this.createSlotFromRegister(Stage.ID, this.ifId),
        EX: this.createSlotFromRegister(Stage.EX, this.idEx),
        MEM: this.createSlotFromRegister(Stage.MEM, this.exMem),
        WB: this.createSlotFromRegister(Stage.WB, this.memWb),
      },
      registers: {
        ifId: this.cloneIFIDRegister(this.ifId),
        idEx: this.cloneIDEXRegister(this.idEx),
        exMem: this.cloneEXMEMRegister(this.exMem),
        memWb: this.cloneMEMWBRegister(this.memWb),
      },
      hazard,
      forwarding,
      controlStrategy: this.controlHazardStrategy,
      conflicts: this.cloneConflictEvents(this.lastConflicts),
    };
  }

  private createFetchSlot(): PipelineInstructionSlot {
    if (this.lastHazard.type === 'control' && this.lastHazard.action === 'stall') {
      return {
        ...createEmptyPipelineInstructionSlot(Stage.IF),
        status: 'stalled',
        pc: this.pc,
      };
    }

    if (this.fetchStopped || this.halted) {
      return createEmptyPipelineInstructionSlot(Stage.IF);
    }

    const instructionWord = this.fetchInstruction(this.pc);
    if (instructionWord === null) {
      return createEmptyPipelineInstructionSlot(Stage.IF);
    }

    return {
      stage: Stage.IF,
      status: 'valid',
      pc: this.pc,
      instructionWord,
      decodedInstruction: this.safeDecode(instructionWord),
    };
  }

  private createSlotFromRegister(
    stage: Stage,
    register: IFIDPipelineRegister | IDEXPipelineRegister | EXMEMPipelineRegister | MEMWBPipelineRegister
  ): PipelineInstructionSlot {
    return {
      stage,
      status: register.status,
      pc: register.pc,
      instructionWord: register.instructionWord,
      decodedInstruction: this.cloneDecodedInstruction(register.decodedInstruction),
    };
  }

  private resolveDisplaySlot(pipeline: PipelineSnapshot): PipelineInstructionSlot {
    return (
      pipeline.stages.WB.decodedInstruction ? pipeline.stages.WB
      : pipeline.stages.MEM.decodedInstruction ? pipeline.stages.MEM
      : pipeline.stages.EX.decodedInstruction ? pipeline.stages.EX
      : pipeline.stages.ID.decodedInstruction ? pipeline.stages.ID
      : pipeline.stages.IF.decodedInstruction ? pipeline.stages.IF
      : createEmptyPipelineInstructionSlot(Stage.IF)
    );
  }

  private getPipelineControlSignals(stage: Stage, instruction: DecodedInstruction | null): ControlSignals {
    if (!instruction) {
      return stage === Stage.IF
        ? this.controlUnit.getControlSignals(Stage.IF, null)
        : createPipelineDefaultControlSignals();
    }

    if (stage === Stage.MEM && instruction.opcode !== 0x03 && instruction.opcode !== 0x23) {
      return createPipelineDefaultControlSignals();
    }

    if (stage === Stage.WB && !this.writesRegister(instruction)) {
      return createPipelineDefaultControlSignals();
    }

    return this.controlUnit.getControlSignals(stage, instruction);
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

  private isValid(
    register: IFIDPipelineRegister | IDEXPipelineRegister | EXMEMPipelineRegister | MEMWBPipelineRegister
  ): boolean {
    return register.status === 'valid' && register.decodedInstruction !== null;
  }

  private hasLivePipelineWork(): boolean {
    return this.isValid(this.ifId) || this.isValid(this.idEx) || this.isValid(this.exMem) || this.isValid(this.memWb);
  }

  private writesRegister(instruction: DecodedInstruction): boolean {
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

  private isBranchTaken(instruction: DecodedInstruction, rs1Value: number, rs2Value: number): boolean {
    switch (instruction.funct3) {
      case 0x0:
        return rs1Value === rs2Value;
      case 0x1:
        return rs1Value !== rs2Value;
      case 0x4:
        return (rs1Value | 0) < (rs2Value | 0);
      case 0x5:
        return (rs1Value | 0) >= (rs2Value | 0);
      case 0x6:
        return (rs1Value >>> 0) < (rs2Value >>> 0);
      case 0x7:
        return (rs1Value >>> 0) >= (rs2Value >>> 0);
      default:
        throw new Error(`Unsupported branch funct3: ${instruction.funct3}`);
    }
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

  private captureObservableState(): ObservablePipelineCPUState {
    return {
      pc: this.pc,
      registers: this.registerFile.getAll(),
    };
  }

  private buildChanges(before: ObservablePipelineCPUState, after: ObservablePipelineCPUState): StateChange[] {
    const changes: StateChange[] = [];

    if (before.pc !== after.pc) {
      changes.push({
        target: 'pc',
        oldValue: before.pc,
        newValue: after.pc,
      });
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

  private captureHistoryState(): PipelineCPUHistoryState {
    return {
      pc: this.pc,
      cycleCount: this.cycleCount,
      instructionCount: this.instructionCount,
      halted: this.halted,
      fetchStopped: this.fetchStopped,
      instructionMemory: this.instructionMemory.slice(),
      dataMemory: this.dumpDataMemory(),
      registers: this.registerFile.getAll(),
      ifId: this.cloneIFIDRegister(this.ifId),
      idEx: this.cloneIDEXRegister(this.idEx),
      exMem: this.cloneEXMEMRegister(this.exMem),
      memWb: this.cloneMEMWBRegister(this.memWb),
      lastHazard: this.cloneHazard(this.lastHazard),
      lastForwarding: this.cloneForwarding(this.lastForwarding),
      controlHazardStrategy: this.controlHazardStrategy,
      lastConflicts: this.cloneConflictEvents(this.lastConflicts),
      lastALUDetail: { ...this.lastALUDetail },
      lastMemoryAccess: { ...this.lastMemoryAccess },
      lastActiveDataPaths: this.lastActiveDataPaths.map((path) => ({ ...path })),
      lastChanges: this.lastChanges.map((change) => ({ ...change })),
    };
  }

  private restoreHistoryState(state: PipelineCPUHistoryState): void {
    this.pc = state.pc;
    this.cycleCount = state.cycleCount;
    this.instructionCount = state.instructionCount;
    this.halted = state.halted;
    this.fetchStopped = state.fetchStopped;
    this.instructionMemory = state.instructionMemory.slice();
    this.registerFile.reset();
    state.registers.forEach((value, index) => this.registerFile.write(index, value));
    this.dataMemory.reset();
    this.dataMemory.load(state.dataMemory);
    this.ifId = this.cloneIFIDRegister(state.ifId);
    this.idEx = this.cloneIDEXRegister(state.idEx);
    this.exMem = this.cloneEXMEMRegister(state.exMem);
    this.memWb = this.cloneMEMWBRegister(state.memWb);
    this.lastHazard = this.cloneHazard(state.lastHazard);
    this.lastForwarding = this.cloneForwarding(state.lastForwarding);
    this.controlHazardStrategy = state.controlHazardStrategy;
    this.lastConflicts = this.cloneConflictEvents(state.lastConflicts);
    this.lastALUDetail = { ...state.lastALUDetail };
    this.lastMemoryAccess = { ...state.lastMemoryAccess };
    this.lastActiveDataPaths = state.lastActiveDataPaths.map((path) => ({ ...path }));
    this.lastChanges = state.lastChanges.map((change) => ({ ...change }));
  }

  private createFlushedIFIDRegister(): IFIDPipelineRegister {
    return {
      ...createEmptyIFIDPipelineRegister(),
      status: 'flushed',
    };
  }

  private createStalledIFIDRegister(): IFIDPipelineRegister {
    return {
      ...createEmptyIFIDPipelineRegister(),
      status: 'stalled',
    };
  }

  private createFlushedIDEXRegister(): IDEXPipelineRegister {
    return {
      ...createEmptyIDEXPipelineRegister(),
      status: 'flushed',
    };
  }

  private createBubbleIDEXRegister(): IDEXPipelineRegister {
    return {
      ...createEmptyIDEXPipelineRegister(),
      status: 'bubble',
    };
  }

  private cloneIFIDRegister(register: IFIDPipelineRegister): IFIDPipelineRegister {
    return {
      ...register,
      decodedInstruction: this.cloneDecodedInstruction(register.decodedInstruction),
    };
  }

  private cloneIDEXRegister(register: IDEXPipelineRegister): IDEXPipelineRegister {
    return {
      ...register,
      decodedInstruction: this.cloneDecodedInstruction(register.decodedInstruction),
      controlSignals: { ...register.controlSignals },
    };
  }

  private cloneEXMEMRegister(register: EXMEMPipelineRegister): EXMEMPipelineRegister {
    return {
      ...register,
      decodedInstruction: this.cloneDecodedInstruction(register.decodedInstruction),
      controlSignals: { ...register.controlSignals },
    };
  }

  private cloneMEMWBRegister(register: MEMWBPipelineRegister): MEMWBPipelineRegister {
    return {
      ...register,
      decodedInstruction: this.cloneDecodedInstruction(register.decodedInstruction),
      controlSignals: { ...register.controlSignals },
    };
  }

  private cloneDecodedInstruction(instruction: DecodedInstruction | null): DecodedInstruction | null {
    return instruction ? { ...instruction } : null;
  }

  private cloneHazard(hazard: PipelineHazardSnapshot): PipelineHazardSnapshot {
    return {
      ...hazard,
      raw: hazard.raw
        ? {
            ...hazard.raw,
            consumer: { ...hazard.raw.consumer },
            producer: { ...hazard.raw.producer },
          }
        : null,
      control: hazard.control
        ? {
            ...hazard.control,
            producer: { ...hazard.control.producer },
          }
        : null,
    };
  }

  private cloneForwarding(forwarding: PipelineForwardingSnapshot): PipelineForwardingSnapshot {
    return {
      enabled: forwarding.enabled,
      ForwardA: {
        ...forwarding.ForwardA,
        producer: forwarding.ForwardA.producer ? { ...forwarding.ForwardA.producer } : null,
      },
      ForwardB: {
        ...forwarding.ForwardB,
        producer: forwarding.ForwardB.producer ? { ...forwarding.ForwardB.producer } : null,
      },
      StoreForward: {
        ...forwarding.StoreForward,
        producer: forwarding.StoreForward.producer ? { ...forwarding.StoreForward.producer } : null,
      },
    };
  }

  private createConflictEvents(
    hazard: PipelineHazardSnapshot,
    forwarding: PipelineForwardingSnapshot,
    consumerRegister: IDEXPipelineRegister,
    cycleNumber: number
  ): PipelineConflictEvent[] {
    const events: PipelineConflictEvent[] = [];

    if (hazard.type === 'raw' && hazard.raw) {
      events.push({
        id: `cycle-${cycleNumber}-raw-${hazard.raw.register}-${hazard.raw.source}`,
        type: 'data',
        stage: Stage.ID,
        resolution: 'stall',
        reason: hazard.reason,
        register: hazard.raw.register,
        source: hazard.raw.source,
        consumer: this.cloneInstructionRef(hazard.raw.consumer),
        producer: this.cloneInstructionRef(hazard.raw.producer),
        forwardingSignal: null,
        redirectPC: null,
      });
    }

    if (hazard.type === 'control' && hazard.action === 'stall' && hazard.control) {
      events.push({
        id: `cycle-${cycleNumber}-control-stall-${hazard.control.producer.pc}`,
        type: 'control',
        stage: Stage.ID,
        resolution: 'stall',
        reason: hazard.reason,
        register: null,
        source: null,
        consumer: null,
        producer: this.cloneInstructionRef(hazard.control.producer),
        forwardingSignal: null,
        redirectPC: null,
      });
    }

    if (hazard.type === 'control' && hazard.action === 'flush' && hazard.control) {
      events.push({
        id: `cycle-${cycleNumber}-control-${hazard.control.producer.pc}`,
        type: 'control',
        stage: Stage.EX,
        resolution: 'flush',
        reason: hazard.reason,
        register: null,
        source: null,
        consumer: null,
        producer: this.cloneInstructionRef(hazard.control.producer),
        forwardingSignal: null,
        redirectPC: hazard.control.redirectPC,
      });
    }

    this.appendForwardingConflictEvent(events, forwarding.ForwardA, 'ForwardA', 'rs1', consumerRegister, cycleNumber);
    this.appendForwardingConflictEvent(events, forwarding.ForwardB, 'ForwardB', 'rs2', consumerRegister, cycleNumber);
    this.appendForwardingConflictEvent(
      events,
      forwarding.StoreForward,
      'StoreForward',
      'storeData',
      consumerRegister,
      cycleNumber
    );

    return events;
  }

  private appendForwardingConflictEvent(
    events: PipelineConflictEvent[],
    signal: PipelineForwardingSignal,
    forwardingSignal: PipelineForwardingSignalName,
    source: PipelineConflictEvent['source'],
    consumerRegister: IDEXPipelineRegister,
    cycleNumber: number
  ): void {
    if (
      signal.source === 'none' ||
      !signal.producer ||
      !this.isValid(consumerRegister) ||
      !consumerRegister.decodedInstruction
    ) {
      return;
    }

    events.push({
      id: `cycle-${cycleNumber}-${forwardingSignal}-${signal.register}-${signal.source}`,
      type: 'data',
      stage: Stage.EX,
      resolution: 'forward',
      reason: `${forwardingSignal} forwards x${signal.register} from ${signal.source}.`,
      register: signal.register,
      source,
      consumer: this.createInstructionRef(Stage.EX, consumerRegister),
      producer: this.cloneInstructionRef(signal.producer),
      forwardingSignal,
      redirectPC: null,
    });
  }

  private createInstructionRef(
    stage: Stage,
    register: IFIDPipelineRegister | IDEXPipelineRegister | EXMEMPipelineRegister | MEMWBPipelineRegister
  ): PipelineInstructionRef | null {
    if (!register.decodedInstruction) {
      return null;
    }

    return {
      stage,
      pc: register.pc,
      instructionWord: register.instructionWord,
      asmString: register.decodedInstruction.asmString,
    };
  }

  private cloneInstructionRef(ref: PipelineInstructionRef): PipelineInstructionRef {
    return { ...ref };
  }

  private cloneConflictEvents(events: readonly PipelineConflictEvent[]): PipelineConflictEvent[] {
    return events.map((event) => ({
      ...event,
      consumer: event.consumer ? this.cloneInstructionRef(event.consumer) : null,
      producer: event.producer ? this.cloneInstructionRef(event.producer) : null,
    }));
  }

  private resolveForwardedValue(
    source: Exclude<PipelineForwardingSource, 'none'>,
    exMemForwardRegister: MEMWBPipelineRegister,
    memWb: MEMWBPipelineRegister
  ): number {
    if (source === 'exMem') {
      return exMemForwardRegister.writeData;
    }

    return memWb.writeData;
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

  private mapDataAddress(address: number): number {
    return (address >>> 0) % this.dataMemorySize;
  }

  private signExtend(value: number, bits: number): number {
    const shift = 32 - bits;
    return (value << shift) >> shift;
  }

  private dumpDataMemory(): Uint8Array {
    const dump = new Uint8Array(this.dataMemorySize);
    for (let index = 0; index < this.dataMemorySize; index++) {
      dump[index] = this.dataMemory.readByte(index);
    }
    return dump;
  }
}
