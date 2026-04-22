import { memo, useMemo, useState, type FormEvent } from 'react';
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

function parseRegisterInput(input: string): number | null {
  const trimmed = input.trim().toLowerCase();

  if (trimmed.length === 0) {
    return null;
  }

  if (/^0x[0-9a-f]{1,8}$/.test(trimmed)) {
    return Number.parseInt(trimmed.slice(2), 16) | 0;
  }

  if (/^[0-9a-f]{1,8}$/.test(trimmed) && /[a-f]/.test(trimmed)) {
    return Number.parseInt(trimmed, 16) | 0;
  }

  if (/^-?[0-9]+$/.test(trimmed)) {
    const value = Number.parseInt(trimmed, 10);
    if (value < -0x80000000 || value > 0xFFFFFFFF) {
      return null;
    }
    return value | 0;
  }

  return null;
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
  const { registers, format, setRegisterDisplayFormat, setRegisterInitialValues, currentSnapshot } = useCPUStore(
    useShallow((state) => ({
      registers: state.registers,
      format: state.registerDisplayFormat,
      setRegisterDisplayFormat: state.setRegisterDisplayFormat,
      setRegisterInitialValues: state.setRegisterInitialValues,
      currentSnapshot: state.currentSnapshot,
    }))
  );

  const [selectedRegisters, setSelectedRegisters] = useState<Set<number>>(() => new Set());
  const [initialValueInput, setInitialValueInput] = useState('0x00000000');
  const [feedback, setFeedback] = useState('选中的寄存器会在程序重置后保持为置入初值。');

  const changedRegisterIndices = useMemo(
    () => extractChangedRegisterIndices(currentSnapshot.changes.map((change) => change.target)),
    [currentSnapshot.changes]
  );

  function toggleRegister(index: number) {
    if (index === 0) {
      return;
    }

    setSelectedRegisters((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  function handleSelectWritableRegisters() {
    setSelectedRegisters(new Set(registers.map((_, index) => index).filter((index) => index > 0)));
  }

  function handleApplyInitialValue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedValue = parseRegisterInput(initialValueInput);
    if (parsedValue === null) {
      setFeedback('寄存器值无效，请输入 0x0000002A 或 42 这样的 32 位数值。');
      return;
    }

    if (selectedRegisters.size === 0) {
      setFeedback('请先选中至少一个可写寄存器。');
      return;
    }

    setRegisterInitialValues(Array.from(selectedRegisters), parsedValue);
    setFeedback(`已为 ${selectedRegisters.size} 个寄存器置入 ${formatRegisterValue(parsedValue, 'hex')}。`);
  }

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
        <span className="type-pill">选中 {selectedRegisters.size}</span>
      </div>

      <form className="state-init-form state-init-form--registers" onSubmit={handleApplyInitialValue}>
        <input
          className="memory-input state-init-input"
          type="text"
          inputMode="text"
          value={initialValueInput}
          onChange={(event) => setInitialValueInput(event.target.value)}
          aria-label="寄存器初值"
          placeholder="0x0000002A"
        />
        <button type="submit" className="control-button control-button--secondary memory-jump-button">
          置入选中
        </button>
        <button
          type="button"
          className="control-button control-button--ghost memory-jump-button"
          onClick={handleSelectWritableRegisters}
        >
          全选可写
        </button>
        <button
          type="button"
          className="control-button control-button--ghost memory-jump-button"
          onClick={() => setSelectedRegisters(new Set())}
          disabled={selectedRegisters.size === 0}
        >
          清除选择
        </button>
      </form>

      <p className="panel-caption">{feedback}</p>

      <div className="register-table-shell">
        <table className="register-table">
          <thead>
            <tr>
              <th aria-label="选择寄存器" />
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
              const isSelected = selectedRegisters.has(index);
              const className = [
                'register-row',
                isActive ? 'register-row--active' : '',
                isChanged ? 'register-row--changed' : '',
                isSelected ? 'register-row--selected' : '',
              ].filter(Boolean).join(' ');

                return (
                  <tr key={index} className={className}>
                    <td className="register-select-cell">
                      <input
                        type="checkbox"
                        className="state-select-checkbox"
                        checked={isSelected}
                        disabled={isZeroRegister}
                        aria-label={`选择 x${index}`}
                        onChange={() => toggleRegister(index)}
                      />
                    </td>
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
