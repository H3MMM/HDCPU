import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useCPUStore } from '../../store/cpu-store';

const BYTES_PER_ROW = 16;
const ROW_COUNT = 8;

function formatAddress(value: number): string {
  return `0x${value.toString(16).padStart(4, '0')}`;
}

function formatWord(value: number): string {
  return `0x${(value >>> 0).toString(16).padStart(8, '0')}`;
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
  const currentSnapshot = useCPUStore((state) => state.currentSnapshot);
  const latestMemoryAccess = useCPUStore((state) => state.latestMemoryAccess);

  const [jumpInput, setJumpInput] = useState(formatAddress(memoryViewStartAddress));
  const [feedback, setFeedback] = useState('Jump to an address to inspect the current data-memory window.');

  useEffect(() => {
    setJumpInput(formatAddress(memoryViewStartAddress));
  }, [memoryViewStartAddress]);

  const accessAddress = latestMemoryAccess.address;
  const hasRecentAccess = latestMemoryAccess.type !== 'none';

  const rows = useMemo(() => {
    return Array.from({ length: ROW_COUNT }, (_, rowIndex) => {
      const address = memoryViewStartAddress + rowIndex * BYTES_PER_ROW;
      const bytes = Array.from(memoryBytes.slice(address, address + BYTES_PER_ROW));
      const isAccessRow = hasRecentAccess && accessAddress >= address && accessAddress < address + BYTES_PER_ROW;

      return {
        address,
        bytes,
        ascii: toAscii(bytes),
        isAccessRow,
      };
    });
  }, [accessAddress, hasRecentAccess, memoryBytes, memoryViewStartAddress]);

  function handleJumpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedAddress = parseAddressInput(jumpInput);
    if (parsedAddress === null) {
      setFeedback('Invalid address. Use a value like 0x0040 or 64.');
      return;
    }

    jumpToMemoryAddress(parsedAddress);
    setFeedback(`Memory window moved to ${formatAddress(parsedAddress - (parsedAddress % BYTES_PER_ROW))}.`);
  }

  return (
    <section className="panel-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Day 10 / Memory View</p>
          <h2>Data Memory</h2>
        </div>
        <span className="editor-pill">Stage {currentSnapshot.stage}</span>
      </div>

      <p className="panel-copy">
        The memory panel now follows the engine snapshot too. The most recent memory transaction is summarized below,
        and the accessed row is highlighted so store/load activity is easy to verify against the datapath animation.
      </p>

      <div className="register-summary-strip">
        <span className="type-pill">Window {formatAddress(memoryViewStartAddress)}</span>
        <span className="type-pill">
          Last Access {hasRecentAccess ? latestMemoryAccess.type.toUpperCase() : 'NONE'}
        </span>
        <span className="type-pill">Data {formatWord(latestMemoryAccess.data)}</span>
      </div>

      <div className="memory-toolbar">
        <form className="memory-jump-form" onSubmit={handleJumpSubmit}>
          <input
            className="memory-input"
            type="text"
            inputMode="text"
            value={jumpInput}
            onChange={(event) => setJumpInput(event.target.value)}
            aria-label="Memory address"
            placeholder="0x0040"
          />
          <button type="submit" className="control-button control-button--secondary memory-jump-button">
            Jump To Address
          </button>
          <button
            type="button"
            className="control-button control-button--ghost memory-jump-button"
            onClick={() => jumpToMemoryAddress(accessAddress)}
            disabled={!hasRecentAccess}
          >
            Jump To Last Access
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

      <p className="panel-caption">
        {hasRecentAccess
          ? `Last memory ${latestMemoryAccess.type} happened at ${formatAddress(accessAddress)}.`
          : feedback}
      </p>

      <div className="memory-grid-shell">
        <div className="memory-grid-header">
          <span>Address</span>
          <span>Hex Bytes</span>
          <span>ASCII</span>
        </div>

        {rows.map((row) => (
          <div key={row.address} className={row.isAccessRow ? 'memory-row memory-row--focused' : 'memory-row'}>
            <span className="memory-address">{formatAddress(row.address)}</span>
            <div className="memory-cells">
              {row.bytes.map((byte, index) => {
                const isActiveByte = byte !== 0;
                const absoluteAddress = row.address + index;
                const isAccessByte = hasRecentAccess && absoluteAddress === accessAddress;
                const className = [
                  'memory-byte',
                  isActiveByte ? 'memory-byte--active' : '',
                  isAccessByte ? 'memory-byte--focused' : '',
                ].filter(Boolean).join(' ');

                return (
                  <span key={`${row.address}-${index}`} className={className}>
                    {formatByte(byte)}
                  </span>
                );
              })}
            </div>
            <span className="memory-ascii">{row.ascii}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
