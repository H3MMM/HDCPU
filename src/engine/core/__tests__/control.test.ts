import { describe, expect, it } from 'vitest';
import { ALUOp, ImmType, Stage } from '../../../types';
import { ControlUnit } from '../control';
import { Decoder } from '../decoder';

describe('ControlUnit', () => {
  const decoder = new Decoder();

  const decode = (instruction: number) => decoder.decode(instruction);

  it('should generate IF stage fetch signals', () => {
    const controlUnit = new ControlUnit();
    const signals = controlUnit.getControlSignals(Stage.IF);

    expect(signals).toMatchObject({
      PCWrite: true,
      IorD: false,
      MemRead: true,
      MemWrite: false,
      IRWrite: true,
      RegWrite: false,
      ALUSrcA: 0,
      ALUSrcB: 1,
      ALUOp: ALUOp.ADD,
      PCSource: 0,
      Branch: false,
      ImmSrc: ImmType.NONE,
    });
    expect(controlUnit.getNextStage(Stage.IF)).toBe(Stage.ID);
  });

  it('should generate ID stage decode signals', () => {
    const controlUnit = new ControlUnit();
    const instruction = decode(0x00412083);
    const signals = controlUnit.getControlSignals(Stage.ID, instruction);

    expect(signals).toMatchObject({
      PCWrite: false,
      MemRead: false,
      RegWrite: false,
      ALUSrcA: 0,
      ALUSrcB: 2,
      ALUOp: ALUOp.ADD,
      ImmSrc: ImmType.I,
    });
    expect(controlUnit.getNextStage(Stage.ID, instruction)).toBe(Stage.EX);
  });

  it('should route R-type instructions from EX to WB with ALU control', () => {
    const controlUnit = new ControlUnit();
    const instruction = decode(0x003100B3);
    const signals = controlUnit.getControlSignals(Stage.EX, instruction);

    expect(signals).toMatchObject({
      ALUSrcA: 1,
      ALUSrcB: 0,
      ALUOp: ALUOp.ADD,
      RegWrite: false,
      ImmSrc: ImmType.NONE,
    });
    expect(controlUnit.getNextStage(Stage.EX, instruction)).toBe(Stage.WB);
  });

  it('should route I-type ALU instructions from EX to WB with the decoded ALU op', () => {
    const controlUnit = new ControlUnit();
    const instruction = decode(0xFFF17093);
    const signals = controlUnit.getControlSignals(Stage.EX, instruction);

    expect(signals).toMatchObject({
      ALUSrcA: 1,
      ALUSrcB: 2,
      ALUOp: ALUOp.AND,
      ImmSrc: ImmType.I,
    });
    expect(controlUnit.getNextStage(Stage.EX, instruction)).toBe(Stage.WB);
  });

  it('should route load instructions through MEM then WB', () => {
    const controlUnit = new ControlUnit();
    const instruction = decode(0x00412083);
    const executeSignals = controlUnit.getControlSignals(Stage.EX, instruction);
    const memorySignals = controlUnit.getControlSignals(Stage.MEM, instruction);
    const writeBackSignals = controlUnit.getControlSignals(Stage.WB, instruction);

    expect(executeSignals).toMatchObject({
      ALUSrcA: 1,
      ALUSrcB: 2,
      ALUOp: ALUOp.ADD,
      ImmSrc: ImmType.I,
    });
    expect(memorySignals).toMatchObject({
      IorD: true,
      MemRead: true,
      MemWrite: false,
      RegWrite: false,
      ImmSrc: ImmType.I,
    });
    expect(writeBackSignals).toMatchObject({
      RegWrite: true,
      MemToReg: 1,
      ImmSrc: ImmType.I,
    });
    expect(controlUnit.getNextStage(Stage.EX, instruction)).toBe(Stage.MEM);
    expect(controlUnit.getNextStage(Stage.MEM, instruction)).toBe(Stage.WB);
    expect(controlUnit.getNextStage(Stage.WB, instruction)).toBe(Stage.IF);
  });

  it('should route store instructions through MEM and back to IF', () => {
    const controlUnit = new ControlUnit();
    const instruction = decode(0x00112223);
    const executeSignals = controlUnit.getControlSignals(Stage.EX, instruction);
    const memorySignals = controlUnit.getControlSignals(Stage.MEM, instruction);

    expect(executeSignals).toMatchObject({
      ALUSrcA: 1,
      ALUSrcB: 2,
      ALUOp: ALUOp.ADD,
      ImmSrc: ImmType.S,
    });
    expect(memorySignals).toMatchObject({
      IorD: true,
      MemRead: false,
      MemWrite: true,
      RegWrite: false,
      ImmSrc: ImmType.S,
    });
    expect(controlUnit.getNextStage(Stage.EX, instruction)).toBe(Stage.MEM);
    expect(controlUnit.getNextStage(Stage.MEM, instruction)).toBe(Stage.IF);
  });

  it('should branch in EX with conditional PC update signals', () => {
    const controlUnit = new ControlUnit();
    const instruction = decode(0x00208463);
    const signals = controlUnit.getControlSignals(Stage.EX, instruction);

    expect(signals).toMatchObject({
      PCWriteCond: true,
      PCWrite: false,
      PCSource: 1,
      Branch: true,
      ALUSrcA: 1,
      ALUSrcB: 0,
      ALUOp: ALUOp.SUB,
      ImmSrc: ImmType.B,
    });
    expect(controlUnit.getNextStage(Stage.EX, instruction)).toBe(Stage.IF);
  });

  it('should jump in EX and write the link register immediately', () => {
    const controlUnit = new ControlUnit();
    const jalInstruction = decode(0x008000EF);
    const jalrInstruction = decode(0x004100E7);

    expect(controlUnit.getControlSignals(Stage.EX, jalInstruction)).toMatchObject({
      PCWrite: true,
      PCSource: 2,
      RegWrite: true,
      ALUSrcA: 0,
      ALUSrcB: 1,
      ALUOp: ALUOp.ADD,
      ImmSrc: ImmType.J,
    });
    expect(controlUnit.getControlSignals(Stage.EX, jalrInstruction)).toMatchObject({
      PCWrite: true,
      PCSource: 2,
      RegWrite: true,
      ALUSrcA: 0,
      ALUSrcB: 1,
      ALUOp: ALUOp.ADD,
      ImmSrc: ImmType.I,
    });
    expect(controlUnit.getNextStage(Stage.EX, jalInstruction)).toBe(Stage.IF);
    expect(controlUnit.getNextStage(Stage.EX, jalrInstruction)).toBe(Stage.IF);
  });

  it('should handle U-type instructions in EX and WB', () => {
    const controlUnit = new ControlUnit();
    const luiInstruction = decode(0x123450B7);
    const auipcInstruction = decode(0x12345097);

    expect(controlUnit.getControlSignals(Stage.EX, luiInstruction)).toMatchObject({
      ALUSrcA: 0,
      ALUSrcB: 2,
      ALUOp: ALUOp.PASS_B,
      ImmSrc: ImmType.U,
    });
    expect(controlUnit.getControlSignals(Stage.EX, auipcInstruction)).toMatchObject({
      ALUSrcA: 0,
      ALUSrcB: 2,
      ALUOp: ALUOp.ADD,
      ImmSrc: ImmType.U,
    });
    expect(controlUnit.getControlSignals(Stage.WB, luiInstruction)).toMatchObject({
      RegWrite: true,
      MemToReg: 0,
      ImmSrc: ImmType.U,
    });
    expect(controlUnit.getNextStage(Stage.EX, luiInstruction)).toBe(Stage.WB);
    expect(controlUnit.getNextStage(Stage.EX, auipcInstruction)).toBe(Stage.WB);
  });

  it('should behave as a state machine for a load instruction', () => {
    const controlUnit = new ControlUnit();
    const instruction = decode(0x00412083);

    expect(controlUnit.getCurrentStage()).toBe(Stage.IF);
    expect(controlUnit.getCurrentSignals()).toMatchObject({
      PCWrite: true,
      IRWrite: true,
    });

    expect(controlUnit.advance()).toBe(Stage.ID);
    expect(controlUnit.getCurrentSignals(instruction)).toMatchObject({
      ALUSrcB: 2,
      ImmSrc: ImmType.I,
    });

    expect(controlUnit.advance(instruction)).toBe(Stage.EX);
    expect(controlUnit.getCurrentSignals(instruction)).toMatchObject({
      ALUSrcA: 1,
      ALUSrcB: 2,
      ALUOp: ALUOp.ADD,
    });

    expect(controlUnit.advance(instruction)).toBe(Stage.MEM);
    expect(controlUnit.getCurrentSignals(instruction)).toMatchObject({
      MemRead: true,
      IorD: true,
    });

    expect(controlUnit.advance(instruction)).toBe(Stage.WB);
    expect(controlUnit.getCurrentSignals(instruction)).toMatchObject({
      RegWrite: true,
      MemToReg: 1,
    });

    expect(controlUnit.advance(instruction)).toBe(Stage.IF);
  });

  it('should skip MEM and WB for a branch instruction', () => {
    const controlUnit = new ControlUnit();
    const instruction = decode(0x00208463);

    expect(controlUnit.advance()).toBe(Stage.ID);
    expect(controlUnit.advance(instruction)).toBe(Stage.EX);
    expect(controlUnit.getCurrentSignals(instruction)).toMatchObject({
      Branch: true,
      PCWriteCond: true,
    });
    expect(controlUnit.advance(instruction)).toBe(Stage.IF);
  });

  it('should reset back to IF after the state has advanced', () => {
    const controlUnit = new ControlUnit();
    const instruction = decode(0x003100B3);

    controlUnit.advance();
    controlUnit.advance(instruction);
    controlUnit.advance(instruction);

    expect(controlUnit.getCurrentStage()).toBe(Stage.WB);

    controlUnit.reset();

    expect(controlUnit.getCurrentStage()).toBe(Stage.IF);
    expect(controlUnit.getCurrentSignals()).toMatchObject({
      PCWrite: true,
      IRWrite: true,
    });
  });

  it('should require an instruction when advancing through execute-dependent stages', () => {
    const controlUnit = new ControlUnit();

    controlUnit.advance();
    controlUnit.advance(decode(0x003100B3));

    expect(() => controlUnit.advance()).toThrow('Instruction is required for EX stage');
  });
});
