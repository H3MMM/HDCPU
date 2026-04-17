import { useMemo } from 'react';
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

export function RegisterView() {
  const registers = useCPUStore((state) => state.registers);
  const format = useCPUStore((state) => state.registerDisplayFormat);
  const setRegisterDisplayFormat = useCPUStore((state) => state.setRegisterDisplayFormat);
  const currentSnapshot = useCPUStore((state) => state.currentSnapshot);

  const changedRegisterIndices = useMemo(
    () => extractChangedRegisterIndices(currentSnapshot.changes.map((change) => change.target)),
    [currentSnapshot.changes]
  );

  return (
    <section className="panel-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Day 10 / Register View</p>
          <h2>Register File</h2>
        </div>

        <div className="segmented-control" aria-label="Register display format">
          <button
            type="button"
            className={format === 'hex' ? 'segment-button segment-button--active' : 'segment-button'}
            onClick={() => setRegisterDisplayFormat('hex')}
          >
            Hex
          </button>
          <button
            type="button"
            className={format === 'dec' ? 'segment-button segment-button--active' : 'segment-button'}
            onClick={() => setRegisterDisplayFormat('dec')}
          >
            Dec
          </button>
        </div>
      </div>

      <p className="panel-copy">
        This table is now backed by the real register file snapshot. Non-zero values stay visible, while the most
        recent write-back is called out so we can verify that state changes are landing in the UI on the right cycle.
      </p>

      <div className="register-summary-strip">
        <span className="type-pill">x0 hard-wired to zero</span>
        <span className="type-pill">{changedRegisterIndices.size} register writes in latest snapshot</span>
        <span className="type-pill">{format.toUpperCase()} display</span>
      </div>

      <div className="register-table-shell">
        <table className="register-table">
          <thead>
            <tr>
              <th>Register</th>
              <th>Alias</th>
              <th>Value</th>
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
                  <td>
                    <span className={isChanged ? 'value-badge value-badge--changed' : isActive ? 'value-badge value-badge--active' : 'value-badge'}>
                      {formatRegisterValue(value, format)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
