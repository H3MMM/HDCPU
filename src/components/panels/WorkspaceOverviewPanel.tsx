import { memo, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useCPUStore } from '../../store/cpu-store';
import type { MachineCodeRow } from '../../store/cpu-store';
import { Stage, type CycleSnapshot, type DecodedInstruction } from '../../types';

const PIPELINE_STAGE_KEYS = ['IF', 'ID', 'EX', 'MEM', 'WB'] as const;

function registerName(index: number): string {
  return `x${index}`;
}

function formatWord(value: number): string {
  return `0x${(value >>> 0).toString(16).padStart(8, '0')}`;
}

function getStageLearningHint(stage: Stage): string {
  switch (stage) {
    case Stage.ID:
      return '先看寄存器读数和控制信号是否匹配当前指令。';
    case Stage.EX:
      return '重点观察 ALU 输入、结果，以及是否发生分支判断。';
    case Stage.MEM:
      return '重点查看数据存储器、地址和最近一次访存。';
    case Stage.WB:
      return '重点确认结果是否正确写回目标寄存器。';
    case Stage.IF:
    default:
      return '先看 PC、指令存储器和 IR，确认取指是否正确。';
  }
}

function formatMemoryAccess(type: 'none' | 'read' | 'write', address: number): string {
  if (type === 'none') {
    return '本阶段没有访存';
  }

  return `${type === 'read' ? '最近一次读取' : '最近一次写入'} @ ${formatWord(address)}`;
}

function getSnapshotInstructionAddress(snapshot: CycleSnapshot): number {
  return (snapshot.stage === Stage.IF ? snapshot.pc : snapshot.instructionAddress) >>> 0;
}

function getCurrentMachineCodeRow(machineCodeRows: readonly MachineCodeRow[]): MachineCodeRow | null {
  return machineCodeRows.find((row) => row.current) ?? null;
}

function getCurrentInstructionAddress(
  machineCodeRows: readonly MachineCodeRow[],
  snapshot: CycleSnapshot
): number | null {
  const currentRow = getCurrentMachineCodeRow(machineCodeRows);
  if (currentRow) {
    return currentRow.address >>> 0;
  }

  if (machineCodeRows.length === 0) {
    return null;
  }

  return getSnapshotInstructionAddress(snapshot);
}

function getSourceRegisterValue(
  snapshot: CycleSnapshot,
  registerIndex: number,
  pipelineValue: number
): number {
  if (snapshot.stage === Stage.EX || snapshot.stage === Stage.MEM || snapshot.stage === Stage.WB) {
    return pipelineValue | 0;
  }

  return snapshot.registers[registerIndex] ?? 0;
}

function isBranchTaken(instruction: DecodedInstruction, snapshot: CycleSnapshot): boolean {
  const rs1Value = getSourceRegisterValue(snapshot, instruction.rs1, snapshot.pipelineRegs.A);
  const rs2Value = getSourceRegisterValue(snapshot, instruction.rs2, snapshot.pipelineRegs.B);

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
      return false;
  }
}

function getNextInstructionAddress(
  instruction: DecodedInstruction,
  snapshot: CycleSnapshot,
  currentAddress: number
): number {
  if (instruction.opcode === 0x6F) {
    return (currentAddress + instruction.immediate) >>> 0;
  }

  if (instruction.opcode === 0x67) {
    if (snapshot.stage === Stage.WB) {
      return snapshot.pipelineRegs.ALUOut >>> 0;
    }

    const rs1Value = getSourceRegisterValue(snapshot, instruction.rs1, snapshot.pipelineRegs.A);
    return ((rs1Value + instruction.immediate) & ~1) >>> 0;
  }

  if (instruction.opcode === 0x63) {
    const offset = isBranchTaken(instruction, snapshot) ? instruction.immediate : 4;
    return (currentAddress + offset) >>> 0;
  }

  return (currentAddress + 4) >>> 0;
}

export function getNextInstruction(
  machineCodeRows: readonly MachineCodeRow[],
  instruction: DecodedInstruction | null,
  snapshot: CycleSnapshot
): string {
  const currentAddress = getCurrentInstructionAddress(machineCodeRows, snapshot);
  if (currentAddress === null || instruction === null) {
    return machineCodeRows[0]?.assembly ?? '没有下一条指令';
  }

  const nextAddress = getNextInstructionAddress(instruction, snapshot, currentAddress);
  const targetRow = machineCodeRows.find((row) => row.address === nextAddress);
  if (targetRow) {
    return targetRow.assembly;
  }

  if (instruction.opcode === 0x63 || instruction.opcode === 0x67 || instruction.opcode === 0x6F) {
    return `目标地址 ${formatWord(nextAddress)}`;
  }

  return '当前已经是最后一条指令';
}

function getInstructionExpectation(
  instruction: DecodedInstruction | null,
  snapshot: CycleSnapshot
): string {
  if (!instruction) {
    return '当前没有待执行指令。';
  }

  const rs1Value = getSourceRegisterValue(snapshot, instruction.rs1, snapshot.pipelineRegs.A);
  const rs2Value = getSourceRegisterValue(snapshot, instruction.rs2, snapshot.pipelineRegs.B);
  const immediate = instruction.immediate | 0;
  const mnemonic = instruction.asmString.split(/\s+/)[0]?.toLowerCase() ?? 'unknown';
  const instructionAddress = getSnapshotInstructionAddress(snapshot);

  switch (mnemonic) {
    case 'addi':
      return `${registerName(instruction.rd)} 将写入 ${(rs1Value + immediate) | 0}，因为 ${registerName(instruction.rs1)}=${rs1Value} 与立即数 ${immediate} 相加。`;
    case 'add':
      return `${registerName(instruction.rd)} 将写入 ${(rs1Value + rs2Value) | 0}，来自 ${registerName(instruction.rs1)} 和 ${registerName(instruction.rs2)} 的加法结果。`;
    case 'sub':
      return `${registerName(instruction.rd)} 将写入 ${(rs1Value - rs2Value) | 0}，这是 ${registerName(instruction.rs1)} 减去 ${registerName(instruction.rs2)} 的结果。`;
    case 'and':
      return `${registerName(instruction.rd)} 将写入 ${rs1Value & rs2Value}，因为会执行按位与运算。`;
    case 'or':
      return `${registerName(instruction.rd)} 将写入 ${rs1Value | rs2Value}，因为会执行按位或运算。`;
    case 'xor':
      return `${registerName(instruction.rd)} 将写入 ${rs1Value ^ rs2Value}，因为会执行按位异或运算。`;
    case 'slli':
      return `${registerName(instruction.rd)} 将写入 ${(rs1Value << (immediate & 0x1F)) | 0}，因为 ${registerName(instruction.rs1)} 会左移 ${immediate & 0x1F} 位。`;
    case 'srli':
      return `${registerName(instruction.rd)} 将写入 ${(rs1Value >>> (immediate & 0x1F)) | 0}，因为 ${registerName(instruction.rs1)} 会逻辑右移 ${immediate & 0x1F} 位。`;
    case 'srai':
      return `${registerName(instruction.rd)} 将写入 ${rs1Value >> (immediate & 0x1F)}，因为 ${registerName(instruction.rs1)} 会算术右移 ${immediate & 0x1F} 位。`;
    case 'lw':
      return `将访问地址 ${formatWord((rs1Value + immediate) | 0)}，并把读出的 1 个字写回 ${registerName(instruction.rd)}。`;
    case 'sw':
      return `将把 ${registerName(instruction.rs2)} 当前的值 ${rs2Value} 写入内存地址 ${formatWord((rs1Value + immediate) | 0)}。`;
    case 'beq':
      return `会比较 ${registerName(instruction.rs1)} 和 ${registerName(instruction.rs2)}；若相等，PC 将跳到 ${formatWord((instructionAddress + immediate) | 0)}。`;
    case 'bne':
      return `会比较 ${registerName(instruction.rs1)} 和 ${registerName(instruction.rs2)}；若不相等，PC 将跳到 ${formatWord((instructionAddress + immediate) | 0)}。`;
    case 'blt':
      return `会比较 ${registerName(instruction.rs1)} 和 ${registerName(instruction.rs2)}；若前者更小，PC 将跳到 ${formatWord((instructionAddress + immediate) | 0)}。`;
    case 'bge':
      return `会比较 ${registerName(instruction.rs1)} 和 ${registerName(instruction.rs2)}；若前者大于等于后者，PC 将跳到 ${formatWord((instructionAddress + immediate) | 0)}。`;
    case 'jal':
      return `${registerName(instruction.rd)} 将写入返回地址 ${formatWord((instructionAddress + 4) | 0)}，随后 PC 会跳到 ${formatWord((instructionAddress + immediate) | 0)}。`;
    case 'jalr':
      return `${registerName(instruction.rd)} 将写入返回地址 ${formatWord((instructionAddress + 4) | 0)}，随后 PC 会跳到 ${formatWord((((rs1Value + immediate) & ~1) | 0))}。`;
    case 'lui':
      return `${registerName(instruction.rd)} 将写入 ${formatWord(immediate)}，因为 LUI 会把立即数装入高 20 位。`;
    case 'auipc':
      return `${registerName(instruction.rd)} 将写入 ${formatWord((instructionAddress + immediate) | 0)}，因为 AUIPC 会把 PC 与立即数相加。`;
    default:
      return instruction.description || `${instruction.asmString} 即将执行，请重点关注目标寄存器、PC 或内存的变化。`;
  }
}

function getPipelineStageSummary(snapshot: CycleSnapshot): string {
  const activeStages = PIPELINE_STAGE_KEYS
    .map((stageKey) => {
      const slot = snapshot.pipeline.stages[stageKey];
      return slot.decodedInstruction ? `${stageKey}: ${slot.decodedInstruction.asmString}` : null;
    })
    .filter((entry): entry is string => entry !== null);

  return activeStages.length > 0 ? activeStages.join(' / ') : '流水线当前为空';
}

function getPipelineConflictSummary(snapshot: CycleSnapshot): string {
  if (snapshot.pipeline.conflicts.length === 0) {
    return '本周期没有冲突事件';
  }

  return snapshot.pipeline.conflicts
    .map((event) => {
      if (event.resolution === 'forward') {
        const producerKind = event.producer && (event.producer.instructionWord & 0x7F) === 0x03
          ? '数据存储器读数'
          : event.producer?.asmString ?? '上一条指令';
        return `${event.forwardingSignal}: x${event.register} 由 ${producerKind} 旁路给 ${event.consumer?.asmString ?? '当前 EX 指令'}`;
      }

      if (event.resolution === 'stall') {
        return `RAW x${event.register}: 停顿 IF/ID，并向 ID/EX 插入气泡`;
      }

      return `控制冲突: flush 到 PC=${formatWord(event.redirectPC ?? 0)}`;
    })
    .join(' / ');
}

function getPipelineResolutionHint(snapshot: CycleSnapshot): string {
  if (snapshot.pipeline.hazard.type === 'raw') {
    return '旁路关闭时，RAW 冲突会冻结 PC 与 IF/ID，并插入 bubble 等待写回。';
  }

  if (snapshot.pipeline.hazard.type === 'control') {
    return '分支或跳转在 EX 解决后，错误路径上的 IF/ID 与 ID/EX 会被清空。';
  }

  if (snapshot.pipeline.forwarding.ForwardA.source !== 'none' || snapshot.pipeline.forwarding.ForwardB.source !== 'none') {
    return 'ALU 输入正在通过 ForwardA/ForwardB 取得更新值；load-use 会从数据存储器读数旁路。';
  }

  if (snapshot.pipeline.forwarding.StoreForward.source !== 'none') {
    return 'store 写入数据正在通过 StoreForward 取得更新值。';
  }

  return '观察 IF/ID、ID/EX、EX/MEM、MEM/WB 四个段间寄存器，理解多条指令如何重叠推进。';
}

export const WorkspaceOverviewPanel = memo(function WorkspaceOverviewPanel() {
  const {
    datapathMode,
    currentInstruction,
    currentSnapshot,
    machineCodeRows,
    stage,
    latestMemoryAccess,
    lastAction,
  } = useCPUStore(
    useShallow((state) => ({
      datapathMode: state.datapathMode,
      currentInstruction: state.currentInstruction,
      currentSnapshot: state.currentSnapshot,
      machineCodeRows: state.machineCodeRows,
      stage: state.stage,
      latestMemoryAccess: state.latestMemoryAccess,
      lastAction: state.lastAction,
    }))
  );

  const nextInstruction = useMemo(
    () => getNextInstruction(machineCodeRows, currentInstruction, currentSnapshot),
    [currentInstruction, currentSnapshot, machineCodeRows]
  );
  const expectation = useMemo(
    () => getInstructionExpectation(currentInstruction, currentSnapshot),
    [currentInstruction, currentSnapshot]
  );

  if (datapathMode === 'pipeline') {
    const activeStageCount = PIPELINE_STAGE_KEYS.filter(
      (stageKey) => currentSnapshot.pipeline.stages[stageKey].decodedInstruction !== null
    ).length;
    const forwardingEnabled = currentSnapshot.pipeline.forwarding.enabled;

    return (
      <section className="panel-card panel-card--accent">
        <div className="panel-header">
          <div>
            <p className="eyebrow">流水线总览</p>
            <h2>五级并行快照</h2>
          </div>
          <span className="status-chip status-chip--accent">周期 {currentSnapshot.cycleNumber}</span>
        </div>
        <br></br>

        <div className="metric-grid">
          <article className="metric-card">
            <span className="metric-label">在途阶段</span>
            <strong>{activeStageCount}/5</strong>
          </article>
          <article className="metric-card">
            <span className="metric-label">旁路</span>
            <strong>{forwardingEnabled ? '开启' : '关闭'}</strong>
          </article>
          <article className="metric-card">
            <span className="metric-label">冲突事件</span>
            <strong>{currentSnapshot.pipeline.conflicts.length}</strong>
          </article>
        </div>

        <div className="metric-grid metric-grid--dense">
          <article className="metric-card metric-card--wide">
            <span className="metric-label">时空占用</span>
            <strong>{getPipelineStageSummary(currentSnapshot)}</strong>
          </article>
          <article className="metric-card">
            <span className="metric-label">已退休指令</span>
            <strong>{currentSnapshot.instructionIndex}</strong>
          </article>
        </div>

        <div className="metric-grid metric-grid--dense">
          <article className="metric-card metric-card--wide">
            <span className="metric-label">本周期处理</span>
            <strong>{getPipelineConflictSummary(currentSnapshot)}</strong>
          </article>
          <article className="metric-card">
            <span className="metric-label">学习提示</span>
            <strong>{getPipelineResolutionHint(currentSnapshot)}</strong>
          </article>
        </div>

        <p className="panel-caption">{lastAction}</p>
      </section>
    );
  }

  return (
    <section className="panel-card panel-card--accent">
      <div className="panel-header">
        <div>
          <p className="eyebrow">当前总览</p>
          <h2>学习快照</h2>
        </div>
        <span className="status-chip status-chip--accent">实时状态</span>
      </div>
      
      <br></br>

      <div className="metric-grid">
        <article className="metric-card">
          <span className="metric-label">当前指令</span>
          <strong>{currentInstruction?.asmString ?? '程序已结束'}</strong>
        </article>
        <article className="metric-card">
          <span className="metric-label">下一条指令</span>
          <strong>{nextInstruction}</strong>
        </article>
        <article className="metric-card">
          <span className="metric-label">当前阶段</span>
          <strong>{stage}</strong>
        </article>
      </div>

      <div className="metric-grid metric-grid--dense">
        <article className="metric-card metric-card--wide">
          <span className="metric-label">这一步预计变化</span>
          <strong>{expectation}</strong>
        </article>
        <article className="metric-card">
          <span className="metric-label">学习提示</span>
          <strong>{getStageLearningHint(stage)}</strong>
        </article>
        <article className="metric-card">
          <span className="metric-label">最近访存</span>
          <strong>{formatMemoryAccess(latestMemoryAccess.type, latestMemoryAccess.address)}</strong>
        </article>
      </div>

      <p className="panel-caption">{lastAction}</p>
    </section>
  );
});
