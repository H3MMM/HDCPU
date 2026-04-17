import { useCPUStore } from '../../store/cpu-store';

function formatWord(value: number): string {
  return `0x${(value >>> 0).toString(16).padStart(8, '0')}`;
}

function formatAddress(value: number): string {
  return `0x${value.toString(16).padStart(4, '0')}`;
}

export function MachineCodeView() {
  const machineCodeRows = useCPUStore((state) => state.machineCodeRows);
  const assembleErrors = useCPUStore((state) => state.assembleErrors);
  const currentInstruction = useCPUStore((state) => state.currentInstruction);
  const currentMachineWord = useCPUStore((state) => state.currentMachineWord);

  return (
    <section className="panel-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Day 4 / Machine Code</p>
          <h2>机器码视图</h2>
        </div>
        <span className="editor-pill">{machineCodeRows.length} words</span>
      </div>

      <div className="machine-summary-grid">
        <article className="metric-card">
          <span className="metric-label">Current Word</span>
          <strong>{currentMachineWord === null ? 'none' : formatWord(currentMachineWord)}</strong>
        </article>
        <article className="metric-card">
          <span className="metric-label">Decoded</span>
          <strong>{currentInstruction?.asmString ?? 'unknown'}</strong>
        </article>
        <article className="metric-card">
          <span className="metric-label">Assembler Errors</span>
          <strong>{assembleErrors.length}</strong>
        </article>
      </div>

      <div className="machine-table-shell">
        <table className="machine-table">
          <thead>
            <tr>
              <th>Address</th>
              <th>Machine Code</th>
              <th>Binary</th>
              <th>Assembly</th>
            </tr>
          </thead>
          <tbody>
            {machineCodeRows.map((row) => (
              <tr key={row.index} className={row.current ? 'machine-row machine-row--current' : 'machine-row'}>
                <td className="machine-address">{formatAddress(row.address)}</td>
                <td className="machine-hex">{formatWord(row.machineCode)}</td>
                <td className="machine-binary">{row.binary}</td>
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
                L{error.line}:C{error.column}
              </strong>
              <span>{error.message}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="panel-caption">
          机器码列表是从当前编辑器内容实时汇编得到的，右侧的汇编列来自反汇编结果，所以能直接核对编码是否符合预期。
        </p>
      )}
    </section>
  );
}
