import { memo, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  MEMORY_ADDRESS_HEX_DIGITS,
  MEMORY_ROW_BYTES,
  mapMemoryAddressToStorage,
  useCPUStore,
} from '../../store/cpu-store';

const BYTES_PER_ROW = MEMORY_ROW_BYTES;
const ROW_COUNT = 8;

function formatAddress(value: number): string {
  return `0x${(value >>> 0).toString(16).padStart(MEMORY_ADDRESS_HEX_DIGITS, '0')}`;
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

  if (/^0x[0-9a-f]{1,8}$/.test(trimmed)) {
    return Number.parseInt(trimmed.slice(2), 16);
  }

  if (/^[0-9a-f]{1,8}$/.test(trimmed) && (trimmed.length === 4 || trimmed.length === 8 || /[a-f]/.test(trimmed))) {
    return Number.parseInt(trimmed, 16);
  }

  if (/^[0-9]+$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10);
  }

  return null;
}

function parseByteInput(input: string): number | null {
  const trimmed = input.trim().toLowerCase();

  if (trimmed.length === 0) {
    return null;
  }

  if (/^0x[0-9a-f]{1,2}$/.test(trimmed)) {
    return Number.parseInt(trimmed.slice(2), 16);
  }

  if (/^[0-9a-f]{1,2}$/.test(trimmed) && /[a-f]/.test(trimmed)) {
    return Number.parseInt(trimmed, 16);
  }

  if (/^[0-9]+$/.test(trimmed)) {
    const value = Number.parseInt(trimmed, 10);
    return value >= 0 && value <= 0xFF ? value : null;
  }

  return null;
}

function getMemoryAccessLabel(type: 'none' | 'read' | 'write'): string {
  switch (type) {
    case 'read':
      return '读取';
    case 'write':
      return '写入';
    default:
      return '无';
  }
}

export const MemoryView = memo(function MemoryView() {
  const {
    memoryBytes,
    memoryViewStartAddress,
    jumpToMemoryAddress,
    setMemoryInitialBytes,
    currentSnapshot,
    latestMemoryAccess,
  } = useCPUStore(
    useShallow((state) => ({
      memoryBytes: state.memoryBytes,
      memoryViewStartAddress: state.memoryViewStartAddress,
      jumpToMemoryAddress: state.jumpToMemoryAddress,
      setMemoryInitialBytes: state.setMemoryInitialBytes,
      currentSnapshot: state.currentSnapshot,
      latestMemoryAccess: state.latestMemoryAccess,
    }))
  );

  const [jumpInput, setJumpInput] = useState(formatAddress(memoryViewStartAddress));
  const [byteInput, setByteInput] = useState('0x00');
  const [selectedAddresses, setSelectedAddresses] = useState<Set<number>>(() => new Set());
  const [feedback, setFeedback] = useState('跳转到某个地址后，这里会显示对应的数据内存窗口。');

  useEffect(() => {
    setJumpInput(formatAddress(memoryViewStartAddress));
  }, [memoryViewStartAddress]);

  const accessAddress = latestMemoryAccess.address;
  const accessStorageAddress = mapMemoryAddressToStorage(accessAddress);
  const hasRecentAccess = latestMemoryAccess.type !== 'none';

  const rows = useMemo(() => {
    return Array.from({ length: ROW_COUNT }, (_, rowIndex) => {
      const address = (memoryViewStartAddress + rowIndex * BYTES_PER_ROW) >>> 0;
      const cells = Array.from({ length: BYTES_PER_ROW }, (_, index) => {
        const logicalAddress = (address + index) >>> 0;
        const storageAddress = mapMemoryAddressToStorage(logicalAddress);

        return {
          logicalAddress,
          storageAddress,
          value: memoryBytes[storageAddress] ?? 0,
        };
      });
      const isAccessRow = hasRecentAccess && cells.some((cell) => cell.storageAddress === accessStorageAddress);

      return {
        address,
        cells,
        ascii: toAscii(cells.map((cell) => cell.value)),
        isAccessRow,
      };
    });
  }, [accessStorageAddress, hasRecentAccess, memoryBytes, memoryViewStartAddress]);

  const visibleAddresses = useMemo(
    () => rows.flatMap((row) => row.cells.map((cell) => cell.logicalAddress)),
    [rows]
  );

  function handleJumpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedAddress = parseAddressInput(jumpInput);
    if (parsedAddress === null) {
      setFeedback('地址格式无效，请输入 0x00000040、0040 或 64 这样的值。');
      return;
    }

    jumpToMemoryAddress(parsedAddress);
    setFeedback(`内存窗口已移动到 ${formatAddress(parsedAddress)}。`);
  }

  function toggleAddress(address: number) {
    setSelectedAddresses((current) => {
      const next = new Set(current);
      if (next.has(address)) {
        next.delete(address);
      } else {
        next.add(address);
      }
      return next;
    });
  }

  function handleSelectVisibleAddresses() {
    setSelectedAddresses(new Set(visibleAddresses));
  }

  function handleApplyByteInitialValue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedValue = parseByteInput(byteInput);
    if (parsedValue === null) {
      setFeedback('字节值无效，请输入 0x2A 或 42 这样的 0-255 数值。');
      return;
    }

    if (selectedAddresses.size === 0) {
      setFeedback('请先选中至少一个内存地址。');
      return;
    }

    setMemoryInitialBytes(Array.from(selectedAddresses), parsedValue);
    setFeedback(`已为 ${selectedAddresses.size} 个选中地址置入 0x${parsedValue.toString(16).padStart(2, '0').toUpperCase()}。`);
  }

  return (
    <section className="panel-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">内存观察</p>
          <h2>数据内存</h2>
        </div>
        <span className="editor-pill">阶段 {currentSnapshot.stage}</span>
      </div>

      <p className="panel-copy">
        内存面板也已经直接跟随引擎快照。最近一次访存会在这里汇总，同时高亮对应的行和字节，方便和数据通路动画、控制信号以及时间线一起核对。
      </p>

      <div className="register-summary-strip">
        <span className="type-pill">窗口 {formatAddress(memoryViewStartAddress)}</span>
        <span className="type-pill">最近访存 {getMemoryAccessLabel(latestMemoryAccess.type)}</span>
        <span className="type-pill">数据 {formatWord(latestMemoryAccess.data)}</span>
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
            placeholder="0x00000040"
          />
          <button type="submit" className="control-button control-button--secondary memory-jump-button">
            跳到地址
          </button>
          <button
            type="button"
            className="control-button control-button--ghost memory-jump-button"
            onClick={() => jumpToMemoryAddress(accessAddress)}
            disabled={!hasRecentAccess}
          >
            跳到最近访存
          </button>
        </form>

        <div className="memory-presets">
          {[0x00000000, 0x00000020, 0x00000040, 0x00000080].map((address) => (
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

        <form className="state-init-form" onSubmit={handleApplyByteInitialValue}>
          <input
            className="memory-input state-init-input"
            type="text"
            inputMode="text"
            value={byteInput}
            onChange={(event) => setByteInput(event.target.value)}
            aria-label="内存字节初值"
            placeholder="0x2A"
          />
          <button type="submit" className="control-button control-button--secondary memory-jump-button">
            置入选中
          </button>
          <button
            type="button"
            className="control-button control-button--ghost memory-jump-button"
            onClick={handleSelectVisibleAddresses}
          >
            全选窗口
          </button>
          <button
            type="button"
            className="control-button control-button--ghost memory-jump-button"
            onClick={() => setSelectedAddresses(new Set())}
            disabled={selectedAddresses.size === 0}
          >
            清除选择
          </button>
          <span className="state-selection-count">选中 {selectedAddresses.size}</span>
        </form>
      </div>

      <p className="panel-caption">
        {hasRecentAccess
          ? `最近一次访存发生在 ${formatAddress(accessAddress)}。`
          : feedback}
      </p>

      <div className="memory-grid-shell">
        <div className="memory-grid-header">
          <span>地址</span>
          <span>十六进制字节</span>
          <span>ASCII</span>
        </div>

        {rows.map((row) => (
          <div key={row.address} className={row.isAccessRow ? 'memory-row memory-row--focused' : 'memory-row'}>
            <span className="memory-address">{formatAddress(row.address)}</span>
            <div className="memory-cells">
              {row.cells.map((cell, index) => {
                const isActiveByte = cell.value !== 0;
                const isAccessByte = hasRecentAccess && cell.storageAddress === accessStorageAddress;
                const isSelected = selectedAddresses.has(cell.logicalAddress);
                const className = [
                  'memory-byte',
                  isActiveByte ? 'memory-byte--active' : '',
                  isAccessByte ? 'memory-byte--focused' : '',
                  isSelected ? 'memory-byte--selected' : '',
                ].filter(Boolean).join(' ');

                return (
                  <button
                    key={`${row.address}-${index}`}
                    type="button"
                    className={className}
                    aria-label={`${formatAddress(cell.logicalAddress)} = ${formatByte(cell.value)}`}
                    aria-pressed={isSelected}
                    onClick={() => toggleAddress(cell.logicalAddress)}
                  >
                    {formatByte(cell.value)}
                  </button>
                );
              })}
            </div>
            <span className="memory-ascii">{row.ascii}</span>
          </div>
        ))}
      </div>
    </section>
  );
});
