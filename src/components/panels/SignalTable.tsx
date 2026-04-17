import { useMemo } from 'react';
import { useCPUStore } from '../../store/cpu-store';
import type { ControlSignals } from '../../types';

interface SignalDefinition {
  key: keyof ControlSignals;
  label: string;
  group: 'fetch' | 'memory' | 'alu' | 'writeback';
  describe: (value: ControlSignals[keyof ControlSignals]) => string;
}

const SIGNAL_DEFINITIONS: SignalDefinition[] = [
  { key: 'PCWrite', label: 'PCWrite', group: 'fetch', describe: (value) => (value ? 'Enable PC update' : 'Hold current PC') },
  { key: 'PCWriteCond', label: 'PCWriteCond', group: 'fetch', describe: (value) => (value ? 'Conditional branch update' : 'No conditional write') },
  { key: 'IRWrite', label: 'IRWrite', group: 'fetch', describe: (value) => (value ? 'Latch fetched instruction' : 'IR unchanged') },
  { key: 'IorD', label: 'IorD', group: 'memory', describe: (value) => (value ? 'Address from ALUOut' : 'Address from PC') },
  { key: 'MemRead', label: 'MemRead', group: 'memory', describe: (value) => (value ? 'Read memory' : 'No memory read') },
  { key: 'MemWrite', label: 'MemWrite', group: 'memory', describe: (value) => (value ? 'Write memory' : 'No memory write') },
  { key: 'MemToReg', label: 'MemToReg', group: 'writeback', describe: (value) => (value === 1 ? 'Write back MDR' : 'Write back ALUOut') },
  { key: 'RegWrite', label: 'RegWrite', group: 'writeback', describe: (value) => (value ? 'Commit register write' : 'No register write') },
  { key: 'ALUSrcA', label: 'ALUSrcA', group: 'alu', describe: (value) => (value === 1 ? 'Input A from register A' : 'Input A from PC') },
  {
    key: 'ALUSrcB',
    label: 'ALUSrcB',
    group: 'alu',
    describe: (value) =>
      value === 0 ? 'Input B from register B'
      : value === 1 ? 'Input B is constant 4'
      : value === 2 ? 'Input B from immediate'
      : 'Input B from shifted immediate',
  },
  { key: 'ALUOp', label: 'ALUOp', group: 'alu', describe: (value) => `ALU operation ${String(value)}` },
  {
    key: 'PCSource',
    label: 'PCSource',
    group: 'fetch',
    describe: (value) =>
      value === 0 ? 'Next PC from ALU result'
      : value === 1 ? 'Next PC from ALUOut'
      : 'Next PC from jump target',
  },
  { key: 'Branch', label: 'Branch', group: 'fetch', describe: (value) => (value ? 'Branch path active' : 'Sequential flow') },
  { key: 'ImmSrc', label: 'ImmSrc', group: 'alu', describe: (value) => `Immediate mode ${String(value)}` },
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
          <p className="eyebrow">Day 4 / Signal Table</p>
          <h2>控制信号表</h2>
        </div>
        <span className="editor-pill">Stage {stage}</span>
      </div>

      <p className="panel-copy">
        这张表直接读取当前阶段与当前指令推导出的控制信号，不再只是静态占位。现在你在执行控制台里切换阶段，信号表会同步变化。
      </p>

      <div className="signal-intro-card">
        <span className="detail-label">Current Instruction</span>
        <strong className="detail-value">{currentInstruction?.asmString ?? 'No decoded instruction'}</strong>
      </div>

      <div className="signal-table-shell">
        <table className="signal-table">
          <thead>
            <tr>
              <th>Signal</th>
              <th>Value</th>
              <th>Meaning</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className={row.isActive ? 'signal-row signal-row--active' : 'signal-row'}>
                <td>
                  <div className="signal-name-cell">
                    <strong>{row.label}</strong>
                    <span className={`signal-group-tag signal-group-tag--${row.group}`}>{row.group}</span>
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
