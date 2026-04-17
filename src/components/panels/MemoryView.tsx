import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useCPUStore } from '../../store/cpu-store';

const BYTES_PER_ROW = 16;
const ROW_COUNT = 8;

function formatAddress(value: number): string {
  return `0x${value.toString(16).padStart(4, '0')}`;
}

function formatByte(value: number): string {
  return value.toString(16).padStart(2, '0').toUpperCase();
}

function toAscii(bytes: readonly number[]): string {
  return bytes
    .map((byte) => (byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.'))
    .join('');
}

function parseAddressInput(input: string): number | null {
  const trimmed = input.trim().toLowerCase();

  if (trimmed.length === 0) {
    return null;
  }

  if (/^0x[0-9a-f]+$/.test(trimmed)) {
    return Number.parseInt(trimmed.slice(2), 16);
  }

  if (/^[0-9]+$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10);
  }

  return null;
}

export function MemoryView() {
  const memoryBytes = useCPUStore((state) => state.memoryBytes);
  const memoryViewStartAddress = useCPUStore((state) => state.memoryViewStartAddress);
  const jumpToMemoryAddress = useCPUStore((state) => state.jumpToMemoryAddress);
  const stage = useCPUStore((state) => state.stage);

  const [jumpInput, setJumpInput] = useState(formatAddress(memoryViewStartAddress));
  const [feedback, setFeedback] = useState('输入十六进制或十进制地址后可以直接跳转到对应的内存窗口。');

  useEffect(() => {
    setJumpInput(formatAddress(memoryViewStartAddress));
  }, [memoryViewStartAddress]);

  const rows = useMemo(() => {
    return Array.from({ length: ROW_COUNT }, (_, rowIndex) => {
      const address = memoryViewStartAddress + rowIndex * BYTES_PER_ROW;
      const bytes = Array.from(memoryBytes.slice(address, address + BYTES_PER_ROW));

      return {
        address,
        bytes,
        ascii: toAscii(bytes),
      };
    });
  }, [memoryBytes, memoryViewStartAddress]);

  function handleJumpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedAddress = parseAddressInput(jumpInput);
    if (parsedAddress === null) {
      setFeedback('地址格式无效，请输入如 0x0040 或 64 这样的值。');
      return;
    }

    jumpToMemoryAddress(parsedAddress);
    setFeedback(`内存窗口已跳转到 ${formatAddress(parsedAddress - (parsedAddress % BYTES_PER_ROW))}。`);
  }

  return (
    <section className="panel-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Day 3 / Memory View</p>
          <h2>内存视图</h2>
        </div>
        <span className="editor-pill">Stage {stage}</span>
      </div>

      <div className="memory-toolbar">
        <form className="memory-jump-form" onSubmit={handleJumpSubmit}>
          <input
            className="memory-input"
            type="text"
            inputMode="text"
            value={jumpInput}
            onChange={(event) => setJumpInput(event.target.value)}
            aria-label="内存地址"
            placeholder="0x0040"
          />
          <button type="submit" className="control-button control-button--secondary memory-jump-button">
            地址跳转
          </button>
        </form>

        <div className="memory-presets">
          {[0x0000, 0x0020, 0x0040, 0x0080].map((address) => (
            <button
              key={address}
              type="button"
              className="preset-pill"
              onClick={() => jumpToMemoryAddress(address)}
            >
              {formatAddress(address)}
            </button>
          ))}
        </div>
      </div>

      <p className="panel-caption">{feedback}</p>

      <div className="memory-grid-shell">
        <div className="memory-grid-header">
          <span>Address</span>
          <span>Hex Bytes</span>
          <span>ASCII</span>
        </div>

        {rows.map((row) => (
          <div key={row.address} className="memory-row">
            <span className="memory-address">{formatAddress(row.address)}</span>
            <div className="memory-cells">
              {row.bytes.map((byte, index) => (
                <span key={`${row.address}-${index}`} className={byte === 0 ? 'memory-byte' : 'memory-byte memory-byte--active'}>
                  {formatByte(byte)}
                </span>
              ))}
            </div>
            <span className="memory-ascii">{row.ascii}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
