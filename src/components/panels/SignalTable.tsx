import { memo, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useCPUStore } from '../../store/cpu-store';
import { ALUOp, Stage, type ControlSignals, type DecodedInstruction } from '../../types';

type SignalGroup = 'fetch' | 'memory' | 'alu' | 'writeback';
type CanvasSignalValue = string | number | boolean;

interface CanvasSignalContext {
  stage: Stage;
  controlSignals: ControlSignals;
  currentInstruction: DecodedInstruction | null;
}

interface CanvasSignalDefinition {
  label: string;
  group: SignalGroup;
  getValue: (context: CanvasSignalContext) => CanvasSignalValue;
  isActive: (context: CanvasSignalContext) => boolean;
  describe: (context: CanvasSignalContext) => string;
}

const GROUP_LABELS = {
  fetch: '取指 / PC',
  memory: '访存',
  alu: '运算',
  writeback: '写回',
} as const;

const ALU_OP_BINARY: Record<ALUOp, string> = {
  [ALUOp.ADD]: '0000',
  [ALUOp.SUB]: '0001',
  [ALUOp.AND]: '0010',
  [ALUOp.OR]: '0011',
  [ALUOp.XOR]: '0100',
  [ALUOp.SLT]: '0101',
  [ALUOp.SLTU]: '0110',
  [ALUOp.SLL]: '0111',
  [ALUOp.SRL]: '1000',
  [ALUOp.SRA]: '1001',
};

function isStage(stage: Stage, stages: readonly Stage[]): boolean {
  return stages.includes(stage);
}

function boolSignal(value: boolean): string {
  return value ? '1' : '0';
}

function formatALUOpSignal(value: ALUOp): string {
  return `${value}(${ALU_OP_BINARY[value] ?? '----'})`;
}

function formatSignalValue(value: CanvasSignalValue): string {
  if (typeof value === 'boolean') {
    return boolSignal(value);
  }

  return String(value);
}

function getFunct3(context: CanvasSignalContext): number {
  return context.currentInstruction?.funct3 ?? 0;
}

function getSizeSelect(context: CanvasSignalContext): string {
  return (getFunct3(context) & 0x3).toString(2).padStart(2, '0');
}

function getSignExtendSelect(context: CanvasSignalContext): string {
  const instruction = context.currentInstruction;
  if (!instruction || instruction.opcode !== 0x03) {
    return '0';
  }

  return instruction.funct3 === 0x0 || instruction.funct3 === 0x1 ? '1' : '0';
}

function usesExecuteStageALU(instruction: DecodedInstruction | null): boolean {
  if (!instruction) {
    return false;
  }

  return instruction.opcode !== 0x37 && instruction.opcode !== 0x6F;
}

function describePCSource(value: ControlSignals['PCSource']): string {
  if (value === 0) {
    return '选择 PC+4 顺序地址';
  }

  if (value === 1) {
    return '选择 ALUOut 保存的分支目标';
  }

  return '选择跳转目标地址';
}

function describeWriteBackSelect(value: ControlSignals['MemToReg']): string {
  if (value === 1) {
    return '写回数据来自 MDR';
  }

  if (value === 2) {
    return '写回数据来自 PC+4';
  }

  if (value === 3) {
    return '写回数据来自 imm32';
  }

  return '写回数据来自 ALUOut';
}

function describeALUSrcBSelect(value: ControlSignals['ALUSrcB']): string {
  if (value === 1) {
    return 'ALU B 端选择常数 4';
  }

  if (value === 2) {
    return 'ALU B 端选择立即数';
  }

  if (value === 3) {
    return 'ALU B 端选择立即数左移 1 位';
  }

  return 'ALU B 端选择寄存器 B';
}

function describeSizeSelect(value: string): string {
  if (value === '00') {
    return '字节访问';
  }

  if (value === '01') {
    return '半字访问';
  }

  return '字访问';
}

const CANVAS_SIGNAL_DEFINITIONS: readonly CanvasSignalDefinition[] = [
  {
    label: 'PC_s',
    group: 'fetch',
    getValue: ({ controlSignals }) => controlSignals.PCSource,
    isActive: ({ stage, controlSignals }) => isStage(stage, [Stage.IF, Stage.EX]) && controlSignals.PCWrite,
    describe: ({ controlSignals }) =>
      controlSignals.PCWrite ? describePCSource(controlSignals.PCSource) : 'PCWrite=0 时，PC_s 不生效',
  },
  {
    label: 'PC_Write',
    group: 'fetch',
    getValue: ({ controlSignals }) => controlSignals.PCWrite,
    isActive: ({ stage, controlSignals }) => isStage(stage, [Stage.IF, Stage.EX]) && controlSignals.PCWrite,
    describe: ({ controlSignals }) => (controlSignals.PCWrite ? '允许 PC 锁存新地址' : 'PC 保持当前值'),
  },
  {
    label: 'PC0_Write',
    group: 'fetch',
    getValue: ({ stage, controlSignals }) => stage === Stage.IF && controlSignals.PCWrite,
    isActive: ({ stage, controlSignals }) => stage === Stage.IF && controlSignals.PCWrite,
    describe: ({ stage, controlSignals }) =>
      stage === Stage.IF && controlSignals.PCWrite ? '本周期锁存取指 PC' : 'PC0 不写入',
  },
  {
    label: 'IR_Write',
    group: 'fetch',
    getValue: ({ controlSignals }) => controlSignals.IRWrite,
    isActive: ({ stage, controlSignals }) => stage === Stage.IF && controlSignals.IRWrite,
    describe: ({ controlSignals }) => (controlSignals.IRWrite ? 'IR 锁存新取回的指令' : 'IR 保持当前指令'),
  },
  {
    label: 'Reg_Write',
    group: 'writeback',
    getValue: ({ controlSignals }) => controlSignals.RegWrite,
    isActive: ({ stage, controlSignals }) => isStage(stage, [Stage.EX, Stage.WB]) && controlSignals.RegWrite,
    describe: ({ controlSignals }) => (controlSignals.RegWrite ? '寄存器堆写使能有效' : '寄存器堆不写入'),
  },
  {
    label: 'rs2_imm_s',
    group: 'alu',
    getValue: ({ controlSignals }) => (controlSignals.ALUSrcB === 2 || controlSignals.ALUSrcB === 3 ? 1 : 0),
    isActive: ({ stage, controlSignals }) =>
      stage === Stage.EX && (controlSignals.ALUSrcB === 2 || controlSignals.ALUSrcB === 3),
    describe: ({ controlSignals }) => describeALUSrcBSelect(controlSignals.ALUSrcB),
  },
  {
    label: 'ALU_OP',
    group: 'alu',
    getValue: ({ controlSignals }) => formatALUOpSignal(controlSignals.ALUOp),
    isActive: ({ stage, currentInstruction }) => stage === Stage.EX && usesExecuteStageALU(currentInstruction),
    describe: ({ controlSignals }) => `ALU 执行 ${formatALUOpSignal(controlSignals.ALUOp)}`,
  },
  {
    label: 'Mem_Write',
    group: 'memory',
    getValue: ({ controlSignals }) => controlSignals.MemWrite,
    isActive: ({ stage, controlSignals }) => stage === Stage.MEM && controlSignals.MemWrite,
    describe: ({ controlSignals }) => (controlSignals.MemWrite ? '数据内存写使能有效' : '数据内存不写入'),
  },
  {
    label: 'w_data_s',
    group: 'writeback',
    getValue: ({ controlSignals }) => controlSignals.MemToReg,
    isActive: ({ stage, controlSignals }) => isStage(stage, [Stage.EX, Stage.WB]) && controlSignals.RegWrite,
    describe: ({ controlSignals }) =>
      controlSignals.RegWrite ? describeWriteBackSelect(controlSignals.MemToReg) : 'RegWrite=0 时，w_data_s 不生效',
  },
  {
    label: 'Size_s',
    group: 'memory',
    getValue: getSizeSelect,
    isActive: ({ stage }) => stage === Stage.MEM,
    describe: (context) => describeSizeSelect(getSizeSelect(context)),
  },
  {
    label: 'SE_s',
    group: 'memory',
    getValue: getSignExtendSelect,
    isActive: ({ stage, controlSignals }) => stage === Stage.MEM && controlSignals.MemRead,
    describe: (context) => (getSignExtendSelect(context) === '1' ? '访存读数需要符号扩展' : '不进行符号扩展'),
  },
];

export const SignalTable = memo(function SignalTable() {
  const { stage, controlSignals, currentInstruction } = useCPUStore(
    useShallow((state) => ({
      stage: state.stage,
      controlSignals: state.controlSignals,
      currentInstruction: state.currentInstruction,
    }))
  );

  const rows = useMemo(() => {
    const context = { stage, controlSignals, currentInstruction };

    return CANVAS_SIGNAL_DEFINITIONS.map((definition) => ({
      ...definition,
      value: definition.getValue(context),
      active: definition.isActive(context),
      meaning: definition.describe(context),
    }));
  }, [controlSignals, currentInstruction, stage]);

  return (
    <section className="panel-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">控制信号</p>
          <h2>画布控制线</h2>
        </div>
        <span className="editor-pill">阶段 {stage}</span>
      </div>
     <br></br>

      <div className="signal-intro-card">
        <span className="detail-label">当前指令</span>
        <strong className="detail-value">{currentInstruction?.asmString ?? '暂无已译码指令'}</strong>
      </div>

      <div className="signal-table-shell">
        <table className="signal-table">
          <thead>
            <tr>
              <th>信号</th>
              <th>值</th>
              <th>含义</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className={row.active ? 'signal-row signal-row--active' : 'signal-row'}>
                <td>
                  <div className="signal-name-cell">
                    <strong>{row.label}</strong>
                    <span className={`signal-group-tag signal-group-tag--${row.group}`}>{GROUP_LABELS[row.group]}</span>
                  </div>
                </td>
                <td>
                  <span className={row.active ? 'value-badge value-badge--active' : 'value-badge'}>
                    {formatSignalValue(row.value)}
                  </span>
                </td>
                <td className="signal-meaning">{row.meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
});
