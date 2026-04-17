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
          <p className="eyebrow">第 4 天 / 机器码</p>
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
          <span className="metric-label">汇编错误</span>
          <strong>{assembleErrors.length}</strong>
        </article>
      </div>

      <div className="machine-table-shell">
        <table className="machine-table">
          <thead>
            <tr>
              <th>地址</th>
              <th>机器码</th>
              <th>二进制</th>
              <th>汇编</th>
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
                第 {error.line} 行 / 第 {error.column} 列
              </strong>
              <span>{error.message}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="panel-caption">
          机器码列表会随着编辑器内容实时重建，右侧汇编列来自反汇编结果，因此可以直接对照编码、地址和汇编文本是否一致。
        </p>
      )}
    </section>
  );
}
