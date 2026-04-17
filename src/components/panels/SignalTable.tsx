import { useMemo } from 'react';
import { useCPUStore } from '../../store/cpu-store';
import type { ControlSignals } from '../../types';

interface SignalDefinition {
  key: keyof ControlSignals;
  label: string;
  group: 'fetch' | 'memory' | 'alu' | 'writeback';
  describe: (value: ControlSignals[keyof ControlSignals]) => string;
}

const GROUP_LABELS = {
  fetch: '取指',
  memory: '访存',
  alu: '运算',
  writeback: '回写',
} as const;

const SIGNAL_DEFINITIONS: SignalDefinition[] = [
  { key: 'PCWrite', label: 'PCWrite', group: 'fetch', describe: (value) => (value ? '允许更新 PC' : '保持当前 PC') },
  { key: 'PCWriteCond', label: 'PCWriteCond', group: 'fetch', describe: (value) => (value ? '按条件更新分支 PC' : '不进行条件写入') },
  { key: 'IRWrite', label: 'IRWrite', group: 'fetch', describe: (value) => (value ? '锁存刚取回的指令' : 'IR 保持不变') },
  { key: 'IorD', label: 'IorD', group: 'memory', describe: (value) => (value ? '地址来自 ALUOut' : '地址来自 PC') },
  { key: 'MemRead', label: 'MemRead', group: 'memory', describe: (value) => (value ? '读取内存' : '本周期不读内存') },
  { key: 'MemWrite', label: 'MemWrite', group: 'memory', describe: (value) => (value ? '写入内存' : '本周期不写内存') },
  { key: 'MemToReg', label: 'MemToReg', group: 'writeback', describe: (value) => (value === 1 ? '回写 MDR' : '回写 ALUOut') },
  { key: 'RegWrite', label: 'RegWrite', group: 'writeback', describe: (value) => (value ? '提交寄存器写回' : '本周期不写寄存器') },
  { key: 'ALUSrcA', label: 'ALUSrcA', group: 'alu', describe: (value) => (value === 1 ? '输入 A 来自寄存器 A' : '输入 A 来自 PC') },
  {
    key: 'ALUSrcB',
    label: 'ALUSrcB',
    group: 'alu',
    describe: (value) =>
      value === 0 ? '输入 B 来自寄存器 B'
      : value === 1 ? '输入 B 是常数 4'
      : value === 2 ? '输入 B 来自立即数'
      : '输入 B 来自左移后的立即数',
  },
  { key: 'ALUOp', label: 'ALUOp', group: 'alu', describe: (value) => `ALU 运算类型：${String(value)}` },
  {
    key: 'PCSource',
    label: 'PCSource',
    group: 'fetch',
    describe: (value) =>
      value === 0 ? '下一条 PC 来自 ALU 结果'
      : value === 1 ? '下一条 PC 来自 ALUOut'
      : '下一条 PC 来自跳转目标',
  },
  { key: 'Branch', label: 'Branch', group: 'fetch', describe: (value) => (value ? '分支路径已激活' : '顺序执行') },
  { key: 'ImmSrc', label: 'ImmSrc', group: 'alu', describe: (value) => `立即数类型：${String(value)}` },
];

function formatSignalValue(value: ControlSignals[keyof ControlSignals]): string {
  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }

  return String(value);
}

export function SignalTable() {
  const stage = useCPUStore((state) => state.stage);
  const controlSignals = useCPUStore((state) => state.controlSignals);
  const currentInstruction = useCPUStore((state) => state.currentInstruction);

  const rows = useMemo(() => {
    return SIGNAL_DEFINITIONS.map((definition) => {
      const value = controlSignals[definition.key];
      const isActive = typeof value === 'boolean' ? value : value !== 0 && value !== 'NONE' && value !== 'ADD';

      return {
        ...definition,
        value,
        isActive,
      };
    });
  }, [controlSignals]);

  return (
    <section className="panel-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">第 4 天 / 控制信号</p>
          <h2>控制信号表</h2>
        </div>
        <span className="editor-pill">阶段 {stage}</span>
      </div>

      <p className="panel-copy">
        这张表直接读取当前阶段和当前指令推导出的控制信号，所以你在控制台推进周期、单步指令或回退时间线时，这里都会同步更新。
      </p>

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
              <tr key={row.key} className={row.isActive ? 'signal-row signal-row--active' : 'signal-row'}>
                <td>
                  <div className="signal-name-cell">
                    <strong>{row.label}</strong>
                    <span className={`signal-group-tag signal-group-tag--${row.group}`}>{GROUP_LABELS[row.group]}</span>
                  </div>
                </td>
                <td>
                  <span className={row.isActive ? 'value-badge value-badge--active' : 'value-badge'}>
                    {formatSignalValue(row.value)}
                  </span>
                </td>
                <td className="signal-meaning">{row.describe(row.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
