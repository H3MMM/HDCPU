import { memo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useCPUStore } from '../../store/cpu-store';

function formatWord(value: number): string {
  return `0x${(value >>> 0).toString(16).padStart(8, '0')}`;
}

function formatAddress(value: number): string {
  return `0x${value.toString(16).padStart(4, '0')}`;
}

function formatBinaryWord(value: number): string {
  const binary = (value >>> 0).toString(2).padStart(32, '0');
  return binary.match(/.{1,4}/g)?.join(' ') ?? binary;
}

export const MachineCodeView = memo(function MachineCodeView() {
  const {
    machineCodeRows,
    assembleErrors,
    currentInstruction,
    currentMachineWord,
  } = useCPUStore(
    useShallow((state) => ({
      machineCodeRows: state.machineCodeRows,
      assembleErrors: state.assembleErrors,
      currentInstruction: state.currentInstruction,
      currentMachineWord: state.currentMachineWord,
    }))
  );

  return (
    <section className="panel-card panel-card--machine">
      <div className="panel-header">
        <div>
          <p className="eyebrow">机器码</p>
          <h2>机器码视图</h2>
        </div>
        <span className="editor-pill">{machineCodeRows.length} 条指令</span>
      </div>

      <div className="machine-summary-grid">
        <article className="metric-card">
          <span className="metric-label">当前机器字</span>
          <strong>{currentMachineWord === null ? '无' : formatWord(currentMachineWord)}</strong>
        </article>
        <article className="metric-card">
          <span className="metric-label">当前译码</span>
          <strong>{currentInstruction?.asmString ?? '未译码'}</strong>
        </article>
        <article className="metric-card">
          <span className="metric-label">当前二进制</span>
          <strong>{currentMachineWord === null ? '无' : formatBinaryWord(currentMachineWord)}</strong>
        </article>
      </div>

      <div className="machine-table-shell machine-table-shell--compact">
        <table className="machine-table machine-table--compact">
          <thead>
            <tr>
              <th>地址</th>
              <th>机器码</th>
              <th>汇编</th>
            </tr>
          </thead>
          <tbody>
            {machineCodeRows.map((row) => (
              <tr key={row.index} className={row.current ? 'machine-row machine-row--current' : 'machine-row'}>
                <td className="machine-address">{formatAddress(row.address)}</td>
                <td className="machine-hex">{formatWord(row.machineCode)}</td>
                <td className="machine-assembly">{row.assembly}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {assembleErrors.length > 0 ? (
        <div className="assembler-error-list" role="status">
          {assembleErrors.map((error, index) => (
            <div key={`${error.line}-${error.column}-${index}`} className="assembler-error-item">
              <strong>
                第 {error.line} 行 / 第 {error.column} 列
              </strong>
              <span>{error.message}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="panel-caption">
          表格保留了最常对照的三列：地址、机器码和汇编。二进制只在顶部显示当前机器字，避免整张表横向滚动。
        </p>
      )}
    </section>
  );
});
