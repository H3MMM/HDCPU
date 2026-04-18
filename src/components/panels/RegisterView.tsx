import { memo, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useCPUStore } from '../../store/cpu-store';

const REGISTER_LABELS = [
  'zero', 'ra', 'sp', 'gp', 'tp', 't0', 't1', 't2',
  's0/fp', 's1', 'a0', 'a1', 'a2', 'a3', 'a4', 'a5',
  'a6', 'a7', 's2', 's3', 's4', 's5', 's6', 's7',
  's8', 's9', 's10', 's11', 't3', 't4', 't5', 't6',
];

function formatRegisterValue(value: number, format: 'hex' | 'dec'): string {
  if (format === 'dec') {
    return String(value | 0);
  }

  return `0x${(value >>> 0).toString(16).padStart(8, '0')}`;
}

function extractChangedRegisterIndices(targets: readonly string[]): Set<number> {
  const changedIndices = new Set<number>();

  targets.forEach((target) => {
    const match = /^registers\[(\d+)\]$/.exec(target);
    if (match) {
      changedIndices.add(Number.parseInt(match[1], 10));
    }
  });

  return changedIndices;
}

export const RegisterView = memo(function RegisterView() {
  const { registers, format, setRegisterDisplayFormat, currentSnapshot } = useCPUStore(
    useShallow((state) => ({
      registers: state.registers,
      format: state.registerDisplayFormat,
      setRegisterDisplayFormat: state.setRegisterDisplayFormat,
      currentSnapshot: state.currentSnapshot,
    }))
  );

  const changedRegisterIndices = useMemo(
    () => extractChangedRegisterIndices(currentSnapshot.changes.map((change) => change.target)),
    [currentSnapshot.changes]
  );

  return (
    <section className="panel-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">寄存器观察</p>
          <h2>寄存器堆</h2>
        </div>

        <div className="segmented-control" aria-label="寄存器显示格式">
          <button
            type="button"
            className={format === 'hex' ? 'segment-button segment-button--active' : 'segment-button'}
            onClick={() => setRegisterDisplayFormat('hex')}
          >
            十六进制
          </button>
          <button
            type="button"
            className={format === 'dec' ? 'segment-button segment-button--active' : 'segment-button'}
            onClick={() => setRegisterDisplayFormat('dec')}
          >
            十进制
          </button>
        </div>
      </div>

      <p className="panel-copy">
        这张表已经直接绑定真实寄存器快照。除了持续显示当前数值外，还会标出最近一次写回命中的寄存器，方便我们确认写回周期是不是落在正确的位置。
      </p>

      <div className="register-summary-strip">
        <span className="type-pill">x0 固定为 0</span>
        <span className="type-pill">最近快照写回 {changedRegisterIndices.size} 个寄存器</span>
        <span className="type-pill">{format === 'hex' ? '十六进制显示' : '十进制显示'}</span>
      </div>

      <div className="register-table-shell">
        <table className="register-table">
          <thead>
            <tr>
              <th>寄存器</th>
              <th>别名</th>
              <th>数值</th>
            </tr>
          </thead>
          <tbody>
            {registers.map((value, index) => {
              const isZeroRegister = index === 0;
              const isActive = value !== 0 && !isZeroRegister;
              const isChanged = changedRegisterIndices.has(index);
              const className = [
                'register-row',
                isActive ? 'register-row--active' : '',
                isChanged ? 'register-row--changed' : '',
              ].filter(Boolean).join(' ');

                return (
                  <tr key={index} className={className}>
                    <td className="register-index">x{index}</td>
                    <td className="register-alias">{REGISTER_LABELS[index]}</td>
                    <td className="register-value-cell">
                      <div className="register-value-wrap">
                        <span className={isChanged ? 'value-badge value-badge--changed' : isActive ? 'value-badge value-badge--active' : 'value-badge'}>
                          {formatRegisterValue(value, format)}
                        </span>
                      </div>
                    </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
});
