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

export function RegisterView() {
  const registers = useCPUStore((state) => state.registers);
  const format = useCPUStore((state) => state.registerDisplayFormat);
  const setRegisterDisplayFormat = useCPUStore((state) => state.setRegisterDisplayFormat);
  const instructionCount = useCPUStore((state) => state.instructionCount);

  return (
    <section className="panel-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Day 3 / Register View</p>
          <h2>寄存器视图</h2>
        </div>

        <div className="segmented-control" aria-label="寄存器显示格式">
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
        32 个通用寄存器已经整理成可滚动表格。现在的值先由 Day3 的占位状态驱动，后续接入真实引擎后可以无缝替换。
      </p>

      <div className="register-summary-strip">
        <span className="type-pill">x0 locked to zero</span>
        <span className="type-pill">{instructionCount} instructions mapped</span>
        <span className="type-pill">{format.toUpperCase()} display</span>
      </div>

      <div className="register-table-shell">
        <table className="register-table">
          <thead>
            <tr>
              <th>寄存器</th>
              <th>别名</th>
              <th>值</th>
            </tr>
          </thead>
          <tbody>
            {registers.map((value, index) => {
              const isZeroRegister = index === 0;
              const isActive = value !== 0 && !isZeroRegister;

              return (
                <tr key={index} className={isActive ? 'register-row register-row--active' : 'register-row'}>
                  <td className="register-index">x{index}</td>
                  <td className="register-alias">{REGISTER_LABELS[index]}</td>
                  <td>
                    <span className={isActive ? 'value-badge value-badge--active' : 'value-badge'}>
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
