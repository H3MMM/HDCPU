import { useCPUStore } from '../../store/cpu-store';

function formatWord(value: number): string {
  return `0x${(value >>> 0).toString(16).padStart(8, '0')}`;
}

function formatChangeValue(value: number): string {
  return `${value | 0} / ${formatWord(value)}`;
}

function getMemoryAccessTypeLabel(type: 'none' | 'read' | 'write'): string {
  switch (type) {
    case 'read':
      return '读取';
    case 'write':
      return '写入';
    default:
      return '无';
  }
}

export function ExecutionInspector() {
  const currentSnapshot = useCPUStore((state) => state.currentSnapshot);
  const currentInstruction = useCPUStore((state) => state.currentInstruction);
  const latestMemoryAccess = useCPUStore((state) => state.latestMemoryAccess);

  const pipelineRegisters = [
    { label: 'PC', value: formatWord(currentSnapshot.pc) },
    { label: '下一 PC', value: formatWord(currentSnapshot.nextPC) },
    { label: 'IR', value: formatWord(currentSnapshot.pipelineRegs.IR) },
    { label: 'MDR', value: formatWord(currentSnapshot.pipelineRegs.MDR) },
    { label: 'A', value: formatWord(currentSnapshot.pipelineRegs.A) },
    { label: 'B', value: formatWord(currentSnapshot.pipelineRegs.B) },
    { label: 'ALUOut', value: formatWord(currentSnapshot.pipelineRegs.ALUOut) },
  ];

  const memoryAccessLabel = latestMemoryAccess.type === 'none'
    ? '最近一个周期没有访存操作。'
    : `${getMemoryAccessTypeLabel(latestMemoryAccess.type)} @ ${formatWord(latestMemoryAccess.address)} = ${formatWord(latestMemoryAccess.data)}`;

  return (
    <section className="panel-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">执行快照</p>
          <h2>执行检查器</h2>
        </div>
        <span className="editor-pill">周期 {currentSnapshot.cycleNumber}</span>
      </div>

      <p className="panel-copy">
        这里适合用来核对“这一步 CPU 内部到底发生了什么”。如果中央画布已经让你看懂了数据流，再来这里确认关键寄存器、ALU 输入输出和访存结果会更直观。
      </p>

      <div className="metric-grid">
        <article className="metric-card">
          <span className="metric-label">当前指令</span>
          <strong>{currentInstruction?.asmString ?? '程序已结束'}</strong>
        </article>
        <article className="metric-card">
          <span className="metric-label">活跃路径</span>
          <strong>{currentSnapshot.activeDataPaths.length}</strong>
        </article>
        <article className="metric-card">
          <span className="metric-label">状态变化</span>
          <strong>{currentSnapshot.changes.length}</strong>
        </article>
      </div>

      <div className="inspector-register-grid">
        {pipelineRegisters.map((registerEntry) => (
          <article key={registerEntry.label} className="inspector-register-card">
            <span className="detail-label">{registerEntry.label}</span>
            <strong className="detail-value">{registerEntry.value}</strong>
          </article>
        ))}
      </div>

      <div className="inspector-panel-grid">
        <article className="signal-intro-card">
          <span className="detail-label">ALU 细节</span>
          <div className="inspector-list">
            <div className="inspector-list-item">
              <span>输入 A</span>
              <strong>{formatWord(currentSnapshot.aluDetail.inputA)}</strong>
            </div>
            <div className="inspector-list-item">
              <span>输入 B</span>
              <strong>{formatWord(currentSnapshot.aluDetail.inputB)}</strong>
            </div>
            <div className="inspector-list-item">
              <span>运算</span>
              <strong>{currentSnapshot.aluDetail.operation}</strong>
            </div>
            <div className="inspector-list-item">
              <span>结果</span>
              <strong>{formatWord(currentSnapshot.aluDetail.result)}</strong>
            </div>
            <div className="inspector-list-item">
              <span>零标志</span>
              <strong>{currentSnapshot.aluDetail.zero ? '1' : '0'}</strong>
            </div>
          </div>
        </article>

        <article className="signal-intro-card">
          <span className="detail-label">最近访存</span>
          <strong className="detail-value inspector-callout">{memoryAccessLabel}</strong>
          <div className="inspector-list">
            <div className="inspector-list-item">
              <span>访问类型</span>
              <strong>{getMemoryAccessTypeLabel(latestMemoryAccess.type)}</strong>
            </div>
            <div className="inspector-list-item">
              <span>地址</span>
              <strong>{formatWord(latestMemoryAccess.address)}</strong>
            </div>
            <div className="inspector-list-item">
              <span>数据</span>
              <strong>{formatWord(latestMemoryAccess.data)}</strong>
            </div>
          </div>
        </article>
      </div>

      <div className="inspector-panel-grid">
        <article className="signal-intro-card">
          <span className="detail-label">最近状态变化</span>
          {currentSnapshot.changes.length > 0 ? (
            <div className="inspector-list">
              {currentSnapshot.changes.map((change) => (
                <div key={`${change.target}-${change.newValue}`} className="inspector-list-item">
                  <span>{change.target}</span>
                  <strong>
                    {formatChangeValue(change.oldValue)} {'->'} {formatChangeValue(change.newValue)}
                  </strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="panel-caption">最近可见快照没有架构状态变化。</p>
          )}
        </article>

        <article className="signal-intro-card">
          <span className="detail-label">活跃数据路径</span>
          {currentSnapshot.activeDataPaths.length > 0 ? (
            <div className="inspector-list">
              {currentSnapshot.activeDataPaths.map((path, index) => (
                <div
                  key={`${path.from}-${path.to}-${path.portFrom}-${path.portTo}-${index}`}
                  className="inspector-list-item"
                >
                  <span>
                    {path.from}.{path.portFrom} {'->'} {path.to}.{path.portTo}
                  </span>
                  <strong>
                    {formatWord(path.value)} / {path.signalType}
                  </strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="panel-caption">当前没有新的数据通路活动。</p>
          )}
        </article>
      </div>
    </section>
  );
}
