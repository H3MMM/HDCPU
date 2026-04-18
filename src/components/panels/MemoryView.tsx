import { memo, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useShallow } from 'zustand/react/shallow';
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
    currentSnapshot,
    latestMemoryAccess,
  } = useCPUStore(
    useShallow((state) => ({
      memoryBytes: state.memoryBytes,
      memoryViewStartAddress: state.memoryViewStartAddress,
      jumpToMemoryAddress: state.jumpToMemoryAddress,
      currentSnapshot: state.currentSnapshot,
      latestMemoryAccess: state.latestMemoryAccess,
    }))
  );

  const [jumpInput, setJumpInput] = useState(formatAddress(memoryViewStartAddress));
  const [feedback, setFeedback] = useState('跳转到某个地址后，这里会显示对应的数据内存窗口。');

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
      setFeedback('地址格式无效，请输入 0x0040 或 64 这样的值。');
      return;
    }

    jumpToMemoryAddress(parsedAddress);
    setFeedback(`内存窗口已移动到 ${formatAddress(parsedAddress - (parsedAddress % BYTES_PER_ROW))}。`);
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
            placeholder="0x0040"
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
});
